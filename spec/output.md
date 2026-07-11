
## Transcript

Selecting text will automatically copy to clipboard and return keyboard focus to the last active input box

HTTP and HTTPS URLs in transcript text are rendered as clickable links. Clicking a link opens it in the user's default browser, while plain text selection and copy behavior still work normally.

When new transcript content arrives, the output panel scrolls down to keep the most recent content in view.

If the user manually scrolls away from the bottom, automatic scrolling pauses and a floating scroll-to-bottom button appears in the lower-right corner of the output panel.

Clicking the button scrolls the output panel to the bottom and restores automatic scrolling for new transcript content.

If the app setting "show current output when scrolling up" is enabled, scrolling away from the bottom splits the transcript into two stacked displays:

- The top display takes most of the space, stays scrollable, and contains the scroll-to-bottom button.
- The bottom display stays pinned to the live output at the bottom of the panel and does not allow manual scrolling.
- The bottom display does not show image previews, even when transcript image previews are enabled, so it can stay compact.

When the user scrolls the top display back to the bottom, or presses the scroll-to-bottom button, the split collapses back into the normal single transcript view.

When image link previews are enabled in app settings:

- The original link text remains visible in the transcript.
- If a link points to an image, the image preview is shown below the line that contains the link.
- Clicking the image preview behaves the same as clicking the link text.
- Image previews should stay within the transcript width and respect a reasonable maximum height so they do not dominate the output area.

## Status Messages

- The output area shows a short status message when session logging starts.
- The output area shows a short status message when session logging stops.
