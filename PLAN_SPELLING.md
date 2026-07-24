# Spellcheck Implementation Plan

This plan breaks spellcheck into two phases so we can build the UI, data flow, and settings plumbing first, then swap in the chosen Rust spelling engine later without reworking the app structure.

## Goals

- Provide live typo underlining in input boxes.
- Replace the native webview context menu for input fields with an app-owned menu.
- Support on-demand suggestions, dictionary actions, and future thesaurus lookups from that menu.
- Route spelling requests through a backend spell query stream so checks can be queued and answered asynchronously.
- Support persistent user overrides so false positives can be cleared and remembered.

## Phase 1: UI and preparation

### 1.a UI squiggles

- Wire input boxes so typed text is forwarded into a live spelling-check stream.
- Track input revisions so the frontend can ignore stale spellcheck responses.
- Render spelling annotations in the input UI as underlines or squiggles for probable typos.
- Keep the UI responsive while spelling results arrive asynchronously.
- Treat the spellcheck overlay as advisory only; do not block typing or submission.

### 1.b Context menu

- Take ownership of the native webview context menu for input text areas.
- Show standard text actions such as copy, cut, paste, and select-all.
- Add spell-specific actions for the current word or selection:
  - suggested replacements
  - add to user dictionary
  - ignore once
  - ignore always
- Prepare the menu structure so future thesaurus lookups can be added without changing the basic interaction pattern.
- Ensure context menu behavior works on demand even when spellcheck is disabled globally.

### 1.c Session plumbing

- Introduce a frontend-to-backend spell query stream for live checks.
- Route at least these query types through the stream:
  - check text or token ranges
  - request suggestions for a specific word
  - add a word to the user dictionary
  - ignore a word temporarily or permanently
- Include revision identifiers with each query so responses can be matched to the correct text state.
- Make the frontend tolerant of out-of-order or delayed responses.
- Keep the transport shape generic so the backend engine can be chosen later without changing the UI contract.

### 1.d Settings additions, settings UI, and settings plumbing

- Add a master on/off switch for spellcheck.
- Add a simple comma-separated master ignore list.
- Use sensible defaults for:
  - suggestion limit
  - minimum word length
  - debounce interval
  - backend queue concurrency
- Assume the context menu is always available on demand.
- Keep the current `en-US`-style language/locale setting, but make it clear that the backend spelling engine may use it as a dictionary or locale hint rather than a literal browser setting.
- Add settings UI controls for the new spellcheck options.
- Persist the new settings through the existing app settings plumbing.

## Phase 2: library implementation, dependent on library selection

### 2.a Install and integrate the Rust library

- Add the selected Rust spellcheck library to the backend.
- Load dictionaries and any required word lists at startup or on first use.
- Cache loaded dictionary state so repeated checks stay fast.
- Keep dictionary loading and heavy initialization off the UI thread.

### 2.b Backend spell service

- Implement backend handlers for:
  - `check`
  - `suggest`
  - `add`
- Join the backend library API to the frontend spell query stream.
- Queue spell queries so the backend can respond efficiently under typing load.
- Return annotations, suggestions, and dictionary updates in a format the frontend can apply incrementally.

### 2.c Library-specific capabilities

- If the chosen library is `hunspell-rs`, expose extra capabilities such as:
  - `stem`
  - `analyze`
  - other dictionary-aware word queries that are useful in the context menu
- Surface those results in the word context menu only when they are available and useful.
- If the chosen library is `spellbook`, keep the integration focused on the core live check, suggestion, and user dictionary workflow.

### 2.d Library-driven settings

- Add app settings for global toggles or options exposed by the chosen library.
- Examples include:
  - acronym handling
  - camelCase handling
  - case sensitivity
  - dictionary path or locale-specific options if required
- Only add settings that are actually meaningful for the selected engine.
- Avoid committing to two interchangeable engines in the UI; the app should present one spellcheck system at a time.

### 2.e Missing pieces to make spellcheck feel complete

- Ensure false positives can be cleared through a persistent ignore or custom-word list.
- Decide whether ignores are app-wide only or also session-scoped.
- Confirm how spellcheck interacts with multi-line input, pasted text, and command history entries.
- Define how often live checks should run while the user is typing.
- Make sure suggestion menus are keyboard accessible as well as mouse accessible.
- Verify that turning spellcheck off removes underlines and live queries without breaking the context menu.

## Library choice guidance

- Prefer `spellbook` if we want a lightweight, pure-Rust backend with straightforward async-friendly integration.
- Prefer `hunspell-rs` if we need richer dictionary features and are willing to work around its less backend-friendly threading model.
- The Phase 1 work should not depend on this choice so we can defer the decision safely.

## Open decisions

- Should the ignore list be stored as one app-wide list, or split into app-wide, session, and per-world variants?
- Should the current `spellcheckLanguage` setting be renamed to `spellcheckLocale`, or kept for compatibility and aliased internally?
- Should custom words be stored alongside the ignore list, or tracked as a distinct user dictionary?
- Should spellcheck be enabled by default, or off until the user turns it on?

