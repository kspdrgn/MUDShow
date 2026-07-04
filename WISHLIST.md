# Feature Wishlist / Plan

## Top TODO

- Tabs, multiple connections
- Session Logging
- Image link display
- App Settings, database location control

## Input Box
  - [X] Input Command History
  - [X] Re-focus - Automatically bring keyboard focus back to input box after selecting world text
  - [X] Multiple Input Boxes - Buttons to spawn or remove more inputs
  - [X] Resize input height by lines
  - [?] TAB auto-complete of names/objects known or in MUD text
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

Instead of storing world text as the contents of the play window, it should be stored locally in a database. Likely using SQLite.

This would support:
  - Virtualized scrolling
  - Longer history
  - Changing timestamp display on the fly
  - Timestamps visible on mouse-over lines
  - More logging control, save without timestamps, etc
  - Ability to pop-out and pop-in breakouts of conversations
  - Output history would support rich reformatting to match current session settings

## Multiple Connections
  - [ ] UI tabs for viewing worlds, their activity and logging status, and for switching between them
  - [ ] CTRL+TAB switch worlds
  - [ ] Reconnect without closing world tab
  - [ ] Disconnect without closing world tab

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
    - Support automatic name color variation even if they're not in your wf/database
    - Support visual format differentiation of different poses by different people
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
