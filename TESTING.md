# Symlink Manager 1.1.1 testing

## Automated checks

After installing dependencies with `npm ci`, run:

```bash
npm run check
npm run build
npm test
```

The checks respectively validate TypeScript types, generate `main.js`, and exercise standalone Node filesystem operations. The filesystem test covers directory symbolic links and, on Windows, directory junctions: creation, detection, target resolution, duplicate-name rejection, removal and preservation of target contents. It requires permission to create the relevant links.

The automated test does not exercise the plugin implementation, file symbolic links, broken links, dialogs, context menus, decoration or reload behaviour. The following manual checks cover Obsidian integration; they are a test plan, not a record of a completed test run.

## Root creation

1. Run **Create link in vault root** from the Command Palette and confirm the destination is the vault root.
2. Right-click empty File Explorer space and check whether **Create link here…** is available and targets the root. This depends on Obsidian exposing the root through `file-menu`; use the Command Palette if it is unavailable.

## File-link creation

1. Right-click a folder and choose **Create link here…**.
2. Confirm **Target type** appears first and defaults to **Folder**.
3. Select **File** and confirm Browse opens a file picker rather than a folder picker.
4. Confirm the Windows Junction control is disabled for File targets.
5. Create a file symlink from the picker and confirm Obsidian reloads after creation.
6. Repeat by typing an absolute file path manually.
7. With File selected, enter a folder path; confirm creation is blocked with `Target does not exist or inconsistent type.`
8. With Folder selected, enter a file path; confirm the same validation message.
9. Enter a nonexistent path; confirm the same validation message.
10. Confirm duplicate destination names are still blocked.

## File-link behaviour

1. Confirm the file symlink appears in Obsidian's File Explorer and receives the link decoration.
2. Right-click the linked file and confirm **Show link target**, **Show link target in system folder**, and **Remove link…** appear.
3. Confirm **Create link here…** does not appear on a file.
4. Confirm **Open vault** does not appear on a file link.
5. **Show link target** should report the resolved target file.
6. **Show link target in system folder** should open the operating system file explorer at the target location and reveal/select the target file.
7. Open/edit a linked Markdown file in Obsidian and confirm changes affect the target file. Check other file types separately against the known rendering limitations below.
8. Confirm Obsidian’s own **Open in default app** command opens the linked file with the operating system’s associated application.
9. Remove the link and confirm no reload occurs and the target file remains unchanged.

## Broken-link behaviour

1. Create a link to a disposable test target, then move the target outside Obsidian.
2. If Obsidian still displays the link, confirm **Show link target** reports the missing target.
3. Remove the broken link with **Remove link…** and confirm the moved target remains unchanged.
4. Record if Obsidian hides the broken link, preventing access to its context menu.

## Folder/junction regression

1. Create a directory symbolic link and confirm existing behaviour remains unchanged.
2. On Windows, create a junction and confirm existing behaviour remains unchanged.
3. Confirm folder links still show **Create link here…**, Show/Open/Remove, and the **Open vault** when the target is a detected Obsidian vault.
4. Confirm creation still reloads Obsidian and removal does not.
5. Confirm link decoration works for both linked folders and linked files.
6. Confirm friendly EPERM/EACCES handling still works.

## Linked-vault behaviour

1. Link a directory containing an `.obsidian` folder and confirm **Open vault** appears.
2. Choose **Open vault** and confirm Obsidian opens or focuses the target vault while leaving the current vault open.
3. From the parent vault, open and edit Markdown files inside the linked vault and confirm changes affect the real target files.
4. Confirm files can be created, renamed, moved and copied through the linked tree as normal filesystem content.

## Known Obsidian behaviour

On the tested Windows setup, Markdown file symlinks render normally in Obsidian. Symlinks to some non-Markdown file types (for example PDF or image files) may be recognised by Obsidian but not rendered correctly; **Show link target in system folder** remains the appropriate fallback for locating the real target file.
