# Plugin System

## Purpose

Plugins provide world-specific behavior without putting world rules in the
core session and PlayScreen code. The host owns connections, session
lifecycle, routing, rendering, persistence, and surface placement. A plugin
owns the domain interpretation and state needed for its contribution, and
asks the host to present actions or surfaces through the plugin contract.

This document describes the current plugin contract and the rules future
plugin work must preserve. It is the source of truth for plugin behavior;
`PLAN_PLUGIN.md` only tracks remaining design and implementation work.

## Scope and Registration

- Plugins are registered with a world-plugin registry when the app session is
  created.
- The current registry loads built-in plugins through in-process providers.
  The provider seam is intentionally compatible with future external loading,
  but external packages, processes, and sandboxing are not implemented yet.
- A plugin has a unique non-empty id, a display label, an optional list of
  plugin dependencies, an activation predicate, and a session-contribution
  factory.
- Activation is evaluated against the current world and optional character.
  A plugin may therefore be world-scoped, character-aware, or available for
  all worlds.
- Multiple plugins may be active for the same world session.
- The registry rejects duplicate ids. Dependencies must be registered and
  active, dependency cycles are rejected, and dependencies are activated
  before their dependents.

## World Plugin Session

Each open world session gets at most one plugin session. The session is created
with:

- the world and optional character records;
- the stable world-session key;
- a connection port that can send an ordinary command;
- a session-scoped service bag; and
- a host port for invoking a plugin action or opening a host surface.

A plugin creates one session contribution when it activates. A contribution
may provide actions, surfaces, dynamic-action updates, change subscriptions,
connection hooks, and disposal behavior.

Plugin state belongs to the plugin session unless it is explicitly stored in a
plugin-owned service or another host-managed store. Closing the world session
disposes its plugin session and clears its transient session state.

## Pipeline Hooks

The current plugin session receives these events in active-plugin order:

- `onRawMessage(text)` for raw incoming connection text delivered to the
  debug/raw-message path;
- `onIncomingLine(line)` for an incoming world line after the connection layer
  has framed and normalized it;
- `onConnected()` after the connection is established and the initial
  character connection command has been sent; and
- `onDisconnected()` when the connection closes or reports an error.

Hook failures are reported with the plugin id and hook name, then isolated so
the remaining plugins and the transcript can continue. A plugin must not
parse socket framing or own the transport. Protocol-aware plugins must consume
the normalized connection interface described in `spec/protocols.md` as that
interface becomes available.

## Services and Dependencies

The session service bag is a typed-key registry shared by active plugins in
one world session. A plugin may publish a service for a dependent plugin to
consume. Services are not global and must not be used to couple unrelated
world sessions.

Dependencies express required plugin services or ordering. For example, the
Taps plugin depends on FuzzBall so it can use the FuzzBall property service.
The dependent plugin is not activated when its dependency is missing or
inactive.

## Host Actions

Plugins may contribute host-owned world-session actions. Current action kinds
are:

- buttons with an id, label, optional title, disabled state, and click handler;
- selects with an id, label, current value, options, disabled state, and
  change handler.

The host renders these actions in the world PlayScreen chrome. Plugin action
handlers may send commands through the connection port or invoke the host port
to open a surface. The plugin does not render the action controls or directly
modify the PlayScreen layout.

### World-Session Control Focus

The host owns keyboard focus for plugin-contributed world-session controls.
After a transient control is complete, the host restores focus to the last
selected input bar. This includes select changes and closing a dropdown without
changing its value, so controls such as the Taps Ridemode selector return the
user to command entry.

An action that intentionally opens or focuses a host-managed surface is the
exception: focus transfers to that surface and is not immediately restored to
the input bar. The FuzzBall `exa me=/` action follows this rule by focusing the
newly spawned storage viewer. Plugins must use this distinction for all custom
world-session UI integrations and must not implement competing global focus
behavior.

Dynamic actions are refreshed through the contribution subscription. The
session aggregates actions from all active plugins in activation order.

## Host Surfaces

A plugin may contribute a host-managed surface descriptor with:

- a stable surface id;
- `protocolVersion: 1`;
- a renderer id selected by the host adapter;
- a default title;
- surface kind `plugin`; and
- capabilities for close, dock, float, pop-out, pop-in, modal behavior, and
  multiple instances.

Opening a surface goes through the host. The host owns registration, instance
lifecycle, focus, placement, Dockview/native-window transitions, saved
placement, transport, and rendering. Plugin surface data must use the shared
surface command/snapshot boundary described in `spec/surfaces.md` and
`world-surface-protocol.ts`; a plugin must not create unmanaged native windows
or manipulate host layout internals.

Surface open payloads are host-routed data, not a license to pass arbitrary
objects or DOM references across the boundary. Surface instances are closed
when their owning world session is closed.

## Lifecycle and Failure Rules

- Contribution creation happens in activation order. If creation fails, any
  contributions already created are disposed before the error is rethrown.
- Runtime hook failures do not stop dispatch to other contributions.
- Disposal is idempotent and runs in reverse contribution order.
- Subscription listeners are removed during disposal.
- A disposed plugin session ignores later hook dispatch and change events.
- Plugin failures must not prevent connection teardown, transcript display, or
  the user from closing a world tab.

## Current Built-in Plugins

- The `fuzzball` plugin activates for FuzzBall-capable worlds, captures
  recognized property lines, provides the FuzzBall property and storage-viewer
  services, and contributes the `fuzzball-storage-viewer` surface/action. See
  `spec/fuzzball.md` for its product behavior.
- The `taps` plugin activates for Taps worlds, depends on `fuzzball`, and
  contributes the ride-mode select action. See `spec/taps.md` for its product
  behavior.

## Not Yet Implemented

The current contract intentionally does not promise:

- declarative manifest-only plugins;
- JavaScript/Lua plugin scripting or compiled sidecars;
- external plugin installation, updates, version negotiation, or signatures;
- plugin-owned persistent world/character configuration and migrations;
- raw-byte, typed MCP, GMCP, or MCMP plugin hooks;
- outgoing command interception, transformation, or cancellation;
- plugin permissions for filesystem, network, clipboard, or process access; or
- plugin-defined UI outside host actions and host-managed surfaces.

Those items belong in the plan until a contract and implementation are
defined. They must not be described as current application behavior.
