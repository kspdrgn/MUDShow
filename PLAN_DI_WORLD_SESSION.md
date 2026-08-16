# World Session DI Registry Plan

## Purpose

- Introduce a lightweight dependency registry for services scoped to a world session.
- Give the codebase a short, consistent name for the `worldId + characterId` scope.
- Centralize session-scoped access to things like the world connection and fuzzball cache.
- Reduce the amount of repeated `worldId` / `characterId` plumbing across session-aware modules.

## Current Status

- The general world-session container now exists in `frontend/src/lib/world-session-container.ts`.
- The registry is keyed only by `WorldSessionKey`.
- The first DI-backed service is the world connection path, including connection creation and resolution.
- The debug console now lives in the world-session container as a DI-backed service, with its own entries and visibility state.
- The container no longer owns a separate connection id field; the tab record and `MudConnection` own that identity.

## Working Name

- Call the scope a `world session`.
- Treat the registry key as a `WorldSessionKey` or similar short identifier.
- Keep the name broad enough to cover both world-only sessions and world+character sessions.
- Allow an empty character id for world-only connections when needed.

## Why This Exists

- The codebase already has several concerns that behave like session-scoped services.
- Today, many of those concerns are threaded through separate modules by hand.
- A session registry would make the ownership boundary clearer.
- It would also make it easier for future hosted windows and feature controllers to ask for the right session service once, instead of re-discovering it.

## Best First Candidate

- Keep the connection service as the first proven DI-backed world-session service.
- The connection path already exercises session-key lookup and connection creation.
- It is the clearest example of a session-owned service that benefits from a shared container.
- Use it as the pattern reference for later services such as fuzzball cache and other session-scoped helpers.

## Candidate Session-Scoped Services

### Clearly session-scoped

- World connection access for the active world session.
- Debug console entries, visibility, and registration state for the active world session.
- Fuzzball property cache and tree capture state.
- Character-scoped notes storage and note loading.
- Character-scoped transcript history loading.

### Likely session-scoped

- World or character style scope lookup.
- Trigger context derived from the active world or character.
- Logging-related helpers that need to know the current world session.
- Refresh helpers for any session-owned debug or inspection views.

### Possibly session-scoped later

- Other per-world data caches.
- Session-specific UI service objects for hosted windows.
- Any future world-supporting feature that wants to share one source of truth for session state.

## Unexplored Potential Candidates

The following systems look like they may benefit from the same world-session registry pattern, but we have not decided yet whether they should move there.

### Core world-tab runtime

- `SessionState.worldSessions` as the main per-tab runtime container.
- `WorldTabSessionState` as the live connected-tab object.
- `WorldTab` records in the tab model that identify connected world tabs.
- World tab creation, activation, refresh, close, and teardown logic.

### Connection and capture

- Live MUD connection ownership per world tab.
- World-tab connection id ownership on the tab record and `MudConnection`.
- Incoming-line capture routing.
- Fuzzball-specific capture parsing and cache updates.

### Transcript, output, and logging

- Transcript append and history trimming.
- Output revision updates and unread activity tracking.
- Per-tab logging state and log file lifecycle.

### Input bars and command entry

- Active input-bar focus.
- Bar add/remove/resize state.
- Input submission handling.
- Notes save debouncing tied to the active world tab.

### World panels and local world UI

- Notes panel visibility and loading.
- Highlights, rules, and debug console panel state.
- Scroll restoration and focus restoration for world panels.

### Character-bound persistence inside a world tab

- Notes persistence.
- Transcript history persistence.
- Delete/move cleanup for notes and transcript history when characters change.

### World-tab context and UI routing

- Top-bar world context menu state.
- Reconnect/disconnect affordances.
- Logging and quick-log affordances.
- Trigger-tab context derived from the active world or character.

### World-tab DOM scope helpers

- Per-tab DOM scope generation.
- Element lookup helpers for world-specific controls and output areas.

### Trigger context and ownership

- Trigger tab context world and character ids.
- Trigger cleanup on world or character deletion.

### Fuzzball-specific session scope

- Fuzzball property cache ownership.
- Fuzzball storage viewer state.
- Fuzzball storage viewer refresh and load behavior.

## High-Level Goals

- Make session-scoped services easy to request by key.
- Keep the registry plain and dependency-free.
- Keep the main app as the owner of authoritative runtime state.
- Let session-aware features depend on a registry instead of reaching across unrelated modules.
- Keep the design open to more services later without forcing a large framework.

## Non-Goals

- Do not replace `SessionState` itself with the registry.
- Do not move unrelated app-wide state into the session registry.
- Do not introduce a heavyweight DI framework.
- Do not force every service to use the same lifecycle if it does not fit.
- Do not move popout window state into the world session registry.

## Proposed Shape

### Registry

- Store session-scoped service objects in a map keyed by the world session key.
- Create services lazily the first time a session is requested.
- Reuse the same session service object while the session remains alive.
- Destroy the session service when its owning world session is torn down.
- Keep the registry keyed only by `WorldSessionKey`.

### Session Services

- Expose the shared services needed by world-session-aware code.
- Keep the world connection access behind this layer first.
- Allow future services like notes or transcript helpers to join later.
- Keep the session service focused on access and coordination rather than UI.

### Consumers

- Session action modules should ask the registry for the session service they need.
- Hosted window controllers should consume session services rather than reaching into globals.
- The fuzzball storage viewer should ask for its session cache through the registry path once that path exists.

## Likely Benefits

- Less repeated lookup code in session modules.
- Cleaner ownership of world-scoped services.
- Easier testing of session-owned logic.
- A single place to attach future world-session capabilities.
- A more natural bridge between session state and hosted window features.

## Suggested First Cut

- Name the session scope and registry clearly in code.
- Keep the registry lightweight and dependency-free.
- Keep connection ownership inside the registry-backed container and the tab record.
- Route one or two existing consumers through the registry-backed connection path to prove the pattern.
- Add additional session-scoped services only after the first shape feels right.

## Open Questions

- Should the key be named `WorldSessionKey`, `SessionKey`, or something even shorter?
- Should the registry key be based on a combined string or a structured object?
- Should the session service object be long-lived per session, or rebuilt on demand from smaller providers?
- Should notes and transcript history live in the same registry object as the fuzzball cache, or in adjacent session services?
- Should the registry live near `session.ts` or as its own feature-local module?
- Should future session-scoped services be attached as namespaces on the same container, or split into adjacent registries?
- Should connection id stay only on the tab record and `MudConnection`, or also be mirrored anywhere else for debugging?

## Next Steps

- Pick the final name for the scope and registry.
- Define the next session service interface, likely fuzzball cache or another cache-like helper.
- Identify one or two consumers that can move to the registry with minimal churn.
- Decide where the registry should live in the `frontend/src/lib` tree.
- Expand the registry once the first service proves the pattern.
