# MUDShow Roadmap

This is the canonical high-level implementation checklist for the app. It excludes MCP, GMCP, and MCMP protocol work, which is tracked separately in [`PLAN_PROTOCOLS.md`](PLAN_PROTOCOLS.md).

Detailed design and implementation notes remain in the relevant `PLAN_*.md` files. Keep this document focused on major outcomes, not individual code tasks.

## P0 — Reliability and usability blockers
- [ ] Fix Alt+Tab back to the app not restoring keyboard focus to the input box on Windows. Known upstream issue: [tauri-apps/tauri#15624](https://github.com/tauri-apps/tauri/issues/15624). The fix ([PR #15625](https://github.com/tauri-apps/tauri/pull/15625)) is already merged into Tauri's `dev` branch; revisit when it ships in a published release. A local runtime backport currently addresses this: upgrade to a release containing the fix, remove the vendored backport, and verify repeated Alt+Tab returns preserve typing, drafts, and the selected input, including pop-out windows.
- [X] Stabilize transcript behavior during heavy interaction: autoscroll, split scrolling, resizing, zooming, inactive-tab recovery, and browser-level stress coverage are implemented and validated.
- [X] Make text selection reliable across virtualized transcript content: bounded native selection, canonical range extraction, long-selection markers, handle hit areas, and context-menu navigation are implemented.
- [X] Complete frontend-reload connection recovery and diagnostics ([`PLAN_FRONTENDSEPARATECONNECTION.md`](PLAN_FRONTENDSEPARATECONNECTION.md)): runtime/session metadata, replay, attach/detach, recovery, replay-gap diagnostics, sequence-safe snapshot recovery, lifecycle coverage, structured-sync reconciliation, and a dedicated active-connection diagnostics surface are implemented for the P0 Telnet scope.
- [X] Add regression coverage for connection, transcript, scrolling, and persistence behavior ([`PLAN_TESTS.md`](PLAN_TESTS.md)): connection lifecycle, transcript, virtual-layout, 50,000-chunk, and browser stress coverage are implemented; 50 frontend regression tests and 10 Rust tests pass.
- [X] Stress-test and optimize transcript rendering for long histories and sustained traffic ([`PLAN_PERF.md`](PLAN_PERF.md)): indexed visible-range lookup, bounded render work, 50,000-chunk coverage, resize-tuning decision, and repeatable sustained-traffic profiling are implemented and validated.

## P1 — Core system foundations

- [ ] Complete the generic surface protocol integration and lifecycle coverage.
  - [ ] Connect the generic surface host to the FuzzBall and Taps integrations.
  - [ ] Consolidate hosted-window and pop-out lifecycle management.
- [X] Resolve session ownership and recovery direction: frontend services own session data, saved data reloads from storage, and disposable plugin state can be re-queried; preserve live-connection reattachment and existing bounded replay.
- [X] Consolidate frontend session-service ownership for transcript/history coordination, notes editing and saving, and plugin caches ([`PLAN_DI_WORLD_SESSION.md`](PLAN_DI_WORLD_SESSION.md)); keep trigger definitions in app storage and presentation state in surface controllers.
- [X] Stabilize configuration versioning and migration behavior design: establish a version-aware loading seam for future breaking schema changes; keep non-breaking shape changes silent, and immediately persist explicitly migrated files while rejecting unsupported newer versions.
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
- [ ] Improve frontend startup performance with lazy loading/code splitting for
  secondary surfaces and other non-startup features; revisit the bundle-size
  warning threshold after the startup path is split.

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
- [X] Stabilize configuration versioning and migration behavior: schema version
  2 now migrates legacy name-keyed notes to character IDs, persists explicit
  migrations, preserves unknown note keys, and rejects invalid or newer files.

Detailed design and implementation notes remain in
[`PLAN_CONFIGURATION.md`](PLAN_CONFIGURATION.md).
