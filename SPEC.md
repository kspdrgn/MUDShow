MUDShow High-Level Tech-Agnostic Spec

# Overview

## Purpose
Provide a minimal client for connecting to a single MU* character/session at a time, with just enough local tooling to support roleplay and day-to-day play.

## Core Model
- Local character profile: name, host, port, secure/plain connection choice, optional preferred output width, activity sound setting.
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
- Provide a small, low-clutter interface optimized for reading and typing.

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
