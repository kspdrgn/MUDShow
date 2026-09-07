# Transcript Performance Plan

## Purpose

- Reduce lag in transcript interactions without changing transcript behavior.
- Make the current cost centers visible before changing cache or resize logic.
- Keep the plan compatible with future rich chunk types, chunk disappearance, and chunk reappearance.
- Establish repeatable synthetic workloads so measurements are comparable before and after each optimization.

## Core Model

- The transcript has three important layers:
  - the canonical history store
  - the hot render cache
  - the actual DOM
- A chunk may have more than one cost to update:
  - storing or mutating source history
  - rendering or re-rendering HTML
  - measuring or reflowing layout
  - committing DOM updates
- Chunk height should be treated as first-class cached data, not as a one-off estimate tied only to image previews.
- Some chunk-height changes will come from future rich integrations and from chunks appearing or disappearing entirely.

## Goals

- Keep transcript scrolling smooth first.
- Measure how long the transcript spends in each major update path.
- Separate cache updates, scrolling, and resizing into distinct metrics.
- Identify whether lag comes from height estimation, visible-range scanning, HTML rendering, DOM patching, or repeated observer callbacks.
- Preserve current transcript behavior while adding instrumentation.

## Non-Goals

- Do not change transcript semantics as part of the first instrumentation pass.
- Do not couple performance metrics to any one rich chunk type.
- Do not optimize by hiding work without first measuring it.
- Do not over-invest in resize-specific geometry caching before the scroll path is healthy.
- Do not add permanent telemetry, persisted profiling data, or a backend profiling service.
- Do not introduce a worker, process, or new transport layer for the first pass.

## Current Hotspot Hypothesis

The current virtualized range calculation is not indexed. `buildTranscriptVisibleRange`:

- scans the complete transcript once to collect chunks and calculate total estimated height;
- scans the chunks a second time to locate the visible range; and
- recalculates estimated chunk height during both passes.

Only chunks in the visible range invoke HTML rendering, normally through the render cache. The first profiling pass should verify how much cost comes from the repeated scans and height estimation as history grows, before choosing a height cache, cumulative-height index, or another geometry structure.

## Performance Surfaces

### Scroll Smoothness First

- Treat scrolling as the highest-priority interaction.
- Optimize for low-latency scroll response before focusing on panel resize lag.
- Measure whether scroll work is being delayed by render recomputation, cache misses, or layout reads.
- Keep the scroll path as direct and cheap as possible.

### Cache Updates

- Track when transcript data changes enough to invalidate visible rendering.
- Separate:
  - canonical history updates
  - render cache misses and clears
  - chunk-height cache invalidation
  - dependency-key changes from triggers, preview settings, or chunk-type changes
- Measure:
  - time spent updating caches
  - number of chunks invalidated
  - number of chunks re-rendered
  - number of chunk heights recomputed

### Scrolling

- Track scroll-driven transcript sync separately from other updates.
- Measure:
  - scroll event frequency
  - scrollTop delta
  - viewport changes caused by scrolling
  - visible-range recomputation time
  - render cache hit rate for the newly visible window
- Distinguish:
  - user scroll
  - follow-to-bottom behavior
  - forwarded wheel input from the split live pane

### Resizing

- Track resize-driven transcript sync separately from scroll-driven sync.
- Distinguish:
  - width-changing resize
  - height-only resize
  - split-view pane resize
  - observer bursts during a drag
- Measure:
  - callback count per drag
  - width delta and height delta
  - visible-range recomputation time
  - chunk-height cache hit rate
  - chunks scanned to find the visible window
  - DOM update time after recomputation
- Prefer suspension or coalescing during active resize over deeper geometry caching at first.

## Instrumentation Design

- Use the existing transcript diagnostics toggle as the gate.
- Add a transcript-specific perf helper rather than a global profiling system.
- Keep the helper side-effect free when diagnostics are disabled.
- Aggregate samples over a short window, such as 250–500 ms, rather than logging every chunk or every event individually. Excessive diagnostic logging must not become the measured bottleneck.
- Record top-level spans for:
  - render-state sync
  - scroll sync
  - resize sync
  - preview-load layout shifts
  - live output append
- Record phase timings inside each span:
  - read DOM metrics
  - compute visible range
  - render visible chunks
  - update spacers and state
  - settle on the next frame when needed
- Log counters alongside timings:
  - chunks scanned
  - chunks rendered
  - render cache hits and misses
  - height cache hits and misses
  - width changes
  - height changes
  - split-view state
  - userScrolled state

Each sample should retain enough context to compare runs without including transcript contents:

- reason: render, scroll, resize, preview-load, or append;
- total duration and per-phase durations;
- total chunk count and rendered chunk count;
- visible range and spacer sizes;
- viewport height and output width;
- split-view and bottom-anchor state;
- invalidation reason, when applicable.

Instrumentation should distinguish these invalidation causes:

- new transcript revision;
- width change;
- scroll position change;
- split-view change;
- trigger or style dependency change;
- image-preview state change; and
- resize reconciliation.

The render cache should expose diagnostic counters for hits, misses, clears, evictions, and current size without changing its behavior.

The append path should separately measure transcript mutation, optional persistent-history work, output-revision updates, logging enqueueing, and the delay until the next-frame scroll/render pass. This distinguishes delayed display work from actual rendering cost.

## Height Cache Strategy

- Cache chunk height using the inputs that affect wrapping and special presentation.
- Treat width as a cache key, because width changes invalidate wrapping.
- Treat rich-chunk presentation state as a cache key, because special chunks can change height.
- Treat chunk presence as part of the cache lifecycle, because chunks may disappear or reappear.
- Prefer an incremental or index-based structure later if height caching alone still leaves resize work too expensive.

## Suggested Metrics

- `syncTranscriptRenderState`
  - total duration
  - branch taken
  - number of chunks scanned
  - number of chunks rendered
  - DOM-read, range-build, render, and state-update phase durations
- `scroll`
  - event count
  - time to recompute visible range
  - follow-to-bottom decisions
  - native versus forwarded-wheel events
  - scroll delta and direction
  - deferred next-frame reconciliation duration

- Track long-selection range updates separately from ordinary scrolling:
  - native-to-chunk-range mode transition count
  - selection range recalculation time
  - chunks retained or force-rendered for selection preview
  - canonical range-copy extraction time
  - marker drag and custom-menu update time
- `resize`
  - event count
  - axis classification
  - time per callback
  - callback burst size
  - visible-range recomputation cost
  - animation frames scheduled versus executed
  - width and height deltas
- `cache`
  - render cache hit rate
  - height cache hit rate
  - invalidation reasons
  - clear and eviction counts
- `range`
  - total chunks
  - first-pass scan count

Selection range metrics must not include transcript contents. They should record
only chunk IDs, counts, character-boundary metadata, and elapsed times. A
selection preview may retain a bounded contiguous range of chunks, but it must
not disable virtualization for the entire history.
  - second-pass scan count
  - height-estimate call count
  - visible start/end indexes
  - top and bottom spacer sizes
- `append`
  - transcript append duration
  - history persistence duration
  - logging enqueue duration
  - time from append to render/scroll settlement

## Rollout Strategy

- First add measurement only, behind the existing transient diagnostics toggle.
- Add deterministic synthetic transcript fixtures and a repeatable stress harness.
- Capture baseline profiles for short, medium, and maximum configured histories.
- Validate whether scrolling, rendering, resizing, preview layout shifts, or append-side work is the true bottleneck.
- Next remove avoidable work from the scroll path.
- After that, add resize coalescing or suspension if resize is still noisy.
- Only then decide whether height caching or a more indexed geometry structure is worth the complexity.
- Keep the performance work small and reversible until the metrics show the best next step.

Every optimization should be evaluated against the same workload and should preserve the existing transcript behavior. Record median, p95, and maximum span duration, plus cache and scan counters. A useful provisional target is for normal scroll synchronization to remain comfortably below one frame budget, with p95 ideally below roughly 8–12 ms; this is a diagnostic target, not a release criterion until representative machines are measured.

## Stress-Test Workloads

Use deterministic generated transcript data first, without requiring a live MUD connection.

History sizes:

- 100 chunks;
- 1,000 chunks;
- 10,000 chunks; and
- 50,000 chunks.

Content mixes:

- mostly short lines;
- long wrapped prose;
- ANSI formatting;
- links and image previews; and
- multiple active regular-expression and highlight rules.

Interaction scenarios:

- append output while following the bottom;
- append output while manually scrolled upward;
- rapid wheel scrolling;
- slow scrolling through the middle of history;
- split-view scrolling and forwarded wheel input;
- repeated width-changing resize;
- repeated height-only resize;
- transcript zoom changes;
- switching away from and back to an active world tab; and
- image previews loading after transcript content is visible.

For each scenario, capture the performance samples plus browser frame/drop evidence where available. The harness should be able to replay the same generated data and interaction sequence after an optimization.

## Decision Gates

- If range calculation scales poorly with chunk count, prioritize a height cache or cumulative-height index.
- If HTML rendering dominates, improve render-cache invalidation or reduce render-dependency churn.
- If scroll work is cheap but resize is noisy, coalesce or suspend resize reconciliation.
- If image previews cause large layout shifts, prioritize measured-height correction and preview-specific reconciliation.
- If append or persistence dominates before rendering begins, separate immediate display work from persistence and logging work.

Do not select an optimization based only on intuition or a single maximum-duration sample. Require a repeatable workload, a clear bottleneck in the counters/timings, and a before/after comparison.

## Recommended First Milestone

The first implementation milestone should contain only:

1. A gated transcript performance helper with short-window aggregation.
2. Spans around render sync, range calculation, render-cache access, scroll, resize, preview layout shifts, and output append.
3. Counters for scans, height estimates, rendered chunks, cache hits/misses, invalidations, and resize coalescing.
4. Deterministic synthetic transcript fixtures covering the four history sizes and the main content mixes.
5. A repeatable manual or browser-driven stress harness with baseline recording.

This milestone must not change scroll behavior, cache policy, transcript semantics, or persistence behavior. Its output should identify the next optimization rather than presume one.

## Open Questions

- Should height caching live beside the render cache or in a separate transcript geometry cache?
- Should resize callbacks be coalesced before they reach transcript sync logic?
- Should vertical-only resize reuse the current visible chunk window and only adjust boundaries, or always recompute the full window?
- What is the cleanest way to represent chunk appearance and disappearance in the cache key?

## Next Steps

- Add transcript perf spans and counters behind the diagnostics toggle.
- Add the synthetic workload generator and repeatable interaction harness.
- Measure cache update, append, scroll, resize, preview, and range paths separately.
- Record baseline profiles at 100, 1,000, 10,000, and 50,000 chunks.
- Use the data to decide whether to add chunk-height caching first, coalesce resize work, reduce render invalidation, or jump directly to a cached height index.
- Re-run the same profiles after each optimization and add regression coverage for the corrected path.
