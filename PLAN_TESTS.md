# Frontend Test Plan

## Goal
Build a small, focused frontend test suite that can sanity-check the app's most important interactive paths without requiring a real MUD connection or full manual testing.

## What We Want To Catch
- Connection lifecycle: connect, open, disconnect, reconnect, and error handling.
- Input sending: typed commands reach the active connection.
- Output receiving: incoming text lands in the transcript and updates session state.
- A little bit of UI wiring: the user can trigger the right actions from the session layer.

## Recommended Test Shape
- Keep the suite small and high-value rather than trying to cover every feature.
- Prefer logic tests around the session and connection layer first.
- Add only a couple of browser-level smoke tests if we need to prove the wiring end-to-end.
- Use a fake connection so the tests do not depend on a live server.

## Connection Short Circuit Recommendation
The short circuit should live in the frontend, not in Rust.

Why frontend:
- The app already wraps Tauri connection calls in `frontend/src/lib/connection.ts`.
- Session behavior is orchestrated in frontend code, especially `frontend/src/lib/session-playback-actions.ts` and `frontend/src/lib/session.ts`.
- A frontend fake lets tests exercise the same state transitions the UI uses in production.
- Rust should stay focused on the real transport; test support there would add complexity without helping this suite much.

How it could work:
- Introduce a tiny connection interface or factory that the session layer depends on.
- Production keeps using the current `MudConnection` wrapper.
- Tests swap in an in-memory fake that can:
  - report `open`
  - accept `send` calls
  - emit `data` back into the session
  - emit `close` and `error`
  - allow reconnect by resetting internal state
- Keep the fake minimal. It does not need to simulate networking, timing, buffering, or protocol behavior.

## Persistence Bypass Recommendation
We should add a second bypass for persistence-oriented tests so we do not write into a real app dictionary or depend on real on-disk state.

Why this should exist:
- A few important frontend flows depend on saved state: app settings, worlds, characters, notes, triggers, transcript history, and other local persistence.
- Tests should be able to verify save/load behavior without mutating the real user store.
- A controlled test store also makes it easier to reset state between tests and keep them deterministic.

How it could work:
- Introduce a small storage abstraction at the frontend boundary, similar to the connection factory.
- Production keeps using the current persistence path and Tauri-backed storage calls.
- Tests swap in an isolated in-memory, temp-file-backed, or fixture-seeded store.
- The test-provided storage data should become the active backing store for the application code under test, not just a shallow mock at one call site.
- The bypass should be narrow:
  - read and write app state
  - read and write character notes
  - read and write trigger data
  - read and write transcript history
  - optionally expose a reset/clear operation for test setup
- Do not mirror the full app dictionary or every storage behavior. Just support the persistence cases the tests need, while keeping the data source authoritative for the app code path.

## Integration Seams In The App
The test seams should attach at the same places the app already crosses from UI logic into side effects.

### Connection seam
- `frontend/src/lib/session.ts` currently creates `MudConnection` objects and owns the per-tab connection map.
- `frontend/src/lib/session-playback-actions.ts` drives the connection lifecycle, sends input, and reacts to open/data/close/error events.
- The test seam should be a connection factory or connection provider passed into the session setup, so the entire session layer can talk to a fake connection without knowing it is fake.
- The fake should still flow through the same session actions, status updates, transcript updates, reconnect logic, and disconnect handling that production uses.

### Storage seam
- `frontend/src/lib/storage.ts` already acts as the persistence boundary for worlds, characters, triggers, notes, app style, font shelf, and transcript history.
- `frontend/src/lib/session.ts` loads session data from storage during startup and uses storage-backed helpers for persisted state.
- `frontend/src/App.svelte` loads app settings and other persistent app-level values on mount.
- The test seam should be a storage backend or storage provider that the app code can call through directly, so test data becomes the active backing store for the code under test.
- Tests should be able to seed that store before startup and inspect the same store after app actions run.

### Recommended shape
- Keep the seam at the app boundary rather than at individual call sites.
- Prefer one injected test environment object or provider per app instance over many ad hoc mocks.
- Let the injected environment supply both connection behavior and persistence behavior so tests can stand up a complete isolated app state.
- Keep production defaults unchanged so the normal desktop app still uses the real Tauri and local storage paths.

## Suggested First Pass
1. Add a test runner for frontend logic tests if one is not already present.
2. Extract the app-level connection provider so tests can inject the fake.
3. Extract the app-level storage provider so tests can seed and observe isolated persistence data.
4. Cover the core session flow with a few targeted tests:
   - successful connect opens the session and marks it connected
   - send routes text to the active connection
   - incoming data appends to output
   - disconnect updates state and blocks further sends
   - reconnect restores the session against the fake transport
5. Add a few persistence sanity tests against the bypassed store:
   - save and reload settings
   - save and reload notes
   - save and reload transcript history
   - save and reload trigger data
6. Add one smoke test for the main session UI only if the logic tests leave an important gap.

## Potential First Tests
These are the first candidates we should review before implementation. The idea is to start broad enough to cover the risky paths, then prune anything redundant.

### Connection behavior
1. Connect flow opens a session.
   - A world connection transitions from `connecting` to `connected`.
   - The session shows the connected state.
   - The connect string is sent if the character has one.
2. Disconnect flow updates state cleanly.
   - Manual disconnect marks the session as `disconnected`.
   - Further sends are blocked after disconnect.
3. Reconnect restores the prior session.
   - A disconnected world tab can reconnect.
   - It uses the same world and character context.
   - It returns to `connected` through the same session path.
4. Incoming output is appended correctly.
   - Fake connection `data` events reach the transcript.
   - Output revision and related session state update as expected.
5. Input sending reaches the active connection.
   - Typing a command sends text through the active connection.
   - The command goes to the current world tab, not a stale one.
6. Connection error handling is visible.
   - A fake connection `error` event marks the session as errored or disconnected.
   - The error message is surfaced in the session output or state.

### Persistence behavior
7. Saved session data loads from an isolated store.
   - A test-provided storage fixture is loaded at startup.
   - Worlds, characters, triggers, and related persisted data come from the test store.
8. Persistence writes stay inside the test store.
   - Saving notes, triggers, or session data updates the same isolated backing store.
   - Reloading from that store sees the changes.
9. Transcript history restore works from test data.
   - Seeded history loads for a character.
   - Reconnect restores the expected history window.

### Smoke coverage
10. One browser-level UI smoke test confirms the core session screen can connect, show output, and disconnect using the test seams.

## Likely Best Test Targets
- `frontend/src/lib/connection.ts` for connection wrapper behavior.
- `frontend/src/lib/session-playback-actions.ts` for state changes caused by connection events.
- `frontend/src/lib/session.ts` for tab and session wiring if we need a higher-level check.

## Non-Goals For The First Pass
- No full server emulator.
- No attempt to reproduce MUD protocol edge cases.
- No broad screenshot or visual regression suite yet.
- No Rust-side transport rewrite just for testability.
- No dependence on the real user dictionary or real persistent app store during tests.

## Open Questions
- Whether we want to start with logic-only tests or include one end-to-end browser smoke test right away.
- Whether the fake connection should be exposed as a test-only export or injected through a general-purpose connection factory.
