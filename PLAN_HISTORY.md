# Transcript History Plan

## Rough Direction

- Keep transcript handling entirely in memory for now.
- Use a two-layer model instead of caching the entire transcript as rendered HTML.
- Make the larger layer the canonical transcript store.
- Make the smaller layer a hot render cache for the most recent visible output.

## Canonical Store

- Keep original transcript content as the source of truth.
- Store enough per-chunk or per-event state to re-render later.
- Preserve line boundaries and other metadata needed for scrolling and display changes.
- Support reformatting when settings change, such as timestamps, styles, or link preview behavior.
- Support pop-out of conversation threads into alternate UI panels and pop-in back to transcript lines.

## Hot Render Cache

- Cache rendered HTML only for the recent visible area.
- Keep at least two screens worth of current output, plus a small sliding buffer to support the user scrolling back and forth in history.
- Evict older rendered chunks as the user scrolls further back.
- Rebuild rendered output from canonical data when needed.

## Scrollback Strategy

- Keep recent history fast to display.
- Allow arbitrarily deep scrolling within the current session.
- Leave long-term persistence to a separate file-based history format later.
- Reload persisted history into memory at app startup, even if some rich details are lost.

## Longer-Term Flexibility

- Leave room for richer transcript features and storing calculated state per chunk.
- Use a transcript engine abstraction so the storage backend can change later. Storing scroll-back history to disk may be an option in the future for extended history support.
