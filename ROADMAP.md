# MUDShow Roadmap

This is the high-level roadmap. Detailed implementation checklists remain in
the linked plan documents; an item is complete here only when its acceptance
coverage and canonical specification work are complete.

## P0 — Transport and protocol foundations

- [x] Establish the Rust-owned world connection worker and serialized socket
  lifecycle.
- [x] Establish the versioned connection event envelope with session identity
  and monotonic event ordering.
- [x] Add stateful Telnet framing, negotiation, bounded control events, and
  conservative automatic replies.
- [x] Keep protocol decoding separate from transcript rendering and expose
  diagnostics for raw and structured traffic.

See `PLAN_PROTOCOLS.md` for the protocol boundary and deferred protocol work.

## P1 — Core system foundations

- [x] Establish the generic versioned surface command, snapshot, controller,
  and lifecycle boundary.
- [x] Activate the built-in FuzzBall/Taps world-session integrations through
  the generic plugin and surface host boundary.
- [x] Connect feature surface controllers and native-window adapters to the
  generic boundary.
- [ ] Consolidate frontend session-service ownership.
- [x] Replace transcript replay recovery with an authoritative session snapshot
  plus attach barrier/revision:
  - [x] Keep transcript and scrollback persistence explicitly frontend/local,
    without a backend canonical-history requirement.
  - [x] Make plugin and surface controllers reconstructible from current
    session/plugin state rather than missed transcript events.
  - [x] Add focused frontend/backend lifecycle coverage for local-history
    reload and snapshot/live-event ordering.

See `PLAN_P1_SESSION_SNAPSHOT_ATTACH_BARRIER.md`,
`PLAN_FRONTENDSEPARATECONNECTION.md`, `PLAN_DI_WORLD_SESSION.md`,
`PLAN_PLUGIN.md`, and `PLAN_SURFACES.md`.

## P2 — Session services and product integrations

- [ ] Consolidate FuzzBall cache ownership behind its plugin session service.
- [ ] Consolidate notes and transcript/history operations behind focused
  frontend services while preserving local persistence and debounce behavior.
- [ ] Complete FuzzBall property capture, editing, and storage-viewer behavior.
- [ ] Complete the planned Taps integrations beyond ride mode.
- [ ] Complete channel routing and capture/sentinel behavior where required by
  concrete product features.
- [ ] Continue simplifying the session shell as responsibilities move into
  session-scoped services.

See `PLAN_DI_WORLD_SESSION.md`, `PLAN_FUZZBALL.md`, `PLAN_TAPS.md`,
`PLAN_CHANNELS.md`, and `PLAN_CAPTURE.md`.

## P3 — Extended protocol pipeline

- [ ] Confirm and document the MCP wire format and supported message scope.
- [ ] Implement bounded stateful MCP decoding behind the protocol boundary.
- [ ] Integrate typed MCP events with the Rust connection worker and plugin
  consumers.
- [ ] Add GMCP and MCMP support using the same transport-neutral event model.
- [ ] Extend authoritative snapshots when a protocol’s state cannot be
  reconstructed from current session state and explicit refresh requests.

See `PLAN_PROTOCOLS.md` and `spec/protocols.md`. MCP, GMCP, and MCMP are not
required for basic connection, transcript, or attach recovery.

## Cross-cutting and future work

- [ ] Define external plugin packaging, permissions, versioning, and runtime
  isolation.
- [ ] Add updater and release-channel support.
- [ ] Continue transcript performance, input, spelling, and accessibility work
  as concrete requirements emerge.
- [ ] Revisit hosted/browser-specific lifecycle coverage when the hosted app is
  an active product target.

See `PLAN_PLUGIN.md`, `PLAN_AUTOUPGRADE.md`, `PLAN_PERF.md`,
`PLAN_INPUT.md`, and `PLAN_SPELLING.md`.

## Current P1 completion gate

The snapshot/attach roadmap item is complete when the implementation has:

- [x] An authoritative backend snapshot with a revision separate from event
  sequence.
- [x] A frontend attach barrier with session-ID protection.
- [x] A fixed byte-bounded incoming-data delivery buffer.
- [x] Frontend-local transcript recovery and plugin attachment refresh hooks.
- [ ] Native Tauri/WebView lifecycle coverage for reload, active traffic, and
  surface recovery. (Deferred future improvement.)
- [x] Final specification and roadmap review.

The core snapshot/attach implementation is complete. A deterministic native
E2E harness is a future improvement and is not required to reopen this item.
