# Session Logging Implementation Plan

This plan covers user-initiated session logging for a world tab, including:

- start logging with an auto-generated filename
- stop logging
- rename the active log file while logging continues
- show active logging in the UI
- persist the default log folder in app settings
- write status messages to the output view

The target behavior is described in `spec/logging.md` and the related updates in `spec/layout.md`, `spec/output.md`, and `spec/settings.md`.

## Current Repo Touch Points

Likely implementation areas in the current codebase:

- `frontend/src/lib/session.ts`
- `frontend/src/lib/session-playback-actions.ts`
- `frontend/src/lib/session-state.ts`
- `frontend/src/lib/world-session.ts`
- `frontend/src/lib/storage.ts`
- `frontend/src/lib/app-settings.ts`
- `frontend/src/lib/components/PlayScreen.svelte`
- `frontend/src/lib/components/InputBars.svelte`
- `frontend/src/lib/components/TopBar.svelte`
- `frontend/src/lib/components/StatusDot.svelte`
- `frontend/src/lib/components/SettingsPage.svelte`
- `frontend/src/lib/components/WorldsAndCharactersEditor.svelte`
- `tauri/src/main.rs`
- `tauri/src/storage.rs`

## Implementation Goals

1. Logging is controlled per active world tab.
2. Logging starts with a generated file name based on date, world name, and character name.
3. Logging captures the current visible transcript history first, then appends new output as it arrives.
4. Renaming the active log file moves the file on disk and keeps the same log stream open.
5. The app shows logging state clearly in both the tab and the input bar.
6. The output pane shows start/stop status messages.
7. The app stores a default log folder location in settings.

## Suggested Build Order

### 1. Add logging state to session models

- Extend `WorldTabSessionState` in `frontend/src/lib/world-session.ts` with logging fields.
- Add a logging projection if needed so the session store can update logging separately from connection state.
- Decide on the minimum state needed for logging:
  - whether logging is active
  - current log path
  - current log folder
  - current generated base name
  - any rename/edit buffer for the UI
  - any pending error message

Checklist:

- [ ] Add logging fields to world session state.
- [ ] Add logging fields to initial world session creation.
- [ ] Decide whether logging state should live in the frontend store only or also in persistent storage.

### 2. Add app settings for the default log folder

- Extend `AppSettings` in `frontend/src/lib/app-settings.ts`.
- Load and save the new field alongside the existing settings.
- Expose the setting in the app settings screen.
- Keep the fallback behavior explicit if the path is empty or invalid.

Checklist:

- [ ] Add `defaultLogFolder` or equivalent to `AppSettings`.
- [ ] Provide a safe default when the setting is missing.
- [ ] Persist the setting through the existing local storage flow.
- [ ] Add a UI control in `SettingsPage.svelte`.
- [ ] Keep the control consistent with the existing settings card layout.

### 3. Define log file naming and path handling

- Create a small helper for log filename generation.
- Use the current date in `YYYY-MM-DD` form.
- Include world and character names.
- Sanitize names for filesystem safety.
- Keep the generated name readable.
- Decide how edits are applied:
  - append text to the generated name
  - replace the full filename

Checklist:

- [ ] Add a filename sanitizer helper.
- [ ] Add a generated-name helper.
- [ ] Add a path join helper for the log folder and filename.
- [ ] Normalize names so platform-invalid characters do not leak into the path.

### 4. Implement log file lifecycle operations

This is the main backend-facing piece.

The likely shape is:

- start logging
- append one output chunk
- rename active log file
- stop logging

Possible implementation approaches:

- Frontend-only file handling if the desktop permissions and platform support are enough.
- Tauri commands for file creation, append, rename, and close if we want a cleaner boundary.

The Tauri route is likely the safer long-term choice because:

- it keeps file operations centralized
- it avoids mixing file I/O with session rendering logic
- it can handle rename/move behavior more predictably

Checklist:

- [ ] Add a log-open command or service.
- [ ] Add an append command or service.
- [ ] Add a rename/move command or service.
- [ ] Add a close/stop command or service.
- [ ] Make sure the file is opened with append semantics after start.
- [ ] Make sure the file handle survives output bursts safely.

### 5. Capture transcript history on log start

- On start, write the current transcript contents first.
- Reuse the same transcript source the UI is already rendering if possible.
- Include visible history exactly as the user sees it.
- If the output includes formatting, decide whether to preserve terminal-style text or strip style markers.

Checklist:

- [ ] Determine the best source for the current transcript buffer.
- [ ] Write existing transcript content before new appends.
- [ ] Keep the initial write consistent with later append formatting.
- [ ] Avoid double-writing already persisted history.

### 6. Append future output while logging is active

- Hook logging into the same path that receives new session output.
- Append only the new output chunks that arrive after logging starts.
- Keep logging independent of connection state until stopped by the user.

Checklist:

- [ ] Identify the output ingestion point in `session-playback-actions.ts`.
- [ ] Append new output to the log when logging is active.
- [ ] Keep the append path non-blocking for the UI.
- [ ] Handle reconnects without creating duplicate log files unless the user explicitly restarts logging.

### 7. Add rename behavior for the active log file

- Provide a rename action while logging is active.
- If the user edits only part of the generated name, preserve the rest where possible.
- If the user wants full control, allow replacing the whole filename.
- Rename should move the existing log file and continue writing to the new location.

Checklist:

- [ ] Add a rename UI affordance.
- [ ] Support partial edits to the generated filename.
- [ ] Support full replacement of the filename.
- [ ] Move the file on disk without losing the active stream.
- [ ] Preserve logging state across the rename.
- [ ] Surface rename errors to the user.

### 8. Add start/stop controls in the UI

The plan should keep the UI minimal and consistent with the current layout.

Likely UI surface options:

- add a small logging control in the world tab header or top bar menu
- add a compact action in the world tab context menu
- optionally add a button near the input bars if that is more discoverable

Checklist:

- [ ] Decide where the logging control lives.
- [ ] Add a start action.
- [ ] Add a stop action.
- [ ] Add a rename action.
- [ ] Disable or hide actions when not applicable.
- [ ] Keep the action discoverable without cluttering the layout.

### 9. Show logging status in the tab and input bar

- Reuse the existing `StatusDot` pattern.
- Add a second dot beneath the connection dot when logging is active.
- Keep the indicator consistent in both the tab area and the active input bar.

Checklist:

- [ ] Extend tab rendering in `TopBar.svelte` for a logging dot.
- [ ] Extend input bar rendering in `InputBars.svelte` for a logging dot.
- [ ] Keep the dot visually distinct from connection state.
- [ ] Ensure inactive logging does not reserve awkward empty space.

### 10. Add output status messages

- Show a clear message in the transcript area when logging starts.
- Show a clear message when logging stops.
- Keep the messages readable and brief.

Checklist:

- [ ] Add a logging start message.
- [ ] Add a logging stop message.
- [ ] Make sure the messages flow through the existing transcript rendering path.
- [ ] Avoid confusing the logging messages with normal server output.

### 11. Wire logging state into character and tab lifecycle

Logging should behave sensibly when tabs or characters change.

Questions the implementation should settle:

- does logging stop automatically when a world tab closes?
- does logging survive reconnects in the same tab?
- should logging be tied to the current character identity, current tab identity, or both?

Recommended behavior from the spec:

- logging is tied to the active world tab
- closing the tab stops logging
- reconnecting in the same tab should not silently reset the logging state

Checklist:

- [ ] Stop logging when the tab is closed.
- [ ] Keep logging state tied to the active tab session.
- [ ] Make reconnect behavior explicit and predictable.
- [ ] Prevent stale log handles after world or character switches.

### 12. Decide persistence scope

The spec only requires the default log folder to be persisted.

Open decision:

- should active logging state be restored after an app restart?

Recommended default:

- do not restore an active log session automatically
- keep logging as an explicit user action

Checklist:

- [ ] Persist the log folder setting.
- [ ] Do not auto-resume logging after restart unless explicitly desired later.
- [ ] Keep the design consistent with how tabs are not restored across app sessions.

## Tauri / Rust Considerations

If logging is implemented through Tauri commands:

- add commands in `tauri/src/main.rs`
- add file operations in `tauri/src/storage.rs` or a new dedicated module
- update capability/permission files under `tauri/permissions`
- keep file path validation strict
- make rename and append operations atomic enough to avoid corruption

Checklist:

- [ ] Add any needed Tauri commands and permissions.
- [ ] Keep the file I/O boundary isolated.
- [ ] Ensure cross-platform path handling is safe.
- [ ] Keep logs in the user-configured folder unless the user overrides the destination.

## UI / UX Considerations

- Logging controls should not dominate the interface.
- The active state should be obvious at a glance.
- The file rename flow should be easy for both:
  - appending text to the generated name
  - editing the full filename

Checklist:

- [ ] Keep the control compact.
- [ ] Avoid adding a large permanent logging panel.
- [ ] Make the active state visible in multiple places.
- [ ] Make the rename interaction forgiving.

## Error Handling

Handle these cases explicitly:

- log folder missing or invalid
- filename conflicts
- file permission failures
- rename failures
- write failures while logging is active
- tab closure while a log file is open

Checklist:

- [ ] Display a useful error message in the output area.
- [ ] Leave the session usable if logging fails.
- [ ] Ensure logging errors do not disconnect the session.
- [ ] Prevent silent failures.

## Verification Checklist

Manual checks to run after implementation:

- [ ] Start logging on an active world tab.
- [ ] Confirm the output history is written immediately.
- [ ] Confirm new incoming output is appended.
- [ ] Confirm the tab shows the logging dot.
- [ ] Confirm the input bar shows the logging dot.
- [ ] Stop logging and confirm the dot disappears.
- [ ] Rename the active log file and confirm logging continues.
- [ ] Verify the new filename is reflected on disk.
- [ ] Confirm the default log folder setting persists across restarts.
- [ ] Confirm logging errors are visible and non-fatal.

## Open Questions

1. Should the logging control live in the tab header, the world menu, the input bar area, or more than one place?
2. Should the output history written on start preserve the exact rendered text or a plain-text extraction?
3. Should rename support a dedicated dialog with a filename field, or a more compact inline edit pattern?
4. Should logging continue across disconnect/reconnect by default, or should reconnect prompt the user?

