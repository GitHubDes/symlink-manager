import { App } from "obsidian";

/**
 * Reload Obsidian after an external filesystem link change.
 *
 * Symlinks and junctions created with Node exist outside Obsidian's Vault API.
 * Experiments in v3/v4 could refresh the File Explorer presentation, but did not
 * make a newly linked directory fully participate in Obsidian's vault state.
 * A normal Obsidian reload does, because startup discovers the link naturally.
 *
 * Keep the reload mechanism isolated here so core link-management code does not
 * depend on undocumented reconciliation/watcher internals.
 */
export async function refreshAfterExternalLinkChange(app: App): Promise<void> {
  // app:reload is Obsidian's own Reload app command (the same class of reload as
  // Ctrl+R). Feature-detect it so a changed/older Obsidian build has a fallback.
  const commands = (app as App & {
    commands?: {
      executeCommandById?: (id: string) => boolean;
    };
  }).commands;

  if (typeof commands?.executeCommandById === "function") {
    const executed = commands.executeCommandById("app:reload");
    if (executed) return;
  }

  // Desktop fallback. This still reloads the current Obsidian window/vault and
  // deliberately avoids identifying a vault by its non-unique display name.
  window.location.reload();
}
