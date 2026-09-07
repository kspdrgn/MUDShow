# Channels and Conversation Routing

Channels are logical conversation threads and routing infrastructure inside a world session. They are not a separate visual panel system. User-facing reading views are conversation surfaces managed by the surfaces system and may be placed in a top dock, side dock, floating panel, or native window according to their surface capabilities.

## Current Behavior

- The application uses the surfaces system for user-facing panels; there is no separate top-channel or side-channel UI.
- Notes, Debug Console, and FuzzBall storage are host-managed surfaces with their own controllers and transport contracts.
- The main transcript remains the default live-output view.
- A future channel controller will track registered and active routed conversation threads for each world session.
- Routing sources such as trigger rules and world-plugin capture behavior will publish ordered entries to channels without owning surface placement.

## Intended Channel Behavior

- A channel has a stable identity, label, routing metadata, and world-session scope.
- A world session may have multiple active channels.
- A routed entry may be delivered to one or more channels while preserving source and ordering metadata.
- A channel may continue receiving entries while its reading surface is closed; opening a surface later may subscribe to the existing channel state.
- Closing or moving a conversation surface does not close or move the logical channel.
- Channel lifecycle ends when the owning world session ends, unless a later persistence requirement says otherwise.

## Surface Integration

- Conversation surfaces subscribe to channels through a controller or surface-specific bridge.
- Surface controllers own presentation state; the channel controller owns routing and channel lifecycle.
- Surface placement, Dockview edge groups, side-dock behavior, floating panels, pop-out windows, and cross-window transport are defined by `spec/surfaces.md`.
- Channels must not create arbitrary windows or manipulate surface layout directly.

## Routing Sources

- Trigger rules may route matching transcript lines or capture groups into named channels.
- World-plugin capture behavior may classify output and route it into plugin-owned or shared channels.
- Protocol and capture layers may provide source metadata and ordering information without knowing which surface will display the result.
- A router may publish to a channel even when no surface is open.

## Scope

- Channels are scoped to world sessions.
- App-level tabs and settings tabs are not channels.
- Notes, Debug Console, and FuzzBall storage are surfaces, not special channel types.
- Highlights and rules remain separate from channels unless a future routing feature explicitly connects them.
