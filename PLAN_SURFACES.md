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

## Follow-up dependencies

- Mount registered feature controllers and actions in the concrete Dockview
  and native-window adapters without adding feature-specific host branches.
- Add browser/native integration coverage for actual Dockview and Tauri
  lifecycle transitions.
- Define renderer and capability adapters only when a concrete feature needs
  them.
