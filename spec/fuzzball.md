# FuzzBall Spec

## Purpose

FuzzBall support provides the shared property-tree integration used by
FuzzBall-compatible worlds and by dependent world plugins such as Taps. It
owns property-line capture, the transient session cache, property reads and
writes, and the host-managed storage viewer.

The plugin is the source of truth for generic FuzzBall property behavior.
Taps-specific meaning belongs in `spec/taps.md`.

## World Capability

- The `fuzzball` world compatibility activates the FuzzBall plugin.
- The `taps` compatibility also activates the FuzzBall plugin, because Taps
  inherits the generic FuzzBall property capability.
- Generic `telnet` worlds do not activate the plugin.
- A FuzzBall session may be world-only or associated with a named character.

## Property Capture

- The plugin inspects every normalized incoming world line for a recognized
  property record.
- Recognized records begin with `dir`, `str`, or `int`, followed by a full
  property path and an optional value.
- A trailing `/` on a path indicates that the node has children. The stored
  path is normalized without trailing slashes, except for the root `/`.
- Lines such as `1 property listed.` and `0 properties listed.` are summary
  lines and are not cached.
- A property record updates the node at that path. Missing ancestors are
  synthesized as unloaded directory nodes so a child can be displayed before
  its parent is explicitly returned.
- The parser is best-effort and request-independent. Ordinary world output
  that happens to match the grammar can be captured.
- Captured raw text is not retained by the property cache.

The accepted line shapes are equivalent to:

```text
dir /path/:(no value)
str /path:value
int /path:value
```

The value text is retained as received. A `dir` node has no direct value.

## Session Cache

- Cache state is held in memory by the FuzzBall plugin's world-session
  contribution and is scoped to the world id plus character id.
- A world-only connection uses an empty character id.
- The cache preserves hierarchy, node type, direct value, whether the value
  was explicitly loaded, whether children exist, whether children have been
  loaded, and the last update time.
- Observing an individual child does not mark its parent listing as complete;
  a requested listing becomes loaded when its property-count response is
  received, including a zero-property response.
- Paths are normalized to have a leading slash and collapsed separators.
- Child nodes are sorted alphabetically for display.
- The cache is transient. It survives disconnect/reconnect within the open
  world session and is cleared when the owning plugin/session contribution is
  disposed. A frontend refresh may lose it; the viewer can query it again.
- The cache is not written to application persistence.

## Property Service

Dependent plugins use the session-scoped FuzzBall property service:

- `get(path)` returns the cached node snapshot or no value when unknown.
- `refresh(path)` sends `examine me=<path>` through the owning connection.
- `set(path, value)` sends `@set me=<path>:<value>` through the owning
  connection.
- `subscribe(listener)` reports cache changes.

The service exposes cache-backed state; callers that need current server data
must request a refresh and wait for the resulting captured lines.

## Storage Viewer

The FuzzBall plugin contributes the `fuzzball-storage-viewer` host surface
and the `exa me=/` world-session action.

- Opening the action opens or focuses the viewer for the current world tab.
- If that session has no cached data, the viewer requests `examine me=/`.
- Expanding a branch whose children are not loaded requests an `examine`
  query for that node.
- The viewer renders the cached hierarchy, node names, values, value-loaded
  state, and node types, and updates when the cache changes.
- The viewer is query-only; it does not edit or delete properties.
- Its state and data are owned by the surface controller and use the general
  surface transport and placement rules in `spec/surfaces.md`.
- Reopening the viewer for the same world tab focuses the existing instance.
- Closing the world session closes the viewer and discards its transient cache.

## Plugin Boundary

FuzzBall owns generic property syntax, parsing, caching, refresh, writes, and
storage inspection. A dependent plugin owns the meaning of its paths and the
commands or UI specific to its world. The plugin contract and lifecycle rules
are defined in `spec/plugins.md`.

## Not Yet Implemented

The current FuzzBall integration does not promise typed writes through the
plugin service, persistent property data, request-correlated capture, or
gender/pronoun handling. Design notes and future work remain in
`PLAN_FUZZBALL.md`.

## References

- [FuzzBall property-tree plan](../PLAN_FUZZBALL.md)
- [FuzzBall reference manual](https://www.fuzzball.org/docs/muckhelp.html)
- [FuzzBall command manual](https://www.fuzzball.org/docs/muckman/commands.html)
