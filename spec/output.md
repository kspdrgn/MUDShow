# Output / Transcript

## Transcript

Selecting text will automatically copy to clipboard and return keyboard focus to the last active input box

HTTP and HTTPS URLs in transcript text are rendered as clickable links. Clicking a link opens it in the user's default browser, while plain text selection and copy behavior still work normally.

## Automatic Scrolling

When new transcript content arrives, the output panel scrolls down to keep the most recent content in view.

If the user manually scrolls away from the bottom, automatic scrolling pauses and a floating scroll-to-bottom button appears in the lower-right corner of the output panel.

Clicking the scroll-to-bottom button scrolls the output panel to the bottom and restores automatic scrolling for new transcript content.

While the command input area is focused, Page Up and Page Down scroll the transcript output without moving focus away from the input. Home scrolls to the top of the main transcript view, and End scrolls to the bottom and restores automatic scrolling.

## Split Output when Scrolling

If the app setting "show current output when scrolling up" is enabled, scrolling away from the bottom splits the transcript into two stacked displays:

- The top display takes most of the space, stays scrollable, and contains the scroll-to-bottom button.
- The bottom display stays pinned to the live output at the bottom of the panel and does not allow manual scrolling.
- The bottom display does not show image previews, even when transcript image previews are enabled, so it can stay compact.

When the user scrolls the top display back to the bottom, or presses the scroll-to-bottom button, the split collapses back into the normal single transcript view.

## Image Link Previews

When image link previews are enabled in app settings:

- The original link text remains visible in the transcript.
- If a link points to an image, the image preview is shown below the line that contains the link.
- Image links also show a small image badge right after the link text so it is clear the URL was detected as an image, and clicking that badge restores a hidden preview.
- Clicking the image preview behaves the same as clicking the link text.
- When the preview is hovered, a small button appears in its upper-right corner that removes that preview from the transcript display.
- Image previews should stay within the transcript width and respect a reasonable maximum height so they do not dominate the output area.

## Status Messages

The output area shows a short status message for changes in connection or logging state.
