# Symlink Manager

Symlink Manager adds safe symbolic-link management to the Obsidian File Explorer on desktop. On Windows it can also create directory junctions.

## Using Symlink Manager

Symlink Manager works directly from the **right-click context menus in Obsidian's File Explorer**.

Right-click a folder or empty space in the File Explorer to create a symbolic link or, on Windows, a directory junction.

Right-click a linked folder to access link-specific actions, including viewing its target, opening the target in your system file explorer, and safely removing the link without deleting the target.

## Features## Features

- Create symbolic links from a folder or blank File Explorer space.
- Choose the target with the native folder picker or enter an absolute path manually.
- Optionally create Windows directory junctions.
- Remove a link without deleting its target.
- Show a link target and open it in the system file explorer.
- Visually mark linked folders.
- Prevent name collisions with existing files and folders.
- Friendly handling for filesystem permission errors.

## Current refresh behaviour

After **creating** a symbolic link or junction, Symlink Manager reloads the Obsidian app window so Obsidian fully discovers the newly linked tree. This is currently a workaround while a reliable internal Obsidian refresh mechanism is investigated. **Removing a link does not require or trigger this reload.**

Obsidian may hide duplicate or overlapping linked trees when the same directory or vault is linked into multiple places. Symlink Manager does not attempt to bypass Obsidian's handling of overlapping symlink targets.

## Files outside the vault

This plugin intentionally accesses filesystem paths outside the current vault when you choose a link target. It does so only to create/manage the symbolic link or junction you explicitly request, resolve its target, or open that target in your operating system's file explorer. It does not send file paths or file contents over the network.

## Platform support

Symlink Manager is desktop-only because it uses Node.js and Electron filesystem APIs. Symbolic links are supported on Windows, macOS, and Linux subject to operating-system permissions. Windows users can also choose directory junctions.

On Windows, creating symbolic links may require Developer Mode or elevated permissions. Junctions generally avoid that requirement for directory links.

## Installation

For a manual installation, place `main.js`, `manifest.json`, and `styles.css` from the GitHub release in:

```text
<Vault>/.obsidian/plugins/symlink-manager/
```

Restart or reload Obsidian, then enable **Symlink Manager** under **Settings → Community plugins**.

## Building from source

```bash
npm install
npm run build
```

## Development

Symlink Manager was developed collaboratively with the assistance of ChatGPT. ChatGPT was used for implementation, debugging and documentation, while the plugin was iteratively tested and validated through hands-on use in Obsidian.

## License

MIT.
