# Output / Transcript

- [X] Implementation status: the last-activity indicator and long-selection UX
  mode described below are implemented.

## Transcript

Selecting text will automatically copy to clipboard and return keyboard focus to the last active input box

HTTP and HTTPS URLs in transcript text are rendered as clickable links. Clicking a link opens it in the user's default browser, while plain text selection and copy behavior still work normally.

Incoming world text is buffered until a newline is received. The transcript only receives complete lines, `\r` characters are discarded, and a trailing partial line is held until it is completed or the connection ends.

The transcript keeps only the visible rows and a small scroll buffer mounted while the history is very large, so scrolling stays responsive even with a lot of saved output.

### Transcript retention and restored history

- Each open world tab keeps a bounded in-memory transcript of normalized output chunks. The app setting `Scrollback chunks` controls this limit; the default is 50,000 chunks. Older chunks are discarded as new chunks arrive.
- The transcript is the source for the current tab's scrollback. Its chunks retain their text and line/character counts so the renderer can virtualize the visible range and re-render chunks when formatting or display dependencies change.
- Each world session also has a small render cache for recently rendered chunks. The cache is disposable and may be rebuilt from the retained transcript; it is not a persistence mechanism.
- A named character may opt into restored output history by setting a positive output-history line limit. The default is 0, which disables both saving and restoring. History is stored separately from the main JSON database as line-counted, normalized transcript entries keyed to that character.
- While enabled, incoming transcript output is appended to the character's rolling history and older entries are removed until the configured line limit is met. The stored history contains transcript output, not input-command history.
- When connecting as a named character, the saved history is loaded before live output is displayed. Changing the limit trims future loads and writes to the new limit; setting it to 0 stops saving and restoring.
- Renaming a character moves its stored history to the renamed character, and deleting a character removes its stored history. World-only connections do not create or restore character history.

## Last Activity Indicator

When a world session receives transcript activity while the user is away from
the app, the transcript shows where that activity was last reached when the
user returns to the app and the world tab is active and focused.

- The indicator is a horizontal interface bar placed between transcript chunks
  at the boundary associated with the most recent activity that arrived while
  the user was away.
- It displays `Last activity {timeago}`, using a compact, friendly duration
  such as `just now`, `2m ago`, `1h ago`, or `yesterday` as appropriate.
- The time-ago value is derived from the activity timestamp and may update
  while the indicator remains visible.
- The indicator uses the shared flexible interface-indicator treatment from
  `spec/layout.md`: primary Dockview theme highlight/action colors and UI
  styling, not the active world's transcript output style.
- The indicator is fixed at its transcript boundary. The user cannot drag it,
  resize it, or move it to another chunk.
- The indicator is a world-session-scoped view state. It is not a transcript
  chunk and is not written to transcript history, the main database, session
  logs, or copied transcript text.
- If the referenced transcript chunk is trimmed from the in-memory scrollback,
  the session removes the indicator or reanchors it to the nearest retained
  boundary without fabricating transcript content.
- Returning to the app does not insert a duplicate indicator when the same
  unseen activity has already been acknowledged for that world session.
- Explicit user transcript navigation dismisses the indicator. This includes
  scrollbar movement, mouse-wheel scrolling, forwarded page scrolling, and
  `Ctrl+Home`/`Ctrl+End` navigation. Layout-generated scroll reconciliation,
  automatic follow-to-bottom behavior, and split-view layout changes do not by
  themselves dismiss it.
- Dismissing the indicator changes only this transient marker state; it does
  not clear the tab's ordinary unread-activity or focus-attention state unless
  those features independently define that behavior.

The indicator participates in transcript layout without becoming part of the
virtualized content range. It remains anchored when chunks are mounted or
unmounted, and it is excluded from ordinary text selection, long-selection
range copying, logging, and transcript search.

## Long Selection UX Mode

The transcript supports ordinary character-level text selection within the
currently contiguous virtualization window. When a drag would extend beyond
that window and virtualization would otherwise unmount chunks from the native
selection, the transcript changes to a model-backed chunk-range selection mode.

### Entering range mode

- Selection inside the contiguous rendered window behaves normally. The user
  can select from character to character on any line of a rendered chunk.
- The transcript detects when the drag crosses a virtualization boundary or
  would cause a selected chunk to leave the contiguous mounted selection
  window. It also enters range mode when the dragged chunk span reaches the
  app setting `Line selection range`, based on cumulative chunk line counts;
  this threshold is independent of virtualization and scrollback retention.
- At that point the interaction switches to chunk-range mode instead of
  allowing the browser's native selection to silently lose text.
- The initial side of the range snaps to the end boundary of the chunk where
  the transition occurred. The selected range is represented by stable chunk
  identity and boundary information rather than only by DOM selection state.
- A start-chunk indicator appears at the selection's drop location. While the
  pointer drag continues, the end-chunk indicator follows the candidate target
  and previews the eventual range.
- A highlighted line along the left edge of the transcript connects the start
  and end range indicators. The indicators and connector use the shared
  flexible interface-indicator system defined in `spec/layout.md`.

### Range semantics

- Range mode selects complete transcript chunks between the two markers,
  including the marked boundary chunks according to the direction of the
  selection.
- The canonical transcript remains the source for the selected text. The
  selection continues to work when intermediate chunks are not mounted by
  virtualization.
- Interface indicators, connector lines, image-preview controls, and other
  transcript UI chrome are never included in the selected or copied text.
- The range is bounded to a reasonable selectable window. The feature does not
  require the entire retained transcript history to be mounted or selectable
  at once.
- If the selectable bound is reached, the range remains clamped to the
  permitted boundary and the UI communicates that the range cannot be
  extended farther.
- A range belongs to the primary transcript view. Split live-output rendering
  must not create a second independent range or duplicate copied content.

### Completing and adjusting a range

- Releasing the pointer in range mode does not automatically copy text.
- Release opens a custom context menu anchored to the selected range. The menu
  includes a copy action and may include other actions defined by the owning
  transcript feature.
- If the user dismisses the menu without choosing an action, the range and its
  indicators remain available for adjustment.
- The user may drag either range indicator to change the selection. Completing
  a marker drag reopens the custom context menu for the updated range.
- An active range handle has a generous vertical grab area extending one
  transcript line above and below its visible boundary line, so adjacent
  one-line chunks can be used to start a handle drag.
- Right-clicking anywhere on the selected range reopens the custom context
  menu, allowing the user to recover the actions without moving a marker.
- The custom context menu provides explicit navigation actions for moving to
  the lower handle and upper handle; their arrow directions match the
  corresponding on-handle controls.
- Copying from the custom menu extracts the range from canonical transcript
  data, then dismisses the range UI and restores the normal post-copy focus
  behavior. Copying does not depend on the browser's current native selection
  string.
- Starting a new ordinary selection, changing transcript tabs, or losing the
  owning world-session surface cancels the existing range and its indicators.

### Interaction boundaries

- Range indicators are draggable only when they are part of an active range;
  the last-activity indicator remains fixed and cannot be used as a range
  handle.
- The range overlay must not prevent ordinary scrolling needed to reach the
  candidate end chunk. Auto-scroll during an active drag may extend the range
  as the pointer approaches the transcript viewport edge.
- The range state is transient view state. It is not stored in transcript
  history, the main database, session logs, or the world-session transcript
  content model.
- The custom range menu follows the shared context-menu behavior for clamping,
  outside-click dismissal, Escape dismissal, focus handling, and nested menu
  panels.

Holding `Ctrl` while using the mouse wheel over the transcript temporarily zooms the transcript text in or out without changing saved style settings. `Ctrl+-`, `Ctrl+=`, and `Ctrl+0` provide the same temporary zoom out, zoom in, and reset behavior. The transcript context menu uses the shared context menu shell, keeps logging and notes on the main menu, includes a compact zoom row with minus, percent reset, and plus controls, and places edit world, edit character, edit styles, and edit triggers in a nested Settings submenu shared with the top tab bar menu. The notes entry opens the hosted notes surface for the active character. The Settings submenu opens on hover or keyboard focus, stays accessible from a click, behaves like a side panel instead of an in-place section, uses a short close delay so the pointer can cross between panels, and clamps to the app window.

The app menu includes a transient dev tools submenu for troubleshooting. It holds a webview inspector shortcut and a transcript diagnostics toggle. When transcript diagnostics is enabled, the app writes additional console debug output about transcript scroll state, resize events, image preview loads, and render-range decisions. The toggle is off by default and does not change saved settings.

## Automatic Scrolling

When new transcript content arrives, the output panel scrolls down to keep the most recent content in view.

When any transcript items (such as image previews) load or otherwise change height, the transcript keeps following the bottom as long as the user has not manually scrolled away.

If the user manually scrolls away from the bottom, automatic scrolling pauses and a floating scroll-to-bottom button appears in the lower-right corner of the output panel.

When the transcript viewport changes size because of window, input-area, Dockview, panel, or edge-group layout changes, the client preserves the current user-scroll state. If the user was following the bottom, the transcript re-anchors to the bottom after layout settles. If the user had scrolled away, the history position and split view remain unchanged. Multiple resize notifications in one layout cycle are reconciled together.

Layout-generated scroll events caused by those size changes do not count as manual scrolling. Only direct scrollbar, mouse-wheel, or forwarded page-scroll input can change the user-scroll state.

Clicking the scroll-to-bottom button scrolls the output panel to the bottom and restores automatic scrolling for new transcript content.

While the command input area is focused, Page Up and Page Down scroll the transcript output by a page without moving focus away from the input. `Ctrl+Home` scrolls the transcript output to the top of the document, and `Ctrl+End` scrolls to the bottom and restores automatic scrolling. Plain `Home` and `End` stay in the input text.

## Split Output when Scrolling

If the app setting "show current output when scrolling up" is enabled, scrolling away from the bottom splits the transcript into two stacked displays:

- The top display takes most of the space, stays scrollable, and contains the scroll-to-bottom button.
- The bottom display stays pinned to the live output at the bottom of the panel and does not allow manual scrolling.
- The bottom display does not show image previews, even when transcript image previews are enabled, so it can stay compact.
- Mouse wheel movement over the bottom display is forwarded to the top display so scrolling still works on the main transcript pane.

When the user scrolls the top display back to the bottom, or presses the scroll-to-bottom button, the split collapses back into the normal single transcript view.

## Image Link Previews

When image link previews are enabled in app settings:

- The original link text remains visible in the transcript.
- If a link points to an image, the image preview is shown below the line that contains the link.
- Image previews reserve their maximum space immediately with a loading tombstone so delayed loads do not make the transcript jump.
- Image links also show a small image badge right after the link text so it is clear the URL was detected as an image, and clicking that badge restores a hidden preview.
- Clicking the image preview behaves the same as clicking the link text.
- When the preview is hovered, a small button appears in its upper-right corner that removes that preview from the transcript display.
- Image previews should stay within the transcript width and respect a reasonable maximum height so they do not dominate the output area.

## Status Messages

The output area shows a short status message for changes in connection or logging state.

## Debug Console

Each world tab can open a separate debug console surface in the window host.

- The console shows the live incoming server stream, outgoing commands, and status messages for that specific world tab, and it keeps collecting session traffic even while the surface is hidden or popped out.
- The console keeps about 1000 lines of recent content and drops older entries as new ones arrive.
- Control characters and special bytes are rendered visibly so command codes and escape sequences can be inspected directly.
- The console is read-only and is intended for troubleshooting communication rather than replacing the transcript view.

## Notes Surface

Each world tab can open a separate notes surface in the window host.

- The notes surface shows and edits the saved per-character notes for that tab's active character, and it keeps the current note text synchronized while the surface is hidden or popped out.
- The notes surface is hosted through the surfaces system so it can be docked, floated, or popped out into its own native window.
- F3 toggles the notes surface for the active world tab.
