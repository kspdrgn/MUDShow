# Transcript Performance Plan

The transcript keeps canonical chunks separate from rendered HTML. The virtual layout path now uses a sliding prefix-height index:

- append and front-trim are amortized O(1);
- visible-range lookup is O(log n) plus the number of rendered chunks;
- the scroll path no longer rebuilds an array or rescans every retained chunk;
- occasional index compaction bounds retained geometry overhead;
- selection temporarily mounts a bounded native-selection window rather than changing the canonical store.

Remaining measurement work:

- add gated timings for render-state sync, scroll, resize, cache misses, and height-index rebuilds;
- measure sustained traffic with 50,000 retained chunks;
- decide whether measured resize bursts need further coalescing or a measured-height cache.
