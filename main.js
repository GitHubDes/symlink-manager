"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const fs_1 = require("fs");
const nodePath = __importStar(require("path"));
const electron_1 = require("electron");
async function refreshAfterExternalLinkChange(app) {
    const commands = app.commands;
    if (typeof (commands === null || commands === void 0 ? void 0 : commands.executeCommandById) === "function") {
        const executed = commands.executeCommandById("app:reload");
        if (executed)
            return;
    }
    window.location.reload();
}
class CreateSymlinkModal extends obsidian_1.Modal {
    constructor(plugin, destinationVaultPath) {
        super(plugin.app);
        this.plugin = plugin;
        this.destinationVaultPath = destinationVaultPath;
        this.targetPath = "";
        this.linkName = "";
        this.linkType = "symlink";
        this.isDirectory = true;
    }
    onOpen() {
        this.render();
    }
    render() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Create link" });
        const where = this.destinationVaultPath || "/";
        contentEl.createEl("p", { text: `Create in: ${where}` });
        new obsidian_1.Setting(contentEl)
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
                if (!this.isDirectory)
                    this.linkType = "symlink";
                this.render();
            });
        });
        new obsidian_1.Setting(contentEl)
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
                var _a, _b;
                try {
                    // `dialog` is a main-process Electron API. Obsidian exposes it to
                    // desktop plugins through @electron/remote (with electron.remote as
                    // a compatibility fallback on older desktop builds).
                    let remote;
                    try {
                        remote = require("@electron/remote");
                    }
                    catch {
                        remote = require("electron").remote;
                    }
                    if (!((_a = remote === null || remote === void 0 ? void 0 : remote.dialog) === null || _a === void 0 ? void 0 : _a.showOpenDialog)) {
                        throw new Error("Electron remote dialog API is unavailable");
                    }
                    const result = await remote.dialog.showOpenDialog((_b = remote.getCurrentWindow) === null || _b === void 0 ? void 0 : _b.call(remote), {
                        title: `Choose target ${kind}`,
                        defaultPath: this.targetPath || undefined,
                        properties: [this.isDirectory ? "openDirectory" : "openFile"],
                    });
                    if (result.canceled || result.filePaths.length === 0)
                        return;
                    this.setTargetPath(result.filePaths[0], true);
                }
                catch (error) {
                    this.plugin.reportError(`Could not open ${kind} picker`, error);
                }
            });
        });
        const nameSetting = new obsidian_1.Setting(contentEl)
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
            new obsidian_1.Setting(contentEl)
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
                    this.linkType = value;
                });
            });
        }
        new obsidian_1.Setting(contentEl)
            .addButton((button) => {
            button.setButtonText("Cancel").onClick(() => this.close());
        })
            .addButton((button) => {
            button
                .setButtonText("Create")
                .setCta()
                .onClick(async () => {
                try {
                    await this.plugin.createLink(this.destinationVaultPath, this.targetPath, this.linkName, this.linkType, this.isDirectory);
                    this.close();
                }
                catch (error) {
                    this.plugin.reportError("Could not create link", error);
                }
            });
        });
    }
    setTargetPath(value, fromPicker) {
        this.targetPath = value.trim();
        const targetInput = this.contentEl.querySelector(".symlink-manager-target-input");
        if (targetInput && targetInput.value !== this.targetPath)
            targetInput.value = this.targetPath;
        const trimmed = this.targetPath.replace(/[\\/]+$/, "");
        if (trimmed && (fromPicker || !this.linkName)) {
            this.linkName = nodePath.basename(trimmed);
            this.refreshNameInput();
        }
    }
    refreshNameInput() {
        const input = this.contentEl.querySelector(".symlink-manager-name-input");
        if (input && document.activeElement !== input)
            input.value = this.linkName;
    }
    onClose() {
        this.contentEl.empty();
    }
}
class TargetInfoModal extends obsidian_1.Modal {
    constructor(app, linkVaultPath, targetPath, targetExists, isVault) {
        super(app);
        this.linkVaultPath = linkVaultPath;
        this.targetPath = targetPath;
        this.targetExists = targetExists;
        this.isVault = isVault;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Link target" });
        contentEl.createEl("p", { text: `Link: ${this.linkVaultPath}` });
        contentEl.createEl("p", { text: "Target:" });
        contentEl.createEl("div", { text: this.targetPath, cls: "symlink-manager-target-path" });
        contentEl.createEl("p", { text: `Target exists: ${this.targetExists ? "Yes" : "No"}` });
        contentEl.createEl("p", { text: `Obsidian vault: ${this.isVault ? "Yes" : "No"}` });
    }
    onClose() {
        this.contentEl.empty();
    }
}
class ConfirmRemoveModal extends obsidian_1.Modal {
    constructor(plugin, vaultPath, targetPath) {
        super(plugin.app);
        this.plugin = plugin;
        this.vaultPath = vaultPath;
        this.targetPath = targetPath;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: `Remove link “${nodePath.basename(this.vaultPath)}”?` });
        contentEl.createEl("p", {
            text: "Only the filesystem link will be removed. The target will not be changed.",
            cls: "symlink-manager-warning",
        });
        contentEl.createEl("p", { text: "Target:" });
        contentEl.createEl("div", { text: this.targetPath, cls: "symlink-manager-target-path" });
        new obsidian_1.Setting(contentEl)
            .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
            .addButton((button) => {
            button
                .setButtonText("Remove link")
                .setWarning()
                .onClick(async () => {
                try {
                    await this.plugin.removeLink(this.vaultPath);
                    this.close();
                }
                catch (error) {
                    this.plugin.reportError("Could not remove link", error);
                }
            });
        });
    }
    onClose() {
        this.contentEl.empty();
    }
}
class SymlinkManagerPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.observer = null;
        this.decorateTimer = null;
    }
    async onload() {
        if (!(this.app.vault.adapter instanceof obsidian_1.FileSystemAdapter)) {
            new obsidian_1.Notice("Symlink Manager requires Obsidian Desktop with a filesystem-backed vault.");
            return;
        }
        this.addCommand({
            id: "create-symlink-vault-root",
            name: "Create link in vault root",
            callback: () => new CreateSymlinkModal(this, "").open(),
        });
        this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
            this.addFileMenuItems(menu, file);
        }));
        this.app.workspace.onLayoutReady(() => this.startExplorerDecoration());
    }
    onunload() {
        var _a;
        (_a = this.observer) === null || _a === void 0 ? void 0 : _a.disconnect();
        this.observer = null;
        if (this.decorateTimer !== null)
            window.clearTimeout(this.decorateTimer);
        document.querySelectorAll(".symlink-manager-link-badge").forEach((el) => el.remove());
    }
    addFileMenuItems(menu, file) {
        if (file instanceof obsidian_1.TFolder) {
            menu.addSeparator();
            menu.addItem((item) => {
                item
                    .setTitle("Create link here…")
                    .setIcon("folder-symlink")
                    .onClick(() => new CreateSymlinkModal(this, file.path).open());
            });
        }
        const info = this.getLinkInfoSync(file.path);
        if (!info.isLink || !info.target)
            return;
        if (!(file instanceof obsidian_1.TFolder))
            menu.addSeparator();
        menu.addItem((item) => {
            item
                .setTitle("Show link target")
                .setIcon("info")
                .onClick(() => {
                const current = this.getLinkInfoSync(file.path);
                if (!current.isLink || !current.target) {
                    new obsidian_1.Notice("The selected path is no longer a link.");
                    return;
                }
                const displayTarget = this.targetDirectoryForMenu(current);
                new TargetInfoModal(this.app, file.path, displayTarget, current.targetExists, current.isVault).open();
            });
        });
        if (info.targetIsDirectory) {
            menu.addItem((item) => {
                item
                    .setTitle("Open target in system explorer")
                    .setIcon("folder-open")
                    .onClick(async () => {
                    const current = await this.getLinkInfo(file.path);
                    if (!current.isLink || !current.target) {
                        new obsidian_1.Notice("The selected path is no longer a link.");
                        return;
                    }
                    const directory = this.targetDirectoryForMenu(current);
                    const error = await electron_1.shell.openPath(directory);
                    if (error)
                        new obsidian_1.Notice(`Could not open target: ${error}`);
                });
            });
        }
        if (info.targetIsDirectory && info.isVault) {
            menu.addItem((item) => {
                item
                    .setTitle("Open vault")
                    .setIcon("vault")
                    .onClick(() => {
                    electron_1.ipcRenderer.sendSync("vault-open", info.target, false);
                });
            });
        }
        menu.addItem((item) => {
            item
                .setTitle("Remove link…")
                .setIcon("unlink")
                .onClick(() => new ConfirmRemoveModal(this, file.path, info.target).open());
        });
    }
    targetDirectoryForMenu(info) {
        if (!info.target)
            return "";
        return info.targetIsDirectory ? info.target : nodePath.dirname(info.target);
    }
    async createLink(destinationVaultPath, rawTargetPath, rawLinkName, linkType, isDirectory) {
        const targetPath = this.normaliseExternalPath(rawTargetPath);
        const linkName = rawLinkName.trim();
        const invalidTarget = "Target does not exist or inconsistent type.";
        if (!targetPath || !nodePath.isAbsolute(targetPath))
            throw new Error(invalidTarget);
        if (!linkName)
            throw new Error("Enter a link name.");
        if (linkName === "." || linkName === ".." || /[\\/]/.test(linkName)) {
            throw new Error("Link name must be a single name.");
        }
        let targetStat;
        try {
            targetStat = await fs_1.promises.stat(targetPath);
        }
        catch {
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
            await fs_1.promises.symlink(targetPath, linkAbsolute, symlinkType);
        }
        catch (error) {
            if (this.errorCode(error) === "EEXIST") {
                throw new Error("An item with that name already exists in this folder.");
            }
            throw error;
        }
        new obsidian_1.Notice(`Created ${linkType === "junction" ? "junction" : "symbolic link"} “${linkName}”. Reloading vault…`);
        await refreshAfterExternalLinkChange(this.app);
    }
    async removeLink(vaultPath) {
        const info = await this.getLinkInfo(vaultPath);
        if (!info.isLink) {
            throw new Error("The selected path is no longer a recognised filesystem link. Nothing was removed.");
        }
        await fs_1.promises.unlink(this.absoluteVaultPath(vaultPath));
        new obsidian_1.Notice(`Removed link “${nodePath.basename(vaultPath)}”.`);
    }
    reportError(prefix, error) {
        console.error("Symlink Manager:", prefix, error);
        const code = this.errorCode(error);
        if (code === "EPERM" || code === "EACCES") {
            const message = process.platform === "win32"
                ? "Permission denied. For symbolic links on Windows, enable Developer Mode or run with sufficient privileges; junctions usually do not require Developer Mode."
                : "Permission denied. Check that you have permission to create or remove items in this folder and to access the target.";
            new obsidian_1.Notice(`${prefix}: ${message}`, 10000);
            return;
        }
        const detail = error instanceof Error ? error.message : String(error);
        new obsidian_1.Notice(`${prefix}: ${detail}`, 8000);
    }
    errorCode(error) {
        if (typeof error === "object" && error !== null && "code" in error) {
            const code = error.code;
            return typeof code === "string" ? code : null;
        }
        return null;
    }
    getAdapter() {
        const adapter = this.app.vault.adapter;
        if (!(adapter instanceof obsidian_1.FileSystemAdapter))
            throw new Error("Filesystem adapter unavailable.");
        return adapter;
    }
    absoluteVaultPath(vaultPath) {
        const adapter = this.getAdapter();
        return vaultPath ? adapter.getFullPath(vaultPath) : adapter.getBasePath();
    }
    emptyLinkInfo() {
        return { isLink: false, target: null, targetExists: false, targetIsDirectory: false, isVault: false };
    }
    getLinkInfoSync(vaultPath) {
        try {
            const absoluteLink = this.absoluteVaultPath(vaultPath);
            const stat = (0, fs_1.lstatSync)(absoluteLink);
            if (!stat.isSymbolicLink())
                return this.emptyLinkInfo();
            let target;
            try {
                target = (0, fs_1.realpathSync)(absoluteLink);
            }
            catch {
                const rawTarget = (0, fs_1.readlinkSync)(absoluteLink);
                target = nodePath.resolve(nodePath.dirname(absoluteLink), rawTarget);
            }
            let targetExists = false;
            let targetIsDirectory = false;
            let isVault = false;
            try {
                const targetStat = (0, fs_1.statSync)(target);
                targetExists = true;
                targetIsDirectory = targetStat.isDirectory();
                if (targetIsDirectory) {
                    try {
                        isVault = (0, fs_1.statSync)(nodePath.join(target, ".obsidian")).isDirectory();
                    }
                    catch {
                        isVault = false;
                    }
                }
            }
            catch {
                // Broken/inaccessible target is still a link.
            }
            return { isLink: true, target, targetExists, targetIsDirectory, isVault };
        }
        catch {
            return this.emptyLinkInfo();
        }
    }
    async getLinkInfo(vaultPath) {
        const absoluteLink = this.absoluteVaultPath(vaultPath);
        try {
            const stat = await fs_1.promises.lstat(absoluteLink);
            if (!stat.isSymbolicLink())
                return this.emptyLinkInfo();
            let target;
            try {
                target = await fs_1.promises.realpath(absoluteLink);
            }
            catch {
                const rawTarget = await fs_1.promises.readlink(absoluteLink);
                target = nodePath.resolve(nodePath.dirname(absoluteLink), rawTarget);
            }
            let targetExists = false;
            let targetIsDirectory = false;
            let isVault = false;
            try {
                const targetStat = await fs_1.promises.stat(target);
                targetExists = true;
                targetIsDirectory = targetStat.isDirectory();
                if (targetIsDirectory) {
                    try {
                        isVault = (await fs_1.promises.stat(nodePath.join(target, ".obsidian"))).isDirectory();
                    }
                    catch {
                        isVault = false;
                    }
                }
            }
            catch {
                // Broken/inaccessible target is still a link.
            }
            return { isLink: true, target, targetExists, targetIsDirectory, isVault };
        }
        catch (error) {
            if (this.errorCode(error) === "ENOENT")
                return this.emptyLinkInfo();
            throw error;
        }
    }
    async pathExists(absolutePath) {
        try {
            await fs_1.promises.lstat(absolutePath);
            return true;
        }
        catch (error) {
            if (this.errorCode(error) === "ENOENT")
                return false;
            throw error;
        }
    }
    normaliseExternalPath(value) {
        const trimmed = value.trim();
        if (!trimmed)
            return "";
        return nodePath.normalize(trimmed.replace(/^(["'])(.*)\1$/, "$2"));
    }
    startExplorerDecoration() {
        var _a;
        this.decorateVisibleLinks();
        (_a = this.observer) === null || _a === void 0 ? void 0 : _a.disconnect();
        this.observer = new MutationObserver(() => this.scheduleDecoration());
        this.observer.observe(document.body, { childList: true, subtree: true });
        this.register(() => { var _a; return (_a = this.observer) === null || _a === void 0 ? void 0 : _a.disconnect(); });
    }
    scheduleDecoration() {
        if (this.decorateTimer !== null)
            window.clearTimeout(this.decorateTimer);
        this.decorateTimer = window.setTimeout(() => {
            this.decorateTimer = null;
            this.decorateVisibleLinks();
        }, 120);
    }
    decorateVisibleLinks() {
        const titles = document.querySelectorAll('.workspace-leaf-content[data-type="file-explorer"] .nav-folder-title[data-path], ' +
            '.workspace-leaf-content[data-type="file-explorer"] .nav-file-title[data-path]');
        for (const title of titles) {
            const vaultPath = title.dataset.path;
            if (!vaultPath)
                continue;
            const existing = title.querySelector(".symlink-manager-link-badge");
            const link = this.getLinkInfoSync(vaultPath).isLink;
            if (!link) {
                existing === null || existing === void 0 ? void 0 : existing.remove();
                continue;
            }
            if (existing)
                continue;
            const badge = document.createElement("span");
            badge.addClass("symlink-manager-link-badge");
            badge.setAttribute("aria-label", "Filesystem link");
            (0, obsidian_1.setIcon)(badge, "link-2");
            const titleContent = title.querySelector(".nav-file-title-content, .nav-folder-title-content");
            (titleContent !== null && titleContent !== void 0 ? titleContent : title).appendChild(badge);
        }
    }
}
exports.default = SymlinkManagerPlugin;
