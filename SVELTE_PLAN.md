# MUDShow Svelte Migration Plan

## Goal
Rebuild the current one-file client as a maintainable Svelte + TypeScript app built with Vite, while preserving the existing behavior and minimalist feel.

## Architecture Goal
Keep the frontend, backend proxy, and any future desktop shell as separate concerns with separate build outputs and minimal shared code.

## Future Platform Goal
Keep the backend replaceable so the project can move toward a Tauri desktop app later. The preferred intermediate path is a Node sidecar if a native Rust backend is not yet worth the cost.

## Recommended Top-Level Structure
```text
frontend/
  app.css
  main.ts
  App.svelte
  lib/
    types.ts
    storage.ts
    connection.ts
    formatting.ts
    completion.ts
    components/
      CharacterList.svelte
      CharacterModal.svelte
      PlayScreen.svelte
      Transcript.svelte
      InputBars.svelte
      NotesPanel.svelte
      HighlightsPanel.svelte
      StatusDot.svelte
      Modal.svelte
backend/
  proxy.ts
shared/
  types.ts
  constants.ts
dist/
  frontend/
  backend/
```

## Structure Notes
- A `src/` folder inside `frontend/` is optional, not required; use it only if the chosen frontend setup expects it.
- Keep frontend code inside `frontend/` so the UI can be built and deployed independently.
- Keep proxy/server code inside `backend/` so it can be built and run separately from the UI.
- Keep shared protocol or data-shape definitions in `shared/` only when both sides truly need them.
- Keep `App.svelte` as the state orchestrator and screen switcher.
- Put shared data shapes in `types.ts`.
- Put browser persistence in `storage.ts`.
- Put session/proxy connection logic in `connection.ts`.
- Put transcript parsing, ANSI handling, highlighting, and word completion in focused utility modules.
- Keep UI components small and mostly presentational.
- Keep global styling in `app.css`; let components own only local structure and state behavior.

## Build Plan
1. Create separate frontend and backend build targets and confirm both run independently.
2. Move the current UI into the frontend app shell.
3. Keep the proxy code isolated in its own backend entrypoint.
4. Define any shared types or constants in a small shared area.
5. Keep the backend protocol simple enough to be implemented later by either a Node sidecar or Rust.
6. Split the UI into focused Svelte components.
7. Extract local storage read/write logic into reusable helpers.
8. Extract connection setup, send/receive handling, and disconnect/error handling.
9. Extract transcript formatting: ANSI rendering, telnet stripping, highlighting, scroll behavior.
10. Extract input handling: dual bars, focus switching, Enter send, Tab completion.
11. Rebuild notes and highlight panels as independent components.
12. Recreate character list, modal editing flow, and add/delete actions.
13. Restore keyboard shortcuts, attention state, and activity sound.
14. Reapply the existing visual language in a cleaner stylesheet split.
15. Verify all behaviors against the current client and trim any unused code.

## Implementation Order
- Start with data model and persistence.
- Then separate frontend and backend build entrypoints.
- Then build connection and transcript rendering.
- Then build the screen flow and input controls.
- Finish with polish, keyboard shortcuts, and visual parity.

## Output Layout
- Use a root-level `dist/` for generated artifacts.
- Keep frontend output in `dist/frontend/`.
- Keep backend output in `dist/backend/`.
- Avoid mixing source files with generated files.

## Behavioral Checklist
- Character profiles can be created, edited, selected, and deleted.
- Notes persist per character.
- Highlight rules persist globally.
- One active connection is shown at a time.
- Incoming output is rendered with formatting and highlight colors.
- Two input bars work independently.
- F1/F2 switch input focus.
- F3 toggles notes.
- F4 toggles highlights.
- Tab completes recent words from observed output.
- Activity is visible when the tab is unfocused.
- UI remains minimal, readable, and responsive.

## Non-Goals
- Do not add mapping.
- Do not add a scripting engine or trigger system.
- Do not add gameplay automation.
- Do not change the app into a multi-user or cloud-synced system.
- Do not bundle the frontend and backend into one codebase layer if they can stay independent.
- Do not couple future desktop shell code directly to browser-only implementation details.
- Do not force an early Rust rewrite if a Node sidecar keeps the path to Tauri simpler.
- Do not expand the scope beyond the current client behavior unless explicitly requested.

## Future Instruction Style
- Prefer small, incremental changes.
- Preserve current behavior unless a change is explicitly requested.
- Keep frontend and backend instructions separate unless a task clearly spans both.
- Keep the code split by responsibility, not by framework convention alone.
- Favor readable state flow over clever abstractions.
- Keep the app compact and easy to reason about.
