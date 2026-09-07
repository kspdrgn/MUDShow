# MUDShow Roadmap

This is the canonical high-level implementation checklist for the app. It excludes MCP, GMCP, and MCMP protocol work, which is tracked separately in [`PLAN_PROTOCOLS.md`](PLAN_PROTOCOLS.md).

Detailed design and implementation notes remain in the relevant `PLAN_*.md` files. Keep this document focused on major outcomes, not individual code tasks.

## P0 — Reliability and usability blockers

- [~] Stabilize transcript behavior during heavy interaction: autoscroll, split scrolling, resizing, zooming, and inactive-tab recovery are implemented; browser-level stress coverage remains.
- [~] Make text selection reliable across virtualized transcript content: bounded native selection and canonical range extraction are implemented; the full marker/context-menu UX remains.
- [~] Complete frontend-reload connection recovery and diagnostics ([`PLAN_FRONTENDSEPARATECONNECTION.md`](PLAN_FRONTENDSEPARATECONNECTION.md)): runtime/session metadata, replay, attach/detach, recovery, and replay-gap diagnostics are implemented; structured resynchronization remains.
- [~] Add regression coverage for connection, transcript, scrolling, and persistence behavior ([`PLAN_TESTS.md`](PLAN_TESTS.md)): focused connection, transcript, and virtual-layout coverage is present; broader lifecycle and browser coverage remains.
- [~] Stress-test and optimize transcript rendering for long histories and sustained traffic ([`PLAN_PERF.md`](PLAN_PERF.md)): indexed visible-range lookup and bounded render work are implemented; sustained-traffic profiling remains.

## P1 — Core system foundations

- [ ] Complete the generic surface protocol integration and lifecycle coverage.
- [ ] Connect the generic surface host to the FuzzBall and Taps integrations.
- [ ] Resolve remaining session-scoped ownership decisions for transcript history, notes, triggers, and FuzzBall state.
- [ ] Stabilize configuration versioning and migration behavior.
- [ ] Consolidate hosted-window and pop-out lifecycle management.
- [ ] Finish reducing frontend/component plumbing and remove unnecessary diagnostic logging.

## P2 — High-value product features

- [ ] Finish the FuzzBall storage editor and property `set` support.
- [ ] Complete capture filtering so plugin-captured data can be hidden from the visible transcript while remaining in history.
- [ ] Build Taps description, morph, room, list, WF, WS, and CInfo editors.
- [ ] Add whisper/page conversation tabs with pop-in and pop-out behavior.
- [ ] Add WHO, WF, WS, name-awareness, and related Taps side panels.
- [ ] Add trigger routing to channels and additional transcript actions.
- [ ] Improve input assistance: drag resizing, better spellcheck timing, thesaurus, character count, and safe text normalization.
- [ ] Add world-specific input translation and send previews.

## P3 — Presentation and workflow polish

- [ ] Add ANSI color customization, background images, and world-specific styles.
- [ ] Improve pose/name differentiation and automatic name highlighting.
- [ ] Add configurable visible timestamps and activity indicators.
- [ ] Improve rule-tree affordances and trigger action summaries.
- [ ] Add rolling auto-logging, customizable log naming/folders, and date-offset handling.
- [ ] Add always-on-top and transparency options.
- [~] Clean up focus behavior, key conflicts, tree selection, and native find-dialog behavior: clicking Dockview panel tabs in the active world now restores focus to the selected input bar; the remaining focus and navigation cleanup is still open.

## P4 — Distribution and maintenance

- [ ] Add signed release artifacts.
- [ ] Implement Windows auto-updating.
- [ ] Decide and implement the Linux update model.
- [ ] Validate release and update flows end to end.
- [ ] Finish specification updates for surfaces, layout, services, and plugin contracts.

## Related plans

- [`WISHLIST.md`](WISHLIST.md) — detailed backlog and lower-priority ideas.
- [`PLAN_RIDEMODE.md`](PLAN_RIDEMODE.md) — FuzzBall/Taps integration and generic plugin surface work.
- [`PLAN_SURFACES.md`](PLAN_SURFACES.md) — unified surface and window hosting.
- [`PLAN_DI_WORLD_SESSION.md`](PLAN_DI_WORLD_SESSION.md) — session-scoped service ownership.
- [`PLAN_FRONTENDSEPARATECONNECTION.md`](PLAN_FRONTENDSEPARATECONNECTION.md) — durable connections across frontend reloads.
- [`PLAN_PERF.md`](PLAN_PERF.md) and [`PLAN_HISTORY.md`](PLAN_HISTORY.md) — transcript performance and history architecture.
- [`PLAN_INPUT.md`](PLAN_INPUT.md) and [`PLAN_SPELLING.md`](PLAN_SPELLING.md) — input and writing assistance.
- [`PLAN_AUTOUPGRADE.md`](PLAN_AUTOUPGRADE.md) — release updating strategy.
