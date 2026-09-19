# Changelog

## 1.0.0

First public release, promoted from the tested v6 codebase. Creation currently reloads Obsidian to register the linked tree; removal does not reload.

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
