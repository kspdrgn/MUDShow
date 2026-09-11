# Durable World Connections Across Frontend Reloads

## Implemented milestone

- Rust owns connection identity, runtime identity, session IDs, and the current
  authoritative session snapshot.
- Every emitted connection event carries a session ID and monotonically increasing sequence.
- Frontend connections have separate `connect`, `attach`, `detach`, and `close` semantics.
- Frontend teardown detaches listeners instead of disconnecting sockets; explicit disconnect, tab close, reconnect, and native app exit still close them.
- A new frontend discovers backend connections, matches world/character metadata,
  recreates tabs, attaches listeners, loads its local transcript history, and
  receives the current backend session snapshot.
- The attach boundary must prevent snapshot/live-event races. A session revision
  or attach barrier replaces transcript replay as the normal recovery mechanism.

## Remaining work

- Keep P0 focused on Telnet. MCP, GMCP, and MCMP decoder integration is
  deferred to P3 or later and should consume this generic event boundary.
- Keep Telnet negotiation and automatic Telnet replies in the backend while
  detached.
- Keep the fixed per-connection incoming-data delivery buffer bounded by bytes;
  do not add cursor acknowledgements or gap metadata yet.
- Focused lifecycle coverage for the attach contract is complete. Real
  frontend/native reload coverage is deferred until a deterministic native E2E
  harness exists.
- Future protocol-specific work should extend the existing structured-sync model and
  diagnostics without moving decoder ownership into transcript rendering.
- The Settings > Connections view provides the dedicated active-connection
  diagnostics surface for endpoint, security mode, status, identity, session,
  sequence, and last error.

## Agreed History and Refresh Recovery Direction

Preserve live-connection recovery: Rust keeps the socket, connection identity,
and compact authoritative protocol/session snapshot. A refreshed webview
discovers surviving connections, loads its transcript from local storage, and
reattaches. If Rust restarts, a new connection is required. Reattachment does
not trigger a new server welcome.

Canonical transcript ownership remains in frontend/local services. Recover
configured rolling transcript history through the existing user-local storage
feature. Rust does not own canonical transcript history. Its bounded delivery
buffer may replay retained incoming data to smooth a frontend detach/reattach,
but it is not durable history and does not provide cursor or gap semantics.

The backend retains compact authoritative state, a monotonic session revision,
and the fixed-size incoming-data delivery buffer. The snapshot remains the
source of protocol and negotiation recovery; frontend plugins can issue their
own refresh requests after attachment.

Remove the backend canonical-history experiment from scheduled work. Reconsider
backend history ownership only with validated performance or memory evidence or
a concrete product requirement. Hot reload alone is not sufficient justification.

Saved notes and triggers reload from storage without parallel authoritative
backend copies. Accept the existing notes debounce loss window. Plugin caches
may be discarded and re-queried. Any serializable world-session data may
optionally use webview storage when a specific feature benefits from refresh
durability; no universal caching framework is required.

Keep protocol snapshots compact. Do not grow them into copies of frontend
plugin caches, saved documents, or full transcript history. Surface snapshots
remain a live view-communication mechanism, not a promise of durable frontend
state. See `PLAN_DI_WORLD_SESSION.md` for the frontend ownership boundaries.

## Implementation plan

### Phase 1: Freeze the lifecycle contract

- Document the legal state transitions for `connect`, `attach`, `detach`,
  `reconnect`, `close`, remote close, and frontend teardown.
- Keep socket ownership in the Rust connection manager and listener ownership in
  `MudConnection`.
- Treat `connectionId + sessionId` as the identity of one backend session;
  connection ID alone must never authorize an old session to mutate current
  state.
- Define the attach ordering guarantee: the backend establishes an attach
  barrier, returns a snapshot plus revision, and delivers events after that
  revision only after the snapshot is accepted by the frontend.

### Phase 2: Version the event envelope

- Introduce a shared versioned envelope for text, lifecycle, and structured
  protocol events.
- Preserve one monotonically increasing sequence across raw, text, lifecycle,
  and structured events for live delivery within a session. The sequence does
  not imply backend retention or transcript replay.
- Keep protocol-specific payloads behind discriminated `kind` values; do not add
  protocol branches to frontend transcript code.
- Reject malformed or unknown payloads as classified diagnostics without
  terminating a healthy socket.

### Phase 3: Add structured snapshot recovery

- Extend attach responses with the authoritative session revision and a typed
  snapshot state.
- Do not treat missing transcript events as a backend recovery failure; the
  frontend's local history is the transcript recovery source.
- Apply the snapshot before accepting subsequent structured events, using the
  revision to reject stale or duplicate updates.
- Surface failed snapshot recovery as an actionable connection diagnostic.

### Phase 4: Preserve detached protocol behavior

- Keep Telnet negotiation and automatic MCP/GMCP/MCMP replies in the backend
  while no frontend listener is attached.
- Ensure detached processing continues to update authoritative protocol/session
  state and the bounded incoming-data delivery buffer.
- Do not make frontend visibility, active-tab state, or transcript rendering a
  prerequisite for protocol correctness.

### Phase 5: Diagnostics

- Add a dedicated connection diagnostics model and surface containing runtime
  ID, connection ID, session ID, status, attach state, sequence range,
  structured-sync state, and last error.
- Keep raw traffic in the existing debug console; diagnostics should summarize
  lifecycle and recovery rather than duplicate the traffic stream.
- Make diagnostics safe to show after frontend reload and after failed attach.

### Phase 6: Test and acceptance pass

- Add Rust unit tests for session protection, snapshot revisioning, attach
  ordering, replacement, disconnect cleanup, and detached processing.
- Add frontend tests for snapshot/live interleaving, stale callbacks, attach
  failure, revision handling, local-history loading, and teardown.
- Add native/frontend coverage for reload with active traffic, reconnect,
  delayed attach, replacement sessions, and native surface recovery.
- Update `ROADMAP.md` only when the lifecycle, structured recovery, and focused
  verification criteria are complete.

## Code inventory

### Backend ownership

- `tauri/src/mud_backend.rs`
  - `ConnectionManager`: connection map, runtime identity, session IDs,
    replacement, disconnect, authoritative snapshot state, and event emission.
  - `ConnectionEntry`: active worker, descriptor, session snapshot, and revision
    counter.
  - `connect_mud`: starts/replaces a backend session.
  - `list_mud_connections`: frontend reload discovery metadata.
  - `get_mud_connection_events`: transitional compatibility path; do not extend
    it as transcript recovery.
  - `attach_mud_connection`: snapshot/attach boundary.
  - `send_mud` and `disconnect_mud`: frontend command boundary.
  - `run_connection`, `flush_line_buffer`, and `emit_event`: stream reading,
    line framing, sequence assignment, and event emission.
  - `ConnectionEvent`, `ConnectionEventMessage`, `ConnectionDescriptor`, and
    `ReplayEvent`: event and attach-boundary DTOs; no generic replay response.

- `tauri/src/main.rs`
  - registers the connection commands;
  - owns app shutdown cleanup and native-window lifecycle that may detach or
    destroy frontend consumers.

- `tauri/src/diagnostics.rs`
  - currently provides the native diagnostics attachment point; use it for
    backend-facing diagnostics without mixing them into transcript output.

### Frontend connection ownership

- `frontend/src/lib/connection.ts`
  - `MudConnection`: connect/attach/detach/close, event listener lifetime,
    snapshot attach, revision filtering, and frontend diagnostics callback.
  - `acceptsConnectionSequence`: current pure ordering rule.
  - `ConnectionEvent`, `ReplayEvent`, and
    `MudConnectionDescriptor`: current frontend event and metadata shapes.

- `frontend/src/lib/session-world-connection.ts`
  - creates and resolves world connections;
  - maps connection callbacks into world-session status, transcript, plugin,
    and reconnect behavior;
  - is the integration point for structured-event routing, not the protocol
    decoder itself.

- `frontend/src/lib/session-world-transcript.ts`
  - appends decoded text/status output and debug-console traffic;
  - owns activity and transcript-side effects;
  - should consume ordered text events without owning replay mechanics.

- `frontend/src/lib/session.ts` and `frontend/src/lib/session-tabs.ts`
  - own world-tab discovery, session reconstruction, activation, teardown,
    and frontend-reload recovery orchestration.

- `frontend/src/lib/world-session.ts`
  - owns the session projection consumed by the UI;
  - candidate location for connection diagnostics state, provided it remains
    session metadata rather than raw protocol state.

### Diagnostics and test ownership

- `frontend/src/lib/components/debug-console/DebugConsoleWindow.svelte`
  - existing per-world troubleshooting surface; keep raw traffic here.
- `frontend/src/lib/components/debug-console/debug-console-controller.ts`
  - controller boundary for debug-console state and future diagnostics actions.
- `frontend/src/lib/components/debug-console/debug-console-transport.ts`
  - typed transport pattern that can inform a dedicated connection diagnostics
    surface.
- `frontend/src/lib/tests/connection-regression.test.ts`
  - current sequence-filtering coverage; expand with pure lifecycle and gap
    classification tests.
- `PLAN_PROTOCOLS.md` and `spec/protocols.md`
  - own protocol decoding, negotiation, structured event semantics, limits, and
    protocol-specific tests; coordinate with this plan but do not duplicate
    the connection lifecycle contract.

## Invariants for implementation

- One socket reader exists per active backend session.
- Live events retain a monotonic sequence for ordering and diagnostics; the
  authoritative session snapshot has its own monotonic state revision.
- Snapshot acceptance and live delivery have one explicit ordering guarantee.
- Transcript history is loaded from frontend/local storage, not backend replay.
- Session ID mismatches are ignored and cannot close or mutate the replacement.
- Detaching the frontend never disconnects the backend socket.
- Explicit close, reconnect, tab close, and app shutdown do disconnect it.
- Structured state is never presented as current after a failed or stale
  snapshot recovery.
- Native-process crash survival remains out of scope for this plan.

Native-process crash survival is out of scope; it requires a separate broker process.
