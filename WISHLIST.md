# Feature Wishlist / Plan

## Top TODO

MVP Features:
- [ ] Session logging. WIP. needs testing. needs better ui!
- [ ] Style. WIP. See "MUD Text > Appearance"
- [ ] Complex highlights, want plaza dimming and page/whisper colors
- [ ] Config versioning, smooth migration of schema changes. WIP. Untested, still at v1.
- [X] Tabs, multiple connections
- [X] Character Settings
  - [X] make hierarchical
  - [X] add world without character
  - [X] auto-add default character, don't save
  - [X] add characters under a world
  - [X] de-dupe quick connect list
  - [X] improve characters edit page
  - [X] add initial connect string (for login).
- [X] App Settings, database location control
- [X] Clickable HTTP* links
- [X] Image link display, toggle with app setting
- [X] input: pageup/pagedown/ctrl+end/ctrl+home keys pass thru to output
- [X] tab menu: shortcut to edit world and/or character?

Bugs:
- [X] Creating new world does not create default character
- [X] fix input box expanding hotkeys conflicting with command history keys
- [X] fix console window opening when running app
- [ ] fix autoscroll to bottom not working if tab is not active? should scroll down when switching back? related to activity indicator line?
- [X] Fix image previews not triggering scroll-to-bottom consistently
- [ ] Fix extra blank line after Taps "Somewhere on the muck, * has connected." Maybe related to PD blank lines at end of +watch and other places.
- [ ] Fix window not flashing on activity
- [X] Fix unmodified home/end keys not working in input window, the passthru to output scrolling should be CTRL+Home and CTRL+End forwarded to output window and unmodified home/end kept to the input text.
- [X] Linux: Fix resize frame, can't see while mousing over

Release:
- [X] include plain exe in 'release' artifacts?
- [X] rename bundle zip from 'desktop-bundle' to app name and version
- [ ] Linux: CI + Release build?
- [ ] Auto-updater:
  - [ ] Tauri updater package for auto-update
  - [ ] Windows partial update packages, signed and onto github
  - [ ] Linux idk, needs release build too

## Input Box
  - [X] Input Command History
  - [X] Re-focus - Automatically bring keyboard focus back to input box after selecting world text or clicking one-shot UI stuff
  - [X] Multiple Input Boxes
    - [X] UI buttons to spawn or remove more inputs
    - [X] F1 F2 shortcut for first two
    - [ ] key shortcuts for expand/shrink/new/close?
  - [X] Resize input height by lines
  - [X] TAB auto-complete of names/objects seen in MUD text
  - [X] CTRL+Enter to make new line without sending
  - [X] Spellcheck, native from browser
    - [ ] Better spellcheck?
  - [ ] Thesaurus
  - [ ] Character count - Buffer indicator

## MUD Text
  - Appearance - Fonts/colors customization, not app UI theming.
    - [X] Switch built-in fonts
    - [X] Pick font colors
    - [ ] Customize ANSI colors
    - [X] Pick font sizes
      - [ ] Keyboard/mousewheel shortcut to change font size on the fly?
    - [X] App default styles
    - [X] App override styles
    - [ ] System fonts picking, see `PLAN_FONTS.md`
    - [ ] Background images
  
  - Contents
    - [X] Clickable links
    - [X] Auto-preview image links with hide button
    - [X] Automatic clipboard copy when selecting text
    - [ ] Timestamps visible on mouse-over lines
    - [ ] Visible timestamps customizable
    - [X] Output history - Buffer of previous session contents restored for context
    - [ ] Visual differentiation of different poses by different people - Paragraph margin, subtle alternating color differences, something to visibly separate poses in the wall of white text.
    - [ ] New activity indicator (separator line?)
    - [ ] Max width is off, too short, try calculate glyph width from a mono font, maybe support pixel max width for non-mono fonts

  - Scrolling
    - [ ] Pause auto-scroll when selecting
    - [X] END key in input area scrolls main output text to end
    - [X] PAGE UP / PAGE DOWN / CTRL+HOME / CTRL+END keys in input area scroll main output text
    - [ ] Mouse wheel on input area scrolls main output text
    - [ ] Keep current bottom line in view when resizing
    - [ ] Option to NOT auto-scroll when not in focus
    - [ ] Visible counter of lines remaining when scrolled up
    - [X] Pause automatic scroll to bottom when scrolled up manually
    - [X] Shortcut button to scroll to bottom appears when scrolled up manually
    - [X] Split scrolling, keep the current output in view at the bottom while the upper portion scrolls up

  - Highlighting
    - [ ] User specified word color highlights
    - [ ] Separate name highlights from complex (regex?) highlights, simplify name handling
    - [X] Click highlight color to change it
    - [X] Toggle matching case sensitivity
    - [X] Toggle matching on word boundaries
    - [ ] Toggle matching on beginning of line only
    - [X] Inputting a name to highlight should trim whitespace
    - [ ] Reg-ex highlights
    - [ ] Automatic highlights of name variations like [`'s`, `s'`] without making a bunch of regex stuff
    - [ ] Automatic name color even if they're not in your wf/database

  - Logging
    - [X] One-click session logging. Start logging and auto-name log file.
    - [X] Visual indicator that logging is enabled
    - [X] On-the-fly log renaming of active session log file
    - [ ] Auto-log everything to separate log file
    - [ ] Customize log name format, incl folders
    - [X] Show log name that will be used next to quick log button, user can edit the filename before starting, show indicator if file exists and will be appended to
    - [ ] Global option to offset date by 5 hours to record as the previous day if logging at 3am

## Database MUD text backend

Instead of storing world text simply as the contents of the play window, it should be stored locally in an in-memory SQLite database. Future file databases or exports should be user-readable such as  JSONL, or structured text.

This would support:
  - Virtualized scrolling
  - Longer history
  - Changing timestamp display on the fly
  - Timestamps visible on mouse-over lines
  - More logging control, save without timestamps, etc
  - Ability to pop-out and pop-in breakouts of conversations
  - Output history would support rich reformatting to match current session settings
  - Save database version code so user database files can be converted or upgraded losslessly as the app changes. Version such as "j1" for json version 1 storage schema, or "b1" for binary storage version 1.

## Multiple Connections
  - [ ] UI tabs for active viewing worlds and allowing switching between them
    - [X] show connection status
    - [ ] show activity status, should always be visible and grey if no new activity, maybe flashing amber for unread activity?
    - [X] show logging status
  - [X] CTRL+TAB switch worlds
  - [X] CTRL+F4 to close active tab
  - [X] Reconnect without closing world tab
  - [X] Disconnect without closing world tab
  - [X] Confirm closing connected tab, no matter the means of closing the tab
  - [ ] Confirm closing the app if tabs are connected
  - [ ] Confirm closing un-logged tab (if this reminder is enabled in app settings)

## Window
  - [ ] On-top option
  - [ ] Window transparency

## Settings
  - [ ] two-pane world/character settings, no modals
    - [ ] route-able to each place when selecting edit world/character from menus
  - [X] tabbed/two-pane app settings, instead of everything in one page
    - [ ] route-able to each sub-tab

## Taps Integrations
  - Plugin System
    - [ ] Specific MU integrations should be managed as modular plugins
    - [ ] plugins may come from different sources and should auto-update separately from the app
    - [ ] plugins may include world definitions, avoid clobbering user definitions by server name
  - Editors
    - [ ] Description editor
    - [ ] Morph editor
    - [ ] Room editor
    - [ ] List editor
  - Echo
    - [ ] Support echo command - Returns text sent but with clear decoration - Useful for delimiting start/end of multi-line blocks
    - [ ] Inject echo command on demand
    - [ ] MOTD hiding
    - [ ] Room description capture
  - Name Awareness
    - [ ] Detect known character names in poses, pages, whispers, DMs
    - [ ] Support automatic name color variation even if they're not in your wf/database
    - [ ] Support visual format differentiation of different poses by different people
    - [ ] Support integration with WF/WS and local contact list
  - WF
    - [ ] WF sidebar
    - [ ] Address-book style list, local database of whole WF
    - [ ] Hidefrom display - Hidden or not. Countdown to visibility.
    - [ ] Hidefrom button
  - Conversation Tabs
    - [ ] Whisper tabs
    - [ ] Page tabs
    - [ ] Pop-out tab on mouseover whisper/page - Text removed from muck text
    - [ ] Pop-in tab back to muck text
  - Last-paged, Last-Whispered
    - [ ] Detect last paged and last whispered names
    - [ ] Auto-complete 'p =', 'wh =' shortcuts to reduce mavs
  - Other
    - [ ] WS sidebar
    - [ ] WHO popout
  - Help!
    - [ ] Help guide for basic taps commands
    - [ ] Click commands to see their help text
    - [ ] Break-out help text to separate window
