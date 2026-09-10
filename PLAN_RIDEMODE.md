# Taps Ride-Mode Integration Plan

The generic surface protocol and controller lifecycle foundation is now
available in `frontend/src/lib/world-surface-protocol.ts` and
`frontend/src/lib/surfaces/`. It is intentionally feature-neutral: it does
not activate Taps, FuzzBall, or any other plugin.

The remaining ride-mode work must consume this boundary through a typed
feature adapter. Taps should own ride-mode state and commands, while the host
continues to own placement, rendering, and lifecycle routing. External plugin
loading, permissions, and runtime isolation remain out of scope.
