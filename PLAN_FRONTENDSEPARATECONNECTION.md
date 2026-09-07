# Durable World Connections Across Frontend Reloads

## Implemented milestone

- Rust owns connection identity, runtime identity, session IDs, and a bounded replay buffer.
- Every emitted connection event carries a session ID and monotonically increasing sequence.
- Frontend connections have separate `connect`, `attach`, `detach`, and `close` semantics.
- Frontend teardown detaches listeners instead of disconnecting sockets; explicit disconnect, tab close, reconnect, and native app exit still close them.
- A new frontend discovers backend connections, matches world/character metadata, recreates tabs, attaches listeners, replays missed text events, deduplicates live/replayed sequences, and shows a diagnostic when the replay buffer has a gap.

## Remaining work

- Add a versioned structured event contract for Telnet/MCP/GMCP/MCMP.
- Keep protocol negotiation and automatic protocol replies in the backend while detached.
- Add snapshot-based resynchronization for structured replay gaps.
- Add backend tests for replay trimming, session protection, attach ordering, and disconnect cleanup.
- Add a dedicated diagnostics surface for runtime ID, replay range, and session state.

Native-process crash survival is out of scope; it requires a separate broker process.
