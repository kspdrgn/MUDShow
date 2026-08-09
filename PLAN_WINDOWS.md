# Window Host Plan

## Purpose

- Define one host-managed window shell for the whole app.
- Support built-in app windows and hosted plugin windows through the same surface.
- Keep the host responsible for layout, focus, dismissal, stacking, and window lifetime.
- Make it possible to promote a window from in-app presentation to a separate app window later.

## Core Idea

- The shell is the only thing that knows how a window is presented.
- Window content stays separate from window chrome, so the host can swap the presentation without rewriting the content.
- A window can live inside the app window first, then later move into its own window and back again.
- Built-in app windows and plugin windows both flow through the same host API, but they are identified differently.
- Windows have a presentation mode:
  - modal windows block outside interaction and use a backdrop
  - MDI windows do not use a backdrop and do not block outside interaction
- Windows can also have host behavior flags:
  - `canPopOut` controls whether they can move to a separate native window
  - `canMoveInApp` controls whether they can be dragged around while they remain in the app
- Built-in app windows are allowed to exist in either presentation mode, but the current built-in defaults are non-modal MDI behavior for the dummy test surface and modal behavior for true dialog surfaces.

## Implementation Shape

- Add one window host manager at the app root, similar in spirit to the existing context-menu shell.
- Keep host state centralized so only one overlay stack is responsible for focus, escape, backdrop clicks, and z-order.
- Represent each window as a host-owned record with an id, kind, title, placement, close behavior, and content payload.
- Let the host provide a consistent titlebar with a drag handle and a standard close button in the upper right.
- Treat the titlebar as the drag surface for both in-app and popped-out windows.
- Let built-in windows provide content through typed host adapters instead of owning their own overlay chrome.
- Keep the shell responsible for the visual frame, while the built-in window components become mostly forms, messages, and button rows.
- Use the root app shell to render the window host once, then feed it app-owned and tab-owned window records from state.
- Keep the context menu shell above hosted windows in z-order so menus always win.
- Bring a clicked MDI window to the front by reordering the host stack.

## Window Host State

- Track whether a window is open.
- Track window kind: built-in app window or hosted plugin window.
- Track which built-in window interface is active.
- Track the window title and any header actions.
- Track whether the window is modal or non-modal.
- Track whether the window can be dismissed by backdrop click or Escape when it is modal.
- Track whether the window is pinned in-app or popped out to a separate window.
- Track whether the window may pop out at all.
- Track whether the window may be moved while it is still inside the app window.
- Track the window position and size.
- Track whether the current position is clamped to the app content area or free to move as a separate window.
- Track enough payload to restore the same window content after a pop out or pop in.
- Track whether the window is currently active so a click can raise it above other MDI windows.

## Window Kinds

- Built-in app window: owned by the app, backed by app state, and rendered through the shell.
- Hosted plugin window: requested by a plugin, rendered through the shell, and constrained by the host contract.
- The host should expose the kind so styling, permissions, and lifecycle rules can differ where needed.

## Built-In App Windows

- Character editor window.
- World editor window.
- Logging control window.
- Close-world confirmation window.
- Close-app confirmation window.
- Notice / alert window.
- World list delete confirmation window.
- A dummy app-level window is currently used as the first MDI and pop-out test surface.

## Host Responsibilities

- Create, show, hide, activate, and close window sessions.
- Own the window overlay, backdrop, stacking order, escape handling, focus trap, titlebar drag behavior, and close button placement.
- Clamp in-app window dragging to the app surface so a window cannot be moved outside the visible app area when it is allowed to move.
- Allow popped-out windows to move freely without app-surface clamping when pop-out is enabled.
- Support pop out and pop in for window content.
- Preserve user state when a window changes form or presentation.
- Provide a stable host surface for both app-owned and plugin-owned content.
- Let built-in window content be simplified to content-only components.
- Route all window open requests through a single host entry point so future plugin windows do not bypass app rules.
- Keep the shell mount point outside the tab flow so it can overlay both settings and play screens consistently.
- Render a native OS window for popped-out content without custom title chrome or OS window-frame overrides.
- Leave the native OS buttons alone when a window is popped out.
- Add a small host-rendered pop-in button anchored to the top right of the popped-out window area.
- Leave native OS keyboard shortcuts and other minimize behaviors alone.

## Built-In Migration Plan

- Start with the simplest built-in window surfaces that already behave like dialogs.
- Migrate notice, confirmation, and logging windows first so the shell proves the overlay, close, and keyboard behavior.
- Migrate world and character editors next, once the shell can carry form state cleanly.
- Migrate delete-confirm overlays that currently live inside list components so they become host-owned window records.
- Leave the content components free of backdrop, absolute positioning, and window-shape styling once migrated.
- Built-in app windows should default to `canPopOut = false` and `canMoveInApp = false`.
- Windows that are modal should set backdrop dismissal and outside input blocking on; windows that are not modal should not.
- The current dummy window test surface uses `canPopOut = true`, `canMoveInApp = true`, and non-modal behavior.
- Pop-outable windows should show a second titlebar button with an arrow glyph in the upper right.

## Plugin Surface

- Plugins should request a window host surface by name and content id.
- Plugins should declare whether a window may pop out to its own window.
- Plugins should declare whether a window is modal or non-modal.
- Plugins should not control native window layout directly.
- The host should keep plugin windows inside the same lifecycle as built-in windows.
- Plugin windows should follow the same close, escape, and focus rules as app windows unless the host explicitly relaxes them.

## Suggested First Cut

- Add a reusable window shell component to the host UI.
- Move the simplest built-in window interfaces into that shell one by one.
- Simplify the built-in window components so they render only their content and actions, not the overlay chrome.
- Keep the first pass limited to built-in app windows so the host contract is stable before plugin integration.
- Add the plugin-facing window contract after the built-in path is proven.
- Use the dummy window as the first end-to-end test for MDI and pop-out behavior.

## Shell API Draft

- `openWindow(kind, payload, options)` should request a window session.
- `closeWindow(id)` should dismiss the active window.
- `updateWindow(id, patch)` should let the host replace title, content state, or window mode.
- `popOutWindow(id)` should move a window into a separate window without losing state.
- `popInWindow(id)` should bring a popped-out window back into the app shell.
- `moveWindow(id, position)` should update the window location, with the host clamping in-app placement when `canMoveInApp` is true and leaving popped-out placement free.
- `activateWindow(id)` should bring a window to the front inside the host stack.
- The host should be able to answer whether a given window is built-in or plugin-hosted.

## Relationship To Other Plans

- `PLAN_CHANNELS.md` defines the top channel bar.
- `PLAN_SIDE_CHANNELS.md` defines the side-mounted list system.
- `PLAN_TAPS.md` should map Taps editors such as Description, Morph, and CInfo to modal or non-modal windows.

## TODO Checklist

- [x] Inventory the built-in modal surfaces that still bypass the shared host.
- [x] Confirm the shared host already supports modal, pop-out, and pop-in behavior.
- [x] Decide the migration parameters for built-in modal windows: `isModal = yes`, `canPopOut = false`, `canMoveInApp = false`, no resize affordance.
- [x] Migrate the notice / alert window onto the shared host.
  - [x] Update [NoticeModal.svelte](C:\_\_projects\MUDShow\frontend\src\lib\components\window\NoticeModal.svelte) to render content only.
  - [x] Add a host-backed notice window record and open/close path in [App.svelte](C:\_\_projects\MUDShow\frontend\src\App.svelte).
- [x] Migrate the close-world confirmation window onto the shared host.
  - [x] Update [ConfirmCloseTabModal.svelte](C:\_\_projects\MUDShow\frontend\src\lib\components\window\ConfirmCloseTabModal.svelte) to render content only.
  - [x] Route world-tab close confirmation state through the window host from [session.ts](C:\_\_projects\MUDShow\frontend\src\lib\session.ts).
- [x] Migrate the close-app confirmation window onto the shared host.
  - [x] Replace the app-close modal branch in [App.svelte](C:\_\_projects\MUDShow\frontend\src\App.svelte) with a shared-host window record.
  - [x] Keep the native close-request interception in [App.svelte](C:\_\_projects\MUDShow\frontend\src\App.svelte) but hand it off to the host window state.
- [X] Migrate the logging control window onto the shared host.
  - [x] Update [LoggingModal.svelte](C:\_\_projects\MUDShow\frontend\src\lib\components\play\LoggingModal.svelte) to render content only.
  - [x] Move logging modal open/close state and actions in [App.svelte](C:\_\_projects\MUDShow\frontend\src\App.svelte) onto the host.
  - [x] Preserve the log-file rename, reveal, start, and stop actions during the host migration.
- [x] Migrate the world editor window onto the shared host.
  - [x] Update [WorldModal.svelte](C:\_\_projects\MUDShow\frontend\src\lib\components\settings\WorldModal.svelte) to render content only.
  - [x] Move world editor open/save/cancel flow in [session-edit-world-character.ts](C:\_\_projects\MUDShow\frontend\src\lib\session-edit-world-character.ts) to host-owned state.
  - [x] Update the world-editor launch path in [App.svelte](C:\_\_projects\MUDShow\frontend\src\App.svelte).
- [x] Migrate the character editor window onto the shared host.
  - [x] Update [CharacterModal.svelte](C:\_\_projects\MUDShow\frontend\src\lib\components\settings\CharacterModal.svelte) to render content only.
  - [x] Move character editor open/save/cancel flow in [session-edit-world-character.ts](C:\_\_projects\MUDShow\frontend\src\lib\session-edit-world-character.ts) to host-owned state.
  - [x] Update the character-editor launch path in [App.svelte](C:\_\_projects\MUDShow\frontend\src\App.svelte).
- [x] Migrate the world list delete confirmation into a host-owned window record.
  - [x] Remove the inline delete overlay from [WorldsAndCharactersEditor.svelte](C:\_\_projects\MUDShow\frontend\src\lib\components\settings\WorldsAndCharactersEditor.svelte).
  - [x] Add host-backed delete-confirm state for worlds and characters in [WorldsAndCharactersEditor.svelte](C:\_\_projects\MUDShow\frontend\src\lib\components\settings\WorldsAndCharactersEditor.svelte) or its backing state module.
  - [x] Keep delete actions wired to [session-edit-world-character.ts](C:\_\_projects\MUDShow\frontend\src\lib\session-edit-world-character.ts).
- [x] Remove legacy overlay and window-chrome markup from migrated built-in components.
  - [x] Strip backdrop and absolute-positioning styles from migrated modal components.
  - [x] Keep only window content, form controls, and action rows in migrated components.
  - [x] Ensure migrated components are all rendered through the shared host from [App.svelte](C:\_\_projects\MUDShow\frontend\src\App.svelte).
- [ ] Route open/close state for built-in windows through the host entry point.
  - [ ] Centralize built-in window record creation in [window-host.ts](C:\_\_projects\MUDShow\frontend\src\lib\components\window-host\window-host.ts).
  - [ ] Keep built-in modal open/close actions in [App.svelte](C:\_\_projects\MUDShow\frontend\src\App.svelte) and session helpers aligned.
  - [ ] Make sure modal dismissal still handles Escape, backdrop clicks, and explicit close buttons.
- [ ] Update the relevant spec documents to describe the shared-host modal behavior.
  - [ ] Update [spec/layout.md](C:\_\_projects\MUDShow\spec\layout.md) for the modal surfaces that now use the shared host.
  - [ ] Update [spec/tauri.md](C:\_\_projects\MUDShow\spec\tauri.md) if any popped-out or host-managed window behavior changes.
  - [ ] Update [PLAN_WINDOWS.md](C:\_\_projects\MUDShow\PLAN_WINDOWS.md) again if the migration order changes.
- [ ] Verify keyboard dismissal, backdrop dismissal, and focus behavior for migrated modal windows.
  - [ ] Confirm Escape closes only the topmost host modal when multiple windows are present.
  - [ ] Confirm backdrop clicks only dismiss windows that allow backdrop dismissal.
  - [ ] Confirm focus lands on the expected first control after each migrated window opens.

## Next Steps

- Define the window host data model and lifecycle.
- Decide how window state should be restored after pop out and pop in.
- Draft the host events needed to open a window in-place or as a separate window.
- Specify the built-in window interfaces that should migrate first.
- Define the plugin-facing window request API once the built-in shell is in place.
- Wire pop-out/pop-in controls into the window shell for pop-out capable windows.
- Add native-window pop-in behavior through a host-rendered pop-in control on popped-out windows.
