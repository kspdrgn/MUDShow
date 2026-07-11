# Implementation Plan: Clickable Links In Transcript Output

## Goal

Add clickable `http://` and `https://` links to the output transcript without breaking ANSI formatting, highlights, selection copy, or auto-focus behavior.

## Scope

- Transcript output only.
- Clickable external links for plain HTTP and HTTPS URLs.
- Preserve current text selection behavior.
- Stretch goal: optional image-link display controlled by an app setting.

## Phase 1: Audit the render pipeline

- Confirm where transcript text is transformed from raw MUD data into HTML.
- Identify the safest insertion point for URL detection.
- Verify how ANSI spans and highlight spans are currently nested.
- Confirm whether any existing external-open helper already exists.

## Phase 2: Add safe clickable links

- Detect HTTP and HTTPS URLs after escaping raw text.
- Preserve surrounding punctuation and whitespace as plain text.
- Render detected URLs as anchor elements with a safe `href`.
- Keep existing copy-on-select behavior intact.
- Ensure anchor clicks do not interfere with text selection or focus restoration.

## Phase 3: External-open behavior

- Route clicks through the safest browser-opening path available in the app.
- If the desktop shell needs a backend command or permission update, add the minimal change required.
- Keep this behavior desktop-safe and avoid introducing arbitrary scheme handling.

## Phase 4: Image-link display stretch goal

- Add a boolean app setting for image-link display.
- Default the setting to off.
- When enabled, image URLs can render inline previews or thumbnail-style embeds.
- When disabled, image URLs remain normal clickable links.
- Keep the UI setting in the existing App Settings screen.

## Phase 5: Spec and regression coverage

- Update `spec/output.md` and, if needed, the settings spec so the new behavior is documented.
- Add focused tests for:
  - ANSI text containing URLs
  - highlighted URLs
  - URLs at the start or end of lines
  - punctuation adjacent to URLs
  - image URLs with the setting on and off

## Acceptance Criteria

- A user can click an `http://` or `https://` URL in the transcript and open it externally.
- Selecting transcript text still copies to clipboard and returns focus to the active input.
- ANSI formatting and highlight colors still render correctly around links.
- The image-link setting is stored and respected when enabled.
