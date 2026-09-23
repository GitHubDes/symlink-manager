# Symlink Manager — Design Reference

## Project status

This document describes release **1.1.1**. Symlink Manager is a desktop-only Obsidian plugin for creating, recognising and managing file and directory symbolic links, Windows directory junctions, and linked Obsidian vaults.

The filesystem is the source of truth. The plugin keeps no database of links. Obsidian handles browsing, indexing and editing the content exposed through those links.

## Creation workflow

Right-click a folder and choose **Create link here…**. The dialog contains:

- **Target type**: Folder or File, defaulting to Folder. Changing it clears the target and link name.
- **Target folder / Target file**: an absolute path or a native picker opened with **Browse…**.
- **Link name**: defaults from the selected target and remains editable.
- **Windows link type**: Symbolic link or Junction. Junctions are available only for folders.

The link is created inside the selected folder, including when that folder is itself a link. The target does not need to be an Obsidian vault.

The Command Palette command **Create link in vault root** opens the same dialog at the vault root. The documented empty-space context-menu workflow depends on Obsidian exposing the root through its `file-menu` event; the plugin has no separate empty-space DOM handler. Verify this integration in the running Obsidian version.

Creation validates that the target exists and matches the chosen file/folder type, that the link name is a single name, and that the destination does not already exist. It then uses Node's `fs.symlink()` with the selected link type. Failed operations report an error rather than copying content.

## Link context menu

Recognised links receive these actions:

- **Show link target**: displays the link path, resolved target, target existence and whether the target is an Obsidian vault.
- **Show link target in system folder**: opens directory targets, reveals existing file targets, or opens the containing folder for a missing target.
- **Remove link…**: opens a confirmation dialog and removes the link after checking it again.
- **Open vault**: available only for a linked directory containing an `.obsidian` directory.

Folders also receive **Create link here…**. Ordinary files receive no plugin actions.

Link inspection uses `lstat()` to inspect the link itself and `realpath()` to resolve its target. If resolution fails, `readlink()` provides the target path so a broken link can still be recognised.

## Removal and safety

The confirmation states: **Only the filesystem link will be removed. The target will not be changed.**

Before removal, the plugin checks that the selected path is still a symbolic link, then calls `fs.unlink()`. It does not recursively delete the target. If the check no longer identifies a link, removal is refused.

The plugin leaves Obsidian's normal Delete action untouched. Replacing or suppressing that action remains a future design objective, conditional on a reliable integration mechanism.

Safety requirements for future changes:

- Keep the filesystem authoritative; decoration is only a visual hint.
- Check the selected path before removing a link.
- Never recursively delete a link target.
- Never convert a failed link operation into a copy or move.
- Keep core filesystem operations independent of Explorer decoration.

## Linked vaults

Vault detection checks only whether the target directory contains an `.obsidian` directory. Custom configuration-directory names and registry-based discovery are not supported.

**Open vault** uses Electron's internal `vault-open` IPC channel with the target path and leaves the current vault open. This integration requires verification when Obsidian changes.

Once Obsidian accepts a linked tree, operations through the parent vault act on the real target files. The plugin does not merge vault configurations or build a separate cross-vault index. Obsidian controls duplicate/overlapping-tree handling and file rendering; see [README.md](README.md) for observed limitations.

## Explorer decoration

The plugin adds a link badge to recognised file and folder titles using Obsidian's File Explorer DOM structure. A `MutationObserver` watches document child-list changes and schedules decoration with a 120 ms debounce.

Each decoration pass checks matching Explorer rows synchronously against the filesystem. The DOM selectors and synchronous filesystem work are maintenance considerations, particularly for large vaults or slow targets. No persistent link cache is maintained.

## Refresh behaviour

After successful creation, `refresh.ts` invokes Obsidian's `app:reload` command, falling back to `window.location.reload()` if the command is unavailable. Reloading lets Obsidian discover the newly linked content through its startup scan.

Earlier reconciliation and watcher experiments did not fully integrate newly linked trees. Creation therefore retains the reload workaround. Removing a link does not reload the window.

## Platforms and permissions

The plugin uses Node.js and Electron APIs and requires a filesystem-backed desktop vault. It supports ordinary file and directory symbolic links on Windows, macOS and Linux; Windows also offers directory junctions.

Windows symbolic links may require Developer Mode or elevated permissions. Permission errors receive a platform-specific explanation. Testing has primarily been on Windows; cross-platform behaviour and Obsidian integration still require platform-specific verification.

## Source and build layout

- `main.ts`: dialogs, context menus, filesystem operations and Explorer decoration.
- `refresh.ts`: the creation-time reload mechanism.
- `styles.css`: link badges and dialog styling.
- `build.mjs`: transpiles and combines the TypeScript sources into `main.js`.
- `test-link-ops.mjs`: standalone directory-link filesystem checks.

`npm run check` performs TypeScript checking separately from `npm run build`. The generated `main.js` is ignored by Git. `esbuild.config.mjs` is a legacy configuration and is not used by the current build script.

See [TESTING.md](TESTING.md) for automated coverage and manual integration checks, and [CHANGELOG.md](CHANGELOG.md) for release history.

## Future possibilities

- Replace the creation-time reload if a reliable refresh mechanism becomes available.
- Improve Delete-menu integration through a reliable mechanism.
- Add distinct visual treatment for broken links; target inspection already reports missing targets.
- Extend vault detection where demonstrated needs justify it.
- Add settings or linked-vault features only where they address concrete workflows.
