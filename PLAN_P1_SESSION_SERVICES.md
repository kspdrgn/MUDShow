# Frontend Core Session-Service Consolidation Plan

## Purpose

Consolidate frontend-owned, world-session system services behind one small
session-service host so session close and cleanup do not call service-specific
lifecycle code from `session.ts`, `session-tabs.ts`, or surface code.

This plan is intentionally smaller than a general DI framework. The host owns
lifecycle coordination; each service owns its state and recovery strategy.

## Scope

### In scope

- Establish a lightweight core system-service host for each active world
  session.
- Integrate the extracted notes working-state service.
- Give core services one close lifecycle with awaited, bounded flushing.
- Remove direct notes lifecycle calls from tab and surface code.
- Add focused lifecycle, timeout, and cleanup tests.
- Preserve current local-storage behavior and frontend reload recovery rules.

### Deferred

- Transcript-history consolidation. Keep its current behavior and ownership
  until the core service lifecycle is proven.
- Changes to transcript write frequency or batching.
- Moving canonical live transcript state out of `PlayTranscript`.
- Converting notes or transcript services into world plugins.
- A general-purpose DI framework or plugin-like dependency graph for core
  services.

## Identity and lifetime

The application enforces one world tab for a given `worldId + characterId`.
That gives the current model:

```text
WorldSessionKey <-> one app tab <-> one connection
```

Core session services may therefore be keyed by `WorldSessionKey`.

The service host lives with the world-session container. It remains alive while
the app tab/session remains alive. A frontend reload recreates the in-memory
host; services restore or re-query state according to their own needs.

Connection reattachment is a connection-service concern. The core service host
does not own backend recovery policy.

## Ownership boundaries

### Core session services

Core services own session data and persistence coordination, including their
own loading, saving, and recovery behavior.

The first integrated service is notes:

- working note text;
- loading saved notes;
- debounced saves;
- close-time flush;
- disposal of pending timers and in-memory state.

### Surface controllers and components

Surface controllers own presentation and transport concerns:

- draft/editor interaction;
- surface revisions and stale-command rejection;
- Dockview/native-window transport;
- placement, focus, and visibility;
- rendering and DOM state.

Surface code reads and updates the notes service through the session boundary;
it does not flush, dispose, or directly persist notes.

### Plugins

World plugins retain their existing plugin-session lifecycle and typed service
bag. FuzzBall and Taps remain plugin-owned. Core notes services are not
plugins because they are host-wide session concerns rather than world-specific
behavior.

## Proposed service-host contract

Keep the contract small. Services may implement only the lifecycle operations
they need:

```ts
interface WorldSessionService {
  load?(): Promise<void>;
  flush?(): Promise<void>;
  dispose?(): Promise<void> | void;
}
```

The host is responsible for:

- creating registered services for a `WorldSessionKey`;
- invoking service flushes during close;
- applying a five-second timeout to each flush;
- logging timeout or failure and continuing close;
- disposing the service host and its services;
- preventing disposed services from updating active session state.

Flushes may run concurrently. No ordering is required unless a concrete
service later demonstrates a dependency.

Timed-out underlying writes may finish in the background when safe. If the app
or native process is shutting down, services may be destroyed without waiting
for late completion.

## Close behavior

The desired close path is:

```text
tab/session close
  -> service host starts all flushes
  -> each flush is awaited for up to 5 seconds
  -> failures/timeouts are logged
  -> services are disposed
  -> connection/session teardown completes
```

The close operation should not require callers to know that a notes service or
any future service exists. Callers invoke the service-host close operation,
not `notes.flush()` or another system-specific method.

## Reload and reattachment

- Frontend reload destroys the old in-memory service host.
- A new frontend creates a new host for the discovered world session.
- Notes reload saved state from local storage.
- Future services may reload from local storage, query the backend, or query
  the world server as appropriate.
- Reattachment must not assume that transient in-memory service state survived.
- Service restoration is service-owned; the host only provides lifecycle entry
  points.

## Implementation phases

### Phase 1: Host and lifecycle seam

- Add a small typed system-service host to the world-session container.
- Register service factories by session key.
- Add an awaitable close/dispose operation.
- Implement five-second bounded flush handling with error logging.
- Define behavior for late completion after timeout.

### Phase 2: Notes integration

- Move notes service creation behind the host.
- Route notes load, read, and save operations through the service.
- Remove direct pending-save maps and storage calls from session/tab/surface
  lifecycle paths.
- Ensure tab close, character/world deletion, reset, and app teardown all use
  the host close path.
- Preserve the existing 300 ms debounce and character-based storage.

### Phase 3: Lifecycle verification

- Verify close and deletion paths flush pending notes.
- Verify a flush failure or timeout is logged and does not deadlock close.
- Verify disposal cancels timers and prevents stale updates.
- Verify reload/reattach recreates the service and reloads saved notes.
- Verify popped-out and docked notes surfaces observe one shared service state.

### Phase 4: Durable documentation review

- Update `spec/di.md` with the core service-host boundary.
- Update `spec/surfaces.md` only for confirmed controller/service ownership.
- Update `ROADMAP.md` and `PLAN_DI_WORLD_SESSION.md` after implementation and
  tests are complete.

## Acceptance tests

- A `WorldSessionKey` maps to one app tab and one service host.
- Notes state is shared correctly by all surfaces for that session.
- Notes debounce preserves the current 300 ms behavior.
- Closing a tab flushes pending notes and awaits completion.
- Character/world deletion and persistent-view reset do not silently discard a
  pending note save.
- A flush failure is logged and close continues.
- A flush timeout occurs at five seconds, is logged, and close continues.
- Disposal cancels pending timers and blocks stale service updates.
- Recreated services reload notes after frontend reload/connection reattach.
- A popped-out notes surface remains synchronized with the in-app surface.
- Existing plugin lifecycle and FuzzBall service tests remain green.

## Resolved implementation choices

- Use a small keyed service host inside each world-session container. Services
  register under typed keys and expose only the lifecycle methods they need.
- Apply the five-second timeout independently to each concurrent flush.
- Log late completion using the same lightweight service log path as ordinary
  completion/failure. Detailed diagnostics can be refined later.
- Do not impose ordering between service disposal and connection disposal unless
  a concrete dependency requires it.

## Reference documents

- `ROADMAP.md`
- `PLAN_DI_WORLD_SESSION.md`
- `PLAN_FRONTENDSEPARATECONNECTION.md`
- `spec/di.md`
- `spec/output.md`
- `spec/surfaces.md`
- `spec/plugins.md`
- `frontend/src/lib/notes-service.ts`
- `frontend/src/lib/world-session-container.ts`
