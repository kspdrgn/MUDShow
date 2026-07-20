# UI Layout

The app shows a minimal layout with tabs at the top and the open tab filling all the space beneath.
If no tabs are open, the Home Panel is shown instead of a tab.

## Window and Title Bar

The window is frameless. The window title bar is custom styled and does not show the standard OS controls. Empty areas are draggable to move the window.
On Linux, the window edges expose a wider resize hit area with matching resize cursors so the frameless border is easier to grab.

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
  - Connected tabs show a connection status dot and, when logging is active, a second logging status dot beneath it.
  - If no tabs are open, the Home Panel should be shown centered in the empty content space.
  - Connection tabs are not restored between app sessions.
  - Characters and App Settings are opened only when the user chooses them and are not instantiated until then.
  - Tabs will have an X button anchored on their right side to close a tab.
  - CTRL+F4 will close the active tab.
  - Closing a connected or connecting world tab requires confirmation. Clicking the tab X shows a small dropdown anchored to that X, while Ctrl+F4 uses a centered modal confirmation.
  - Tabs can be dragged to re-order them within the tab bar arbitrarily

## Quick Connect Menu

The '+' button on the tab bar shows the quick connect menu as a dropdown menu. This displays a list of saved worlds and characters. Clicking a row will open a new tab. It also shows a gear icon labelled "Edit Characters" that will open the characters menu interface in a new tab.

## App Hamburger Menu

- Characters - opens or creates the Characters Tab
- App Settings - opens or creates the App Settings Tab
- Dev Tools - opens the native web inspector for the main webview in desktop development builds

# Tabs

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
  - Open the current database folder and select the file
  - Pick a different database file with a native file picker
  - Move the current database file to a new location with a native save dialog

Activity Notification
  - Blink app or not
  - Show activity in app title, how to show it, or not

Connections
  - Connection timeout (seconds)
  - Connection retries
  - Send TCP Keepalives (SO_KEEPALIVE)

Spellcheck language and/or dictionary to use

UI color scheme
- Secondary or dim UI text must remain readable on dark grey surfaces; it should meet normal text contrast expectations instead of relying on very low-contrast grey.

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
  - Output-History enabled and how many lines to save/restore
  - Activity notification sound per character
  - Renaming a saved character will migrate any persisted history and settings to stay associated to the new character name

Deleting a world or a character requires confirmation before it takes effect.
- Deleting a world warns that all saved characters for that world will be removed.
- Deleting a character warns that its saved notes, highlights, and stored history will be removed.
- The delete confirmation is the same whether the action is triggered from a world row or a character row.

Deleting a world or a character will not be allowed if there is an open tab on that world or character.

## PlayScreen Layout

The PlayScreen is the main content and interaction space for a single world and character.

PlayScreen
  - HighlightsPanel - Toggle, anchored to top
  - NotesPanel - Toggle, anchored to top
  - Transcript - Fills most space in the middle. Shows all connection output.
  - InputBars - Anchored to the bottom, contains one or more input areas
  - Logging controls - Start, stop, and rename the active log file for the current world tab.
  - The active input bar shows a logging status dot beneath the connection status dot when logging is active.

  - One PlayScreen instance per world tab.
  - Each PlayScreen instance keeps its own transcript view, scroll position, input bars, panel visibility, and connection status while that tab remains open.
