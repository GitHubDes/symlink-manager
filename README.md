# Easy Symlinker

Easy Symlinker brings filesystem symbolic links into Obsidian's File Explorer on desktop. Link folders or individual files into a vault, jump directly to another linked Obsidian vault, and manage links without deleting their targets.

## Simple to use

Easy Symlinker is designed to make filesystem links feel like a natural part of Obsidian. You do not need to use the command line or create links manually.

Right-click where you want the link, choose the target file or directory, and Easy Symlinker creates the link and refreshes Obsidian for you. Existing links are managed in the same way: right-click a link to view its target, reveal it in the system file explorer, open a linked vault, or remove the link safely.

The filesystem details and extra commands stay out of the way, while the links themselves remain standard operating-system links.

## Highlights

- **Link Obsidian vaults into a larger workspace.** A linked vault can be used from the parent almost as though it were part of that vault: open and edit its notes, manage its files and folders, and even move files across vault boundaries using Obsidian normally. When you want to work with the linked vault independently, right-click it and choose **Open vault**; Obsidian opens or focuses it while leaving the current vault open.
- **Use symbolic links to Markdown files.** A linked `.md` file behaves like a normal Markdown file in Obsidian in our Windows testing: it opens and renders through the link while the real file remains elsewhere.
- Link complete directories into a vault without copying their contents.
- Create links to either **files or directories** using the native picker or an absolute path.
- Remove a link without deleting the file or directory it points to.
- Reveal linked file targets in the operating system file explorer.
- Visually identify linked items in the File Explorer.

## Using Easy Symlinker

Easy Symlinker works from the **right-click context menus in Obsidian's File Explorer**.

Right-click a folder to create a link. To create at the vault root, use **Create link in vault root** in the Command Palette, or right-click empty File Explorer space if Obsidian exposes the root context menu there. Choose whether the target is a **directory** or a **file**, then select the target or enter its absolute path. On Windows, directory targets can also be created as junctions.

Right-click an existing link for actions appropriate to that link. These include viewing its target, opening the target in the system file explorer, safely removing the link (just the link itself), and **Open vault** when a linked directory is recognised as an Obsidian vault. For a linked file, **Show link target in system folder** reveals the target file in its containing folder.

### Open vault

A directory symlink can point at the root of another Obsidian vault. When Easy Symlinker recognises that target as a vault, **Open vault** appears in the link's context menu.

This provides a simple way to keep links to related vaults in the File Explorer and move between them without first finding the vault in Obsidian's vault switcher. The target is opened or focused by Obsidian. Easy Symlinker does **not** close the vault you are currently using.

More importantly, linking another vault does more than provide a shortcut to it. Once Obsidian accepts the linked tree, **it effectively treats that tree as part of the parent vault's file tree**.

From the parent vault you can open and edit Markdown notes in the linked vault, create files and folders there, rename and delete them, and move or copy files into or out of the linked tree across what would normally be a vault boundary. These operations act on the real target files: the linked vault is not copied into the parent vault.

This allows separately maintained vaults to behave like components of a larger workspace when that is useful, while each linked vault remains physically separate on disk and can still be opened independently with its own Obsidian configuration.

When you want to work with the linked vault as a vault in its own right, right-click the link and choose **Open vault**. Obsidian opens or focuses the target vault without Easy Symlinker closing the parent.

In short: **work with the linked content as part of the parent vault when you want to, and open the same content as its own vault when you want to.**

There are limits to this integration. Obsidian decides how linked and overlapping trees are indexed and displayed, and behaviour can vary by platform and Obsidian version. Easy Symlinker does not merge the two vault configurations or turn them into one physical vault.

### Linked Markdown files

Easy Symlinker can create symbolic links to individual files as well as directories. A particularly useful case is a `.md` file stored elsewhere on the computer but wanted inside an Obsidian vault without maintaining another copy.

In our Windows testing, Obsidian follows symlinks to Markdown files correctly: the linked note opens and renders normally. Editing the note through the link edits the target file because the link and target are the same filesystem content, not copies.

For linked files, Obsidian’s own **Open in default app** command can be used to open the linked file with the operating system’s associated application.

## Obsidian and symlinks: important behaviour

Symbolic links are provided by the operating system, but what Obsidian does with a linked item depends on Obsidian's own file handling. Easy Symlinker creates and manages the filesystem link; it cannot make every Obsidian viewer treat that link in the same way.

The following behaviour has been observed during Windows testing of this release:

| Link                                                  | Observed Obsidian behaviour                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Directory symlink                                     | Works as a linked directory/tree.                                                        |
| Directory junction                                    | Works as a linked directory/tree.                                                        |
| Symlink to `.md` file                                 | Opens and renders normally.                                                              |
| Symlink to PDF/image/other non-Markdown file          | Obsidian may recognise the file type but fail to render the target content.              |
| File link opened with **Show link target in system folder** | The operating system file explorer opens at the target location; for an existing file target, the file is revealed/selected. |
| Symlink to another Obsidian vault                     | Can be opened directly with **Open vault**.                                              |

For example, a symlink named as a PDF may cause Obsidian to start its PDF viewer but display no pages. This does **not** mean the symbolic link is invalid. **Show link target in system folder** can reveal the real target file so it can be opened directly with the operating system if needed. Similar behaviour can occur with images and other non-Markdown resources.

These are Obsidian-side rendering/file-access behaviours rather than different kinds of links created by Easy Symlinker. Behaviour may differ between Obsidian versions and between Windows, macOS and Linux, so non-Windows results are welcome.

### Duplicate and overlapping directory targets

Obsidian may hide duplicate or overlapping linked trees when the same directory or vault is linked into multiple places. Easy Symlinker does not attempt to bypass Obsidian's handling of overlapping symlink targets.

### Syncing vaults containing links

Filesystem links are local to the computer on which they are created. Sync services such as **Obsidian Sync, Google Drive, iCloud and Dropbox generally do not reproduce filesystem links on other devices**.

If a vault containing links is synced to another device, do not assume that the links—or content reached through them—will be available there. Links may need to be recreated separately on each device.

Easy Symlinker does not synchronise or recreate links between devices.

## Refresh behaviour

After **creating** a symbolic link or junction, Easy Symlinker reloads the Obsidian app window so Obsidian fully discovers the newly linked item/tree. This is currently a workaround for Obsidian's vault refresh behaviour. **Removing a link does not require or trigger this reload.**

## Safety

Removing a link removes the link itself, **not its target**. Easy Symlinker also prevents creation where a file or directory with the requested link name already exists.

The plugin intentionally accesses filesystem paths outside the current vault when you choose a link target. It does so only to perform the link operation you requested, resolve/manage the target, open it in the operating system, or open a linked Obsidian vault. It does not send file paths or file contents over the network.

## Platform support

Easy Symlinker is desktop-only because it uses Node.js and Electron filesystem APIs. Symbolic links are supported on Windows, macOS and Linux subject to operating-system permissions. Windows users can also choose directory junctions.

On Windows, creating symbolic links may require Developer Mode or elevated permissions. Junctions generally avoid that requirement.

The behaviour described above has been tested primarily on Windows. File symlink rendering in particular is controlled by Obsidian and may behave differently on macOS or Linux.

## Installation

For a manual installation, place `main.js`, `manifest.json`, and `styles.css` from the GitHub release in:

```text
<Vault>/.obsidian/plugins/symlink-manager/
```

Restart or reload Obsidian, then enable **Easy Symlinker** under **Settings → Community plugins**.

## Building from source

Use Node.js 24 LTS to match the GitHub Actions build environment.

```bash
npm ci
npm run build
```

The build generates a minified production `main.js`, which is not committed to the repository. See [TESTING.md](TESTING.md) for type checking and automated/manual verification, [DESIGN.md](DESIGN.md) for the implementation reference, and [CHANGELOG.md](CHANGELOG.md) for release history.

GitHub Actions runs a clean build on Windows with Node.js 24 for pushes to `main`, pull requests targeting `main`, and manual runs. After a successful run, download the `symlink-manager-<commit SHA>` artifact from the **Actions → Build** run page. It contains `main.js`, `manifest.json`, and `styles.css` and is retained for 30 days for testing and release preparation. GitHub Release assets remain the published distribution; this workflow does not publish or modify releases.

## Development

Easy Symlinker was developed collaboratively with the assistance of ChatGPT. ChatGPT was used for implementation, debugging and documentation, while the plugin was iteratively tested and validated through hands-on use in Obsidian.

## License

MIT.
