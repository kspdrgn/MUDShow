# Transcript Performance Plan

## Purpose

- Reduce lag in transcript interactions without changing transcript behavior.
- Make the current cost centers visible before changing cache or resize logic.
- Keep the plan compatible with future rich chunk types, chunk disappearance, and chunk reappearance.

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
- Record top-level spans for:
  - render-state sync
  - scroll sync
  - resize sync
  - preview-load layout shifts
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
- `scroll`
  - event count
  - time to recompute visible range
  - follow-to-bottom decisions
- `resize`
  - event count
  - axis classification
  - time per callback
  - callback burst size
  - visible-range recomputation cost
- `cache`
  - render cache hit rate
  - height cache hit rate
  - invalidation reasons

## Rollout Strategy

- First add measurement only.
- Then validate whether scrolling or resizing is the true bottleneck in realistic transcript usage.
- Next remove avoidable work from the scroll path.
- After that, add resize coalescing or suspension if resize is still noisy.
- Only then decide whether height caching or a more indexed geometry structure is worth the complexity.
- Keep the performance work small and reversible until the metrics show the best next step.

## Open Questions

- Should height caching live beside the render cache or in a separate transcript geometry cache?
- Should resize callbacks be coalesced before they reach transcript sync logic?
- Should vertical-only resize reuse the current visible chunk window and only adjust boundaries, or always recompute the full window?
- What is the cleanest way to represent chunk appearance and disappearance in the cache key?

## Next Steps

- Add transcript perf spans and counters behind the diagnostics toggle.
- Measure cache update, scroll, and resize paths separately.
- Use the data to decide whether to add chunk-height caching first or to jump directly to a cached height index.
