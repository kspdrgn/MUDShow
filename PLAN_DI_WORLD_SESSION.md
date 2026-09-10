# World Session DI Registry Plan

## Purpose

- Introduce a lightweight dependency registry for services scoped to a world session.
- Give the codebase a short, consistent name for the `worldId + characterId` scope.
- Centralize session-scoped access to things like the world connection and fuzzball cache.
- Reduce the amount of repeated `worldId` / `characterId` plumbing across session-aware modules.

## Agreed Ownership and Recovery Direction

Use the existing container to coordinate focused frontend services. Consolidate
responsibilities where this removes duplicate ownership or repeated plumbing;
there is no requirement to migrate every session-related variable. This section
resolves the architectural choices; implementation work remains below.

| Concern | Rust backend | Frontend services | Frontend components/controllers | Storage and recovery |
| --- | --- | --- | --- | --- |
| Connection | Socket, Telnet handling, identity, bounded replay | Attach listeners, send commands, expose status | Controls and status | Discover and reattach to surviving connections |
| FuzzBall/Taps | Transport commands and responses | Plugin cache, parsing, derived state and refresh | Render views and emit intent; controller owns view state | Disposable; re-query, optionally cache in webview storage |
| Notes | Storage I/O where needed | Working text and save coordination | Editor and presentation | Saved character document; reload from app storage |
| Triggers | Storage I/O where needed | Shared definitions; applicability derived for the target session | Editing and selected owner | Reload definitions from app storage |
| Transcript/history | Deliver events | Live entries, retention, revisions, range access and rolling-history coordination | Virtualization, render cache, scroll and selection geometry | Existing configured rolling backlog |
| Surfaces | Native windows and bounds | Lifecycle and live transport | Controller-owned presentation state | Existing saved placement |

- Storage I/O does not require a parallel authoritative backend copy. Keep the
  existing JSON app database and webview transcript-history storage.
- Preserve live-socket reattachment and existing bounded replay when the webview
  refreshes or restarts while Rust survives. Restarting Rust requires a new
  connection. Reattachment does not cause a new server welcome.
- Reload saved notes and triggers. Accept losing notes edits still inside the
  existing debounce interval; preserve ordinary save and close behavior.
- FuzzBall owns its cache through its plugin session contribution and exposes it
  through the typed service capability. The generic container manages plugin
  lifetime without owning FuzzBall-specific fields. Disposable state can be lost
  and queried again.
- Any serializable world-session data may optionally be cached in webview storage
  when a concrete feature benefits. Caches must tolerate absence or stale data;
  a universal caching or cache-migration framework is not required for P1.
- Full transient event history need not survive refresh or reconnect. Additional
  retention, queuing and recovery belong to the transcript-history feature.
  Preserve current behavior during ownership cleanup, including bounded replay.
- Canonical transcript ownership stays in the frontend. Backend ownership is
  reconsidered only with validated performance/memory evidence or a concrete
  product need, not hot reload alone.
- Trigger definitions remain shared; derive applicability using the session
  receiving output. Editor selection remains UI state.
- Surface snapshots serve live docked/pop-out communication; they do not require
  durable recovery of every transient field. Log files remain independent of
  transient transcript state, with frontend policy and backend file writes.

## Current Status

- The general world-session container now exists in `frontend/src/lib/world-session-container.ts`.
- The registry is keyed only by `WorldSessionKey`.
- The first DI-backed service is the world connection path, including connection creation and resolution.
- The debug console now lives in the world-session container as a DI-backed service, with its own entries and visibility state.
- The container no longer owns a separate connection id field; the tab record and `MudConnection` own that identity.
- The container now owns focused notes and transcript-history services. Notes working text and debounce/flush coordination are session-scoped while saved notes remain in app storage; transcript-history coordination is session-scoped while the canonical live transcript remains frontend-owned.
- FuzzBall property cache instances are created by and disposed with the plugin session contribution and exposed through the typed plugin service bag. There is no global FuzzBall cache path.

## Implementation Checklist

### Done

- [x] Establish a general world-session container for session-scoped services.
- [x] Key the registry by `WorldSessionKey` only.
- [x] Move world connection creation and resolution behind the registry.
- [x] Move per-session debug console state and entries behind the registry.
- [x] Remove the separate connection id field from the container when the tab record and `MudConnection` already carry that identity.
- [x] Document the world-session DI shape in `spec/di.md`.

### Still To Do

- [x] Resolve frontend/backend/storage ownership and recovery boundaries above.
- [x] Keep trigger definitions shared and derive applicability per target session.
- [x] Consolidate FuzzBall cache ownership behind its plugin session service, removing global access paths that bypass the owner.
- [x] Consolidate notes working text and save coordination behind a focused frontend service shared by its surfaces; preserve character-based persistence and debounce behavior.
- [x] Consolidate transcript/history data operations behind a focused frontend boundary, keeping rendering and interaction separate.
- [x] Verify affected close, reconnect, reattachment, shared-view and delayed-callback behavior; add awaitable cleanup only where an actual operation needs it.
- [x] Update durable specs as service changes are implemented, without presenting proposed consolidation as completed behavior.
- [ ] Keep the session shell thin and continue moving session-owned behavior out of `session.ts` where it still reaches across modules directly.

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
- Notes working text, note loading and save coordination; saved documents remain character-owned in app storage.
- Character-scoped transcript history loading.

### Likely session-scoped

- World or character style scope lookup.
- World-session style resolution that composes on top of the app style service.
- Trigger context derived from the active world or character.
- Logging-related helpers that need to know the current world session.
- Refresh helpers for any session-owned debug or inspection views.

### Possibly session-scoped later

- Other per-world data caches.
- Session-specific UI service objects for hosted windows.
- Any future world-supporting feature that wants to share one source of truth for session state.

## Unexplored Potential Candidates

The following are an inventory for targeted cleanup, not a migration checklist.
The agreed boundaries above take precedence: DOM interaction and surface view
state remain with their views/controllers, and persistent records remain in
app storage. Extract services only where current consumers benefit.

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
- World-session-scoped last-activity marker state, including the activity
  position relative to transcript chunks and the transient dismissal state.
- Transcript interface-marker projection state kept separate from canonical
  transcript entries and persisted history.
- Long-selection range state and canonical range-copy actions, if ownership is
  kept in the session layer rather than the view component.
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
- Effective style resolution for the active world session and its panels.

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

### Transcript interaction boundary

The world session owns activity facts, not their visual rendering. In
particular, last activity is a world-session variable that may place a transient
between-chunk marker but must never become a transcript database entry, a
history item, or a log item.

The transcript view owns pointer interaction, marker geometry, and menu
placement. Long selection actions should read the canonical session transcript
through a typed range contract so copying does not depend on the currently
mounted virtualized DOM.
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

## Resolved Foundation and Remaining Choices

Keep `WorldSessionKey`, its structured public shape and internal serialization,
the existing registry module, and containers reused for their session lifetime.
Do not mirror connection identity onto the container. The key helper normalizes
empty character IDs to null for world-only sessions.

Choose the smallest notes and transcript service interfaces needed by current
consumers. Separate feature modules may share container-managed lifetime without
creating independent global registries. Stateful trigger execution and broader
webview caching are optional future work, not prerequisites.

## Next Steps

- Implement the focused remaining ownership work above without changing transcript-history policy.
- Keep native placement and surface presentation under the surface system.
- Treat stronger refresh durability as feature-specific work only when needed.
