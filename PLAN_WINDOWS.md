# Window and Surface Host Remaining Work

The durable behavior is specified in `spec/surfaces.md` and `spec/tauri.md`.
The application now uses a surface registry and host adapters; this plan only
tracks remaining work.

## Completed Foundation

The following are implemented and should not be re-planned here:

- A host-neutral surface registry owns registrations, instances, capabilities,
  active state, placement, previous dock edge, and saved position/size.
- Dockview hosts in-app grid, edge, and floating placements.
- Native Tauri webview windows host popped-out surfaces.
- Surface transport uses typed commands, snapshots, lifecycle events, errors,
  revisions, resync, and stale-session replacement.
- Surface controllers keep feature data and view state in the main app while
  popped-out views reconnect through the same transport boundary.
- Notes, Debug Console, FuzzBall storage, and test surfaces use the shared
  lifecycle and placement model.
- World-session teardown closes owned surface instances and discards their
  native windows.

## Remaining Generalization Work

- Replace remaining feature-specific branching in `App.svelte` and the native
  window bridge with registration-driven renderer and transport adapters.
- Define a single adapter contract for plugin surface renderers so a plugin
  surface does not require a new hard-coded `App.svelte` branch.
- Keep `window-host.ts` limited to the serialized native-window DTO and shell
  helpers, or rename that boundary if the terminology continues to imply that
  it is the application surface registry.
- Ensure every surface controller uses the shared command/snapshot protocol
  and does not reach directly into another surface or host implementation.

## Remaining Native-Window Work

- Verify native close, pop-in, failed pop-out, source-tab teardown, and app
  shutdown all preserve or discard surface state according to
  `spec/surfaces.md`.
- Make native position and inner-size capture consistent for every close and
  discard path, including externally closed native windows.
- Exercise the Windows WebView2 shared-environment path and keep lifecycle
  diagnostics clear enough to distinguish native-window creation failures from
  webview load or transport failures.
- Add focused integration coverage for pop-out/pop-in state preservation and
  stale or delayed cross-window messages.

## Remaining Placement Work

- Define migration behavior for saved surface placement data when the
  placement schema changes.
- Decide whether placement should remain browser-local storage or move into a
  host-managed persistence service when multi-device or profile support is
  introduced.
- Keep Dockview auto-hide, floating-panel clamping, and previous-edge restore
  behavior aligned with the durable surface spec as new placement modes are
  added.

## Boundary

Do not add current registry, Dockview, transport, or native-window behavior
back into this plan. Update `spec/surfaces.md` or `spec/tauri.md` when behavior
changes, and leave only unresolved implementation or product decisions here.
