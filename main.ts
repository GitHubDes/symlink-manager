import {
  FileSystemAdapter,
  Menu,
  Modal,
  Notice,
  Plugin,
  Setting,
  TAbstractFile,
  TFolder,
  setIcon,
} from "obsidian";
import { promises as fs, lstatSync, readlinkSync, realpathSync, statSync } from "fs";
import * as nodePath from "path";
import { ipcRenderer, shell } from "electron";
import { refreshAfterExternalLinkChange } from "./refresh";

type LinkCreationType = "symlink" | "junction";

interface LinkInfo {
  isLink: boolean;
  target: string | null;
  targetExists: boolean;
  targetIsDirectory: boolean;
  isVault: boolean;
}

class CreateSymlinkModal extends Modal {
  private targetPath = "";
  private linkName = "";
  private linkType: LinkCreationType = "symlink";
  private isDirectory = true;

  constructor(
    private readonly plugin: SymlinkManagerPlugin,
    private readonly destinationVaultPath: string,
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Create link" });

    const where = this.destinationVaultPath || "/";
    contentEl.createEl("p", { text: `Create in: ${where}` });

    new Setting(contentEl)
      .setName("Target type")
      .setDesc("Choose whether the link will point to a folder or a file.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("directory", "Folder")
          .addOption("file", "File")
          .setValue(this.isDirectory ? "directory" : "file")
          .onChange((value) => {
            this.isDirectory = value === "directory";
            this.targetPath = "";
            this.linkName = "";
            if (!this.isDirectory) this.linkType = "symlink";
            this.render();
          });
      });

    new Setting(contentEl)
      .setName(this.isDirectory ? "Target folder" : "Target file")
      .setDesc(`Choose a ${this.isDirectory ? "folder" : "file"}, or enter its absolute filesystem path.`)
      .addText((text) => {
        text.inputEl.addClass("symlink-manager-target-input");
        text.setPlaceholder(this.isDirectory ? "C:\\path\\to\\folder or /home/user/folder" : "C:\\path\\to\\file.ext or /home/user/file.ext");
        text.setValue(this.targetPath);
        text.onChange((value) => this.setTargetPath(value.trim(), false));
      })
      .addButton((button) => {
        const kind = this.isDirectory ? "folder" : "file";
        button.setButtonText("Browse…").setTooltip(`Choose target ${kind}`).onClick(async () => {
          try {
            // `dialog` is a main-process Electron API. Obsidian exposes it to
            // desktop plugins through @electron/remote (with electron.remote as
            // a compatibility fallback on older desktop builds).
            let remote: any;
            try {
              remote = require("@electron/remote");
            } catch {
              remote = require("electron").remote;
            }
            if (!remote?.dialog?.showOpenDialog) {
              throw new Error("Electron remote dialog API is unavailable");
            }
            const result = await remote.dialog.showOpenDialog(remote.getCurrentWindow?.(), {
              title: `Choose target ${kind}`,
              defaultPath: this.targetPath || undefined,
              properties: [this.isDirectory ? "openDirectory" : "openFile"],
            });
            if (result.canceled || result.filePaths.length === 0) return;
            const selectedPath = result.filePaths[0];
            if (!selectedPath) return;
            this.setTargetPath(selectedPath, true);
          } catch (error) {
            this.plugin.reportError(`Could not open ${kind} picker`, error);
          }
        });
      });

    const nameSetting = new Setting(contentEl)
      .setName("Link name")
      .setDesc("Name shown inside the current vault.");

    nameSetting.addText((text) => {
      text.inputEl.addClass("symlink-manager-name-input");
      text.setPlaceholder(this.isDirectory ? "Folder name" : "File name");
      text.setValue(this.linkName);
      text.onChange((value) => {
        this.linkName = value.trim();
      });
    });

    if (process.platform === "win32") {
      new Setting(contentEl)
        .setName("Windows link type")
        .setDesc(this.isDirectory
          ? "Junctions usually do not require Developer Mode. Symbolic links are more portable."
          : "Junctions are available only for folders.")
        .addDropdown((dropdown) => {
          dropdown
            .addOption("symlink", "Symbolic link")
            .addOption("junction", "Junction")
            .setValue(this.isDirectory ? this.linkType : "symlink")
            .setDisabled(!this.isDirectory)
            .onChange((value) => {
              this.linkType = value as LinkCreationType;
            });
        });
    }

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Cancel").onClick(() => this.close());
      })
      .addButton((button) => {
        button
          .setButtonText("Create")
          .setCta()
          .onClick(async () => {
            try {
              await this.plugin.createLink(
                this.destinationVaultPath,
                this.targetPath,
                this.linkName,
                this.linkType,
                this.isDirectory,
              );
              this.close();
            } catch (error) {
              this.plugin.reportError("Could not create link", error);
            }
          });
      });
  }

  private setTargetPath(value: string, fromPicker: boolean): void {
    this.targetPath = value.trim();
    const targetInput = this.contentEl.querySelector<HTMLInputElement>(".symlink-manager-target-input");
    if (targetInput && targetInput.value !== this.targetPath) targetInput.value = this.targetPath;
    const trimmed = this.targetPath.replace(/[\\/]+$/, "");
    if (trimmed && (fromPicker || !this.linkName)) {
      this.linkName = nodePath.basename(trimmed);
      this.refreshNameInput();
    }
  }

  private refreshNameInput(): void {
    const input = this.contentEl.querySelector<HTMLInputElement>(".symlink-manager-name-input");
    if (input && document.activeElement !== input) input.value = this.linkName;
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class TargetInfoModal extends Modal {
  constructor(
    app: SymlinkManagerPlugin["app"],
    private readonly linkVaultPath: string,
    private readonly targetPath: string,
    private readonly targetExists: boolean,
    private readonly isVault: boolean,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Link target" });
    contentEl.createEl("p", { text: `Link: ${this.linkVaultPath}` });
    contentEl.createEl("p", { text: "Target:" });
    contentEl.createEl("div", { text: this.targetPath, cls: "symlink-manager-target-path" });
    contentEl.createEl("p", { text: `Target exists: ${this.targetExists ? "Yes" : "No"}` });
    contentEl.createEl("p", { text: `Obsidian vault: ${this.isVault ? "Yes" : "No"}` });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class ConfirmRemoveModal extends Modal {
  constructor(
    private readonly plugin: SymlinkManagerPlugin,
    private readonly vaultPath: string,
    private readonly targetPath: string,
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: `Remove link “${nodePath.basename(this.vaultPath)}”?` });
    contentEl.createEl("p", {
      text: "Only the filesystem link will be removed. The target will not be changed.",
      cls: "symlink-manager-warning",
    });
    contentEl.createEl("p", { text: "Target:" });
    contentEl.createEl("div", { text: this.targetPath, cls: "symlink-manager-target-path" });

    new Setting(contentEl)
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((button) => {
        button
          .setButtonText("Remove link")
          .setWarning()
          .onClick(async () => {
            try {
              await this.plugin.removeLink(this.vaultPath);
              this.close();
            } catch (error) {
              this.plugin.reportError("Could not remove link", error);
            }
          });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export default class SymlinkManagerPlugin extends Plugin {
  private observer: MutationObserver | null = null;
  private decorateTimer: number | null = null;

  async onload(): Promise<void> {
    if (!(this.app.vault.adapter instanceof FileSystemAdapter)) {
      new Notice("Easy Symlinker requires Obsidian Desktop with a filesystem-backed vault.");
      return;
    }

    this.addCommand({
      id: "create-symlink-vault-root",
      name: "Create link in vault root",
      callback: () => new CreateSymlinkModal(this, "").open(),
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        this.addFileMenuItems(menu, file);
      }),
    );

    this.app.workspace.onLayoutReady(() => this.startExplorerDecoration());
  }

  onunload(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.decorateTimer !== null) window.clearTimeout(this.decorateTimer);
    document.querySelectorAll(".symlink-manager-link-badge").forEach((el) => el.remove());
  }

  private addFileMenuItems(menu: Menu, file: TAbstractFile): void {
    if (file instanceof TFolder) {
      menu.addSeparator();
      menu.addItem((item) => {
        item
          .setTitle("Create link here…")
          .setIcon("folder-symlink")
          .onClick(() => new CreateSymlinkModal(this, file.path).open());
      });
    }

    const info = this.getLinkInfoSync(file.path);
    if (!info.isLink || !info.target) return;

    if (!(file instanceof TFolder)) menu.addSeparator();

    menu.addItem((item) => {
      item
        .setTitle("Show link target")
        .setIcon("info")
        .onClick(() => {
          const current = this.getLinkInfoSync(file.path);
          if (!current.isLink || !current.target) {
            new Notice("The selected path is no longer a link.");
            return;
          }
          new TargetInfoModal(this.app, file.path, current.target, current.targetExists, current.isVault).open();
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("Show link target in system folder")
        .setIcon("folder-open")
        .onClick(async () => {
          const current = await this.getLinkInfo(file.path);
          if (!current.isLink || !current.target) {
            new Notice("The selected path is no longer a link.");
            return;
          }
          if (current.targetIsDirectory) {
            const error = await shell.openPath(current.target);
            if (error) new Notice(`Could not open target: ${error}`);
          } else if (current.targetExists) {
            shell.showItemInFolder(current.target);
          } else {
            const error = await shell.openPath(nodePath.dirname(current.target));
            if (error) new Notice(`Could not open target location: ${error}`);
          }
        });
    });

    if (info.targetIsDirectory && info.isVault) {
      menu.addItem((item) => {
        item
          .setTitle("Open vault")
          .setIcon("vault")
          .onClick(() => {
            ipcRenderer.sendSync("vault-open", info.target, false);
          });
      });
    }

    menu.addItem((item) => {
      item
        .setTitle("Remove link…")
        .setIcon("unlink")
        .onClick(() => new ConfirmRemoveModal(this, file.path, info.target!).open());
    });
  }


  async createLink(
    destinationVaultPath: string,
    rawTargetPath: string,
    rawLinkName: string,
    linkType: LinkCreationType,
    isDirectory: boolean,
  ): Promise<void> {
    const targetPath = this.normaliseExternalPath(rawTargetPath);
    const linkName = rawLinkName.trim();
    const invalidTarget = "Target does not exist or inconsistent type.";

    if (!targetPath || !nodePath.isAbsolute(targetPath)) throw new Error(invalidTarget);
    if (!linkName) throw new Error("Enter a link name.");
    if (linkName === "." || linkName === ".." || /[\\/]/.test(linkName)) {
      throw new Error("Link name must be a single name.");
    }
    let targetStat;
    try {
      targetStat = await fs.stat(targetPath);
    } catch {
      throw new Error(invalidTarget);
    }
    if ((isDirectory && !targetStat.isDirectory()) || (!isDirectory && !targetStat.isFile())) {
      throw new Error(invalidTarget);
    }

    const parentAbsolute = this.absoluteVaultPath(destinationVaultPath);
    const linkAbsolute = nodePath.join(parentAbsolute, linkName);
    if (await this.pathExists(linkAbsolute)) {
      throw new Error("An item with that name already exists in this folder.");
    }

    try {
      const symlinkType = linkType === "junction" ? "junction" : (isDirectory ? "dir" : "file");
      await fs.symlink(targetPath, linkAbsolute, symlinkType);
    } catch (error) {
      if (this.errorCode(error) === "EEXIST") {
        throw new Error("An item with that name already exists in this folder.");
      }
      throw error;
    }

    new Notice(`Created ${linkType === "junction" ? "junction" : "symbolic link"} “${linkName}”. Reloading vault…`);
    await refreshAfterExternalLinkChange(this.app);
  }

  async removeLink(vaultPath: string): Promise<void> {
    const info = await this.getLinkInfo(vaultPath);
    if (!info.isLink) {
      throw new Error("The selected path is no longer a recognised filesystem link. Nothing was removed.");
    }

    await fs.unlink(this.absoluteVaultPath(vaultPath));
    new Notice(`Removed link “${nodePath.basename(vaultPath)}”.`);
  }

  reportError(prefix: string, error: unknown): void {
    console.error("Easy Symlinker:", prefix, error);
    const code = this.errorCode(error);
    if (code === "EPERM" || code === "EACCES") {
      const message = process.platform === "win32"
        ? "Permission denied. For symbolic links on Windows, enable Developer Mode or run with sufficient privileges; junctions usually do not require Developer Mode."
        : "Permission denied. Check that you have permission to create or remove items in this folder and to access the target.";
      new Notice(`${prefix}: ${message}`, 10000);
      return;
    }
    const detail = error instanceof Error ? error.message : String(error);
    new Notice(`${prefix}: ${detail}`, 8000);
  }

  private errorCode(error: unknown): string | null {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: unknown }).code;
      return typeof code === "string" ? code : null;
    }
    return null;
  }

  private getAdapter(): FileSystemAdapter {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) throw new Error("Filesystem adapter unavailable.");
    return adapter;
  }

  private absoluteVaultPath(vaultPath: string): string {
    const adapter = this.getAdapter();
    return vaultPath ? adapter.getFullPath(vaultPath) : adapter.getBasePath();
  }

  private emptyLinkInfo(): LinkInfo {
    return { isLink: false, target: null, targetExists: false, targetIsDirectory: false, isVault: false };
  }

  private getLinkInfoSync(vaultPath: string): LinkInfo {
    try {
      const absoluteLink = this.absoluteVaultPath(vaultPath);
      const stat = lstatSync(absoluteLink);
      if (!stat.isSymbolicLink()) return this.emptyLinkInfo();

      let target: string;
      try {
        target = realpathSync(absoluteLink);
      } catch {
        const rawTarget = readlinkSync(absoluteLink);
        target = nodePath.resolve(nodePath.dirname(absoluteLink), rawTarget);
      }

      let targetExists = false;
      let targetIsDirectory = false;
      let isVault = false;
      try {
        const targetStat = statSync(target);
        targetExists = true;
        targetIsDirectory = targetStat.isDirectory();
        if (targetIsDirectory) {
          try {
            isVault = statSync(nodePath.join(target, ".obsidian")).isDirectory();
          } catch {
            isVault = false;
          }
        }
      } catch {
        // Broken/inaccessible target is still a link.
      }
      return { isLink: true, target, targetExists, targetIsDirectory, isVault };
    } catch {
      return this.emptyLinkInfo();
    }
  }

  private async getLinkInfo(vaultPath: string): Promise<LinkInfo> {
    const absoluteLink = this.absoluteVaultPath(vaultPath);
    try {
      const stat = await fs.lstat(absoluteLink);
      if (!stat.isSymbolicLink()) return this.emptyLinkInfo();

      let target: string;
      try {
        target = await fs.realpath(absoluteLink);
      } catch {
        const rawTarget = await fs.readlink(absoluteLink);
        target = nodePath.resolve(nodePath.dirname(absoluteLink), rawTarget);
      }

      let targetExists = false;
      let targetIsDirectory = false;
      let isVault = false;
      try {
        const targetStat = await fs.stat(target);
        targetExists = true;
        targetIsDirectory = targetStat.isDirectory();
        if (targetIsDirectory) {
          try {
            isVault = (await fs.stat(nodePath.join(target, ".obsidian"))).isDirectory();
          } catch {
            isVault = false;
          }
        }
      } catch {
        // Broken/inaccessible target is still a link.
      }
      return { isLink: true, target, targetExists, targetIsDirectory, isVault };
    } catch (error) {
      if (this.errorCode(error) === "ENOENT") return this.emptyLinkInfo();
      throw error;
    }
  }

  private async pathExists(absolutePath: string): Promise<boolean> {
    try {
      await fs.lstat(absolutePath);
      return true;
    } catch (error) {
      if (this.errorCode(error) === "ENOENT") return false;
      throw error;
    }
  }

  private normaliseExternalPath(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return nodePath.normalize(trimmed.replace(/^(["'])(.*)\1$/, "$2"));
  }

  private startExplorerDecoration(): void {
    this.decorateVisibleLinks();
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => this.scheduleDecoration());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.register(() => this.observer?.disconnect());
  }

  private scheduleDecoration(): void {
    if (this.decorateTimer !== null) window.clearTimeout(this.decorateTimer);
    this.decorateTimer = window.setTimeout(() => {
      this.decorateTimer = null;
      this.decorateVisibleLinks();
    }, 120);
  }

  private decorateVisibleLinks(): void {
    const titles = document.querySelectorAll<HTMLElement>(
      '.workspace-leaf-content[data-type="file-explorer"] .nav-folder-title[data-path], ' +
      '.workspace-leaf-content[data-type="file-explorer"] .nav-file-title[data-path]',
    );

    for (const title of titles) {
      const vaultPath = title.dataset.path;
      if (!vaultPath) continue;

      const existing = title.querySelector<HTMLElement>(".symlink-manager-link-badge");
      const link = this.getLinkInfoSync(vaultPath).isLink;
      if (!link) {
        existing?.remove();
        continue;
      }

      if (existing) continue;
      const badge = document.createElement("span");
      badge.addClass("symlink-manager-link-badge");
      badge.setAttribute("aria-label", "Filesystem link");
      setIcon(badge, "link-2");
      const titleContent = title.querySelector<HTMLElement>(".nav-file-title-content, .nav-folder-title-content");
      (titleContent ?? title).appendChild(badge);
    }
  }
}
