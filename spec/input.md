# InputBars

Input boxes are where the user sends their outgoing commands and text to the server.

InputBars component shows one or more input boxes associated with a world.

## InputBar Controls

The input bar menu shows when mousing over the right side of the input box
- Star - Spawn new input bar below this one
- Up - Grow input box size by one row
- Down - Shrink box size by one row
- X - Close this input bar

## Input Re-Focus

Keyboard focus should be automatically restored to the last selected input box:
- When doing one-shot UI actions, like toggling a global setting from the menu.
- When switching active world tabs.
- When selecting output text to copy it.

## Multiple Input Areas

- The user can spawn additional input boxes if they want to enter text without disturbing the current input box.
- The user can close input boxes, their contents if any will be preserved in the input history.
- The user can resize the input boxes larger or smaller vertically by 1 line increments.
- When a world tab is active, F1 focuses the first input box and F2 focuses the second. If only one input box exists, F2 creates a second input box and focuses it.
- `Alt+Shift+Up` and `Alt+Shift+Down` move keyboard focus to the previous or next input box when more than one input box exists.
- `Ctrl+Alt+Up` and `Ctrl+Alt+Down` resize the current input box larger or smaller by one row.
- `Ctrl+Up` and `Ctrl+Down` browse the shared input history queue.
- Mixed modifier combinations like `Ctrl+Alt+Shift+Up` and `Ctrl+Alt+Shift+Down` are ignored by the custom hotkey handling.

## [ ] Input Spellcheck

- [X] The input text box should highlight known spelling errors with red underlines.
- [X] Indicated typos should offer spelling correction suggestions.
- [ ] The spelling check system should allow local overrides, these will be stored app-wide.

## [X] Input Command History
- The client keeps a command history queue for each world tab
- The queue is finite and should retain the most recent 50 entries.
- History is not persisted across app restarts.
- History is shared by all input bars in the world tab.
- When the user submits a command, that command is appended to the queue if it is not already the most recent entry.
- When the user types a command without submitting it and then starts browsing history, that typed text becomes part of the same queue.
- When the user browses a recalled history entry and edits it, the edited text is stored as a new queue entry rather than replacing the earlier entry.
- `Ctrl+Up` moves backward through the queue toward older entries.
- `Ctrl+Down` moves forward through the queue toward newer entries.
- When `Ctrl+Down` is pressed at the newest queue entry, the input is cleared without changing the queue.
- After that clear, `Ctrl+Up` should show the last queue entry again.
- Plain arrow keys should keep normal caret movement behavior inside the input.
