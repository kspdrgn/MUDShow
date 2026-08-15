# Window Host Consolidation Plan

## Purpose

- Consolidate the app's window-hosting responsibilities into a clearer set of layers.
- Keep the top-level app registry simple and focused on window ids, lifecycle, and pop in / pop out mechanics.
- Make hosted windows easy to reuse for built-in UI like the fuzzball storage viewer and future plugin-owned surfaces.
- Preserve the main app window as the owner of session state, fuzzball cache, and other backend-facing logic.

## Current Shape

- `App.svelte` currently owns the window registry state and most of the lifecycle logic.
- `WindowHost.svelte` is already the rendering shell for hosted windows, but it does not own the registry.
- `window-host.ts` provides shared window record types and helper constructors.
- Popped-out windows are separate webviews and cannot directly share in-memory state with the main window.
- The fuzzball storage viewer currently depends on app-owned state and cache logic, which makes the popout split more important than a normal UI refactor.

## Goals

- Keep the registry layer generic and small.
- Keep the hosted window UI reusable and dumb.
- Keep application state and feature-specific logic in the main app frontend.
- Support both in-app hosted windows and popped-out native windows without duplicating feature state.
- Make the fuzzball storage viewer work the same way whether it is embedded or popped out.
- Allow future hosted windows to plug into the same window system without learning app internals.

## Non-Goals

- Do not move session state into `WindowHost.svelte`.
- Do not make the registry understand fuzzball-specific behavior.
- Do not require every hosted window to use the same backend transport internally.
- Do not redesign the top-level tab system.
- Do not introduce plugin-specific window behavior into the base host layer yet.

## Proposed Layering

### 1. App Registry

- Own the list of hosted window ids and records.
- Create and destroy window records.
- Handle pop out and pop in requests.
- Track the current placement for each window.
- Coordinate top-level teardown when a source tab closes.
- Stay ignorant of fuzzball-specific state and viewer behavior.

### 2. Window Controller / View Model Layer

- Own the per-window view state.
- Bridge between the window registry and the feature backend.
- Preserve state across pop out and pop in.
- Expose a stable interface to hosted UI components.
- Handle cross-window transport for popped-out windows when needed.
- For fuzzball, keep the controller in the main app frontend so the cache and session connection remain centralized.

### 3. Hosted Window Components

- Render the visible UI for a specific window kind.
- Stay mostly presentational.
- Receive their data through props or a controller interface.
- Emit user actions such as select, toggle, refresh, close, and pop out.
- Avoid importing feature backends directly when the same component may run in both app and popout contexts.

### 4. Shared Window Record Helpers

- Keep `window-host.ts` as the shared home for record types and generic helpers.
- Retain construction defaults, placement flags, and window sizing helpers there.
- Avoid moving business logic into this file.

## Responsibilities By Layer

### App Registry

- Assign stable window ids.
- Track which window ids are mounted in-app.
- Track which window ids are currently popped out.
- Create the native/webview host record when a window is popped out.
- Tear down records when the source tab or window goes away.
- Route pop in / pop out state transitions.

### Window Controller

- Hold the current logical state for a hosted window.
- Decide how the window gets its model data.
- Keep a cached snapshot if the UI needs immediate redraws.
- Convert UI actions into backend requests.
- For a popped-out fuzzball viewer, proxy commands back to the main app frontend.

### `WindowHost.svelte`

- Render the window stack and backdrop.
- Handle focus, escape, and backdrop dismissal behavior.
- Delegate pop out / pop in UI events upward.
- Do not own application state.

### Hosted Window Components

- Render the content for one hosted window instance.
- Stay reusable in both in-app and popped-out placement.
- Avoid knowing whether the current host is native or embedded.

## Fuzzball Viewer Requirements

- The fuzzball storage viewer must use the same logical state whether it is in-app or popped out.
- The main app frontend should own the real fuzzball cache.
- The viewer should consume a stable backend interface rather than importing the cache directly from a popped-out window.
- The controller should be able to request tree refreshes and node loads from the main app.
- The controller should preserve selection and expansion state across pop out and pop in.
- The controller should be able to rehydrate a popped-out window from the main app's current state.

## Dependency Inversion Strategy

- Define a small hosted-window backend interface that the view layer can call.
- Provide one adapter in the main app for direct access to session state and fuzzball cache.
- Provide one adapter for popped-out windows that forwards requests to the main app through a cross-window channel.
- Keep the component API stable so the same window component can run in either placement.
- Keep transport details out of the component.

## Cross-Window Communication

- Use a dedicated message channel for hosted window state and requests.
- Reuse the existing Tauri app-event path where it makes sense.
- Keep the protocol generic enough for future hosted surfaces.
- Treat the main app as the authoritative source for window state and fuzzball cache data.
- Have popped-out windows request snapshots, refreshes, and load actions from the main app instead of reading state locally.

## State Preservation

- Preserve logical window state across pop out and pop in.
- Keep the same window id for the same logical window instance.
- Keep selection, expansion, and pending request state in the controller layer.
- Rebuild the visual host around that same state instead of creating a new viewer instance.
- Allow the host to change without losing the logical window state.

## Suggested First Cut

- Extract the generic window registry logic out of `App.svelte` into a plain TypeScript controller module.
- Keep `WindowHost.svelte` as the renderer for the hosted-window stack.
- Keep `window-host.ts` as the shared record and helper module.
- Introduce a per-window controller abstraction for fuzzball storage viewer state.
- Define a host/back-end interface for the fuzzball viewer so the component does not care whether it is embedded or popped out.
- Add the cross-window request/response bridge only after the controller boundary exists.

## Open Questions

- Should the controller layer be one generic registry controller plus feature-specific controllers, or one combined window-host controller with adapters?
- Should cross-window state sync use Tauri events, a browser channel, or a small helper around the existing Tauri event bus?
- Should a popped-out window receive full model snapshots, or just enough state to rebuild the view from the main app cache?
- How should refresh requests be deduplicated if both hosts ask for the same data?
- Should the controller keep a revision counter or full snapshot model for the viewer?

## Next Steps

- Extract the registry bookkeeping from `App.svelte`.
- Define the controller boundary for hosted windows.
- Define the fuzzball storage viewer backend interface.
- Decide the transport for main-window-to-popout synchronization.
- Update the fuzzball viewer to consume the controller instead of the cache directly.
- Verify pop in / pop out preserves state without resetting the viewer.
