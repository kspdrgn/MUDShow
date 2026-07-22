# Fonts

Fonts are shared application resources used by style settings for the transcript output and command input areas.

The font system has three separate concepts:

- System font universe - installed fonts discovered from the operating system through the desktop backend.
- App font shelf - the compact set of font families that MUDShow shows in normal style controls.
- Style font selection - the specific shelf family and face traits used by one output or input style setting.

The style UI details live in `spec/style.md`. This document defines the backend, persistence, validation, and fallback behavior needed to make fonts reliable across machines and operating systems.

## Goals

- Let users add installed system font families to MUDShow without exposing every installed font in every style dropdown.
- Keep built-in fonts available on every system.
- Store user-added system fonts in a way that remains understandable in the JSON settings database.
- Preserve missing system font choices when a settings database is shared across machines or operating systems.
- Validate shelf entries without requiring the full picker enumeration.
- Keep rendering safe by falling back when a selected font cannot be used.

## Non-Goals

- No native OS font dialog is required.
- No GTK dependency is required.
- No user-imported font files in the first version.
- No server-side font sync.
- No guarantee that every font installed on the OS is discoverable.
- No app-specific font fallback engine beyond choosing a safe CSS fallback.

## Built-In Fonts

MUDShow always provides these built-in font choices:

- JetBrains Mono
- System UI
- Serif

Built-in fonts:

- are always present in the app font shelf
- cannot be deleted
- are portable across settings databases
- are valid even when system font enumeration fails

JetBrains Mono may expose real bundled faces if the app bundles those faces. System UI and Serif are generic CSS families and should not pretend to have exact OS-enumerated faces. They may expose a smaller generic style set, or only a default style, depending on what the style UI supports.

## System Font Discovery

The Tauri backend uses the Rust `fontdb` crate for system font discovery.

`fontdb` is used because:

- the webview cannot reliably enumerate installed fonts by itself
- it is small and does not require a native font dialog
- it exposes face metadata that maps well to CSS rendering
- it supports Windows, macOS, and Linux

Important `fontdb` constraints:

- `fontdb` stores font faces, not just font families.
- `load_system_fonts` scans known system font locations; it does not call every OS font API.
- Some installed fonts may not be discovered if they are outside the scanned locations.
- `fontdb` does not implement a full fallback engine.
- `fontdb` has a CSS-like query API that can validate or match a requested family and face traits.

The app should treat `fontdb` as a discovery and matching layer, not as the source of permanent user preference identity.

## Backend Commands

### `list_system_fonts`

Returns the full system font universe for the font picker.

The command returns grouped font families:

```ts
type SystemFontFamily = {
  family: string;
  faces: SystemFontFace[];
};
```

Each face contains frontend-friendly metadata:

```ts
type SystemFontFace = {
  family: string;
  styleName: string;
  weight: number;
  italic: boolean;
  stretch: string;
  postscriptName: string;
  displayName: string;
  monospaced: boolean;
};
```

The frontend should use this command when opening the full system font picker or refreshing the picker list.

### `validate_system_font`

Validates a single system font shelf entry or style selection without returning the full picker list.

Request:

```ts
type SystemFontValidationRequest = {
  family: string;
  weight?: number;
  italic?: boolean;
  stretch?: string;
};
```

Response:

```ts
type SystemFontValidationResult = {
  family: string;
  available: boolean;
  matchedFace?: SystemFontFace;
};
```

The command uses `fontdb` query matching. If a family is unavailable, or the matched face belongs to a different family, `available` is false.

Validation is intended for:

- checking saved shelf entries on startup or when opening settings
- checking whether a style selection is still usable
- marking a shelf entry as available or missing
- avoiding a full picker enumeration for routine shelf checks

The backend may still need to load the system font database internally. The important contract is that the frontend receives a compact answer instead of the full font universe. The backend may cache the loaded database later if repeated validation is too expensive.

## App Font Shelf

The app font shelf is a persisted, curated list of families available in normal style settings.

The shelf contains:

- built-in entries that are always present
- user-added system font family entries

The shelf stores system fonts at the family level. A user should not need to add separate shelf entries for Regular, Bold, Italic, and Bold Italic from the same family.

Suggested data shape:

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

Shelf rules:

- built-in entries are added automatically
- built-in entries cannot be deleted
- system entries can be added from the full system font picker
- system entries can be deleted when no saved style references them
- deleting a referenced system entry should be blocked or require a replacement flow
- missing system entries remain visible and removable
- missing system entries must not be silently deleted

The system shelf `id` should be stable inside the settings file. It does not need to be a globally portable font identifier. The family name is the primary cross-machine matching value.

## Style Font Selection

Each output or input style setting stores a reference to a shelf family and optional face traits.

Suggested data shape:

```ts
type StyleFontSelection = {
  source: 'builtin' | 'system';
  id: string;
  weight?: number;
  italic?: boolean;
  stretch?: string;
};
```

The style selection answers:

- which shelf family is selected
- which face traits should be requested within that family

The face traits are not separate shelf entries. If a user adds Cascadia Mono to the shelf, the style UI may let them choose Regular, Italic, Bold, or Bold Italic from that one family entry.

When resolving a style:

- built-in selections resolve through app-defined CSS family values
- available system selections resolve to the saved family plus selected traits
- missing system selections fall back through inheritance or defaults
- unresolved selections should preserve the saved value in storage

Resolved CSS may include:

```ts
type ResolvedFontCss = {
  fontFamily: string;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  fontStretch?: string;
};
```

System font `fontFamily` values should include a safe fallback chain.

## Missing Fonts

A selected system font can become unavailable when:

- the font is uninstalled
- the settings database is opened on another operating system
- the settings database is opened on another machine
- `fontdb` cannot discover the font even though the OS can use it

When this happens:

- keep the shelf entry
- keep any style selections that reference it
- mark the shelf entry or style selection as missing
- render with the inherited font or built-in default
- let the user delete or replace the missing shelf entry
- do not rewrite the database solely because the current system cannot find the font

This rule is important because the settings database is user-managed and may be shared between different OSes. A Windows-only font missing on macOS may become available again when the same database is reopened on Windows.

## Cross-OS Behavior

Built-in fonts are the portable baseline.

System font shelf entries are machine-local preferences stored in the shared settings database. They are allowed to be unavailable on some machines.

The app should resolve fonts independently on each machine:

- If the saved family is found, use it.
- If the saved family is not found, use fallback rendering and show the missing state.
- If the saved family later becomes available, use it again without requiring a migration.

The app should avoid changing saved system font entries automatically based only on the current OS.

## Matching and Face Traits

The app stores face traits that map to CSS:

- weight
- italic
- stretch

PostScript name may be returned for diagnostics and best-effort matching, but family name plus CSS-like traits are the main portable selection model.

If a requested family exists but the exact face traits are unavailable:

- `fontdb` may return the closest matching face
- the app may render with the closest match
- the UI should be able to show that the exact saved style is unavailable when that distinction matters

ANSI and trigger formatting can still apply weight or style on top of the base selected font. For example, ANSI bold may set `font-weight: 700` even when the base selected face is regular.

## Performance and Caching

The first implementation may load a fresh `fontdb::Database` inside each backend command.

Later, the backend may cache a loaded database if:

- opening the full picker is slow
- validating many shelf entries becomes slow
- startup validation causes noticeable delay

Caching requirements:

- cache invalidation should be possible through an explicit refresh action
- stale cache results should not delete saved font choices
- validation should still fail gracefully if cache loading fails

## Error Handling

Handle these cases explicitly:

- no system fonts returned
- system font enumeration failure
- malformed or empty family names
- duplicate faces
- selected shelf family unavailable on this OS
- selected face traits unavailable within an available family
- deleting a referenced shelf entry
- backend command failure

When font operations fail, the app should remain usable with built-in defaults.

## Verification

Font system verification should cover:

- enumerate fonts on Windows
- enumerate fonts on macOS
- enumerate fonts on Linux
- validate one available shelf family
- validate one missing shelf family
- validate a family with specific face traits
- keep missing shelf entries in storage
- render fallback when a selected system font is missing
- use multiple styles from one shelf family without adding duplicate shelf entries
- block or replace deletion of referenced system shelf entries
