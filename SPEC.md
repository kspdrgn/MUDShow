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
- As a player, I can tell at a glance whether the session is connected, disconnected, or had a connection error.
- As a player, I can notice new activity even when I am away from the app.
- As a player, I can restore a recent per-character transcript history when I reconnect after an interruption.
- As a player, I can keep the interface simple and focused on play rather than automation.
- As a player, all my settings should be saved to a simple user-readable file format that I can manage the location of.

## Non-Goals
- No mapping.
- No complex scripting or trigger system.
- No stat bars, combat HUD, or gameplay automation.
- No server-side account sync.
- No shared or cloud persistence.
- No persistence for command history across app restarts.
- No persistence for tabs across app restarts.
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
- Use Ctrl+Up/Ctrl+Down to move backward/forward through the queue, including unsent drafts and edited history entries.
- Keep a scrollable transcript of session output.
- Auto-scroll when the user has not manually scrolled away.
- Indicate connection state and errors clearly.
- Allow reconnecting after disconnect.
- Store characters, notes, and highlights locally on the user’s device.
- Store rolling per-character transcript history locally and reload it when reconnecting.
- Do not persist input history across app restarts.
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

## Hierarchical Settings Overview

Many settings can apply to a MU world as a whole or only to specific characters within the world. This interface appears as a tree with each known MU world, containing each owned character. A 'Default' character exists for every world, which cannot be renamed, and is used to connect without using any specific character settings.

All connections to a MU server are done through the World + Character context, even if the character is the default unnamed fake character.

## Trigger / Highlight Settings

Uses hierarchical settings.

## Fonts and Colors Settings

Uses hierarchical settings.

Font and color settings are the same between worlds and characters. Characters can have override settings that are different from the world settings.

## Transcript

Selecting text will automatically copy to clipboard and return keyboard focus to the last active input box

# UI Layout

The app shows a minimal layout with tabs at the top and the open tab filling all the space beneath.
If no tabs are open, the Home Panel is shown instead of a tab.

## Title Bar

The window title bar is custom styled, and does not show the standard OS controls. Empty areas are draggable to move the window.

Anchored to the left:
- Static app title as a guaranteed draggable area
- App tabs display, occupies all available width:
  - From left to right, show each open world as a tab
  - At the end of the tabs list is a '+' button to add new tabs

Anchored to the right:
  - App hamburger menu
  - OS window controls: minimize, maximize, close

## Tab Bar
  - Every connected world character will have its own tab.
  - Tabs can be closed.
  - Only one tab can be opened at a time per world character. Attempting to open the same character will instead activate that tab.
  - Tab names appear with world name and character name.
  - If no tabs are open, the Home Panel should be shown centered in the empty content space.
  - Connection tabs are not restored between app sessions.
  - Characters and App Settings are opened only when the user chooses them and are not instantiated until then.
  - Tabs will have an X button anchored on their right side to close a tab. Connected worlds will display a popup modal confirmation before allowing the close action.
  - Tabs can be dragged to re-order them within the tab bar arbitrarily

## Quick Connect Menu

The '+' button on the tab bar shows the quick connect menu as a dropdown menu. This displays a list of saved worlds and characters. Clicking a row will open a new tab. It also shows a gear icon labelled "Edit Characters" that will open the characters menu interface in a new tab.

## App Hamburger Menu

- Characters - opens or creates the Characters Tab
- App Settings - opens or creates the App Settings Tab

# Possible Tab Contents

## Home Panel

This panel cannot be opened manually and does not show as a tab. It displays when no tabs are opened.

Contents:
- Large app title and about information
- Centered display of the Quick Connect Menu, which contains a link to the Characters edit tab
- Link to app settings tab

## App Settings Tab

This tab is created only when the user opens it.

Database
  - Show current user settings data location
  - Change/migrate user data files location

Activity Notification
  - Blink app or not
  - Show activity in app title, how to show it, or not

Connections
  - Connection timeout (seconds)
  - Connection retries
  - Send TCP Keepalives (SO_KEEPALIVE)

Spellcheck language and/or dictionary to use

UI color scheme

Window
  - On top
  - Transparency

## Characters Tab

This shows a list of all saved worlds and characters, with ability to add more and edit anything.
This tab is created only when the user opens it.

Uses hierarchical settings.

World Connection Settings
  - Name, shown in tab
  - Host URL/IP
  - Port
  - Use TLS
  - Verify TLS certificate or not

Character Settings
  - Name, shown in tab
  - Connection string - Optional, command sent upon connection to log in character
  - Always-Log file setup
  - Output-History enabled and how many lines to save/restore
  - Activity notification sound per character
  - Renaming a saved character will migrate any persisted history and settings to stay associated to the new character name

Deleting a world or a character will not be allowed if there is an open tab on that world or character.

## PlayScreen Layout - World and Character Tab

Main content and interaction space for a single world and character.

PlayScreen
  - HighlightsPanel - Toggle, anchored to top
  - NotesPanel - Toggle, anchored to top
  - Transcript - Fills most space in the middle. Shows all connection output.
  - InputBars - Anchored to the bottom, contains one or more input areas

  - One PlayScreen instance per world tab.
  - Each PlayScreen instance keeps its own transcript view, scroll position, input bars, panel visibility, and connection status while that tab remains open.
