# FuzzBall Integration

FuzzBall-capable worlds are the `fuzzball` and `taps` world profiles. The
FuzzBall integration owns property parsing, the session-scoped property cache,
refresh and set commands, and the generic storage-viewer surface descriptor.
The storage viewer uses the shared surface host boundary and does not own
native-window or Dockview mechanics.

Taps inherits the FuzzBall integration. Telnet worlds do not activate either
integration. Property cache state is transient and is cleared when its owning
world session is disposed; the server remains authoritative.
