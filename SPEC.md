MUDShow High-Level Tech-Agnostic Spec

# Overview

## Purpose
Provide a minimal client for connecting to a single MU* character/session at a time, with just enough local tooling to support roleplay and day-to-day play.

## Core Model
- Local character profile: name, host, port, secure/plain connection choice, optional preferred output width, rolling output history limit, activity sound setting.
- Per-character notes: locally stored private freeform text associated with a remote character.
- Global highlight rules: exact-text matches mapped to colors.
- Session state: active connection, output stream, input focus, and read position.

## User Stories
- As a player, I can save multiple characters so I can return to different worlds or accounts quickly.
- As a player, I can edit a character’s host, port, and connection options without recreating it.
- As a player, I can connect to a MU* and read the live transcript in one place.
- As a player, I can type commands in one of two inputs so I can keep a draft while continuing conversation.
- As a player, I can switch inputs instantly when I need to pause one thought and start another.
- As a player, I can keep private notes for each character.
- As a player, I can define highlighted phrases so important names or words stand out.
- As a player, I can complete recently seen words to speed up typing names.
- As a player, I can tell at a glance whether the session is connected, disconnected, or in error.
- As a player, I can notice new activity even when I am away from the app.
- As a player, I can restore a recent per-character transcript history when I reconnect after an interruption.
- As a player, I can keep the interface simple and focused on play rather than automation.

## Non-Goals
- No mapping.
- No complex scripting or trigger system.
- No stat bars, combat HUD, or gameplay automation.
- No server-side account sync.
- No shared or cloud persistence.
- No persistence for command history across app restarts.
- No rich regex-based highlight language.

# Requirements 

## High-Level Functional Requirements
- Show a character list with create, edit, connect, and delete actions.
- Allow adding and editing character profiles.
- Allow configuring a per-character transcript history line limit, with 0 disabling history storage and restore. The default is 0.
- Connect to a remote MU* endpoint using the selected profile.
- Display incoming text stream with basic terminal-style formatting.
- Preserve line wrapping according to each character’s preferred width when set, otherwise use the available window width.
- Provide a modular set of command input bars, starting with one and allowing more to be added.
- Send entered commands to the active session.
- Keep a session-scoped command history queue with a finite limit of 50 entries.
- Use Up/Down to move backward/forward through the queue, including unsent drafts and edited history entries.
- Keep a scrollable transcript of session output.
- Auto-scroll when the user has not manually scrolled away.
- Indicate connection state and errors clearly.
- Allow reconnecting after disconnect.
- Store characters, notes, and highlights locally on the user’s device.
- Open and close a notes panel for the active character.
- Open and close a highlights panel for global rules.
- Add and remove highlight rules.
- Apply highlight colors to matching text in session output.
- Support simple word completion from recently seen session text.
- Support quick switching between the first two input bars with F1 and F2 when both are present.
- Support quick toggling of notes panel with F3.
- Support quick toggling of highlighting panel with F4.
- Play an optional activity alert when the app is unfocused and new output arrives.
- Track focus/title attention state so the user can see unseen activity.
- Store a rolling per-character transcript history locally and reload it when reconnecting.
- Provide a small, low-clutter interface optimized for reading and typing.

# Feature Breakdown

## Multiple Input Areas

- The user can spawn additional input boxes if they want to enter text without disturbing the current input box
- The user can close input boxes, their contents if any will be preserved in the input history
- The user can resize the input boxes larger or smaller vertically by 1 line increments

## Input Spellcheck

- The input text box should highlight known spelling errors with red underlines
- Indicated typos should offer spelling correction suggestions
- The spelling check system should allow local overrides, these will be stored app-wide and not scoped by world or character yet

## Input Command History
- The client keeps a single command history queue for the current app session.
- The queue is finite and should retain the most recent 50 entries.
- History is not persisted across app restarts.
- History is shared by all input bars.
- When the user submits a command, that command is appended to the queue if it is not already the most recent entry.
- When the user types a command without submitting it and then starts browsing history, that typed text becomes part of the same queue.
- When the user browses a recalled history entry and edits it, the edited text is stored as a new queue entry rather than replacing the earlier entry.
- `Ctrl+Up` moves backward through the queue toward older entries.
- `Ctrl+Down` moves forward through the queue toward newer entries.
- When `Ctrl+Down` is pressed at the newest queue entry, the input is cleared without changing the queue.
- After that clear, `Ctrl+Up` should show the last queue entry again.
- Plain arrow keys should keep normal caret movement behavior inside the input.

## Global App Settings

App
  - Settings json file location

Activity Notification
  - Blink app
  - Show in app title

Connections
  - Connection timeout (seconds)
  - Connection retries
  - Send TCP Keepalives (SO_KEEPALIVE)

Spellcheck language and/or dictionary

UI color scheme

Window
  - On top
  - Transparency

## Hierarchical Settings Overview

Many settings can apply to a MU world as a whole or only to specific characters within the world. This interface appears as a tree with each known MU world, containing each owned character. A 'Default' character exists for every world, which cannot be renamed, and is used to connect without using any specific character settings.

## World Settings / Character Settings

Uses hierarchical settings.

World Connection Settings
  - Name, shown in tab
  - Host URL/IP
  - Port
  - Use TLS
  - Verify TLS certificate

Character Settings
  - Name, shown in tab
  - Connection string - Optional, command sent upon connection to log in character
  - Always-Log file setup
  - Output-History enabled and how many lines to save/restore
  - Activity notification sound per character

## Trigger / Highlight Settings

Uses hierarchical settings.

## Fonts and Colors Settings

Uses hierarchical settings.

Font and color settings are the same between worlds and characters. Characters can have override settings that are different from the world settings.

# UI Layout

## PlayScreen Layout

PlayScreen
  - HighlightsPanel
  - NotesPanel
  - Transcript
  - InputBars

## Current Layout, 1 character at a time

### UI Layout

App - no tabs
  - CharacterList
    - CharacterModal
  - PlayScreen

## Possible future Layout, multiple characters at once, tab navigation?

### UI Layout

App - Tabbed interface
  - CharacterList tab
      - CharacterEdit - Formerly CharacterModal - Character-specific configuration.
  - AppSettings tab - Global application configuration, not character specific. Storage location of json database file, etc.
  - PlayScreen tab per connection

### Tab Behavior
  - Every connected world character will have its own tab.
  - Tabs can be closed.
  - Only one tab can be opened at a time per world character.
  - Tab names appear with world name and character name.
  - If no tabs are open, the connection selector tab should be shown.
  - Connection tabs are not restored between app sessions.
