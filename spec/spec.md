# MUDShow High-Level Tech-Agnostic Spec

## Feature specification documents:
- spec/input.md - Primary user input area and features
- spec/layout.md - App and world UI/UX structure and rules
- spec/output.md - Primary display window and features
- spec/logging.md - Session logging behavior and file handling
- spec/settings.md - App and world settings
- spec/style.md - Style settings for fonts and colors used by input and output area, can be stored at three levels: app, world, character
- spec/triggers.md - Simple word highlights and complex regexp triggers

## Purpose
Provide a minimal client for connecting to a MUSH/MUCK/MUD/MOO/MU* session, with just enough features to support roleplay and day-to-day play.

## Core Model
- 'Worlds' are the MU servers, and 'Characters' are named users on the server. All connections are done through the world + character context.
- Per-character notes: locally stored private freeform text associated with a local character.
- Hierarchical triggers: highlight type triggers provide exact-text matches mapped to foreground/background styling, and rule type triggers provide raw regular-expression matches mapped to style actions with room for future line-level behaviors. Triggers can be owned by the app, a world, or a character.
- Session state: active connection, output stream, input focus, read position, etc.

## User Stories
- As a player, I can save multiple characters so I can return to different worlds or accounts quickly.
- As a player, I can edit a character’s host, port, and connection options without recreating it.
- As a player, I can connect to a MU* and read the live transcript in one place.
- As a player, I can type commands in one of two inputs so I can keep a draft while continuing conversation.
- As a player, I can switch inputs instantly when I need to pause one thought and start another.
- As a player, I can keep private notes for each character.
- As a player, I can define highlighted phrases so important names or words stand out.
- As a player, I can define regexp rules so more complex transcript patterns stand out.
- As a player, I can complete recently seen words to speed up typing names.
- As a player, I can tell at a glance whether the session is connected, disconnected, or had a connection error.
- As a player, I can start, stop, and rename a session log for a world tab.
- As a player, I can notice new activity even when I am away from the app.
- As a player, I can restore a recent per-character transcript history when I reconnect after an interruption.
- As a player, I can keep the interface simple and focused on play rather than automation.
- As a player, all my settings should be saved to a simple user-readable file format that I can manage the location of.

## Non-Goals / Not Supported
- No mapping.
- No complex scripting or trigger system.
- No stat bars, combat HUD, or gameplay automation.
- No server-side account sync.
- No shared or cloud persistence.
- No persistence for input history across app restarts.
- No persistence for tabs across app restarts.

# Requirements 

## High-Level Functional Requirements
- Show a character list with create, edit, connect, and delete actions.
- Allow adding and editing character profiles.
- Allow configuring a per-character transcript history line limit, with 0 disabling history storage and restore. The default is 0.
- Connect to a remote MU* endpoint using the selected profile.
- Display incoming text stream with basic terminal-style formatting.
- Preserve line wrapping according to each character’s preferred width when set, otherwise use the available window width. Preferred character width is rendered from the active output style: monospace fonts use the measured active glyph width, while proportional fonts use an estimated average glyph width.
- Provide a modular set of command input bars, starting with one and allowing more to be added.
- Send entered commands to the active session.
- Keep a session-scoped command history queue with a finite limit of 50 entries.
- Use Ctrl+Up/Ctrl+Down to move backward/forward through the queue, including unsent drafts and edited history entries.
- Keep a scrollable transcript of session output.
- Auto-scroll when the user has not manually scrolled away.
- Let the focused input area forward Page Up, Page Down, `Ctrl+Home`, and `Ctrl+End` to the transcript scroll view.
- Forward mouse wheel input from the split live transcript pane to the main transcript pane.
- Indicate connection state and errors clearly.
- Allow session logging for an active world tab.
- Allow reconnecting after disconnect.
- Store characters, notes, and triggers locally on the user’s device.
- Store highlight and regexp rule triggers locally at app, world, or character scope.
- Store rolling per-character transcript history locally and reload it when reconnecting.
- Open and close a notes panel for the active character.
- Open and close a triggers panel for simple text highlights and regexp rules.
- Manage triggers at app, world, or character scope.
- Add and remove highlight rules.
- Edit the text for an existing highlight rule.
- Edit the foreground and background colors for an existing highlight rule.
- Apply highlight foreground and background colors to matching text in session output.
- Let each highlight foreground or background action be enabled or disabled without persisting disabled actions.
- Let each highlight rule toggle case-sensitive matching.
- Let each highlight rule toggle standalone-word matching.
- Add and remove regexp rules.
- Edit the pattern for an existing regexp rule.
- Edit the color for an existing regexp rule.
- Apply regexp rule colors to matching text in session output.
- Apply regexp rule colors to capture groups when present, to the whole regexp match when no capture groups are present, or to the entire matching line when whole-line matching is active.
- Let each regexp rule toggle case-sensitive matching.
- Let each regexp rule optionally stop later rule evaluation or highlight evaluation when it matches.
- Support simple word completion from recently seen session text.
- Support quick switching between the first two input bars with F1 and F2 when a world tab is active. If only one input bar exists, F2 opens a second one.
- Support quick toggling of notes panel with F3.
- Support quick toggling of highlighting panel with F4.
- Play an optional activity alert when the app is unfocused and new output arrives.
- Track focus/title attention state so the user can see unseen activity.
- Store a rolling per-character transcript history locally and reload it when reconnecting.
- Provide a small, low-clutter interface optimized for reading and typing.
