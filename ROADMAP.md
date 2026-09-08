# MUDShow Roadmap

This is the canonical high-level implementation checklist for the app. It excludes MCP, GMCP, and MCMP protocol work, which is tracked separately in [`PLAN_PROTOCOLS.md`](PLAN_PROTOCOLS.md).

Detailed design and implementation notes remain in the relevant `PLAN_*.md` files. Keep this document focused on major outcomes, not individual code tasks.

## P0 — Reliability and usability blockers
- [X] Stabilize transcript behavior during heavy interaction: autoscroll, split scrolling, resizing, zooming, inactive-tab recovery, and browser-level stress coverage are implemented and validated.
- [X] Make text selection reliable across virtualized transcript content: bounded native selection, canonical range extraction, long-selection markers, handle hit areas, and context-menu navigation are implemented.
- [~] Complete frontend-reload connection recovery and diagnostics ([`PLAN_FRONTENDSEPARATECONNECTION.md`](PLAN_FRONTENDSEPARATECONNECTION.md)): runtime/session metadata, replay, attach/detach, recovery, replay-gap diagnostics, sequence-safe snapshot recovery, and lifecycle coverage are implemented; deeper structured-state reconciliation and a dedicated diagnostics surface remain.
- [X] Add regression coverage for connection, transcript, scrolling, and persistence behavior ([`PLAN_TESTS.md`](PLAN_TESTS.md)): connection lifecycle, transcript, virtual-layout, 50,000-chunk, and browser stress coverage are implemented; 50 frontend regression tests and 10 Rust tests pass.
- [~] Stress-test and optimize transcript rendering for long histories and sustained traffic ([`PLAN_PERF.md`](PLAN_PERF.md)): indexed visible-range lookup, bounded render work, 50,000-chunk coverage, and the resize-tuning decision are implemented; sustained real-traffic profiling remains.

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
- [~] Add configurable visible timestamps and activity indicators: the
  last-activity marker is implemented; configurable persistent timestamps and
  related activity-display options remain.
- [ ] Improve rule-tree affordances and trigger action summaries.
- [ ] Add rolling auto-logging, customizable log naming/folders, and date-offset handling.
- [ ] Add always-on-top and transparency options.
- [X] Add compact previews for collapsed Dockview edge controls: tabs and custom controls reveal without shifting the reading area; tabs expand the full dock while custom controls operate in place.
- [~] Clean up focus behavior, key conflicts, tree selection, and native find-dialog behavior: clicking Dockview panel tabs in the active world now restores focus to the selected input bar; the remaining focus and navigation cleanup is still open.
- [ ] Clean up webview context menus: audit every app UI surface where the native webview context menu is still available, catalog those surfaces (including embedded/non-app surfaces), and decide whether each should block the menu or route unused space in the active world session to that world tab's context menu; default toward disabling native context menus through a configurable switch while preserving the developer-tools shortcut in the app menu.

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
