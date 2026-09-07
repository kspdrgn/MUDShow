# Conversation Routing and Channels Plan

## Purpose

- Define channels as the routing and lifecycle infrastructure for conversation threads inside a world session.
- Keep channel identity and routed content separate from surface placement and rendering.
- Use the surfaces system for every user-facing reading panel, including top, side, floating, and popped-out placements.
- Give trigger rules, capture behavior, and world plugins one shared place to publish and route conversation output.

## Design Boundary

- A channel is a logical conversation thread, not a dedicated visual panel or a second window system.
- A conversation surface is the user-facing view that reads from one or more channels. It is hosted and placed by the surfaces system.
- Channels do not own Dockview groups, side docks, pop-outs, or native windows. Those are surface-host responsibilities defined by `PLAN_SURFACES.md` and `spec/surfaces.md`.
- There is no separate top-channel or side-channel UI to preserve. Former channel and side-channel concepts should converge on conversation surfaces and surface placements.
- A world session may have multiple active channels, and a surface may subscribe to one or more channels when that is useful for a reading view.

## Core Model

- The channel controller is scoped to a world session.
- A channel has a stable identity, a human-readable label, routing metadata, and lifecycle state.
- The controller tracks which channels are registered, active, receiving output, or closed.
- Routed entries preserve their source and ordering metadata so a surface can display a coherent conversation thread.
- Channel history and display policy are separate concerns: a router decides what belongs to a channel, while a surface decides how to present it.
- Channel state should remain available while the owning world session is open, independent of whether any surface is currently visible.

## Goals

- Provide a central controller for registering, activating, closing, and observing world-session conversation channels.
- Let routing sources publish to one or more channels through the same host mechanism.
- Allow trigger rules to route matching transcript content into conversation channels.
- Allow world-plugin capture behavior to classify and route output into plugin-owned or shared channels.
- Allow future built-in features to create focused reading threads without creating bespoke panels.
- Let surfaces subscribe to active channels and render them in any supported surface placement.
- Keep channel state and routing independent from the transcript's primary live-output view.

## Non-Goals

- Do not create a separate channel bar, channel panel, or side-channel shell.
- Do not duplicate the surface registry or surface transport system.
- Do not let routers create arbitrary native windows or manipulate Dockview directly.
- Do not require every transcript line to belong to a separate channel.
- Do not make channels a replacement for the main transcript or for ordinary world-session output.

## Controller Responsibilities

- Register and unregister logical conversation channels for a world session.
- Track channel identity, label, source, active state, and routing metadata.
- Accept ordered routed entries from built-in rules, capture handlers, plugins, and future user actions.
- Support publishing one entry to one or more channels when routing rules overlap.
- Expose channel snapshots or subscriptions to surface controllers.
- Remove or deactivate channels when their owning world session closes.
- Keep routing decisions and channel lifecycle deterministic and observable for diagnostics.

The controller must not own surface placement, visual layout, native windows, or component rendering.

## Routing Sources

- Built-in trigger rules may route matched lines or capture groups to named conversation channels.
- World-plugin capture behavior may classify output and publish entries to plugin-owned or shared channels.
- Protocol and capture layers may provide source metadata, classifications, and ordering information without knowing which surface will display the result.
- User actions may activate an existing channel or open the surface that presents it, but should not bypass the controller for channel state changes.

Routing should be composable: a source may publish to a channel without requiring that a surface is currently open, and a surface may subscribe after the channel has already received content.

## Surface Integration

- Conversation surfaces are registered with the surface registry and use normal surface commands, snapshots, lifecycle, and transport rules.
- A surface controller owns the view model for its reading panel and subscribes to the channel controller for routed entries.
- A conversation surface may be docked in a top or side edge group, floated in-app, or popped out according to its surface capabilities.
- Opening, closing, moving, or popping out a surface must not change the logical channel identity or routing behavior.
- Multiple surfaces may present the same channel when the product needs alternate reading views, while each surface retains its own view state.
- Surface placement and auto-hide behavior belong to Dockview/surface hosts, not to channels.

## Data Model Questions

- Which channel metadata must be persisted for the lifetime of a world session, and which can be derived from the active router?
- Should channel entries use the canonical transcript entry model once the transcript pipeline supports routed projections?
- How should channel backpressure and bounded history work for inactive channels?
- How should a router handle a channel whose surface is closed but whose thread remains active?
- How should duplicate or overlapping routes be represented without duplicating the same entry unnecessarily?
- Which diagnostics should expose routing decisions, dropped entries, and channel lifecycle changes?

## Suggested First Cut

- Define typed channel identity, registration, routed-entry, and snapshot contracts.
- Add a world-session channel controller without adding new channel-specific UI.
- Provide a subscription bridge that a conversation surface controller can use.
- Prove the flow with one focused reading surface backed by a manually registered channel.
- Add trigger-rule routing after the controller and surface bridge are stable.
- Add world-plugin capture routing after the trigger path establishes the common semantics.
- Keep the primary transcript and existing Notes, Debug Console, and FuzzBall surfaces independent unless they explicitly opt into channel subscriptions.

## Relationship To Other Plans

- `PLAN_SURFACES.md` defines placement, lifecycle, Dockview, native windows, and cross-window transport for the user-facing surfaces.
- `PLAN_PLUGIN.md` defines the plugin boundary; this plan defines the channel-routing capability available to plugins.
- `PLAN_TAPS.md` may use channels for Taps conversation threads, but should not define a separate side-channel system.
- `PLAN_CAPTURE.md` defines capture and classification concerns that may publish routed entries into channels.

## Next Steps

- Define the channel controller API and typed routed-entry model.
- Decide how channel snapshots and subscriptions integrate with the existing surface transport contracts.
- Define bounded retention and inactive-channel behavior.
- Add a minimal conversation surface proof of concept using a side-dock placement from the surfaces system.
- Document user-visible channel routing behavior in the appropriate durable spec as routing sources become implemented.
