# Font Picker Plan

## Goal

Use a small Rust-side font enumeration layer, ideally `fontdb`, to discover installed system fonts and pass that data to the frontend so the app can present a pure Svelte font picker.

The picker should act as a source browser for adding system font families to a smaller app-level font shelf. The normal style settings UI should use that compact shelf, not expose every installed system font all the time.

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
- add a system font family to the app's compact selectable font shelf
- choose a shelf font family and face style for transcript and input text
- remove non-built-in shelf font families when they are unwanted or unavailable
- fall back cleanly if the system font list cannot be loaded

## Scope

The picker should support:

- system font enumeration
- a compact app font shelf containing built-in fonts and user-added system font families
- family selection from the shelf in the normal style settings UI
- style selection within the selected family
- font preview
- persistence of the chosen shelf family and selected face traits
- preservation of unavailable system font choices without silently deleting them

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
- provide normalized family names and face metadata for the frontend
- report enough face traits for CSS rendering, including weight, italic, and stretch where available
- report errors cleanly if system font discovery fails

### 2. Tauri command boundary

Expose a read-only command from Rust to the frontend.

The command should return a compact JSON structure such as:

- family name
- style variants
- weight
- italic flag
- stretch if useful
- postscript or face name if useful for diagnostics or best-effort matching
- optional preview metadata

The frontend should not need to know anything about `fontdb` internals.

### 3. App font shelf

Persist a curated list of font families that are available in MUDShow style settings.

Rules:

- built-in fonts are always present
- built-in fonts cannot be deleted
- system font shelf entries store a family-level identity, not a specific face
- a missing system family remains in the shelf and is marked unavailable
- deleting a system shelf entry removes it from the compact style dropdown
- deletion should be blocked or require replacement if any saved style still references that shelf entry
- unavailable font entries should not be silently removed from shared configuration files

This keeps normal style editing compact while still allowing the user to bring in more families from the full system font list.

### 4. Pure Svelte picker UI

Build the full system font picker as a normal Svelte component opened from the existing settings screen.

Recommended UI pieces:

- search field
- scrollable family list
- selected-family detail panel
- style variant preview list
- live preview sample
- add-to-shelf / select action

Build the compact shelf selector directly into the existing style font settings:

- font source or grouped font select showing built-ins and shelf system fonts
- style selector for the selected family's available face variants
- add system font button that opens the full system picker
- delete action for non-built-in shelf entries
- reset-to-default / inherit button

This keeps the UI portable and avoids platform-specific dialog code.

## Data Shape

There are three related but separate font concepts:

1. The system font universe, returned by Rust from `fontdb`.
2. The app font shelf, persisted in the user's settings database.
3. The actual style font selection, persisted in app/world/character style settings.

### System font universe

A practical response shape from Rust could look like:

```ts
type FontFaceOption = {
  family: string;
  styleName: string;
  weight?: number;
  italic?: boolean;
  stretch?: string;
  postscriptName?: string;
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

### App font shelf

The shelf should store family-level entries. A user should not need to add separate shelf entries for Regular, Bold, Italic, and Bold Italic from the same family.

```ts
type BuiltInFontId = 'jetbrains-mono' | 'system-ui' | 'serif';

type FontShelfEntry =
  | {
      source: 'builtin';
      id: BuiltInFontId;
      label: string;
    }
  | {
      source: 'system';
      id: string;
      family: string;
      label: string;
      status?: 'available' | 'missing';
    };
```

The system shelf `id` should be stable inside the settings file, but it does not need to be a globally portable font identifier. The family name is the primary cross-machine matching value.

### Style font selection

Each output/input style setting should reference a shelf family and store the chosen face traits separately.

```ts
type StyleFontSelection = {
  source: 'builtin' | 'system';
  id: string;
  weight?: number;
  italic?: boolean;
  stretch?: string;
};
```

The resolved renderer can turn this into CSS:

```ts
type ResolvedFontCss = {
  fontFamily: string;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  fontStretch?: string;
};
```

For a system font, `fontFamily` should include a safe fallback chain. For a missing system font, resolution should use the inherited or default font while preserving the saved unavailable selection.

### Built-in fonts

Built-ins are app-controlled shelf entries:

- JetBrains Mono
- System UI
- Serif

They may expose a smaller generic style list than system fonts. JetBrains Mono can expose real bundled faces if available; System UI and Serif may rely on generic CSS family behavior and should not pretend to have exact OS-enumerated faces.

## Suggested Work Phases

### Phase 1: Confirm storage shape

- define the persisted font shelf in the app settings database
- define `StyleFontSelection` for app/world/character style settings
- decide how old `fontFamily` string settings migrate to the new font selection shape
- confirm inheritance behavior when a selected shelf family or face is unavailable

Checklist:

- [ ] Persist the app font shelf separately from individual style selections.
- [ ] Store font family selection and face traits separately.
- [ ] Add built-in shelf entries that are always present.
- [ ] Decide how existing `fontFamily` values migrate.
- [ ] Decide how inheritance falls back when a selected system family is missing.

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
- let the user add a system family to the font shelf
- let the user optionally select the newly added shelf family immediately

Checklist:

- [ ] Add the picker component.
- [ ] Add font family filtering.
- [ ] Add style preview for faces within a family.
- [ ] Add preview rendering.
- [ ] Wire add-to-shelf into the settings form.

### Phase 5: Build the compact shelf selector

- update the existing style font controls to show shelf font families
- show built-in and system entries together, grouped or clearly labeled
- show a style selector for the selected shelf family
- derive system style options from the enumerated `fontdb` faces
- allow deleting non-built-in shelf entries when safe
- mark missing system families clearly

Checklist:

- [ ] Render built-in shelf entries.
- [ ] Render user-added system shelf entries.
- [ ] Add a style selector for the selected family.
- [ ] Add a delete action for non-built-in shelf entries.
- [ ] Block or replace deletion when a shelf entry is still referenced.
- [ ] Show unavailable state for missing system families.

### Phase 6: Wire persistence and inheritance

- save the shelf and style selections in the settings model
- make the picker reflect inherited values
- allow explicit override or reset-to-inherit behavior
- ensure the transcript and input box both pick up the chosen font
- preserve missing system fonts in shared databases without silently changing stored values

Checklist:

- [ ] Persist the font shelf.
- [ ] Persist selected shelf family and face traits.
- [ ] Support reset-to-inherit.
- [ ] Apply the font to transcript and input text.
- [ ] Preserve missing fonts without mutating the user's saved choice.
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

- Keep the normal style font control compact by showing only shelf entries.
- Keep the full system picker searchable.
- Group faces under families instead of showing a huge flat list.
- Show a sample line in the selected font so the user can verify the choice quickly.
- Let the user add a system family once, then try different styles/weights from that family in the compact style UI.
- Let the user remove non-built-in shelf entries.
- Do not delete missing font entries automatically; make them visible and removable.
- Keep the picker style consistent with the existing settings page.
- Provide a clear fallback message if the font list cannot be loaded.

## Error Handling

Handle these cases explicitly:

- no fonts returned
- enumeration failure
- duplicate or malformed family names
- missing style variants for a chosen family
- selected shelf family unavailable on this OS
- selected style traits unavailable within an otherwise available family
- deleting a shelf entry that is still referenced by app, world, or character styles
- backend command failure

The frontend should still function with a safe default font even if enumeration fails.

For shared configuration databases:

- preserve unavailable system shelf entries
- preserve style selections that reference unavailable system fonts
- resolve rendering through inheritance or built-in defaults
- avoid rewriting the database just because the current OS cannot find a saved font

## Verification Checklist

- [ ] Confirm the backend can enumerate system fonts on Linux.
- [ ] Confirm the backend can enumerate system fonts on Windows.
- [ ] Confirm the backend can enumerate system fonts on macOS.
- [ ] Confirm the Svelte picker renders grouped families.
- [ ] Confirm selecting a family updates the preview.
- [ ] Confirm selecting a style persists correctly.
- [ ] Confirm adding a system family places it on the compact shelf.
- [ ] Confirm a shelf family can use multiple face styles without adding duplicate shelf entries.
- [ ] Confirm deleting a non-built-in shelf entry works when unreferenced.
- [ ] Confirm deleting a referenced shelf entry is blocked or requires a replacement.
- [ ] Confirm the transcript and input box use the selected font.
- [ ] Confirm the app falls back cleanly if enumeration fails.
- [ ] Confirm missing system fonts remain visible and do not get deleted from shared settings.

## Open Questions

1. Should deletion of a referenced system shelf entry be blocked, or should it offer an immediate replacement flow?
2. Should the first version allow only installed system fonts, or also user-imported font files?
3. Should the font list be cached at startup or loaded only when the settings page opens?
4. Should the preview sample use the transcript font, the input font, or both?
5. Should built-in `system-ui` and `serif` expose generic bold/italic controls, or only a default style?
