# MUDShow Roadmap

## P1 — Core system foundations

- [x] Establish the generic versioned surface command, snapshot, controller,
  and lifecycle boundary.
- [x] Activate the built-in FuzzBall/Taps world-session integrations through
  the generic plugin and surface host boundary.
- [x] Connect feature surface controllers and native-window adapters to the
  generic boundary.
- [ ] Consolidate frontend session-service ownership.
- [ ] Replace transcript replay recovery with an authoritative session snapshot plus attach barrier/revision:
  - [ ] Keep transcript and scrollback persistence explicitly frontend/local, without a backend canonical-history requirement.
  - [ ] Make plugin and surface controllers reconstructible from current session/plugin snapshots rather than missed transcript events.
  - [ ] Add browser/native lifecycle coverage for local-history reload and snapshot/live-event ordering.

The detailed surface boundary is documented in `spec/surfaces.md` and
`PLAN_SURFACES.md`. The remaining P1 work is frontend session-service
consolidation plus the snapshot-based session attach boundary. Transcript
history remains frontend/local, while Rust owns authoritative live session and
protocol state. Detailed connection recovery work is tracked in
`PLAN_FRONTENDSEPARATECONNECTION.md`; browser/native lifecycle coverage is
tracked across that plan and `PLAN_SURFACES.md`.
