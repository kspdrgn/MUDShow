# MUDShow Tauri Migration Plan

## Goal
Turn MUDShow into a clean standalone desktop app with Tauri while preserving the current behavior, feel, and local-first character data model.

## Primary Constraint
The standalone app must work well on its own even if no browser-hosted version is ever created.

## Stretch Goal
Make it possible to share as much app code as is sensible with a hosted browser-based build later.

That stretch goal must not block:
- a solid desktop packaging story
- reliable sidecar startup and shutdown
- sane local persistence
- a simple and understandable runtime boundary

## Recommended Runtime Shape
Use Tauri as the desktop shell.
Use a Node sidecar for the existing proxy layer at first.
Keep the Svelte frontend mostly intact.
Move to Rust only later if and when the Node sidecar becomes a real liability.

## Suggested Architecture
```text
desktop-shell/
  tauri/
  sidecar/
frontend/
  src/
  app.css
backend/
  proxy.ts
shared/
  types.ts
  constants.ts
```

## What Should Stay the Same
- The current Svelte UI structure.
- Character list, editor, play view, notes, highlights, and completion behavior.
- The local-first character and note model.
- The MUD proxy protocol and telnet handling.
- The general app feel and keyboard shortcuts.

## What Will Likely Change
- App startup and shutdown flow.
- How the proxy process is launched in desktop mode.
- How the frontend finds the proxy while running inside Tauri.
- How updates, logs, and packaging are handled.
- Potentially the persistence layer if we later want to move beyond browser storage.

## Frontend Impact Assessment
The frontend should not need a rewrite.

Likely small changes:
- Replace any hardcoded `localhost` assumptions with a configurable runtime endpoint.
- Separate browser-only concerns from app-runtime concerns.
- Keep storage behind an abstraction so desktop storage can be swapped in later if needed.
- Keep the connection layer thin so it can talk to either a browser websocket or a desktop bridge.

Likely unchanged for the first Tauri pass:
- Svelte components.
- Most session state and input handling.
- Rendering, highlighting, transcript formatting, and completion logic.
- Visibility handling and audio feedback, unless Tauri quirks require a small adjustment.

## Runtime Boundary
Define one narrow boundary between UI and runtime services:
- connect to a MUD session
- send player input
- receive server output
- read and write profile/notes/highlight data
- expose app lifecycle state if needed

Everything else should stay in the Svelte app.

## Sidecar Boundary
The Node sidecar should initially own:
- outbound MUD socket connections
- telnet stripping and protocol cleanup
- local proxying over a desktop-safe transport
- any connection-specific logging or reconnect policy

The sidecar should not own:
- UI state
- screen selection
- modal logic
- note editing UI
- highlight editing UI

## Persistence Strategy
For the first desktop version, prefer the least disruptive path:
- keep the current logical data model
- preserve per-character notes and global highlights
- choose a desktop-safe storage location
- keep the data API narrow so a future browser build can reuse the same domain concepts

If browser and desktop storage diverge later, hide that behind a single storage module rather than leaking it through the UI.

## Dev and Build Strategy
Make the development loop explicit early:
1. Run the frontend in dev mode.
2. Run the Node sidecar locally.
3. Run Tauri against those local services.
4. Package the app with the sidecar included.

The build should clearly separate:
- frontend build output
- sidecar build output
- Tauri application packaging

## Phased Plan
1. Add the Tauri shell and confirm a window opens with the existing frontend.
2. Wire the Tauri app to start the Node sidecar automatically.
3. Replace any hardcoded proxy assumptions with app runtime configuration.
4. Confirm connect, send, receive, disconnect, and reconnect behavior in desktop mode.
5. Confirm local persistence works in the desktop package.
6. Verify keyboard shortcuts, notes, highlights, and activity indication still behave correctly.
7. Clean up packaging, icons, metadata, and release scripts.
8. Only after the desktop app is stable, evaluate whether any code should be shared with a hosted browser build.

## Shared-Code Guidance
If we want browser-hosted reuse later, share only code that is clearly platform-neutral:
- data types
- transcript parsing
- highlighting
- completion
- formatting helpers
- perhaps core state reducers or session logic

Avoid sharing:
- shell-specific startup code
- direct filesystem access
- process spawning details
- desktop window management
- any assumptions about localhost proxying

## Non-Goals
- Do not rewrite the frontend just because Tauri exists.
- Do not move the proxy to Rust before the Node sidecar proves to be a problem.
- Do not optimize for a hosted browser app if that adds risk to the standalone desktop release.
- Do not over-abstract the first pass; keep the migration practical.
- Do not add new product features as part of the platform shift.

## Implementation Principles
- Keep the first Tauri release boring and reliable.
- Minimize the surface area that knows whether it is running in a browser or desktop shell.
- Make storage and transport swappable, but only at the seam where they actually differ.
- Prefer incremental extraction over a big-bang rewrite.
- Preserve user behavior before pursuing platform elegance.

## Suggested Success Criteria
- The app launches as a desktop program without a separate manual proxy step.
- The current client workflow still works end to end.
- Notes, highlights, and character data survive app restarts.
- The codebase remains understandable and still feels like the same app.
- Any future hosted-browser reuse path remains possible, but not mandatory.
