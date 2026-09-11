# Taps Ride-Mode Integration Plan

The generic surface protocol and controller lifecycle foundation is now
available in `frontend/src/lib/world-surface-protocol.ts` and
`frontend/src/lib/surfaces/`. It is intentionally feature-neutral: it does
not activate Taps, FuzzBall, or any other plugin.

## Completed integration milestone

- [x] Normalize `telnet`, `fuzzball`, and `taps` world profiles.
- [x] Centralize inherited FuzzBall/Taps capability checks.
- [x] Resolve Taps after its FuzzBall dependency.
- [x] Route connection lifecycle and incoming lines through disposable
  world-session plugin contributions.
- [x] Expose the FuzzBall property service and storage-surface descriptor.
- [x] Expose the Taps ride-mode action and server-authoritative synchronization
  commands.
- [x] Add concrete activation, inheritance, property, action, and lifecycle
  integration tests.

Future Taps features should consume this boundary through typed feature
adapters. Taps owns ride-mode state and commands, while the host continues to
own placement, rendering, and lifecycle routing. External plugin loading,
permissions, and runtime isolation remain out of scope.

The registered descriptor and actions are now mounted through the shared
Dockview/native-window adapters. Plugin runtime state remains disposable;
existing connection reattachment and bounded replay remain the recovery
mechanism.
