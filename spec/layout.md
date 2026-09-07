# UI Layout

- [ ] Implementation status: the flexible interface-indicator system described
  below is not implemented yet. This section defines the intended completed
  behavior.

The app shows a minimal layout with tabs at the top and the open tab filling all the space beneath.
If no tabs are open, the Home Panel is shown instead of a tab.

## Window and Title Bar

The window is frameless. The window title bar is custom styled and does not show the standard OS controls. Empty areas are draggable to move the window.
On Linux, the window edges expose a wider resize hit area with matching resize cursors so the frameless border is easier to grab.
Closing the app shows a confirmation prompt when any world tab is connected or connecting.

Anchored to the left:
- Static app title as a guaranteed draggable area
- App tabs display, implemented by one app-owned Dockview container and occupying all available width:
  - From left to right, show each open world as a tab
  - At the end of the tabs list is a '+' button to add new tabs

Anchored to the right:
  - App hamburger menu
  - OS window controls: minimize, maximize, close

## Shared Context Menus

The app uses one shared context menu shell for the app menu, the tab-bar world context menu, the transcript context menu, and any nested submenu panels they expose.

The shared shell:
- opens from an anchor position supplied by the owning component
- clamps menu panels to the visible window bounds
- repositions on window resize
- closes on outside click or Escape
- supports submenu panels that open to the left or right depending on available space
- uses a short close delay so the pointer can move between a parent menu row and its submenu panel

Menu content stays in the owning component so each feature can keep its own actions and labels.

## Flexible Interface Indicators

The app has a shared interface-indicator system for transient UI elements that
need to appear inside a content stream without becoming part of that stream's
content model. The first consumers are the transcript's last-activity marker
and long-selection range indicators, but the system is available to other
content surfaces with the same needs.

An interface indicator is a host-rendered horizontal bar placed at a defined
boundary between content items. It may contain descriptive text, a compact
status value, a visual marker, or controls associated with the indicator's
owning interaction. Indicators are positioned by the owning surface and are
not represented as ordinary content entries.

### Indicator placement

- An indicator is anchored to a stable boundary before or after a content item,
  rather than to a viewport coordinate.
- The host keeps the indicator at that boundary as content is virtualized,
  resized, reflowed, or otherwise re-rendered.
- An indicator may expose a full-width horizontal bar, a compact inline label,
  or both, but its boundary placement remains unambiguous.
- A surface may expose a connector from an indicator to another indicator or
  content position. Connector geometry belongs to the indicator host and must
  remain stable while the surface scrolls.
- Multiple indicators may occupy the same boundary. The host gives them a
  deterministic order supplied by the owning surface and keeps their visual
  grouping clear.

### Visual treatment

- Indicators use the primary Dockview/application theme highlight or action
  color, including its appropriate foreground and border variants.
- Indicators do not inherit world-session output styles such as transcript
  font, ANSI-derived colors, world background, or world text color.
- The indicator surface remains readable against the current Dockview theme and
  provides a visible focus treatment for any interactive control.
- Indicator content is compact and visually distinct from ordinary content,
  while remaining consistent with the app's shared spacing, border, and radius
  conventions.
- The host does not reserve an indicator's space by inserting fake transcript
  text or by changing the canonical content item's text.

### Ownership and lifecycle

- The owning surface supplies the indicator descriptor, label, placement,
  interaction state, and optional actions.
- The shared host supplies layout, theme treatment, focus treatment, stacking,
  connector geometry, and dismissal plumbing where the descriptor allows it.
- Indicator state is transient UI state unless a feature specification
  explicitly says otherwise. It is not included in content persistence,
  history, logging, search text, or ordinary copy operations.
- Removing or replacing an indicator must not mutate, reorder, or trim the
  content stream that surrounds it.
- An indicator may be fixed, dismissible, or draggable only when its descriptor
  explicitly enables that behavior. The default is non-draggable and
  non-dismissible.
- If the owning surface disappears, its indicators disappear with it. An
  indicator must not leak into another world session, tab, or surface instance.

### Interaction and accessibility

- Non-interactive indicators do not capture pointer events that belong to the
  underlying content surface.
- Interactive indicators expose ordinary keyboard focus, accessible names,
  and actions through the shared context-menu or control conventions.
- Decorative lines and borders are hidden from assistive technology. Descriptive
  indicator text is exposed as status or content associated with its owning
  surface, according to that feature's semantics.
- Indicator text is not included when the user selects or copies surrounding
  content unless the owning feature explicitly defines a separate action that
  copies it.
- The host must preserve sufficient contrast and a non-color cue so an
  indicator is understandable without relying on color alone.

### Transcript use

The transcript may use this system for markers between transcript chunks. A
transcript marker is a view projection over transcript state, not a transcript
chunk. It may reference chunk identity and position for placement, but it must
not enter the transcript database or alter virtualization's canonical content.

The transcript's feature specification owns the meaning of each marker. In
particular:

- the last-activity marker owns its fixed activity position, time-ago label,
  and dismissal behavior;
- the long-selection picker owns its start/end range markers, connecting line,
  drag behavior, preview state, and custom selection menu.

The shared indicator system supplies their common placement and presentation
without deciding transcript semantics.

## App Notices

The app uses one shared app notice host for modal notices, alerts, and confirmations. The host owns the backdrop, focus behavior, stacking order, and dismissal rules.

App notices are always modal:
- They block interaction outside the active notice.
- Clicking the backdrop cancels the active notice.
- Escape cancels the active notice.
- App notices never pop out into separate windows.
- Enabled neutral action buttons in app notices use the bright text color for readability; primary and danger actions keep their accent colors, and disabled actions remain dimmed.

## Hosted Windows

The app uses one shared window host for built-in utility windows and future plugin windows. The host owns the overlay, focus behavior, stacking order, titlebar chrome, and pop-out / pop-in presentation.

The shared host sits above the main tab content, but below the app's shared context menu shell so menus remain on top when both are open.

The host window record carries these presentation flags and behaviors:
- `isModal` - blocks outside interaction and uses a backdrop when true.
- `sizeToContent` - shrink-wraps the shell to its content instead of using the default fixed size.
- `canBackdropDismiss` - allows clicking the backdrop to dismiss a modal window, this only applies when `isModal` is true.
- `canEscapeDismiss` - allows Escape to dismiss the topmost dismissible window.
- `canPopOut` - allows the window to move from the app window into a separate native window.
- `canMoveInApp` - allows the window to be dragged and relocated within the app shell.

Built-in modal windows in the window host default to `isModal = true`, `canPopOut = false`, and `canMoveInApp = false`.

The host record also carries the active placement for the window:
- `in-app` windows stay inside the main app shell.
- `window` windows are shown in their own native window.

Host-managed modal windows should use `sizeToContent` when they are short form dialogs or confirmations, so they fit their content without leaving extra empty space.

Modal dismissal is handled by the host shell:
- Escape closes only the topmost modal window that allows Escape dismissal.
- Backdrop clicks close only the topmost modal window that allows backdrop dismissal.
- Built-in modal content is rendered without its own backdrop or window chrome; it supplies only the inner controls and actions.

## Top Tab Bar
  - Every connected world or world character will have its own tab.
  - Tabs can be closed.
  - Only one tab can be opened at a time per world-only or world-character target. Attempting to open the same target will instead activate that tab.
  - Tab names appear with the world name for world-only connections, or with world name and character name for character connections.
  - Connected tabs show a vertical status display with fixed dot positions for accessibility: connection status, unread activity, and logging status.
  - Inactive activity and logging states remain in fixed invisible slots instead of being removed, so each position always has the same meaning without showing inactive grey dots.
  - A tab shows amber unread activity when it receives output while it is not active, or while it is active but the app window is not focused. The unread activity clears when that tab becomes active in the focused window.
  - If no tabs are open, the Home Panel should be shown centered in the empty content space.
  - Connection tabs are not restored between app sessions.
  - If the frontend WebView reloads while the native Tauri process remains alive, active backend connections are discovered and reattached; this is not app-session tab persistence and does not survive a native-process crash.
  - Characters and App Settings are opened only when the user chooses them and are not instantiated until then.
  - Tabs use Dockview's standard close control to close a tab.
  - CTRL+F4 will close the active tab.
  - Closing a connected or connecting world tab requires confirmation. Clicking the tab X shows a small dropdown anchored to that X, while Ctrl+F4 uses a centered modal confirmation.
  - If the logging reminder is enabled in app settings, closing a disconnected world tab that is not currently being logged also requires confirmation.
  - Tabs can be dragged to re-order them within the tab bar arbitrarily
  - The world tab context menu, whether opened from the top tab bar or the transcript, keeps logging and notes on the main menu and exposes a nested Settings submenu as its own side panel for world-specific shortcuts such as edit world, edit character, edit styles, and edit triggers. The Settings submenu opens on hover or keyboard focus, stays accessible from a click, uses a short close delay so the pointer can cross between panels, and clamps to the app window like the main menu.

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
  - Connection string - Optional, command sent upon connection to log in character. The value is hidden as a password-style input by default and can be temporarily revealed with a reveal button.
  - Output-History enabled and how many lines to save/restore
  - Activity notification sound per character
  - Renaming a saved character will migrate any persisted history and settings to stay associated to the new character name

Deleting a world or a character requires confirmation before it takes effect.
- Deleting a world warns that all saved characters and contained triggers for that world will be removed.
- Deleting a character warns that its saved notes, contained triggers, and stored history will be removed.
- The delete confirmation is the same whether the action is triggered from a world row or a character row.

Deleting a world or a character will not be allowed if there is an open tab on that world or character.

## PlayScreen Layout

The PlayScreen is the main content and interaction space for a single world and character.

PlayScreen
  - Channels - Anchored to the top, shows tabs within each world
  - HighlightsPanel - Toggle, anchored to top
  - Transcript - Fills most space below the channels surface. Shows all connection output.
  - InputBars - Anchored to the bottom, contains one or more input areas
  - Logging controls - Start, stop, and rename the active log file for the current world tab.
  - The active input bar shows the same fixed-position vertical status display as the tab: connection status, unread activity, and logging status.
  - Notes surface - A host-managed character surface in the window host that shows and edits the saved notes for the active character, is registered on demand, can be popped out into a separate native window, and keeps receiving saved note updates while hidden or popped out after it has been opened once.
  - DebugConsole surface - A host-managed world surface in the window host that shows the per-world communication stream for troubleshooting, is registered on demand, can be popped out into a separate native window, and keeps receiving raw output while hidden or popped out after it has been opened once.

  - One PlayScreen instance per world tab.
  - Each PlayScreen instance keeps its own transcript view, scroll position, input bars, panel visibility, and connection status while that tab remains open.

### World-Session Dockview

  - The top app tab bar and the Dockview surface tab bars are separate navigation layers. The top bar switches world sessions; a Dockview tab bar switches surfaces within the active world session.
  - World-session surfaces may be hosted in the center grid, in a floating Dockview group, or in the configured top, right, or left edge groups.
  - An edge group has two independent states:
    - expanded: its surface content and tab bar are visible;
    - collapsed: its content is hidden while its edge reveal/tab strip remains available.
  - A collapsed edge group may be auto-hidden after the custom edge hide delay. Its reveal trigger remains available at that edge when it contains a surface or host action.
  - Selecting a surface tab from a collapsed edge group expands that group and shows the selected surface.
  - Leaving the Dockview area must not collapse an expanded edge group. Leaving the area may allow a collapsed group to remain collapsed or complete its pending auto-hide timer, but it must not expand the group.
  - Moving a surface between edge groups preserves the surface instance and controller state. The destination group becomes visible and expanded for the moved surface.
  - The surface tab bar remains visible whenever its group is expanded or when a collapsed group is represented by an edge reveal/tab strip. Inactive surface tabs remain registered but do not render their content until selected.
  - Floating and native-window transitions do not create a second surface instance. Returning to Dockview uses the surface’s previous dock edge when one is recorded.

## Conversation channels

Channels are logical world-session conversation threads and routing infrastructure, not a separate visual panel system. Conversation surfaces subscribe to channels and use the surfaces system for placement in top or side docks, floating panels, or native windows.

- The channel controller tracks registered and active routed threads for each world session.
- Trigger rules and world-plugin capture behavior may publish ordered entries to channels without owning layout or surface placement.
- A channel may continue receiving routed entries while its reading surface is closed.
- Surface controllers own presentation state; the channel controller owns routing and channel lifecycle.
- The main transcript remains the default live-output view.
- Notes, Debug Console, and FuzzBall storage are surfaces rather than special
  channel types. FuzzBall storage behavior is specified in `spec/fuzzball.md`.
