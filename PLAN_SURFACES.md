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

## Follow-up dependencies

- Connect existing feature controllers and native-window adapters to this
  boundary without adding feature-specific branches to the host.
- Add browser/native integration coverage for actual Dockview and Tauri
  lifecycle transitions.
- Define renderer and capability adapters only when a concrete feature needs
  them.
