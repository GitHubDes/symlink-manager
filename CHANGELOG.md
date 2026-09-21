# Changelog

## development-v8 — Go to vault

- Enable **Go to vault** for directory links whose target contains an Obsidian `.obsidian` directory.
- Ask Obsidian to open/focus the target vault using its desktop `vault-open` IPC mechanism. The current vault is left open; Symlink Manager does not manage vault-window closure.

## 1.0.0

First public release, promoted from the tested v6 codebase. Creation currently reloads Obsidian to register the linked tree; removal does not reload.

## development-v7 — file symlink support

Extend the existing shared link-creation path so Symlink Manager can create symbolic links to individual files as well as directories. The two existing creation entry points — right-clicking a folder and right-clicking empty File Explorer space — should continue to use the same creation UI and common creation function.

### Creation UI

- Add a **Target type** choice as the first field in the creation dialog: **Folder** or **File**.
- This value is passed into the common creation function (working name `isDirectory`; equivalent to the proposed `isDir` boolean).
- The **Browse** button must respect the selected target type: Folder opens the native folder picker; File opens the native file picker.
- If the target type is changed after a target has already been selected, clear the existing target so a target of the wrong type cannot be retained accidentally.
- Windows **junction** creation remains directory-only. When File is selected, the junction option should be disabled rather than hidden, making the restriction explicit while keeping the dialog layout stable.

### Common creation path

Generalise `createDirectoryLink(...)` to a common `createLink(...)` function along these lines:

```ts
async createLink(
    destinationVaultPath: string,
    rawTargetPath: string,
    rawLinkName: string,
    linkType: LinkCreationType,
    isDirectory: boolean,
): Promise<void>
```

Validate the selected target type against the filesystem: a Folder selection must resolve to a directory and a File selection must resolve to a file. For symbolic links, pass `dir` or `file` to `fs.symlink()` according to `isDirectory`; junctions continue to use `junction` and are valid only for directories.

This should extend the existing creation architecture rather than introduce a separate file-link implementation.

# Changes for v3

## Primary fix under test — File Explorer refresh

The remaining v2 show-stopper is that a successfully created symlink or junction can exist on disk without appearing immediately in Obsidian's File Explorer.

v3 isolates all refresh/reconciliation behaviour in `refresh.ts`. Core link creation/removal calls only `refreshExplorerAfterExternalChange(app, path)`, so experiments with undocumented Obsidian internals do not pollute the link-management code.

The v3 refresh strategy is:

1. For a newly created directory link, try Obsidian's internal `reconcileFolderCreation()` path first. This is intended to register a newly discovered folder and its contents.
2. Verify that Obsidian now knows the path with `vault.getAbstractFileByPath()`.
3. If necessary, fall back to `reconcileFile(path)` using only the new path. v2 passed the same path as both new and old path, which may have made the operation effectively a no-op.
4. If still necessary, reconcile the containing directory and verify again.
5. If all targeted methods fail, log the failure but do not automatically reload the whole vault/app. A same-vault unload/reload remains a possible last-resort experiment because it could disturb workspace or plugin state.

The filesystem creation remains successful even if Obsidian does not immediately register the new link.

## TODO — Go to Vault

The disabled **Go to vault (coming later)** item remains deferred. A future implementation must identify the target by physical path rather than vault name, because vault names are not unique. It must not write into the target and must work with read-only targets.

## v4 — linked-tree integration

- v3 fixed immediate File Explorer appearance after link creation.
- v4 extends the encapsulated refresh layer so a newly-created linked directory is recursively populated into Obsidian and then registered with Obsidian's recursive desktop watcher (`watchHiddenRecursive`) when that internal helper is available.
- The core link-management code remains unchanged; undocumented Obsidian integration stays isolated in `refresh.ts`.
- Goal: files and subfolders beneath a newly-created symlink/junction should participate in normal Obsidian refresh, metadata, search/indexing and filesystem change handling without restarting the vault.

## v4 test result / v5 direction

### Linked-tree participation remains the blocker

v4 successfully refreshes the File Explorer after link creation, but testing confirms that the newly introduced symlink/junction tree still does **not** fully participate in the running Obsidian vault. Recursive reconciliation and watcher registration were therefore insufficient to make an externally introduced linked tree behave like content discovered during normal vault startup.

### v5 objective: reload/reopen the current vault

Stop adding increasingly complex reconciliation tricks. The next experiment should use the behaviour already known to work: after successful link creation, make Obsidian rediscover the link through its normal vault startup/loading path.

The preferred implementation is to reload/reopen the **current vault**, using its real vault identity/path (not merely the display name, because vault names are not unique). This should be encapsulated inside `refresh.ts` so the link-management code remains unaffected.

Target sequence:

1. Create the symlink or junction successfully.
2. Preserve/identify the current vault by stable identity/path.
3. Trigger a reload/reopen of that same vault.
4. Allow Obsidian's normal startup scan to discover and register the linked tree.
5. Verify that the linked tree participates normally (Explorer, opening/editing notes, metadata/search, and subsequent filesystem changes).

A full application restart should not be the intended mechanism if the same-vault reload can achieve the required rescan.

## v5 implementation

- Removed the v3/v4 reconciliation and recursive-watcher experiments from `refresh.ts`.
- After a successful create or remove, v5 now invokes Obsidian's own `app:reload` command so the current vault is rediscovered by the normal startup path.
- If that command is unavailable, `window.location.reload()` is used as the desktop fallback.
- The reload does not select a vault by display name, so duplicate vault names are not involved.
- The reload implementation remains encapsulated in `refresh.ts`.
- Primary v5 test: after creation/reload, the linked tree must participate normally in Explorer updates, metadata/search and external filesystem changes.

## v5 test result — passed

- Automatic reload after link creation works and causes the linked symlink/junction tree to participate normally in Obsidian.
- Reloading is therefore the deliberate v5 refresh mechanism, replacing the unsuccessful v3/v4 reconciliation and watcher experiments.
- Testing also exposed Obsidian's own duplicate/overlapping-link behaviour: when the same vault/directory is linked into multiple places, or link targets overlap, Obsidian may hide/suppress later duplicate linked trees. This is not a Symlink Manager refresh failure and should not be worked around by the plugin.

## v6 candidate — native target-folder picker

Add a **Browse…** button beside the target-path field in the Create Link dialog.

- Use the desktop/Electron native folder-selection dialog so the user can choose the target directory instead of typing or pasting its path.
- Keep the existing editable target-path field; manual entry remains supported and provides a fallback on platforms where the native picker is unavailable or problematic.
- After selection, populate the target-path field with the chosen directory's absolute path.
- Populate the link-name field from the selected directory basename when appropriate, while still allowing the user to edit the link name.
- This is a UI-only enhancement. It must not change the now-proven link creation, junction/symlink handling, collision protection, removal, decoration, or reload/refresh behaviour.



## v6 implementation

- Added a native **Browse…** button beside the target-directory field.
- The picker selects directories only and writes the absolute selected path into the existing editable field.
- Selecting a folder proposes its basename as the link name; the user can still edit the name.
- Manual path entry remains available.
- Existing symlink/junction creation, safety checks, removal, decoration and reload behaviour are unchanged.
- Version advanced to 0.6.0.
- JavaScript syntax check and existing filesystem link safety tests pass. The native picker itself requires testing inside Obsidian/Electron.

### v6 folder-picker correction

Initial v6 testing showed **Could not open folder picker**. The first implementation imported `dialog` directly from `electron`, but Electron's `dialog` is a main-process API and is not directly exposed that way in Obsidian's plugin renderer. The picker now obtains the native dialog through `@electron/remote`, with `electron.remote` retained as a compatibility fallback for older Obsidian desktop builds. The working v5 link/reload code is unchanged.

### v6 correction — reload only after creation

Corrected an unintended v6 behaviour: removing a symlink/junction no longer reloads Obsidian. The reload is required only after **creation**, where it is currently used as a workaround to make Obsidian fully discover and participate in the newly linked tree. A cleaner internal refresh mechanism remains a future investigation.

- On Create, validate the manually editable target path against the selected target type. If the target does not exist or its filesystem type does not match the File/Folder selection, show: `Target does not exist or inconsistent type.`

### File-link context-menu behaviour

For existing file symlinks, link-specific context-menu actions should behave as follows:

- **Remove link…** requires no special file/directory handling and remains unchanged.
- **Show link target** must know whether the target is a file or directory. For a file target, show the directory containing the target file; for a directory target, retain the existing behaviour.
- **Open target in system explorer** opens the target directory. For a file link, open the directory containing the target file; for a directory link, open the target directory itself.
- **Go to vault** does not appear for file links, because a file is not a vault directory.
- For existing links, determine file/directory status from the actual filesystem target rather than relying on creation-time state.


### Additional file-symlink integration changes

- Generalise the Obsidian `file-menu` handler so link-management actions are available for symlinked files as well as `TFolder` objects. Ordinary files should not gain folder-only **Create link here…** behaviour.
- Extend File Explorer link decoration to recognise both folder titles and file titles, so symlinked files receive the same link badge/indicator as symlinked folders.
- Generalise `LinkInfo` so target existence is independent of target type. An existing file target must report `targetExists: true`; track whether the target is a directory separately for menu/action behaviour.
- Make removal confirmation wording target-neutral. Use wording such as: **Only the filesystem link will be removed. The target will not be changed.**
- Remove or dynamically adapt directory-only creation wording such as **Target directory**, **single folder name**, and **Folder name** when File is selected.
- Extend testing for file symlinks: creation using both Browse and a manually typed path; opening the linked file normally in Obsidian; Show link target; Open target in system explorer; Remove link; link decoration; broken/missing target handling; duplicate-name rejection; inconsistent File/Folder target validation; and confirmation that Windows Junction is unavailable for File targets.
- Verify during implementation/testing that Obsidian exposes a filesystem symlink-to-file as a normal file object through the `file-menu` event. Treat this as an implementation assumption to confirm rather than silently relying on it.

## v7 implementation — file symbolic links

Implemented the planned file-symlink support in the v7 development build:

- Creation now uses one `createLink(...)` path for directory and file symbolic links.
- The creation modal starts with a Folder/File target-type selector.
- Browse uses the native folder picker for folders and native file picker for files.
- Manually entered targets are checked against the selected type; nonexistent or mismatched targets use the single message `Target does not exist or inconsistent type.`
- Windows junctions remain directory-only and are disabled when File is selected.
- The File Explorer context-menu handler now considers files as well as folders. Ordinary files receive no plugin items; recognised file symlinks receive Show/Remove actions.
- File-link Show displays the directory containing the target file. Open target in system explorer uses the same directory resolution and opens that directory.
- Go to vault remains directory-only.
- Link metadata now distinguishes target existence from whether the target is a directory.
- File Explorer decoration now scans both folder and file rows.
- Removal confirmation wording is neutral for files and directories; removal itself remains unchanged and does not reload Obsidian.
- The filesystem test script now exercises file-symlink creation, detection, resolution, duplicate-name failure, removal, and preservation of the target file.
- `TESTING.md` now contains the manual v7 file-link and regression test plan.

Implementation-time verification still required in Obsidian: confirm that a filesystem symlink to a file is surfaced as a normal file object through the `file-menu` event and participates normally after the existing create-time reload.

### v7 Windows test polish

- Link decoration is appended to the file/folder title-content element rather than the whole File Explorer row, so a file link badge does not displace Obsidian's file-type indicator.
- Windows testing confirmed that file symlinks are created with the correct target extension. Obsidian on Windows renders Markdown file symlinks normally; rendering of other linked file types such as PDF/JPG is controlled by Obsidian and may differ by platform. The filesystem links themselves remain usable, including via the system default application.
- **Open target in system explorer:** restored for both directory and file links using one directory-based path. Directory targets open directly; file targets use their containing directory. No file-specific Explorer branch is required.


- Final v8 UI wording: renamed the vault action from `Go to vault` to `Open vault`.
