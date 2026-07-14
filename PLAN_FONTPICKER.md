# Font Picker Plan

## Goal

Use a small Rust-side font enumeration layer, ideally `fontdb`, to discover installed system fonts and pass that data to the frontend so the app can present a pure Svelte font picker.

This plan intentionally avoids a GTK dependency.

## Why This Approach

- Tauri already gives us a Rust backend plus a webview frontend.
- The frontend can render a custom picker without needing a native dialog.
- Rust can do the one thing the web UI cannot do well on its own: enumerate installed fonts.
- `fontdb` is a lean fit when we only need discovery and metadata, not a full native desktop font dialog.

## Desired User Experience

The user should be able to:

- open a font picker in the settings UI
- browse installed font families
- see style variants where available, such as regular, italic, bold, and bold italic
- preview the currently selected family in the picker
- choose a font that applies to transcript and input text
- fall back cleanly if the system font list cannot be loaded

## Scope

The picker should support:

- system font enumeration
- family selection
- style selection within a family
- font preview
- persistence of the chosen font family and style

Optional later additions:

- search/filter across font families
- recent fonts
- user-imported font files loaded into the app at runtime

## Recommended Architecture

### 1. Rust font enumeration service

Add a small backend helper that uses `fontdb` to scan available fonts on startup or on demand.

Responsibilities:

- load system fonts
- group faces by family
- return available style variants
- provide stable identifiers or normalized names for the frontend
- report errors cleanly if system font discovery fails

### 2. Tauri command boundary

Expose a read-only command from Rust to the frontend.

The command should return a compact JSON structure such as:

- family name
- style variants
- weight
- italic flag
- postscript or face name if useful
- optional preview metadata

The frontend should not need to know anything about `fontdb` internals.

### 3. Pure Svelte picker UI

Build the picker as a normal Svelte component in the existing settings screen.

Recommended UI pieces:

- search field
- scrollable family list
- selected-family detail panel
- style variant selector
- live preview sample
- reset-to-default / inherit button

This keeps the UI portable and avoids platform-specific dialog code.

## Data Shape

A practical response shape from Rust could look like:

```ts
type FontFaceOption = {
  family: string;
  style: string;
  weight?: number;
  italic?: boolean;
  displayName: string;
};

type FontFamilyOption = {
  family: string;
  faces: FontFaceOption[];
};
```

The frontend can then derive:

- the list of visible families
- the selectable styles for the chosen family
- the preview CSS for the selected face

## Suggested Work Phases

### Phase 1: Confirm storage shape

- decide how font family and style are stored in app settings and per-world/per-character style settings
- decide whether a single field stores a combined font descriptor or whether family and style are separate fields
- confirm inheritance behavior for missing font fields

Checklist:

- [ ] Decide where font selection is persisted.
- [ ] Decide whether family and style are separate fields.
- [ ] Decide how inheritance falls back when only part of a font selection is overridden.

### Phase 2: Add Rust font enumeration

- add `fontdb` to the Tauri side
- load system fonts
- normalize families and faces
- deduplicate faces where needed
- return a frontend-friendly list

Checklist:

- [ ] Add the font enumeration dependency.
- [ ] Build a helper to collect installed fonts.
- [ ] Group faces by family.
- [ ] Sort output in a stable, user-friendly order.
- [ ] Surface errors if enumeration fails.

### Phase 3: Expose the Tauri command

- add a command such as `list_system_fonts`
- return the enumeration payload to the frontend
- keep the command read-only
- cache results if startup cost is noticeable

Checklist:

- [ ] Add the backend command.
- [ ] Define the return type clearly.
- [ ] Add permission/scoping if required by the Tauri setup.
- [ ] Decide whether the result should be cached or refreshed on demand.

### Phase 4: Build the Svelte picker

- create a dedicated picker component
- populate it from the Tauri command result
- allow filtering by family name
- show a live preview using the candidate font
- let the user confirm or cancel selection

Checklist:

- [ ] Add the picker component.
- [ ] Add font family filtering.
- [ ] Add style selection.
- [ ] Add preview rendering.
- [ ] Wire selection into the settings form.

### Phase 5: Wire persistence and inheritance

- save the selected font family and style in the existing settings model
- make the picker reflect inherited values
- allow explicit override or reset-to-inherit behavior
- ensure the transcript and input box both pick up the chosen font

Checklist:

- [ ] Persist the selected family and style.
- [ ] Support reset-to-inherit.
- [ ] Apply the font to transcript and input text.
- [ ] Verify named-character overrides work as expected.

## Implementation Options

### Option A: `fontdb` only

Use `fontdb` for system font discovery and keep the frontend picker fully custom.

Pros:

- leanest backend
- minimal dependencies
- no GTK tie-in

Cons:

- no native dialog
- the picker UI is entirely ours to build

Best when:

- we want the smallest practical implementation

### Option B: `fontdb` plus local font import later

Use `fontdb` for discovery now, then add user-imported fonts later if needed.

Pros:

- keeps the initial scope small
- leaves room for user-owned fonts later

Cons:

- imported font files are a separate feature

Best when:

- we want a clean phase 1 and a reasonable path to expand

### Option C: `font-kit` instead of `fontdb`

Use `font-kit` if we later need more advanced matching or system backends.

Pros:

- more feature-rich
- more flexible font handling

Cons:

- more than we need for a basic picker

Best when:

- the feature grows beyond simple enumeration

Recommended direction:

- start with `fontdb`
- keep the payload simple
- only move to a heavier abstraction if we hit a real limitation

## UI Considerations

- Keep the picker compact and searchable.
- Group faces under families instead of showing a huge flat list.
- Show a sample line in the selected font so the user can verify the choice quickly.
- Keep the picker style consistent with the existing settings page.
- Provide a clear fallback message if the font list cannot be loaded.

## Error Handling

Handle these cases explicitly:

- no fonts returned
- enumeration failure
- duplicate or malformed family names
- missing style variants for a chosen family
- backend command failure

The frontend should still function with a safe default font even if enumeration fails.

## Verification Checklist

- [ ] Confirm the backend can enumerate system fonts on Linux.
- [ ] Confirm the backend can enumerate system fonts on Windows.
- [ ] Confirm the backend can enumerate system fonts on macOS.
- [ ] Confirm the Svelte picker renders grouped families.
- [ ] Confirm selecting a family updates the preview.
- [ ] Confirm selecting a style persists correctly.
- [ ] Confirm the transcript and input box use the selected font.
- [ ] Confirm the app falls back cleanly if enumeration fails.

## Open Questions

1. Should the picker store a combined font descriptor or separate family and style fields?
2. Should the first version allow only installed system fonts, or also user-imported font files?
3. Should the font list be cached at startup or loaded only when the settings page opens?
4. Should the preview sample use the transcript font, the input font, or both?
