# App-Wide DI Registry Plan

## Purpose

- Introduce a lightweight app-wide dependency registry for services and shared state used across many parts of the UI.
- Reduce the amount of storage, settings, spellcheck, and window-attention wiring passed through `App.svelte` and component props.
- Give the codebase a short, consistent name for the app-wide service boundary.
- Keep app-wide behavior in named service modules instead of spreading it across the app shell.

## Current Status

- `spec/di.md` now describes an app-wide registry alongside the existing world-session registry.
- `storage` already behaves like an app-wide service, even though it is currently exposed as a plain module.
- `app-settings` already behaves like a shared settings service, with load and save logic concentrated in one module.
- `spellcheck` is a shared cross-cutting feature, but most of its text helpers are still utility-style functions.
- `spellcheck` now owns the app-wide configuration lookup used by Notes and InputBars.
- The app-wide registry now includes lifecycle hooks, and storage registers its startup initialization there.
- App style now has an app-scoped service that resolves the current app style from the default style plus app-level overrides, and owns the font shelf / OS font lookup flow.
- Window attention logic currently lives inside world transcript/session behavior and should be separated into its own app-level service.

## Why This Exists

- `App.svelte` currently owns too much coordination around persistence, settings updates, spellcheck, and attention behavior.
- Several features need the same app-wide data and callbacks in different places.
- Passing those values through multiple component layers makes the code harder to scan and easier to duplicate.
- A registry gives us one stable place to request common services without turning the app shell into the owner of every interaction.

## Candidate App-Wide Services

### Clearly app-wide

- Storage and persistence.
- App settings load, update, and save behavior.
- Window attention and unseen-activity coordination.

### Likely app-wide

- Spellcheck request helpers and shared spellcheck configuration.
- App style resolution, including default style values, app-level overrides, and style editor state.
- Font shelf management and OS font lookup used by the style editor.
- Fonts if font discovery, validation, or shelf access starts to spread beyond the style/settings area.
- Logging location helpers if they continue to be accessed from several unrelated surfaces.

### Possibly app-wide later

- Clipboard-related helpers that are used by multiple app features.
- Shared notification helpers.
- Any other cross-cutting native-window behavior that needs one source of truth.

## Proposed Registry Shape

- Keep the registry plain and dependency-light.
- Expose named service namespaces rather than a giant generic service bag.
- Keep shared state holders and service methods together when the service has lifecycle or persistence concerns.
- Keep pure formatting and text helpers outside the registry unless they need shared state or coordinated lifecycle.

## Proposed Namespaces

- `storage` for persistence, file location management, and app data load/save operations.
- `settings` for app settings state, normalization, persistence, and update helpers.
- `spellcheck` for shared spellcheck requests and spellcheck-related configuration access.
- `style` for resolving the current app style from the default style and app-level overrides.
- `windowAttention` for focus tracking, attention requests, and unseen-activity coordination.

## Function Migration Map

### `storage`

Move into the app-wide registry:

- `getAppStoragePath`
- `getDefaultLogFolder`
- `setAppStoragePath`
- `revealAppStorageFile`
- `pickAppStorageFile`
- `moveAppStorageFile`
- `moveDefaultLogFolder`
- `revealDefaultLogFolder`
- `resolveDefaultLogFolder`
- `setDesktopStorageMode`
- `loadWorlds`
- `saveWorlds`
- `loadCharacters`
- `saveCharacters`
- `loadTranscriptHistory`
- `saveTranscriptHistory`
- `moveTranscriptHistory`
- `deleteTranscriptHistory`
- `loadNotes`
- `saveNotes`
- `moveNotes`
- `deleteNotes`
- `loadTriggers`
- `saveTriggers`
- `loadAppStyleOverrides`
- `saveAppStyleOverrides`
- `loadFontShelf`
- `saveFontShelf`
- `saveConnectionData`
- `loadSessionData`

Keep private in `storage.ts`:

- parsing and normalization helpers
- file queueing and access coordination
- local webview read/write helpers
- record cleanup and validation helpers

### `settings`

Move into the app-wide registry:

- `loadAppSettings`
- `saveAppSettings`
- `DEFAULT_APP_SETTINGS`
- `AppSettings`

Likely service-level API:

- `getSettings`
- `updateSettings`
- `resetSettings`
- `subscribe`

Keep private in `app-settings.ts`:

- normalization helpers
- value-clamping helpers
- `safeParse`
- storage-mode setup side effects

### `spellcheck`

Move into the app-wide registry:

- `checkSpellcheckWord`
- `suggestSpellcheckWords`
- `getSpellcheckSuggestions`
- `getSpellcheckAnnotations`
- `addSpellcheckWord`

Keep as utility helpers unless they later need shared lifecycle or cached state:

- `normalizeSpellcheckIgnoredWords`
- `appendSpellcheckIgnoredWord`
- `splitSpellcheckIgnoredWords`
- `normalizeSpellcheckWord`
- `tokenizeSpellcheckWords`
- `escapeSpellcheckHtml`
- `renderSpellcheckUnderlayHtml`
- `getWordBounds`

Suggested split:

- The spellcheck service owns request coordination and shared configuration access.
- The settings service owns the ignored-words string because it is persisted app state.
- Pure text helpers remain standalone utility functions.

### `style`

Move into the app-wide registry:

- default app style values
- app style editor state
- app style override loading and saving
- font shelf loading and saving
- current app style resolution

Keep private in the app style module:

- style normalization helpers
- style serialization helpers
- style editor dirty-state checks
- pure value resolution helpers

Suggested split:

- The app style service owns the app-level style editor and resolves the current app style.
- The world-session style service will later compose per-world and per-character style choices on top of the app style service.

### `windowAttention`

Move into the app-wide registry:

- `isAppFocused`
- `setWindowAttention`
- `handleVisibilityChange`
- `handleWindowFocus`
- possibly `noteOutputActivity`

Keep in session transcript logic:

- per-tab activity bookkeeping
- active-tab clearing and scroll restoration
- decisions about which tab has new activity

## App Shell Impact

After the registry is introduced, `App.svelte` should mostly do bootstrap and high-level coordination.

It should stop directly owning:

- app storage selection and migration callbacks
- raw settings persistence calls
- spellcheck word-ignore persistence details
- native attention behavior

It should keep:

- registry construction or access
- initial settings and storage bootstrap
- top-level feature wiring
- app-level UI orchestration that does not belong in a shared service

## Suggested Migration Order

1. `storage`
2. `settings`
3. `windowAttention`
4. `spellcheck`

This order gives the biggest wiring reduction first and leaves the most utility-heavy area for last.

## Non-Goals

- Do not move world-session state into the app-wide registry.
- Do not turn the registry into a heavyweight DI framework.
- Do not move pure utility helpers into shared services unless they need shared state or lifecycle.
- Do not replace component-local UI state with registry state.
- Do not make `App.svelte` a thin wrapper for everything; it should still own top-level composition.

## Open Questions

- Should the app-wide registry be a single `createAppServices()` object or separate service constructors with a small root assembler?
- Should `settings` expose a store-like subscription API, or should the app shell continue to own the current settings object and just call service methods?
- Should spellcheck maintain cached configuration or remain a stateless request wrapper around Tauri calls?
- Should `windowAttention` own only native attention calls, or also the activity flag logic that decides when to request attention?
- Should storage remain one module-backed service, or should read/write operations be split into smaller namespaces once the registry lands?

## Next Steps

- Sketch the registry file and namespace interfaces.
- Build the container first, without pulling large service logic into it yet.
- Pick the simplest migration candidate for the second phase.
- Leave `storage` for the final major migration once the registry shape feels stable.

## Implementation Checklist

### Phase 1: Establish the Container

- [x] Define the app-wide registry entry point and its namespace shape.
- [x] Decide whether the registry is assembled in one `createAppServices()` function or via small service factories plus a root assembler.
- [x] Add the container without moving major behavior yet.
- [x] Wire `App.svelte` to create or receive the registry.
- [x] Keep the initial implementation small enough that it can still delegate directly to the current modules.

### Phase 2: Prove the Shape With a Smaller Migration

- [x] Choose a low-risk migration candidate, likely `windowAttention` or `spellcheck`.
- [x] Move the chosen service behind the registry.
- [x] Update `App.svelte` and the immediate call sites to use the new service boundary.
- [x] Decide where shared configuration or ignored-word mutation should live and keep that ownership consistent.
- [x] Confirm the new service shape still feels simple before moving more code.

### Phase 3: Migrate App Settings

- [x] Move app settings load/save/update behavior behind the registry.
- [x] Replace direct settings callbacks passed into components with registry-backed service calls.
- [x] Keep `AppSettings` state ownership in one place rather than spreading it through the tree.

### Phase 4: Move Storage Last

- [x] Move storage path and persistence access behind the registry.
- [x] Move the app-wide persistence operations into the storage service one group at a time.
- [x] Replace direct storage imports in `App.svelte` and feature modules with registry-backed service calls.
- [x] Update any components that still depend on storage callbacks after the first passes.
- [x] Clean up any now-unused imports or helper paths left behind after the refactor.

### Phase 5: Verify and Tighten

- [x] Update related spec or plan docs if the implementation reveals a better boundary.
- [x] Run the relevant type checks and targeted tests after each major extraction.
- [x] Add a generic app lifecycle hook registry and move storage startup initialization into the storage service.
- [x] Move resolved default log-folder lookup into the storage service.
- [x] Move log-folder migration into the storage service so App only consumes the result.
- [x] Create an app-scoped style service and move app style startup initialization into its lifecycle hook.
- [x] Move spellcheck configuration lookup into `AppSpellcheckService` and route the main consumers through the registry-backed config.
- [x] Move the spellcheck ignore-word mutation flow into `AppSpellcheckService`.
- [ ] Revisit whether `spellcheck` should remain partly utility-based or move more of its shared logic into the service.
