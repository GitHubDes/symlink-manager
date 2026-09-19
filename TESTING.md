# Symlink Manager v5 testing

## Primary test — linked-tree participation

1. Install v5 and reload Obsidian once.
2. Create a symbolic link to a folder containing several Markdown files and subfolders.
3. Confirm Obsidian reloads automatically after creation.
4. Confirm the new linked folder appears without manual intervention.
5. Open notes inside the linked folder from File Explorer.
6. Search for text/tags contained only in the linked folder.
7. Modify/add/delete a file in the target folder outside Obsidian and confirm Obsidian notices normally.
8. Repeat with a Windows junction.
9. Repeat with both a symlink and junction present together.

## Removal

1. Use Remove link on a symlink and on a junction.
2. Confirm Obsidian reloads automatically.
3. Confirm the link disappears and the target folder/content remains untouched.

## Regression

- Show link target.
- Open target in system explorer.
- Link decoration.
- Vault detection.
- Duplicate-name rejection.
- Friendly EPERM/EACCES handling.
