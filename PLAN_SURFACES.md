# Surface System Remaining Work

The current surface contract is specified in `spec/surfaces.md`; native
window behavior is specified in `spec/tauri.md`. This plan tracks only the
remaining work for the unified surface system.

## Completed Foundation

- Surface registrations and instances are owned by a host-neutral surface
  registry.
- Surface identity, capabilities, active state, placement, previous dock edge,
  and saved position/size are represented independently of rendering.
- Dockview provides in-app grid, edge, and floating placements.
- Native Tauri webview windows provide the pop-out host.
- Typed surface transport provides commands, snapshots, lifecycle events,
  errors, revisions, resync, stale-session replacement, and listener
  isolation.
- Surface controllers keep data and view state outside the rendered component.
- Notes, Debug Console, FuzzBall storage, and test surfaces use the shared
  surface lifecycle and transport model.
- The old channel-bar/window-host migration described by this plan has been
  superseded by the surface model; channels are now logical routing state and
  are specified separately in `spec/channels.md`.

## Remaining Registry and Adapter Work

- Replace remaining feature-specific branches in `App.svelte` and
  `PlayDockviewSandbox.svelte` with registration-driven renderer, controller,
  and placement adapters.
- Define the generic plugin-surface renderer adapter so registering a plugin
  surface does not require a new hard-coded application branch.
- Keep the native `WindowRecord`/`window-host.ts` types limited to the Tauri
  boundary DTO and shell helpers; they must not become a second application
  surface registry.
- Ensure every surface controller uses the shared command/snapshot boundary
  and does not reach directly into another surface or host implementation.

## Remaining Placement and Lifecycle Work

- Preserve and restore `previousDockedEdge` when a surface moves from a dock
  to a native window and back. The current pop-in path falls back to the top
  edge instead of restoring the prior edge.
- Persist enough placement metadata to retain the previous dock edge across
  native placement and app reloads, with an explicit migration path when the
  placement schema changes.
- Verify native close, pop-in, failed pop-out, source-session teardown, and
  app shutdown against the lifecycle rules in `spec/surfaces.md`.
- Make native position and inner-size capture consistent for every close and
  discard path, including externally closed native windows.
- Keep Dockview auto-hide, floating-panel clamping, and edge restoration
  behavior aligned as new placement modes are introduced.

## Remaining Transport and Verification Work

- Add focused integration coverage for pop-out/pop-in state preservation,
  stale or delayed messages, reconnect/resync, and teardown while messages are
  in flight.
- Exercise the Windows WebView2 shared-environment path and distinguish native
  window creation failures from webview load and surface-transport failures.
- Add registry and placement tests for duplicate registrations, instance
  capability limits, saved-placement precedence, invalid saved data, and
  unregister/close cleanup.

## Product Decisions Still Open

- Decide whether placement should remain browser-local storage or move to a
  host-managed persistence service when profiles or multi-device support are
  introduced.
- Define additional renderer and surface capabilities only when a concrete
  feature needs them; preserve host-owned rendering, placement, and lifecycle
  control.

## Boundary

Do not copy current registry, Dockview, transport, or native-window behavior
back into this plan. Update `spec/surfaces.md` or `spec/tauri.md` when the
durable behavior changes, and leave only unresolved work here.
