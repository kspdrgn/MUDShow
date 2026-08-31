# Output / Transcript

## Transcript

Selecting text will automatically copy to clipboard and return keyboard focus to the last active input box

HTTP and HTTPS URLs in transcript text are rendered as clickable links. Clicking a link opens it in the user's default browser, while plain text selection and copy behavior still work normally.

Incoming world text is buffered until a newline is received. The transcript only receives complete lines, `\r` characters are discarded, and a trailing partial line is held until it is completed or the connection ends.

The transcript keeps only the visible rows and a small scroll buffer mounted while the history is very large, so scrolling stays responsive even with a lot of saved output.

Holding `Ctrl` while using the mouse wheel over the transcript temporarily zooms the transcript text in or out without changing saved style settings. `Ctrl+-`, `Ctrl+=`, and `Ctrl+0` provide the same temporary zoom out, zoom in, and reset behavior. The transcript context menu uses the shared context menu shell, keeps logging and notes on the main menu, includes a compact zoom row with minus, percent reset, and plus controls, and places edit world, edit character, edit styles, and edit triggers in a nested Settings submenu shared with the top tab bar menu. The notes entry opens the hosted notes surface for the active character. The Settings submenu opens on hover or keyboard focus, stays accessible from a click, behaves like a side panel instead of an in-place section, uses a short close delay so the pointer can cross between panels, and clamps to the app window.

The app menu includes a transient dev tools submenu for troubleshooting. It holds a webview inspector shortcut and a transcript diagnostics toggle. When transcript diagnostics is enabled, the app writes additional console debug output about transcript scroll state, resize events, image preview loads, and render-range decisions. The toggle is off by default and does not change saved settings.

## Automatic Scrolling

When new transcript content arrives, the output panel scrolls down to keep the most recent content in view.

When any transcript items (such as image previews) load or otherwise change height, the transcript keeps following the bottom as long as the user has not manually scrolled away.

If the user manually scrolls away from the bottom, automatic scrolling pauses and a floating scroll-to-bottom button appears in the lower-right corner of the output panel.

When the transcript viewport changes size because of window, input-area, Dockview, panel, or edge-group layout changes, the client preserves the current user-scroll state. If the user was following the bottom, the transcript re-anchors to the bottom after layout settles. If the user had scrolled away, the history position and split view remain unchanged. Multiple resize notifications in one layout cycle are reconciled together.

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
- The notes surface is hosted separately from the channel bar so it can be popped out into its own native window.
- F3 toggles the notes surface for the active world tab.
