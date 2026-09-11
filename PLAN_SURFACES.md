# Surface System Remaining Work

## Completed generic foundation

- [x] Define a versioned, JSON-safe surface descriptor and open request.
- [x] Define versioned command, snapshot, error, and lifecycle contracts.
- [x] Reject malformed or unsupported messages at the protocol boundary.
- [x] Enforce monotonic snapshot revisions and revision-checked commands.
- [x] Isolate stale replacement instances and late delivery.
- [x] Bind controllers to transport sessions with open, resync, command, and
  disposal behavior.
- [x] Keep host-neutral registration and placement lifecycle separate from
  rendering, including previous dock-edge preservation.
- [x] Register built-in plugin surface descriptors through the generic host
  port, without feature-specific host branches.
- [x] Feed plugin-contributed actions into the world controls and route
  registered plugin renderers through the Dockview and native-window adapters.
- [x] Restore plugin surface controller state before docking a returned native
  window, using a surface-id restore handler rather than a feature-id branch.
- [x] Dispose plugin surface state when an owning window or world session is
  closed; persistent placement remains owned by the host registry.

## State and recovery direction

- Surface snapshots are live state projections, not transcript-history or
  backend event-replay mechanisms.
- A returned or refreshed surface must be reconstructible from its controller
  snapshot and current world-session/plugin state.
- Surface controllers must not require replay of missed transcript events to
  become correct. If a surface needs authoritative backend state, that state
  must be represented in a versioned session/plugin snapshot.
- View-only state such as selection, scroll geometry, and temporary hover state
  remains local to the surface host.

## Follow-up dependencies

- Add browser/native integration coverage for actual Dockview and Tauri
  lifecycle transitions.
- Define renderer and capability adapters only when a concrete feature needs
  them.
