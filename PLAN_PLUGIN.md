# Plugin System Remaining Work

The current plugin contract and behavior are specified in `spec/plugins.md`.
This document only records work that is not implemented or not yet decided.

## Remaining Pipeline Work

- Complete the normalized protocol event pipeline described in
  `spec/protocols.md` and expose typed MCP, GMCP, and MCMP events to plugins.
- Decide and implement outgoing command hooks: observation, metadata,
  transformation, cancellation, and ordering/conflict rules.
- Define a sentinel capability for plugin capture: issuing a unique token to the
  player's own world connection and receiving the matching classified event.
- Keep sentinel responses available to the canonical transcript/history store
  while allowing the host's visibility projection to mute them from the main
  transcript and other consumers.
- Finish the capture/filter behavior needed by the FuzzBall plugin so plugin
  requests can hide captured material from the visible transcript while
  retaining it in history with the required metadata.
- Define limits and diagnostics for plugin-produced work so a plugin cannot
  cause unbounded buffering, logging, or UI work.

## Remaining Packaging and Runtime Decisions

- Decide whether external plugins are loaded in-process, in a worker, or in a
  separate process, and define the trust and failure boundary for that choice.
- Define the package/manifest format, compatibility/version negotiation,
  installation, update, removal, and rollback behavior.
- Decide whether declarative packs, scripted plugins, or compiled sidecars
  are supported after the current in-process TypeScript contract. Declarative
  configuration remains the preferred direction if it can express the needed
  behavior without weakening the host boundary.
- Define permissions for filesystem, network, clipboard, and process access;
  no plugin currently receives those capabilities through the host contract.

## Remaining State and UI Work

- Define plugin-owned persistent world and character data, schema migration,
  cache invalidation, and behavior when a plugin is disabled or removed.
- Add further host action kinds only when a concrete feature needs them;
  preserve host-owned rendering and layout control.
- Define any additional host surface renderers and their versioned command /
  snapshot contracts before adding plugin-specific UI.
- Keep world-definition distribution separate from user-owned world records so
  future plugins cannot overwrite local connection settings by server name.

## Current Follow-Up Features

The following are product work for existing plugins rather than plugin-system
architecture: FuzzBall storage editing and capture refinements, and the Taps
description editor, morph list/editor, and related integrations. Track their
user-visible behavior in the relevant feature spec when implemented.

Sentinel is the planning name for the former generic “echo” capture marker.
The plugin contract must not assume that the world echoes the token verbatim:
matching, timeout, cancellation, and unsupported-world behavior belong to the
host/event boundary. “Command echo” remains a separate transcript visibility
term for showing submitted user input.

## Boundary

Do not copy current registry behavior, hook names, surface capabilities, or
failure rules back into this plan. Update `spec/plugins.md` when behavior is
implemented, and leave only the next unresolved decision or work item here.

## Related Plans

- `PLAN_PROTOCOLS.md` defines the normalized event pipeline and typed protocol
  subscriptions that plugins will consume.
- `PLAN_CAPTURE.md` defines sentinel requests, matching, capture completion,
  and transcript-retention behavior.
- `PLAN_CHANNELS.md` defines the channel-routing capability available to
  plugins and the default treatment of sentinel events.
- `PLAN_FUZZBALL.md` tracks the concrete FuzzBall capture work that will
  consume the generic sentinel and transcript-filtering capability.
- `PLAN_SURFACES.md` defines host-managed UI placement when plugin capture
  results are presented in structured surfaces.
