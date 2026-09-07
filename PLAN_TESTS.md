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
- Use one focused browser-level end-to-end test as the first UI integration target.
- Prefer Playwright for browser automation rather than inventing a bespoke harness.
- Keep the first Playwright test against the frontend dev/build server with
  deterministic test seams; do not make it depend on a live MUD, Tauri window
  orchestration, or screenshot comparison.
- Use a fake connection so the tests do not depend on a live server.

## Focused Regression Slice

The first implementation should be a small logic-only regression suite for the
highest-risk session paths. It should not attempt to cover the whole application
or make the logic tests depend on browser automation; the separate first
end-to-end test below owns the browser-test setup.

### Scope

Cover these behaviors:

1. Transcript history appends incoming text and trims to the configured line limit.
2. Transcript scroll helpers report distance from the bottom and avoid
   follow-to-bottom behavior after the user scrolls away.
3. A connection can open, deliver incoming data, close, report an error, and
   reconnect without accepting stale events from an earlier attempt.
4. A connected session sends entered text through the active connection and
   incoming text reaches the transcript update path.
5. Transcript history can be saved and loaded through isolated test storage.
6. Transcript chunk-range selection can represent and copy a range that crosses
   the normal virtualized window without depending on all chunks remaining in
   the DOM.
7. The world-session last-activity marker is transient, fixed in transcript
   order, and is cleared only by the agreed scroll-dismissal behavior.

### Explicit non-goals

The first slice does not include:

- Screenshot-based visual regression tests.
- A live MUD server or server emulator.
- Full visual polish of the range indicators and custom context menu beyond the
  targeted interaction scenarios.
- Complete resize, zoom, split-view, or long-history performance coverage.
- Frontend-reload connection recovery.
- A general-purpose injected application environment for every service.

### Current implementation locations

The connection lifecycle is currently split across:

- `frontend/src/lib/connection.ts` - Tauri connection wrapper and event filtering.
- `frontend/src/lib/session-world-connection.ts` - connect, reconnect, disconnect,
  and session state transitions.
- `frontend/src/lib/session-world-transcript.ts` - transcript updates, activity,
  and transcript-history persistence.

The earlier reference to `session-playback-actions.ts` is stale and should not be
used as an implementation target.

### Test layout and command

Follow the existing compiled TypeScript plus Node test-runner pattern. Add:

- `frontend/src/lib/tsconfig.regression-tests.json`
- `frontend/src/lib/tests/transcript-regression.test.ts`
- `frontend/src/lib/tests/connection-regression.test.ts`
- `frontend/src/lib/tests/session-regression.test.ts`
- `frontend/src/lib/tests/storage-regression.test.ts`, if the history storage
  test cannot stay with the transcript tests.

Add a `test:regression` package script that compiles the regression config into
`dist/regression-tests` and runs the emitted tests with `node --test`. Include
`test:regression` in the main `test` script.

Add the first end-to-end test as a separate Playwright project:

- `playwright.config.ts`
- `frontend/tests/e2e/transcript-selection.spec.ts`
- a `test:e2e` package script that starts the frontend server and runs Playwright

Keep `test:e2e` separate from the main Node-based `test` command until the
Playwright browser installation and server startup are established in local and
CI environments. Once that setup is reliable, run it in CI as a required
regression check.

The regression TypeScript config should include only the production modules
needed by these tests. It should not pull in Svelte components, Tauri Rust
bindings, or the complete application graph unless a test specifically requires
them.

### Test seams

Keep the first seams narrow:

- For `MudConnection`, mock the existing Tauri `invoke` and `listen` boundary so
  tests can control events and inspect sends. Do not redesign the Rust transport.
- For transcript history, use a small in-memory `localStorage`-compatible test
  double or narrow storage adapter. Do not create a general storage provider for
  all application data yet.
- For session actions, provide a fake connection through the existing session
  container/context boundary if possible. If reaching session actions pulls in
  too much UI or global state, keep the test at the connection wrapper and pure
  transcript-action level and record that limitation.

### Completion criteria

The slice is complete when:

- `test:regression` passes independently from the other suites.
- The main `test` command runs the new suite.
- Tests are deterministic and do not require Tauri, a browser, a live server, or
  the user's real storage.
- At least one test demonstrates the intended regression behavior rather than
  only exercising setup code.
- Production changes are limited to the minimum seam needed for isolation.

This slice should be implemented before the broader connection/storage injection
work described later in this document.

## First End-to-End Test: Long Selection While Scrolling

The first end-to-end test should target the specifically reproduced transcript
bug currently recorded in `WISHLIST.md`, while covering the new long-selection
interaction:

> Selecting while scrolling can get the transcript stuck in two-pane mode.

This test belongs in the regression suite because it exercises behavior that
cannot be proven by pure transcript or session tests alone. It crosses the
transcript component, virtualized rendering, scroll intent, split-view state,
browser text selection, range indicators, and the custom selection context
menu.

### Preferred tool

Use Playwright Test as the off-the-shelf browser harness. There is no browser
test framework in the project today, so the implementation should add the
smallest supported Playwright setup when this test is started. Prefer the
Playwright web-server fixture to launch the existing frontend dev or preview
server. Do not begin by automating the full Tauri desktop shell.

The first test should use a deterministic frontend test seam for connection and
storage state, or a fixture that can seed a long transcript without networking.
The test must exercise the real rendered `Transcript.svelte` component and its
scroll/selection event handlers in a real browser.

### Scenario

1. Start with a transcript long enough to activate virtualization.
2. Open the play screen with "show current output when scrolling up" enabled.
3. Scroll upward and verify that the split transcript view appears.
4. Begin selecting inside a rendered chunk and drag beyond the contiguous
   virtualized window.
5. Verify that selection switches to chunk-range mode, snaps the initial side
   to the chunk boundary, shows the start/end indicators and connecting line,
   and continues previewing the drag target as more chunks are virtualized.
6. Release and verify that text is not copied automatically, the custom
   context menu opens, and its copy action copies the canonical range.
7. Close the menu, move either range marker, and verify that the menu reopens
   after the adjusted drag completes; right-clicking the selected range also
   reopens it.
8. Scroll back to the actual bottom or use the scroll-to-bottom control.
9. Verify that split view collapses, the session is no longer marked as
   user-scrolled, and newly appended output remains visible at the bottom.

### Last-activity indicator scenario

Add a focused browser scenario or extend the same fixture to verify that:

1. Returning to the app after unseen world output inserts a fixed
   `Last activity {timeago}` interface marker between transcript chunks.
2. The marker uses the primary Dockview theme highlight/action treatment rather
   than world-session output styling.
3. It is not copied as transcript content, cannot be dragged, and remains
   anchored to its world-session activity position.
4. The chosen scroll-dismissal rule is applied consistently and the marker is
   not persisted as transcript history.

### Acceptance criteria

- The test reproduces the existing failure before the fix, or the documented
  reproduction is updated with the exact browser event sequence if it no longer
  does.
- The assertion is behavioral, not a screenshot comparison: split-view DOM
  state, scroll-following state, and visibility of newly appended output are
  checked directly.
- The test is deterministic across repeated runs and does not use timing sleeps
  to wait for rendering; use Playwright locators and observable state instead.
- The test runs independently from Tauri, a live server, and the user's real
  storage.
- The test is kept separate from the cheaper logic-only regression tests so a
  browser failure is easy to diagnose.

## Connection Short Circuit Recommendation
The short circuit should live in the frontend, not in Rust.

Why frontend:
- The app already wraps Tauri connection calls in `frontend/src/lib/connection.ts`.
- Session behavior is orchestrated in frontend code, especially
  `frontend/src/lib/session-world-connection.ts`,
  `frontend/src/lib/session-world-transcript.ts`, and `frontend/src/lib/session.ts`.
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
- `frontend/src/lib/session-world-connection.ts` drives the connection lifecycle, sends input, and reacts to open/data/close/error events.
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
1. Add the focused regression test config and `test:regression` script, following
   the existing compiled TypeScript plus Node test-runner pattern.
2. Add the narrow connection and history-storage seams needed by the focused
   slice; do not extract app-wide providers yet.
3. Cover the core session flow with a few targeted tests:
   - successful connect opens the session and marks it connected
   - send routes text to the active connection
   - incoming data appends to output
   - disconnect updates state and blocks further sends
   - reconnect restores the session against the fake transport
4. Add persistence sanity tests against the isolated history store:
   - save and reload transcript history
5. Add the first Playwright end-to-end test described in "First End-to-End Test:
   Selection While Scrolling".
6. Add other browser-level smoke coverage only if a later behavior leaves an
   important gap.

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
10. The first browser-level test covers transcript selection while scrolling and
    verifies that split view recovers correctly using deterministic test seams.

## Likely Best Test Targets
- `frontend/src/lib/connection.ts` for connection wrapper behavior.
- `frontend/src/lib/session-world-connection.ts` for state changes caused by
  connection events.
- `frontend/src/lib/session.ts` for tab and session wiring if we need a higher-level check.

## Non-Goals For The First Pass
- No full server emulator.
- No attempt to reproduce MUD protocol edge cases.
- No broad screenshot or visual regression suite yet.
- No Rust-side transport rewrite just for testability.
- No dependence on the real user dictionary or real persistent app store during tests.

## Open Questions
- Whether the first Playwright test should launch the frontend through Vite dev
  mode or a production-like preview server.
- Whether the fake connection should be exposed as a test-only export or injected through a general-purpose connection factory.
