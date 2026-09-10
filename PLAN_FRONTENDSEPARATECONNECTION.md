# Durable World Connections Across Frontend Reloads

## Implemented milestone

- Rust owns connection identity, runtime identity, session IDs, and a bounded replay buffer.
- Every emitted connection event carries a session ID and monotonically increasing sequence.
- Frontend connections have separate `connect`, `attach`, `detach`, and `close` semantics.
- Frontend teardown detaches listeners instead of disconnecting sockets; explicit disconnect, tab close, reconnect, and native app exit still close them.
- A new frontend discovers backend connections, matches world/character metadata, recreates tabs, attaches listeners, replays missed text events, deduplicates live/replayed sequences, and shows a diagnostic when the replay buffer has a gap.
- Replay responses and connection events now carry a versioned contract, and
  attach-gap recovery can request a bounded structured snapshot before replay
  dispatch.

## Remaining work

- Keep P0 focused on Telnet. MCP, GMCP, and MCMP decoder integration is
  deferred to P3 or later and should consume this generic event boundary.
- Keep Telnet negotiation and automatic Telnet replies in the backend while
  detached.
- Classify gaps that affect structured state and apply/discard events against
  the snapshot sequence once structured protocols are introduced in P3+.
- P0 lifecycle and frontend/browser reload coverage is complete. Future
  protocol-specific work should extend the existing structured-sync model and
  diagnostics without moving decoder ownership into transcript rendering.
- The Settings > Connections view provides the dedicated active-connection
  diagnostics surface for endpoint, security mode, status, identity, session,
  sequence, and last error.

## Agreed History and Refresh Recovery Direction

Preserve the implemented live-connection recovery: Rust keeps the socket,
connection identity, bounded replay buffer, and compact protocol snapshot.
A refreshed or restarted webview discovers surviving connections and reattaches.
If Rust restarts, a new connection is required. Reattachment does not trigger a
new server welcome.

Canonical transcript ownership remains in frontend services. Recover configured
rolling transcript history through the existing storage feature. Full transient
event history need not survive a frontend refresh or reconnect; additional
retention, queuing and resynchronization are transcript-history feature work.
This decision does not remove or expand the existing bounded replay mechanism.

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
- Define the attach ordering guarantee: the frontend listener is installed
  before replay is requested, replay is delivered in sequence order, and live
  events are accepted only after sequence filtering.

### Phase 2: Version the event envelope

- Introduce a shared versioned envelope for text, lifecycle, and structured
  protocol events.
- Preserve one monotonically increasing sequence across raw, text, lifecycle,
  and structured events for a session.
- Keep protocol-specific payloads behind discriminated `kind` values; do not add
  protocol branches to frontend transcript code.
- Reject malformed or unknown payloads as classified diagnostics without
  terminating a healthy socket.

### Phase 3: Add structured replay recovery

- Extend attach responses with the replay range and a typed gap reason.
- Treat a gap in plain transcript text as recoverable diagnostic information.
- Treat a gap affecting structured state as stale state requiring a snapshot.
- Add a snapshot request/response carrying the authoritative state and the
  sequence at which that state was observed.
- Apply the snapshot before accepting subsequent structured events; discard
  older or duplicate events after recovery.
- Surface failed snapshot recovery as an actionable connection diagnostic.

### Phase 4: Preserve detached protocol behavior

- Keep Telnet negotiation and automatic MCP/GMCP/MCMP replies in the backend
  while no frontend listener is attached.
- Ensure detached processing continues to update the replay stream and protocol
  snapshot state.
- Do not make frontend visibility, active-tab state, or transcript rendering a
  prerequisite for protocol correctness.

### Phase 5: Diagnostics

- Add a dedicated connection diagnostics model and surface containing runtime
  ID, connection ID, session ID, status, attach state, sequence range, gap
  state, structured-sync state, and last error.
- Keep raw traffic in the existing debug console; diagnostics should summarize
  lifecycle and recovery rather than duplicate the traffic stream.
- Make diagnostics safe to show after frontend reload and after failed attach.

### Phase 6: Test and acceptance pass

- Add Rust unit tests for replay trimming, session protection, attach ordering,
  replacement, disconnect cleanup, and detached processing.
- Add frontend tests for delayed replay/live interleaving, stale callbacks,
  attach failure, gap classification, snapshot application, and teardown.
- Add browser-level coverage for frontend reload with active traffic, multiple
  tabs, reconnect, and delayed events.
- Update `ROADMAP.md` only when the lifecycle, structured recovery, and focused
  verification criteria are complete.

## Code inventory

### Backend ownership

- `tauri/src/mud_backend.rs`
  - `ConnectionManager`: connection map, runtime identity, session IDs,
    replacement, disconnect, replay storage, and event emission.
  - `ConnectionEntry`: active worker, descriptor, replay deque, and sequence
    counter.
  - `connect_mud`: starts/replaces a backend session.
  - `list_mud_connections`: frontend reload discovery metadata.
  - `get_mud_connection_events`: replay inspection path.
  - `attach_mud_connection`: replay/attach boundary.
  - `send_mud` and `disconnect_mud`: frontend command boundary.
  - `run_connection`, `flush_line_buffer`, and `emit_event`: stream reading,
    line framing, sequence assignment, and event emission.
  - `ConnectionEvent`, `ConnectionEventMessage`, `ConnectionDescriptor`,
    `ReplayEvent`, and `ReplayResponse`: current wire DTOs to version or extend.

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
    replay dispatch, sequence filtering, and frontend diagnostics callback.
  - `acceptsConnectionSequence`: current pure ordering rule.
  - `ConnectionEvent`, `ReplayEvent`, `ReplayResponse`, and
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
- Every session event has one strictly increasing sequence.
- A frontend listener is installed before replay begins.
- Replay and live delivery pass through the same sequence acceptance rule.
- Session ID mismatches are ignored and cannot close or mutate the replacement.
- Detaching the frontend never disconnects the backend socket.
- Explicit close, reconnect, tab close, and app shutdown do disconnect it.
- Structured state is never presented as current after an unrecovered replay
  gap.
- Native-process crash survival remains out of scope for this plan.

Native-process crash survival is out of scope; it requires a separate broker process.
