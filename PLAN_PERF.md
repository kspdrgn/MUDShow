# Transcript Performance Plan

The transcript keeps canonical chunks separate from rendered HTML. The virtual layout path now uses a sliding prefix-height index:

- append and front-trim are amortized O(1);
- visible-range lookup is O(log n) plus the number of rendered chunks;
- the scroll path no longer rebuilds an array or rescans every retained chunk;
- occasional index compaction bounds retained geometry overhead;
- selection temporarily mounts a bounded native-selection window rather than changing the canonical store.

The remaining resize work is complete. ResizeObserver callbacks are already
coalesced to one animation frame, and the follow-up layout reconciliation is
bounded to the same frame/tick pair. Additional coalescing would only defer
updates without reducing the layout work.

The measured-height cache was not needed. The existing `TranscriptHeightIndex`
is now used by both history and live rendering: width changes rebuild it,
front-trims remove only dropped entries, and new chunks append incrementally.
Visible-range lookup is binary-search based, so a 50,000-chunk history does
not scan all chunks during a resize or scroll. Regression coverage verifies
that a middle-of-history range reads fewer than 100 chunks from a 50,000-chunk
transcript. Heights remain estimates because actual DOM measurements would
invalidate the bounded resize path and image tombstones already reserve the
preview space.
