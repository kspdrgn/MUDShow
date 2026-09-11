# Temporary P1 Plan: Authoritative Session Snapshot and Attach Barrier

> Temporary implementation plan. This document captures the agreed direction
> for roadmap item P1 and should be revisited before implementation begins.

## Goal

Replace transcript replay as the normal frontend reload mechanism with:

1. Frontend/local transcript-history reload.
2. One authoritative backend world-connection snapshot.
3. An atomic attach barrier identifying the snapshot revision.
4. Live events accepted only after snapshot initialization.

Terminology in this plan:

- A **backend world connection** is the surviving connection to the MUD/MU*.
  Its `connectionId` and `sessionId` identify one backend connection lifetime.
- A **frontend attachment** is the temporary listener/consumer relationship
  between a frontend instance and that backend world connection. A frontend
  reload or crash ends an attachment but may leave the world connection alive.
- A **world-session projection** is the frontend-owned UI, transcript, plugin,
  and surface state for a world tab. It is not the same thing as the backend
  connection session.

The backend keeps an always-on, bounded frontend delivery buffer of replayable
incoming events. A new frontend attachment replays whatever incoming data
remains in that buffer; no acknowledgement cursor or gap metadata is used yet.
The grace period
is an app setting so hosted and desktop deployments can choose different
values; it controls how long an unattached backend world connection remains
eligible for reattachment, not whether the buffer exists. Each backend world
connection has one fixed maximum UTF-8 payload-byte budget. If the grace period
expires and the backend world connection is cleaned up, its buffer is cleared.

Rust owns the surviving world connection, authoritative connection/protocol
state, and bounded frontend delivery buffer. The frontend owns transcript
rendering, durable local transcript history, and the world-session projection.

## Attach contract

`attach_mud_connection` should return one coherent response containing:

```ts
{
  contractVersion: number;
  runtimeId: string;
  connectionId: string;
  sessionId: number;
  snapshotRevision: number;
  eventSequence: number;
  snapshot: StructuredConnectionSnapshot;
  events: BufferedIncomingEvent[];
}
```

Semantics:

- `sessionId` protects against replacement backend world connections.
- `snapshotRevision` versions authoritative structured/session state.
- `eventSequence` identifies the backend event position at the attach barrier.
- The snapshot is complete for backend-owned structured state.
- The snapshot never contains transcript history.
- The frontend accepts the snapshot before applying structured live events.
- Events from an old session or stale revision are ignored.
- An always-on bounded frontend delivery buffer covers replayable incoming
  events.
- Buffer replay is temporary delivery recovery, not durable transcript storage.
- Reattachment initially replays the complete retained incoming-data buffer;
  cursor acknowledgements and explicit gap reporting are deferred.

The existing event sequence may remain for diagnostics and live ordering, but
it should not remain overloaded as the conceptual snapshot revision.

## Implementation phases

### 1. Backend attach boundary

Modify `tauri/src/mud_backend.rs`:

- Add an explicit authoritative revision to `ConnectionEntry`.
- Update the revision whenever backend-owned structured/session state changes.
- Make `attach_mud_connection` capture snapshot, revision, session ID, and event
  sequence under one lock.
- Return the attach response directly instead of a replay response.
- Replace the generic replay response with an attach response that includes the
  authoritative snapshot/barrier and the complete retained bounded buffer.
- Store only replayable incoming data in that buffer initially. Do not store
  `opened`, `closed`, or `error` connection-status events for replay.
- Retain or narrow replay DTOs only if another caller still needs them.
- Preserve session-ID protection and detached Telnet processing.

The response must represent one coherent state point. Protocol and negotiation
recovery comes from the authoritative session snapshot. The buffered event path
is reserved for missed events that cannot be reconstructed from the snapshot,
including future protocol or plugin events if those later become necessary.
Events emitted after the barrier must have a later event sequence.

### 2. Frontend connection lifecycle

Modify `frontend/src/lib/connection.ts`:

- Replace replay-based attach handling with the new attach response.
- Install the event listener before invoking attach.
- Buffer events received while the attach response is pending.
- Accept the snapshot first.
- Retrieve the complete retained incoming-data buffer from the backend.
- Apply the authoritative snapshot before missed incoming data, then resume
  normal live delivery.
- Process buffered events according to the barrier:
  - structured state updates require a sequence/revision newer than the
    accepted snapshot;
  - lifecycle and transcript events received during the handshake must not be
    lost;
  - stale session events remain ignored.
- Remove normal replay-gap recovery and `classifyReplayGap`.
- Keep diagnostics for attach failure, stale session, and invalid snapshot.

### 3. Session and plugin reconstruction

Review and update:

- `frontend/src/lib/session-world-connection.ts`
- `frontend/src/lib/world-session.ts`
- plugin/session controller boundaries

On reload/recovery:

- Load local transcript history first.
- Recreate the world-session and plugin controllers.
- Attach and apply the authoritative snapshot.
- Notify frontend plugin sessions through an `onAttached(snapshot)` lifecycle
  hook after snapshot acceptance and before buffered incoming data is applied.
- Keep `onConnected` for actual backend world-connection transitions; it is not
  a substitute for frontend attachment recovery.
- Reconstruct plugin and surface state from the snapshot or an explicit
  refresh/query operation.
- Do not depend on missed transcript events to rebuild plugin state.
- Keep transcript rendering and local history ownership in frontend services.

The normal connection path should use the same snapshot acceptance path where
practical.

### 4. Surface and plugin audit

Audit the built-in integrations, especially FuzzBall and Taps:

- Identify controller state currently created only by observing transcript or
  protocol events.
- Add snapshot-based initialization or an explicit refresh/query operation.
- Ensure caches are disposable and reconstructible.
- Ensure surface controllers do not require replayed transcript events after
  reload.

### 5. Tests

Backend coverage:

- Attach returns a coherent snapshot and barrier.
- Snapshot revision increases when authoritative state changes.
- Older-session events cannot mutate current state.
- Events after the barrier have a later sequence.
- Backend processing updates authoritative state while the always-on delivery
  buffer retains only its bounded replayable event history.
- Reattachment returns the snapshot before buffered incoming data.
- Attachment timeout cleanup removes the backend world connection and thereby
  clears its delivery buffer.
- Disconnect and replacement clear the old session correctly.

Frontend coverage:

- The listener is installed before attach.
- The snapshot is applied before buffered structured events.
- Buffered events are handled correctly by event type and barrier position.
- Stale-session events are ignored.
- Attach failure produces actionable diagnostics.
- Local history loads independently of backend attach.
- Duplicate and stale snapshots do not move state backward.
- Plugin/session reconstruction does not require transcript replay.

Native/frontend coverage:

- Reload while connected with no traffic.
- Reload during active traffic.
- Reload during structured protocol traffic.
- Delayed attach response.
- Connection replacement during recovery.
- Reconnect and explicit disconnect.
- Native surface recovery after frontend reload.

### 6. Specification cleanup

Update as needed:

- `spec/protocols.md`
- `spec/output.md` where wording implies backend replay
- `spec/spec.md`
- `PLAN_FRONTENDSEPARATECONNECTION.md`
- `ROADMAP.md`

Remove wording that presents replay as the reload recovery mechanism. Preserve
the existing user-visible local transcript-history behavior.

## Execution order

- [x] Contract types and backend attach response.
  - [x] Snapshot revision and event sequence are separate fields.
  - [x] Attach returns the authoritative snapshot and retained incoming data.
  - [x] Old replay command and compatibility DTOs are removed.
  - [x] Delivery buffer uses a fixed per-connection byte budget.
  - [x] Finalize the minimal authoritative snapshot fields and update rules.
- [ ] Frontend attach barrier and event buffering.
  - [x] Snapshot-first attach handling and handshake buffering exist.
  - [x] Connection-status events are excluded from buffered recovery.
  - [x] Attachment grace-period setting and backend timeout cleanup exist.
  - [x] Wire app teardown/hot-reload cleanup to notify backend detach.
  - [x] Confirm every alternate frontend teardown path uses the same detach flow.
  - [x] Verify concurrent live-event ordering against the final barrier contract.
- [ ] Session/plugin reconstruction.
  - [x] Confirm world-session projection rebuilds entirely from frontend state.
  - [x] Audit FuzzBall refresh behavior and confirm its cache can be rebuilt.
  - [x] Add attachment lifecycle refresh for Taps ride-mode state.
- [ ] Tests and native/frontend lifecycle coverage.
  - [x] Focused Rust and frontend contract tests pass.
  - [x] Add focused timeout, reattach, replacement-session, and live-ordering
    coverage.
  - [ ] Add real live-traffic hot-reload integration coverage. (Deferred as a
    future improvement; no native E2E harness currently exists.)
  - [x] Add focused surface-controller reconstruction coverage.
  - [ ] Add native-window surface recovery coverage. (Deferred as a future
    improvement; no native E2E harness currently exists.)
- [ ] Specification and roadmap updates.
  - [x] Update the canonical protocol and connection-recovery plans.
  - [x] Review output/spec wording for any remaining backend-replay implication.
  - [x] Refresh the high-level roadmap with phase status and the P1 completion gate.
  - [x] Mark the roadmap item complete based on focused acceptance coverage;
    native lifecycle E2E coverage is explicitly deferred.

Keep this as one coordinated implementation initially. Consider a separate
test-focused agent only after the contract and first implementation checkpoint
are stable; the backend contract, frontend buffering, and plugin reconstruction
are tightly coupled.

## Open design checks before implementation

- Explore the minimal authoritative snapshot fields: backend lifecycle status,
  negotiated capabilities, protocol state, and diagnostics. Do not include
  transcript history, frontend UI state, or frontend plugin state.
- Define the app setting for the attachment grace-period timeout. Keep the
  delivery-buffer byte budget fixed per backend world connection for now.
- Keep protocol and negotiation recovery in the session snapshot initially.
  Preserve an extensible event-buffer format in case future protocol or plugin
  state cannot be reconstructed from snapshots.
- Do not expose gap metadata initially. Replay whatever remains in the bounded
  buffer; events that no longer fit are simply unavailable.
- Keep connection-status events out of the attachment buffer initially. The
  snapshot supplies current lifecycle state; only status transitions occurring
  after the attach barrier are delivered as live events. This avoids confusing
  backend world-connection state with the frontend attachment or the
  world-session projection.
- Remove the old replay command and its compatibility DTOs in this change.
- Keep FuzzBall, Taps, and other plugin lifecycle/recovery behavior in the
  frontend. Plugins may use local storage or issue new requests; the backend
  must not know about frontend plugins.

## Explicitly deferred

- Crash detection beyond the basic hot-reload/reattachment path.
- Hosted web deployment behavior and browser-specific acceptance scenarios.
- Native Tauri/WebView end-to-end reload and surface-recovery coverage until a
  deterministic native test harness is available.
- Event acknowledgements, replay cursors, and explicit gap/loss metadata.
- Frontend plugin state in the backend snapshot.
