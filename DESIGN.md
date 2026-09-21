# Obsidian Symlink Manager — Design Reference

## Project status

This document describes the design as of release **1.1.0**. The shipped implementation supports directory symbolic links, file symbolic links, Windows directory junctions, and opening detected linked Obsidian vaults.


Early design specification for a small Obsidian desktop plugin.

The plugin's purpose is deliberately narrow: make filesystem symbolic
links easy to create, recognise and safely manage from Obsidian's File
Explorer. It is not intended to become a multi-vault indexing or
navigation system. Once a symlink exists, Obsidian should do the normal
work of browsing, searching, linking and editing the files exposed
through it.

The filesystem remains the source of truth. The plugin should not
maintain its own database of symlinks.

## Core design principles

-   Keep the first version small.
-   Use ordinary filesystem symbolic links.
-   Allow links to any directory, not only Obsidian vaults.
-   Integrate primarily with the Obsidian File Explorer context menu.
-   Do not duplicate functionality that Obsidian already provides.
-   Detect the current filesystem state when an operation is performed
    rather than relying on cached plugin state.
-   Prefer supported Obsidian APIs. Where a small amount of File
    Explorer DOM integration is necessary, isolate it so UI changes do
    not break the core filesystem functionality.
-   Desktop only. Symlink creation and inspection depend on desktop
    filesystem access.

## Primary workflow

### Create a symlink inside a folder

When the user right-clicks an ordinary folder in Obsidian's File
Explorer, offer:

**Create link here…**

Selecting it opens a small creation dialog containing:

-   **Target** --- select the directory to be linked, preferably with
    the operating system's folder picker.
-   **Name** --- the name of the symlink that will appear in Obsidian.

The Name field should default to the target directory's existing name
but remain editable.

The symlink is created inside the folder that was right-clicked.

Example:

``` text
Target:
D:\Documents\Genealogy\Bandoo

Name:
Bandoo Research
```

If `Research` was right-clicked in the current vault, the result is
conceptually:

``` text
Current Vault/
└── Research/
    └── Bandoo Research -> D:\Documents\Genealogy\Bandoo
```

The target may be any directory. It does not need to be an Obsidian
vault.

### Create a symlink at the vault root

When the user right-clicks empty space in the File Explorer, offer:

**Create link here…**

In this context, "here" means the current vault root.

The same creation dialog is used: choose a target directory and
optionally change the default link name.

This is the preferred root-level interaction because the File Explorer
does not display the vault root as an ordinary folder row.

A Command Palette action may also be exposed as a fallback/convenience:

**Symlinks: Create symlink in vault root**

This also allows hotkey or Commander integration without adding another
custom UI.

## Visual identification of symlinks

Symlinked folders should be visually distinguishable from ordinary
folders in the File Explorer.

The preferred presentation is to retain the normal folder appearance
while adding a small link indicator.

Conceptually:

``` text
📁 Research
📁🔗 Arthur's Seat
📁 Finance
📁🔗 Genealogy
```

The exact icon treatment can be refined during implementation.

The visual decoration is not authoritative state. It is only a visual
signal. The plugin should determine whether a path is currently a
symlink from the filesystem when commands are invoked.

A shared helper such as `isSymlink(path)` should underpin both
decoration and context-menu behaviour.

On desktop Node.js, this can be based on `lstat()` /
`lstat().isSymbolicLink()`, which inspects the link itself rather than
following the target.

## Symlink context menu

When a user right-clicks a recognised linked directory or file, offer the actions appropriate to that link type.

Initial menu:

-   **Create link here…**
-   **Show link target**
-   **Open target in system explorer**
-   **Remove link…**
-   **Open vault** --- only when simple vault detection succeeds

`Create symlink here...` remains valid on a symlinked folder: the
destination is the directory represented by that folder.

### Show symlink target

Display useful information about the selected link, for example:

``` text
Linked folder:
Research/Bandoo

Target:
D:\Documents\Genealogy\Bandoo

Type:
Directory symbolic link

Target exists:
Yes

Obsidian vault:
No
```

The first version need not become an elaborate properties system; the
important information is the target path and whether it exists.

### Open targets

Directory targets can be revealed/opened in the operating system file manager. File targets can be opened with their operating-system default application.

### Remove symlink

This command must appear only for an entry that is currently detected as
a symbolic link.

Before removal, check the filesystem again. If the path is no longer a
symbolic link, abort rather than deleting anything.

The confirmation should make the operation unambiguous, for example:

> **Remove symlink "Arthur's Seat"?**
>
> This removes only the symbolic link. The target folder and its
> contents will not be changed.

Removal must operate on the link itself and must never perform recursive
deletion of the target.

Obsidian's normal Delete currently removes a directory symlink itself on
the tested Windows setup, but its generic folder-deletion warning is
alarming because it can sound as though the target contents will be
deleted. The plugin's dedicated removal command exists primarily to make
the operation explicit and reassuring.

## Delete safety design objective

Investigate whether Obsidian's normal Delete action can be cleanly
intercepted, suppressed, disabled or replaced when the selected entry is
a symbolic link.

Preferred behaviour, if achievable through a reliable mechanism:

-   Ordinary folders retain Obsidian's normal Delete.
-   Symlinks do not present the generic Delete action, or the action is
    replaced with the plugin's symlink-specific removal flow.

There is currently no known supported pre-delete hook that allows a
plugin simply to cancel Obsidian's normal delete operation before it
occurs.

This is therefore a **design objective, not a v1 dependency**.

Do not make the core plugin brittle merely to achieve it. If
accomplishing this requires unsafe monkey-patching or fragile dependence
on Obsidian internals, leave Obsidian's Delete untouched and retain the
explicit **Remove link…** command.

## Vault detection

Keep vault detection deliberately simple in the first version.

Given a symlink target:

``` text
<target>/
```

if this exists:

``` text
<target>/.obsidian/
```

treat the target as an Obsidian vault.

No attempt should initially be made to detect custom Obsidian
configuration-directory names, scan Obsidian's vault registry, or handle
unusual vault configurations.

Simple rule:

``` text
if target/.obsidian is a directory:
    target is treated as an Obsidian vault
else:
    target is an ordinary linked directory
```

### Open vault

If a linked directory target passes the simple `.obsidian` test, add **Open vault** to its context menu. The implemented desktop action asks Obsidian to open or focus the target vault and deliberately leaves the current vault open.

This supports the useful workflow of having an overview vault containing
symlinks to several independent vaults: work globally through the
overview vault, then jump into an individual vault when isolated vault
behaviour or searches are desired.

## File Explorer integration

### Folder context menu

Use Obsidian's normal file/folder context-menu facilities where
supported.

An ordinary folder should gain:

**Create link here…**

A symlinked folder gains the symlink-specific commands described above.

### Empty File Explorer space

The desired interaction is:

Right-click empty File Explorer space -\> **Create link here…** -\>
create in vault root.

Obsidian itself already provides a context menu in this area. Existing
community plugins demonstrate that root/empty-area context-menu
behaviour is technically possible, although this may require limited
DOM/File Explorer integration rather than only the normal documented
`file-menu` API.

Treat this integration as UI glue. Failure of the decoration or
empty-area integration after an Obsidian UI change should not endanger
existing symlinks or core filesystem operations.

### Visual decoration

There does not appear to be a dedicated public "folder tree item is
being rendered" hook specifically for symlink decoration.

The likely implementation is:

1.  Observe File Explorer entries as they appear/change.
2.  Map displayed entries to vault-relative filesystem paths.
3.  Use filesystem `lstat()` to determine whether each entry is a
    symbolic link.
4.  Add/remove a plugin-specific CSS class or link indicator.

Avoid maintaining a persistent list of symlinks.

## Filesystem behaviour

### Cross-platform target

Initial target platforms:

-   Windows
-   Linux
-   macOS

Use ordinary directory symbolic links on all three unless testing
reveals a compelling reason not to.

Windows directory junctions were considered but are not required for the
initial design. Using one conceptual mechanism across platforms is
preferable.

### Windows

Windows directory symlinks may be affected by the user's permissions or
Developer Mode configuration. This should be tested and failures should
produce a useful error rather than attempting a different destructive
operation.

Do not silently fall back to copying the directory.

### Linux and macOS

Use normal filesystem symbolic links.

## What the plugin deliberately does not do

The initial plugin should **not**:

-   Maintain a database/list of symlinks as authoritative state.
-   Copy or synchronise linked directories.
-   Reimplement Obsidian search.
-   Build a cross-vault index.
-   Invent plugin-specific cross-vault link syntax.
-   Manage note duplication.
-   Replace Obsidian's normal file operations.
-   Require linked directories to be Obsidian vaults.
-   Add complex vault discovery.
-   Support Windows junctions unless later evidence justifies them.
-   Attempt clever custom `.obsidian` folder detection in v1.
-   Depend on unsupported deletion interception for basic safety.

## Why this plugin exists

The motivating workflow uses an "overview" Obsidian vault containing
filesystem symlinks to other vaults/directories.

This already provides substantial functionality naturally:

-   linked folders appear as part of the overview vault;
-   Obsidian can browse and search their Markdown files;
-   files can be moved/copied through the overview structure;
-   normal Obsidian links can work while operating from the overview
    vault;
-   individual vaults can still be opened separately for vault-scoped
    searches and behaviour.

The plugin is therefore not trying to replace filesystem symlinks with
an abstraction. It is intended to make **symlinks themselves first-class
and understandable in Obsidian's File Explorer**.

The useful additions are:

-   easy creation;
-   obvious visual identification;
-   target inspection;
-   safe, explicit link removal;
-   opening the target in the system file manager;
-   convenient "Open vault" when the target is plainly an Obsidian
    vault.

## Implemented feature set

The current 1.1.0 release provides:

1.  **Create link here…** on folder context menus.
2.  **Create link here…** on empty File Explorer space, targeting
    vault root.
3.  Folder/file target selection with native target picker.
4.  Link name defaulting from the selected target.
5.  Visual link indicator for recognised linked folders and files.
6.  **Show link target**.
7.  **Open target in system explorer**.
8.  **Remove link…**, with immediate filesystem verification and
    explicit safe wording.
9.  Simple `.obsidian` vault detection.
10. **Open vault** for detected linked-vault targets.
11. Optional Command Palette root-create command.
12. Delete interception/suppression investigated as a non-blocking
    design objective.

## Implementation priorities

When implementation begins, prove the risky or Obsidian-specific pieces
before polishing the dialog:

1.  Confirm reliable folder-context-menu integration.
2.  Confirm empty File Explorer area/root context-menu integration.
3.  Confirm symlink detection for File Explorer entries on Windows.
4.  Confirm safe creation and removal of directory symlinks.
5.  Confirm visual decoration can be isolated cleanly.
6.  Confirm how best to open/switch to a detected vault.
7.  Test the same filesystem operations on Linux and macOS before
    claiming full cross-platform support.
8.  Investigate, but do not depend upon, suppression/replacement of
    Obsidian's generic Delete action for symlinks.

## Safety invariants

These rules should remain true regardless of later features:

-   The filesystem is authoritative.
-   Never recursively delete a symlink target.
-   Immediately before **Remove link…**, verify that the path itself
    is still a symbolic link.
-   If verification fails, abort.
-   Never convert a failed symlink operation into a copy/move operation.
-   UI decoration must never be treated as proof that an entry is a
    symlink.
-   Core symlink operations should remain functional even if File
    Explorer DOM decoration breaks after an Obsidian update.

## Future possibilities

Only consider these after the small v1 is working:

-   Improve/delete-menu integration if a clean mechanism is found.
-   Additional visual styles for broken symlinks.
-   Detect and indicate missing targets.
-   More robust vault detection.
-   Additional linked-vault behaviours where they solve a demonstrated need.
-   Settings only where real user needs emerge.

Avoid adding features merely because they are possible.
