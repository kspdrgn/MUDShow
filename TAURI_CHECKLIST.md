# MUDShow Tauri Checklist

## Phase 1: Desktop Shell
- [ ] Add a Tauri app shell that can launch the existing frontend.
- [ ] Confirm the window opens cleanly in development mode.
- [ ] Confirm the frontend renders without any Tauri-specific UI changes.
- [ ] Decide the initial window size, title, and basic app metadata.
- [ ] Add app icons and packaging metadata for desktop builds.

## Phase 2: Sidecar Startup
- [ ] Package the Node proxy as a Tauri sidecar.
- [ ] Start the sidecar automatically when the desktop app launches.
- [ ] Stop the sidecar cleanly when the app exits.
- [ ] Capture and surface sidecar startup failures.
- [ ] Verify the proxy is reachable from the frontend in desktop mode.

## Phase 3: Runtime Boundary
- [ ] Replace hardcoded proxy assumptions with a runtime endpoint or config source.
- [ ] Keep the connection layer thin and easy to swap.
- [ ] Confirm connect, send, receive, and disconnect still behave as expected.
- [ ] Make sure reconnect behavior works after the sidecar restarts or fails.

## Phase 4: Persistence
- [ ] Decide whether desktop storage stays in browser storage for the first pass or moves to a Tauri storage API.
- [ ] Preserve characters, notes, and highlight rules across restarts.
- [ ] Keep the data model stable so browser reuse remains possible later.
- [ ] Verify character-specific note loading still works after relaunch.

## Phase 5: Frontend Fit
- [ ] Audit browser-only APIs and confirm which ones work unchanged in Tauri.
- [ ] Keep keyboard shortcuts working in the desktop window.
- [ ] Confirm focus switching between the two input bars still works.
- [ ] Confirm notes and highlights panels still open and close correctly.
- [ ] Confirm activity indication and beep behavior still feel right.

## Phase 6: Packaging and Release
- [ ] Create a production build path for frontend, sidecar, and Tauri packaging.
- [ ] Verify the packaged app runs without manual proxy setup.
- [ ] Verify the app can be installed and launched on the target desktop platform.
- [ ] Add any release scripts or notes needed for repeatable builds.

## Phase 7: Cleanup
- [ ] Remove or simplify any code that only exists because the app used to be browser-first.
- [ ] Extract platform-neutral shared code where it clearly helps.
- [ ] Keep desktop-specific code isolated from shared UI and session logic.
- [ ] Revisit whether any runtime boundaries need to be made more explicit.

## Stretch Goal: Shared Browser App
- [ ] Identify code that is genuinely platform-neutral.
- [ ] Keep transcript parsing, highlighting, completion, and shared types reusable.
- [ ] Avoid coupling shared code to Tauri startup or desktop storage details.
- [ ] Only pursue hosted-browser reuse after the standalone desktop app is stable.

## Suggested First Pass Order
1. Desktop shell
2. Sidecar startup
3. Runtime boundary
4. Persistence
5. Frontend fit
6. Packaging and release
7. Cleanup
8. Stretch goal exploration
