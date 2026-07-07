# Feature Wishlist / Plan

## Top TODO

- [X] Tabs, multiple connections
- [ ] [WIP] App Settings, database location control
- [ ] [WIP] Character Settings - make hierarchical, add world without character, auto-add default character, add characters under a world, de-dupe quick connect list, improve characters edit page.
- [ ] Config versioning, migration with schema changes
- [ ] Session Logging
- [ ] Image link display
- [ ] Easier/better name highlighting config

## Input Box
  - [X] Input Command History
  - [X] Re-focus - Automatically bring keyboard focus back to input box after selecting world text or clicking one-shot UI stuff
  - [X] Multiple Input Boxes - Buttons to spawn or remove more inputs
  - [X] Resize input height by lines
  - [ ] [?] TAB auto-complete of names/objects known or in MUD text
  - [X] Spellcheck
  - [ ] Thesaurus
  - [ ] Character count - Buffer indicator

## MUD Text
  - Appearance
    - [ ] Customize font
    - [ ] Customize base colors, ANSI overrides
    - [ ] Background image
  - Contents
    - [ ] Clickable links
    - [ ] Auto-show image links
    - [X] Automatic clipboard copy when selecting text
    - [ ] Timestamps visible on mouse-over lines
    - [ ] Visible Timestamps customizable
    - [X] Output history - Buffer of previous session contents restored for context
    - [ ] Visual differentiation of different poses by different people - Paragraph margin, subtle alternating color differences, something to visibly separate poses in the wall of white text.
  - Scrolling
    - [ ] Pause auto-scroll when selecting
    - [ ] Mousewheel anywhere scrolls the main window
    - [ ] END key anywhere scrolls to end
    - [ ] PAGE UP / PAGE DOWN keys anywhere scroll main text
    - [ ] Keep bottom line in view when resizing
    - [ ] Pause automatic scroll to bottom when scrolled up manually
    - [ ] Shortcut button to scroll to bottom appears when scrolled up manually
    - [ ] Split scrolling, keep the current output in view at the bottom while the upper portion scrolls up
  - Highlighting
    - [ ] Separate name highlights from complex (regex?) highlights, simplify name handling
    - [ ] Click highlight color to change it
    - [ ] Inputting a name to highlight should trim whitespace
    - [ ] User specified word color highlights, with word boundary, with case sensitivity
    - [ ] Reg-ex highlights
    - [ ] Automatic highlights of name variations like [`'s`, `s'`] without making a bunch of regex stuff
    - [ ] Automatic name color even if they're not in your wf/database
  - Logging
    - [ ] One-click session logging. Start logging and auto-name log file with date and maybe characters too.
    - [ ] Visual indicator that logging is enabled
    - [ ] On-the-fly log renaming of active session log file
    - [ ] Auto-log everything to separate log file

## Database MUD text backend

Instead of storing world text simply as the contents of the play window, it should be stored locally in a SQLite database. Database exports should be user-readable such as  JSONL, or structured text.

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
  - [ ] UI tabs for viewing worlds, their activity and logging status, and for switching between them
  - [ ] CTRL+TAB switch worlds
  - [X] CTRL+F4 to close active tab
  - [X] Reconnect without closing world tab
  - [X] Disconnect without closing world tab
  - [X] Confirm closing connected tab, no matter the means of closing the tab
  - [ ] Confirm closing the app if tabs are connected
  - [ ] Confirm closing un-logged tab (if this reminder is enabled in options)

## Taps Integrations
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

## Window
  - [ ] On-top option
  - [ ] Window transparency
  - [ ] Tabbed interface, multiple connections at once
  - [ ] App settings
  - [ ] Hierarchical world and character settings
