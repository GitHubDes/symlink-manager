# Changelog

## 1.1.1

- Renamed the system-folder action to **Show link target in system folder** for clearer intent.
- Linked file targets are revealed/selected in the operating system file manager.
- Documented that Obsidian's own **Open in default app** works for linked files.
- Added TypeScript/build metadata and a dependency lock file for reproducible review and release preparation.

## 1.1.0

- Added symbolic links to individual files as well as directories.
- Added a Folder/File target selector with native folder and file pickers.
- Added **Open vault** for linked directories that are detected as Obsidian vaults; Obsidian opens or focuses the target vault and leaves the current vault open.
- Added **Show link target in system folder** for linked files, revealing the real target file in its containing folder.
- Improved link detection, File Explorer decoration and refresh behaviour.
- Windows junction creation remains directory-only.
- Expanded README documentation for linked-vault workflows, Markdown file symlinks and known Obsidian behaviour.


## 1.0.0

First public release, promoted from the tested v6 codebase. Creation currently reloads Obsidian to register the linked tree; removal does not reload.

## Development background

Before 1.0.0, refresh experiments using Obsidian reconciliation and watcher internals did not fully integrate newly linked trees. Reloading after creation proved reliable and remains the current workaround; removal does not reload.

Native target selection uses Electron's remote dialog API, with a compatibility fallback. File-link support later extended the shared creation, inspection and decoration paths.

Detailed experimental notes remain available in Git history. Current behaviour is described in [DESIGN.md](DESIGN.md), with verification steps and automated coverage in [TESTING.md](TESTING.md).
