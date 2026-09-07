# Taps Spec

## Purpose

Taps is the Tapestries-specific world integration. It adds Taps behavior on
top of the generic FuzzBall property capability and exposes that behavior
through host-managed world-session actions.

## World Capability and Dependency

- The `taps` world compatibility activates the Taps plugin.
- Taps depends on the active FuzzBall plugin and its property service.
- A Taps session therefore receives the generic FuzzBall property capture,
  cache, property service, and storage viewer as well as Taps behavior.
- Taps-specific state is session-scoped and is not persisted.

## Ride Mode

The currently implemented Taps feature is the ride-mode selector.

- The selector is a compact host-rendered select action in the world-session
  action area.
- Supported values are `ride`, `hand`, `walk`, and `fly`.
- The current value is read from the FuzzBall property path
  `/ride/_mode`.
- When a Taps session connects, it sends:

  ```text
  examine me=/ride/_mode
  ```

- Selecting a value sends:

  ```text
  @set me=/ride/_mode:<rideMode>
  ```

- Values are normalized by trimming whitespace and comparing case
  insensitively. Unknown or missing values are shown as unavailable/loading
  rather than treated as a valid ride mode.
- The selector is disabled while the initial value is loading or an update is
  pending.
- A property-cache update is authoritative and clears any pending optimistic
  value. If the property service confirms that the command was sent before a
  server echo arrives, the selected mode may be shown optimistically until a
  later cache update replaces it.
- Failed updates clear the pending state and expose the error through the
  action title without breaking the session.
- Disconnect and reconnect do not persist ride mode; reconnecting requests the
  current server value again.

## Host Integration

Taps does not create native windows, manipulate Dockview, or own layout.
The host owns action rendering, placement, focus, and lifecycle. The Taps
plugin contributes the action and subscribes to FuzzBall cache changes so the
action stays synchronized with server-side property updates.

Generic FuzzBall storage behavior is specified in `spec/fuzzball.md`; generic
plugin and surface rules are specified in `spec/plugins.md` and
`spec/surfaces.md`.

## Planned Taps Features

The Taps plan also describes possible future character description, morph,
CInfo, WF, and WS integrations. Those are not current application behavior
and must not be assumed available until they are added here and implemented.
See `PLAN_TAPS.md` for the remaining design and implementation work.

## References

- [Taps feature plan](../PLAN_TAPS.md)
- [Plugin contract](plugins.md)
- [FuzzBall property integration](fuzzball.md)
