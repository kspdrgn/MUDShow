# Plugin System Remaining Work

The current plugin contract and behavior are specified in `spec/plugins.md`.
This document only records work that is not implemented or not yet decided.

## Remaining Pipeline Work

- Complete the normalized protocol event pipeline described in
  `spec/protocols.md` and expose typed MCP, GMCP, and MCMP events to plugins.
- Decide and implement outgoing command hooks: observation, metadata,
  transformation, cancellation, and ordering/conflict rules.
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

## Boundary

Do not copy current registry behavior, hook names, surface capabilities, or
failure rules back into this plan. Update `spec/plugins.md` when behavior is
implemented, and leave only the next unresolved decision or work item here.
