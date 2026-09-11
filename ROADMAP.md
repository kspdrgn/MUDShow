# MUDShow Roadmap

## P1 — Core system foundations

- [x] Establish the generic versioned surface command, snapshot, controller,
  and lifecycle boundary.
- [x] Activate the built-in FuzzBall/Taps world-session integrations through
  the generic plugin and surface host boundary.
- [x] Connect feature surface controllers and native-window adapters to the
  generic boundary.
- [ ] Consolidate frontend session-service ownership.

The detailed surface boundary is documented in `spec/surfaces.md` and
`PLAN_SURFACES.md`. The remaining P1 work is frontend session-service
consolidation, with browser/native lifecycle coverage tracked as a surface
follow-up in `PLAN_SURFACES.md`.
