# Feature Wishlist / Plan

## Top TODO

- Tabs, multiple connections
- Session Logging
- Image link display
- Spellcheck
- App Settings, database location control

## Input Box
  - [X] Input Command History
  - [X] Re-focus - Automatically bring keyboard focus back to input box after selecting world text
  - [X] Multiple Input Boxes - Buttons to spawn or remove more inputs
  - [X] Resize input height by lines
  - [?] TAB auto-complete of names/objects known or in MUD text
  - [ ] Spellcheck
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
  - Scrolling
    - [ ] Pause auto-scroll when selecting
    - [ ] Mousewheel anywhere scrolls the main window
    - [ ] END key anywhere scrolls to end
    - [ ] PAGE UP / PAGE DOWN keys anywhere scroll main text
    - [ ] Keep bottom line in view when resizing
    - [ ] Pause automatic scroll to bottom when scrolled up manually
    - [ ] Shortcut button to scroll to bottom appears when scrolled up manually
  - Highlighting
    - [ ] User specified word color highlights
    - [ ] Reg-ex highlights
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
  - More logging control, save without timestamps, etc
  - Ability to pop-out and pop-in breakouts of conversations

## Multiple Connections
  - [ ] Tabs for worlds
  - [ ] CTRL+TAB switch worlds
  - [ ] Reconnect without closing world
  - [ ] Disconnect without closing world

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

## Window
  - [ ] On-top option
  - [ ] Window transparency
  - [ ] Tabbed interface, multiple connections at once
  - [ ] App settings
  - [ ] Heirarchical world and character settings
