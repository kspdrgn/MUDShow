# Feature Wishlist / Plan

## Top TODO

bugs:
- selecting while scrolling can get transcript stuck in two-pane mode
- transcript
  - [X] fixed? output lag, things not appearing as soon as they should. debug console updates immediately, but transcript doesn't.
  - [ ] select lots of text misses some because of virtualization?
- surfaces
  - [X] fixed? resizing top dock can trigger split scrolling.
  - [ ] not fixed? resizing top dock can move bottom of transcript off screen.
- fuzzball storage viewer
  - test with multiple worlds at once.
  - expand all doesn't send requests for unloaded nodes.

- image previews not working in linux?
- change char connect string to password style with reveal button
- logging separate action buttons, show full text of what they do
- logging show log location when stop logging
- logging include timestamp in log when starting? ending?

- [X] channel bar controls
  - [X] button for debug dictionary open
- [X] fuzzball plugin skeleton
  - [X] generic prop tree debug view
  - [X] parsing exa props
  - [X] get
  - [ ] set, revamp ui...
  - [ ] filter out captured props from transcript IF they are from plugin requests (not manual user requests)
    - [ ] capture pipeline filter system to omit contents from transcript
- [X] app notice modals system separate from hosted popout windows
- [X] app DI, slim down App.svelte
- [X] worldSession DI, slim down component plumbing
- [ ] debug console
  - [X] display raw input/output
  - [ ] input to impersonate world input
- [ ] plugin architecture
- [ ] taps plugin skeleton
  - [ ] desc editor first candidate window
  - [ ] morph list
  - [ ] morph editor
  - [ ] page popouts to channels
  - [ ] WS side channel
  - [ ] ridemode dropdown control
- [X] surfaces
  - [X] Dockview
  - [X] consolidated channels? move channels from top to side to pop-in to pop-out?
  - [X] side channels
  - [X] message bus
  - [ ] dockview tabs should have less gutter on top and bottom.
  - [ ] tree ui sucks, duplicates words, selection box not responsive
  - [ ] trim extra logging everywhere
  - [ ] clicking dock panels doesn't refocus to input area
  - [ ] dock panel auto-hide doesn't always activate, not sure why
  - [ ] 'f3' key in some places opens native webUi find dialog, maybe keep in transcript/notes/debug/etc text areas? move notes key to another key if keeping?

MVP Features:
- [X] Notes persistence
- [X] Channels!
  - [X] Notes
  - [X] Debug console
  - [ ] Trigger routing to channel
- [X] Move all modal popups to dedicated modal notice host
- [ ] Surfaces!
  - [X] Dockable panels as tabs
  - [X] Pop-out to floating panel
  - [X] Pop-out to native window
  - [X] Dummy testing windows
- [ ] Channel bar controls
  - [ ] Modular plugin-owned UI controls
  - [ ] Dropdown menus
  - [ ] Menu menus
  - [X] Buttons
- [X] Session logging.
- [X] Style. See "MUD Text > Appearance"
- [X] Regexp triggers, want to dim traffic messages and color pages/whispers to make them stand out
- [ ] Config versioning, smooth migration of schema changes. WIP. Untested, still at v1.
- [ ] New activity indicator (separator line?)
- [ ] App activity indicator settings, constant blinking? other possibilities?
- [X] Consolidate world context menu settings shortcuts into settings submenu, to shrink menu and allow adding more
- [X] Keyboard/mousewheel shortcut to change zoom on the fly
- [X] scroll virtualization, render cache, configurable history length
- [X] Trigger hierarchy
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
- [ ] image previews disable trigger coloring
- [ ] fix transcript being kind of janky, it shifts around a lot when it's supposed to be scrolled to the bottom
- [X] fix !wholeLine rules styling whole line anyway
- [X] Creating new world does not create default character
- [X] fix input box expanding hotkeys conflicting with command history keys
- [X] fix console window opening when running app
- [ ] fix autoscroll to bottom not working if tab is not active? should scroll down when switching back? related to activity indicator line?
- [X] Fix image previews not triggering scroll-to-bottom consistently
- [X] Fix extra blank line after Taps "Somewhere on the muck, * has connected." Maybe related to PD blank lines at end of +watch and other places. Now gathers lines until a newline character.
- [X] Fix window not flashing on activity
- [X] Fix unmodified home/end keys not working in input window, the pass-thru to output scrolling should be CTRL+Home and CTRL+End forwarded to output window and unmodified home/end kept to the input text.
- [X] Linux: Fix resize frame, can't see while mousing over

Release:
- [X] include plain exe in 'release' artifacts?
- [X] rename bundle zip from 'desktop-bundle' to app name and version
- [X] Linux: CI + Release build?
- [ ] signed releases
  - [ ] separate github?
- [ ] Auto-updater:
  - [ ] Tauri updater package for auto-update
  - [ ] Windows partial update packages, signed and onto github
  - [ ] Linux idk

## Input Box
  - [X] Input Command History
  - [X] Re-focus - Automatically bring keyboard focus back to input box after selecting world text or clicking one-shot UI stuff
  - [X] Multiple Input Boxes
    - [X] UI buttons to spawn or remove more inputs
    - [X] F1 F2 shortcut for first two
    - [X] key shortcuts for expand/shrink
  - [X] Resize input height by lines
  - [X] TAB auto-complete of names/objects seen in MUD text
  - [X] CTRL+Enter to make new line without sending
  - [ ] Automatic expand input box when filling it up. Beip does this with automatic contraction back to previous size.
  - [ ] Drag to resize input box instead of needing buttons. Beip does this, has no buttons.
  - [X] Spellcheck
    - [ ] Better spellcheck timing? When done with a word or when moving past it? I think BeipMU is when you move past it. Currently doing it every character for early squiggles, don't like.
    - [X] Better spellcheck - `spellbook` library
    - [ ] Better spellcheck - `hunspell-rs` library
  - [ ] Thesaurus
  - [ ] Character count - Buffer indicator
  - [ ] Duplicate word indicator? Suggest alternates? Search past lines? hmm...
  - [ ] Automatic fixing of misplaced space or obvious typos? idk.. confidence score for autocorrects?
  - [ ] Automatic conversion of tab/newline to %r%t for worlds that need it.

## MUD Text
  - Appearance - Fonts/colors customization, not app UI theming.
    - [X] Switch built-in fonts
    - [X] Pick font colors
    - [ ] Customize ANSI colors
    - [X] Pick font sizes
    - [X] Keyboard/mousewheel shortcut to zoom transcript on the fly
    - [X] App default styles
    - [X] App override styles
    - [X] System fonts picking, see `PLAN_FONTS.md`
    - [ ] Background images
    - [ ] World styles, overriding app styles, overriding default styles

  - Contents
    - [X] Clickable links
    - [X] Auto-preview image links with hide button
    - [X] Automatic clipboard copy when selecting text
    - [X] Timestamps visible on mouse-over lines
    - [ ] Visible timestamps customizable
    - [X] Output history - Buffer of previous session contents restored for context
    - [ ] Visual differentiation of different poses by different people - Paragraph margin, subtle alternating color differences, something to visibly separate poses in the wall of white text.
    - [ ] New activity indicator (separator line?)
    - [X] Max width is off, too short, try calculate glyph width from a mono font, maybe support pixel max width for non-mono fonts

  - Scrolling
    - [ ] Pause auto-scroll when selecting
    - [X] END key in input area scrolls main output text to end
    - [X] PAGE UP / PAGE DOWN / CTRL+HOME / CTRL+END keys in input area scroll main output text
    - [X] Mouse wheel on input area scrolls input area
    - [ ] Keep current bottom line in view when resizing
    - [ ] Option to NOT auto-scroll when not in focus
    - [ ] Visible counter of lines remaining when scrolled up
    - [X] Pause automatic scroll to bottom when scrolled up manually
    - [X] Shortcut button to scroll to bottom appears when scrolled up manually
    - [X] Split scrolling, keep the current output in view at the bottom while the upper portion scrolls up

  - Word Highlighting
    - [X] User specified word color highlights, no regex
    - [X] Click highlight color to change it
    - [X] Toggle matching case sensitivity
    - [X] Toggle matching on word boundaries
    - [X] Inputting a name to highlight should trim whitespace
    - [X] Color foreground/background
    - [ ] Optional automatic highlights of name variations like [`'s`, `s'`] without making a bunch of regex stuff?
    - [X] Copy/paste as JSON
    - [X] Toggles to color actions
    - [X] Collapse highlights into rules with different type

  - Trigger Rules
    - [X] Reg-ex highlights
    - [ ] Show action shorthands in tree view, such as color swatches, maybe small indicators of big functionality
    - [X] Hierarchical rules/highlights
    - [X] Drag reorder/rearrange rules
    - [X] Color foreground/background
    - [X] Opacity
    - [ ] Toggle matching on beginning of line only
    - [ ] Send to tab...
    - [ ] Toggle logging this line
    - [ ] Toggle activity notification
    - [X] Copy/paste as JSON

  - Name awareness
    - [ ] Automatic name color even if they're not in your wf/database
    - [ ] Temporarily filter only select names to read a scene thru the spam. Maybe in a separate tab view?

  - Logging
    - [X] One-click session logging. Start logging and auto-name log file.
    - [X] Visual indicator that logging is enabled
    - [X] On-the-fly log renaming of active session log file
    - [ ] Auto-log everything to separate log file with rolling log management
    - [ ] Customize log name format, incl folders
    - [X] Show log name that will be used next to quick log button, user can edit the filename before starting, show indicator if file exists and will be appended to
    - [ ] Global option to offset date by 5 hours to record as the previous day if logging at 3am

## Database MUD text backend

Instead of storing world text simply as the contents of the play window, it should be stored locally in an in-memory database. Future file databases or exports should be user-readable such as  JSONL, or structured text.

- [X] Long canonical history store with rich state
- [ ] Smooth sexy 60/120fps scrolling
  - [X] Short render cache
  - [X] Scroll DOM virtualization
  - [ ] smooth scrolling?
  - [ ] stress testing and optimization
- [ ] Triggers integration
  - [ ] Triggers configurable to route matches out of logging
- [ ] Logging options?
  - [ ] Write timestamps an beginning of log chunks, maybe with configurable formatting.
  - Would the user ever want to re-log from history with different settings?

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
  - [X] UI tabs for active viewing worlds and allowing switching between them
    - [X] show green connection status
    - [X] show amber activity status
    - [X] show red logging status
  - [X] CTRL+TAB switch worlds
  - [X] CTRL+F4 to close active tab
  - [X] Reconnect without closing world tab
  - [X] Disconnect without closing world tab
  - [X] Confirm closing connected tab, no matter the means of closing the tab
  - [X] Confirm closing the app if tabs are connected
  - [X] Confirm closing un-logged tab (if this reminder is enabled in app settings)

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
