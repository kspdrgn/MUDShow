# Svelte Thin-Component Plan

## Goal

Make the Svelte layer easier for humans and agents to read by keeping each `.svelte` file focused on markup, local bindings, and direct event wiring.

The extraction goal is not "no logic in Svelte." The goal is:

- keep component-local UI glue in the component
- move reusable or testable logic into `.ts` modules
- avoid duplicated helper code across similar components
- keep helper names close to the feature they serve

## General Guidance

- Keep template-only conditions, local refs, and one-line event adapters in `.svelte`.
- Move pure functions, derivations, and normalization code into `.ts`.
- Move geometry, placement, scroll math, and drag math into `.ts`.
- Move async request state machines and serialization helpers into `.ts`.
- Prefer feature-local modules over one giant shared utility file.
- Reuse the helper files that already exist before adding new ones:
  - `frontend/src/lib/input-bars.ts`
  - `frontend/src/lib/triggers.ts`
  - `frontend/src/lib/formatting.ts`
  - `frontend/src/lib/session-dom.ts`
  - `frontend/src/lib/playback.ts`
  - `frontend/src/lib/components/styles/style-settings.ts`

## Precise Plan

### `SettingsPage.svelte`

Create:

- `frontend/src/lib/components/settings/settings-page-tabs.ts`
  - `SettingsTabId`
  - the ordered tab list
  - tab icon SVG strings
  - the set of placeholder tabs

- `frontend/src/lib/spellcheck-style.ts`
  - `DEFAULT_SQUIGGLE_COLOR`
  - `SQUIGGLE_PREVIEW_WAVY_PATH`
  - `SQUIGGLE_STYLE_OPTIONS`
  - `isHexColor`
  - `normalizeHexColor`
  - `getSquiggleColorPickerValue`
  - `normalizeSquiggleStyle`
  - `getSquigglePreviewDecorationStyle`
  - `getSquigglePreviewDasharray`

Keep in Svelte:

- tab switching
- event forwarding to `onChange`
- open/close state for the squiggle picker menu
- direct DOM refs for outside-click handling

### `StyleSettingsPane.svelte`

No new module is strictly required.

If we want to keep preview formatting out of the component, extend the existing `style-settings.ts` with:

- `getPreviewBlockStyle`
- `describePreview`

Keep in Svelte:

- the layout of the two-column style editor
- wiring between `StyleFontsSection` and `StyleColorsSection`
- the preview panel markup

### `StyleFontsSection.svelte`

Create:

- `frontend/src/lib/components/styles/font-picker.ts`
  - system font loading and filtering
  - selected family and selected face movement
  - face description helpers
  - shelf entry creation helpers
  - font-size step helpers
  - any logic that converts picker state into `FontShelfEntry`

Keep in Svelte:

- picker open/close state
- DOM binding for the scroll list
- direct button/input handlers
- rendering of the current section form

### `StyleColorsSection.svelte`

No new module planned.

This file is already a good candidate to stay as a mostly-presentational section with only small update helpers.

If later extraction is needed, the only likely helper file would be:

- `frontend/src/lib/components/styles/style-color-state.ts`
  - color enable/disable toggles
  - current-vs-default color display helpers

### `StyleBackgroundImageSection.svelte`

No new module planned.

If it grows, it should probably share helpers with `style-settings.ts` rather than get its own bespoke utility file.

### `StyleSlideToggle.svelte` and `StyleColorSetting.svelte`

No new module planned.

These should stay presentational unless they become reusable enough to justify a small shared control helper.

### `WorldsAndCharactersEditor.svelte`

Create:

- `frontend/src/lib/components/settings/worlds-and-characters-editor.ts`
  - `DeleteTarget`
  - `MenuTarget`
  - row grouping helpers for worlds and their characters
  - context-menu positioning helpers
  - delete-confirmation target helpers
  - menu-close coordination helpers
  - any helper that turns `worlds` and `characters` into the rendered row model

Keep in Svelte:

- the actual list markup
- click and right-click wiring
- modal/popup visibility state
- delete confirm overlay rendering

### `WorldModal.svelte`

No new module planned.

This is already small enough to stay as a form-only modal.

### `CharacterModal.svelte`

No new module planned for the first pass.

If the same draft-shaping logic gets reused elsewhere, then create:

- `frontend/src/lib/components/settings/character-draft.ts`
  - default draft construction
  - open-to-form synchronization
  - save payload normalization

### `TriggersPane.svelte`

Create:

- `frontend/src/lib/components/settings/triggers-tree.ts`
  - `TreeSelection`
  - `FlatTreeItem`
  - `buildFlatTriggerItems`
  - selection key helpers
  - owner traversal helpers over app, world, and character triggers

- `frontend/src/lib/components/settings/trigger-drafts.ts`
  - `DEFAULT_HIGHLIGHT_DRAFT`
  - `DEFAULT_RULE_DRAFT`
  - draft cloning and reset helpers

- `frontend/src/lib/components/settings/trigger-selection.ts`
  - range-selection helpers
  - toggle-selection helpers
  - dirty-editor confirmation helpers

Keep in Svelte:

- modal open/close state
- selected item state that is tightly bound to the UI
- clipboard actions triggered from buttons
- drag/drop pointer bindings if they remain component-local

### `HighlightsPanel.svelte`

Create:

- `frontend/src/lib/components/settings/highlight-editor.ts`
  - the default highlight draft
  - snapshot serialization for dirty checking
  - draft-to-save-payload conversion
  - helpers that track when the form should resync from props

Keep in Svelte:

- the actual form fields
- the toggle control wiring
- the delete button wiring

### `RuleEditorPanel.svelte`

Create:

- `frontend/src/lib/components/settings/rule-editor.ts`
  - the default rule draft
  - snapshot serialization for dirty checking
  - draft-to-save-payload conversion
  - any small validation or normalization helpers for the save path

Keep in Svelte:

- the rule editing form
- the test/sample-text field rendering
- delete/cancel/save button wiring

### `RulesPanel.svelte`

No new module planned.

This is already a simple list-and-buttons component.

### `InputBars.svelte`

Create:

- `frontend/src/lib/components/play/input-bars-state.ts`
  - per-bar value state
  - command history state
  - history browse state
  - bar add/remove/resize synchronization
  - control visibility timers
  - focus restoration helpers

- `frontend/src/lib/components/play/input-bars-spellcheck.ts`
  - live spellcheck request tokens
  - underlay state
  - live spellcheck loading state
  - debounce and timer helpers
  - any logic shared with the notes editor spellcheck flow

- `frontend/src/lib/components/play/input-bars-history.ts`
  - history queue operations
  - browse cursor movement
  - draft restore/edit helpers

Keep in Svelte:

- the textarea markup
- bar controls rendering
- direct keyboard and mouse event bindings
- passing the computed bar state into child controls

### `NotesPanel.svelte`

Create or reuse:

- `frontend/src/lib/components/play/spellcheck-editor.ts`
  - shared live spellcheck signature logic
  - request token helpers
  - underlay HTML generation flow
  - suggestion-loading helpers

This module should be shared with `InputBars.svelte` if possible.

Keep in Svelte:

- note draft state
- textarea selection and clipboard wiring
- context menu rendering

### `Transcript.svelte`

Create:

- `frontend/src/lib/components/play/transcript-render.ts`
  - render dependency key building
  - per-chunk render cache keys
  - chunk title formatting
  - chunk-to-HTML render helpers

- `frontend/src/lib/components/play/transcript-viewport.ts`
  - overscan constants
  - spacer calculations
  - viewport sync helpers
  - scroll restoration and auto-scroll calculations

- `frontend/src/lib/components/play/transcript-context-menu.ts`
  - context-menu open/close helpers
  - menu position clamping
  - anchor rectangle helpers

- `frontend/src/lib/components/play/transcript-selection.ts` (planned)
  - native-selection to chunk/character-boundary detection
  - long-selection state and marker range calculations
  - canonical text extraction bounds
  - custom selection context-menu action state

- `frontend/src/lib/components/play/transcript-interface-markers.ts` (planned)
  - generic between-chunk marker descriptors
  - placement and range-connection geometry
  - theme-level marker presentation metadata, kept separate from world output
    styling

Keep in Svelte:

- the scroll container refs
- wiring to `ResizeObserver`
- event listeners and cleanup
- the rendered transcript markup
- transient marker and selection interaction wiring
- pointer dragging for range markers and custom selection-menu anchoring

The transcript view should support a generic interface-marker projection between
chunks. Markers are UI state, not transcript chunks, and must not affect
history persistence, logging, or canonical transcript text. The marker host
should use the primary Dockview theme highlight/action color and typography
rather than inheriting the active world-session output style.

Long selection behavior should stay compatible with virtualization:

- ordinary character-to-character selection remains native while both endpoints
  are inside the contiguous rendered window;
- once a drag would cross a virtualization boundary, selection switches to
  chunk-range mode and snaps the initial side to the relevant chunk boundary;
- the selected chunk range remains model-backed even when intermediate chunks
  are not mounted;
- start/end indicators and a left-edge connecting line preview the range;
- release opens a custom context menu instead of automatically copying;
- marker drags update the model-backed range and reopen the menu on release;
- right-clicking the selected range reopens the same menu;
- the implementation must impose a bounded selectable range rather than
  requiring the entire transcript history to be mounted.

### `PlayScreen.svelte`

Create:

- `frontend/src/lib/components/play/play-width.ts`
  - `normalizeCharacterWidth`
  - `measureTextWidth`
  - `measureCharacterWidth`
  - the logic that turns a preferred width in characters into a CSS width string

- `frontend/src/lib/spellcheck-style.ts`
  - shared squiggle style helpers used by the settings screen and the play screen

Keep in Svelte:

- the `onMount` call that waits for fonts
- the reactive trigger that re-measures when inputs change
- the binding of `measuredPlayWidth` to the outer element

### `WorldContextMenu.svelte`

No new module planned.

This should remain a presentational menu unless it starts accumulating duplicate state logic with the top bar or transcript context menu.

### `QuickConnectPanel.svelte`

No new module planned.

It is already close to a pure view component.

### `TopBar.svelte`

Create:

- `frontend/src/lib/components/window/topbar-state.ts`
  - derived world-session menu state
  - close-confirm message and action-label helpers
  - quick-connect side selection
  - `shouldStartTitlebarDrag`
  - any small derived state that only exists to drive the menu or confirm dropdown

- `frontend/src/lib/components/window/topbar-drag.ts`
  - `TabDragState`
  - drag start/move/end/cancel helpers
  - drop-indicator positioning
  - suppressed-click scheduling
  - tab-reorder target calculation

- `frontend/src/lib/components/window/window-actions.ts`
  - `minimizeWindow`
  - `toggleMaximizeWindow`
  - `closeWindow`
  - `openInspector`
  - `startTitlebarDrag`

Keep in Svelte:

- the top-level menu state
- the template for tabs, quick connect, and window controls
- the event listeners that must remain attached to component refs

### `LoggingModal.svelte`

Create:

- `frontend/src/lib/components/play/logging-paths.ts`
  - folder path normalization
  - file path join helpers
  - display path helpers
  - any reusable path formatting used to show the current logging destination

Keep in Svelte:

- current-file existence checks that are tightly tied to the open modal
- save/start/rename event wiring
- the modal form itself

### `ConfirmCloseTabModal.svelte`

No new module planned.

### `NoticeModal.svelte`

No new module planned.

### `HomePanel.svelte`

No new module planned.

### `StatusDot.svelte`

No new module planned.

### `SpellcheckContextMenu.svelte`

No new module planned.

### `WindowResizeHandles.svelte`

No new module planned.

### `App.svelte`

No extraction target planned for the first pass.

Keep it as the orchestration layer unless it starts collecting feature-specific business logic that belongs in one of the modules above.

## Suggested Order

If we actually execute the refactor, the least risky sequence is:

1. `spellcheck-style.ts` and `settings-page-tabs.ts`
2. `transcript-render.ts` and `play-width.ts`
3. `topbar-state.ts`, `topbar-drag.ts`, and `window-actions.ts`
4. `input-bars-state.ts` and `spellcheck-editor.ts`
5. `triggers-tree.ts`, `highlight-editor.ts`, and `rule-editor.ts`
6. `font-picker.ts` and `worlds-and-characters-editor.ts`

That order moves from the most reusable pure helpers to the most stateful UI code.
