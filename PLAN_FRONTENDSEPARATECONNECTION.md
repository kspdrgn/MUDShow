# Plan: Durable World Connections Across Frontend Reloads

## Objective

Keep active world connections alive when the frontend WebView:

- Hot-reloads.
- Fully reloads.
- Crashes and is recreated.
- Restarts independently while the Tauri process remains alive.

The connection should still terminate when the user explicitly disconnects, closes a world tab, exits the app, or the Tauri process itself terminates.

A native Tauri-process crash is out of scope for the first version. Surviving that would require moving the connection manager into a separate helper process or service.

## Current Architecture

The Rust backend already owns the real TCP/TLS connection:

```text
Rust/Tauri process
└── ConnectionManager
    └── connection_id → socket worker and channels

Frontend WebView
└── MudConnection
    └── event listener, tab state, transcript, UI
```

The backend currently lacks:

- Connection metadata.
- A way to list active connections.
- A way for a new frontend instance to attach.
- Event sequence numbers.
- Replay storage for events missed during reload.

The frontend currently calls `session.dispose()` during app cleanup, and container disposal closes connections. That behavior must be separated into “detach frontend” and “explicitly disconnect.”

## Phase 1: Define Connection Identity and Metadata

Extend the backend connection entry to retain:

```text
connection_id
session_id
world_id
character_id
host
port
tls
verify_certificate
connection_status
last_sequence
```

The backend should become authoritative for connection identity. Prefer generating opaque IDs in Rust rather than relying on frontend-generated values such as `connection-1`.

Example descriptor:

```ts
interface MudConnectionDescriptor {
  connectionId: string;
  sessionId: number;
  worldId: string;
  characterId: string | null;
  host: string;
  port: number;
  tls: boolean;
  verifyCertificate: boolean;
  status: 'connecting' | 'connected' | 'disconnected';
  lastSequence: number;
}
```

Keep the existing `(connection_id, session_id)` protection. It prevents an old worker from removing a newer connection that reused the same logical ID.

Relevant current code:

- `tauri/src/mud_backend.rs`, `ConnectionManager`
- `tauri/src/mud_backend.rs`, `ConnectionEntry`
- `tauri/src/mud_backend.rs`, `connect_mud`

## Phase 2: Add Backend Discovery Commands

Add Tauri commands:

```text
get_connection_runtime_id()
list_mud_connections()
get_mud_connection_events(connection_id, after_sequence)
```

The runtime ID identifies the current Tauri process. It should change whenever the native process starts and remain stable across WebView reloads.

`list_mud_connections()` lets a newly loaded frontend discover live connections without relying on old JavaScript state.

The frontend can resolve each returned `world_id` and `character_id` against freshly loaded application data. If the referenced world or character no longer exists, the frontend should show the connection as orphaned and offer to disconnect it.

## Phase 3: Add Sequence-Numbered Event Replay

Every backend-emitted event should include:

```ts
interface MudConnectionEvent {
  connectionId: string;
  sessionId: number;
  sequence: number;
  kind: 'opened' | 'raw' | 'data' | 'closed' | 'error';
  text?: string;
  reason?: string;
  message?: string;
}
```

Each connection keeps a bounded replay buffer, for example:

- Maximum 1,000 events, or
- Maximum 256 KB, whichever comes first.

The buffer should retain the already-normalized `data` events and raw debug events. It does not need to own transcript formatting, highlights, logging, or UI behavior.

The replay response should indicate whether the requested range is unavailable:

```ts
interface MudReplayResponse {
  events: MudConnectionEvent[];
  oldestSequence: number;
  newestSequence: number;
  hasGap: boolean;
}
```

If `hasGap` is true, the frontend should preserve the connection and add a visible diagnostic entry such as:

```text
[frontend reload missed earlier output]
```

The existing immediate Tauri event emission remains the live path. Replay only covers the gap while no frontend listener was attached.

## Phase 4: Separate Attach, Detach, and Disconnect

Update `frontend/src/lib/connection.ts` so its lifecycle has three distinct operations:

```ts
connect(target, handlers)
attach(connectionId, handlers)
detach()
close()
```

Semantics:

- `connect()` creates a new backend connection.
- `attach()` listens to an existing backend connection and requests replay.
- `detach()` removes frontend listeners but does not close the world connection.
- `close()` explicitly invokes `disconnect_mud`.

The current `connect()` calls `close()` before starting, which is correct for reconnecting but unsuitable for frontend recovery.

The frontend should install its event listener before calling `list_mud_connections()`. Then it can:

1. Subscribe to live events.
2. Discover backend connections.
3. Request replay from the last known sequence.
4. Deduplicate events by sequence number.
5. Rebuild the current world-session projection.

Events that arrive during replay are safe if the frontend ignores any sequence number it has already processed.

## Phase 5: Recover World Tabs

Add a recovery path to the session layer, separate from normal user-initiated connection.

Startup sequence:

```text
Frontend starts
  ↓
Load worlds, characters, and settings
  ↓
Install mud event listener
  ↓
List backend connections
  ↓
Match world/character metadata
  ↓
Recreate world tabs and session state
  ↓
Attach each MudConnection
  ↓
Replay missed events
```

Recovered tabs should restore only essential live state initially:

- World and character identity.
- Connection status.
- Connection ID.
- Transcript output received during the reload gap.
- Debug-console raw traffic.

It is reasonable to leave these as frontend-only state for the first version:

- Dockview layout.
- Scroll position.
- Input drafts.
- Input-bar sizing.
- Panel visibility.
- Temporary zoom state.

The existing “tabs are not restored between app sessions” rule remains valid because recovery is allowed only when the backend runtime ID matches the current Tauri process.

## Phase 6: Change Frontend Cleanup Behavior

The current registry disposes connections through the container cleanup path. Ordinary frontend teardown should instead detach listeners rather than close backend connections.

Explicit user actions must continue to call `close()`:

- Disconnect button.
- World-tab close confirmation.
- World or character deletion.
- Reconnect, which closes the old connection before opening a new one.

Native application shutdown should continue to call `disconnect_all()` from Rust. That remains the final owner-level cleanup path.

This distinction is essential for HMR: destroying and recreating a Svelte app must not be interpreted as the user closing a world session.

## Phase 7: Add Recovery Diagnostics

Add development diagnostics showing:

- Backend connection IDs.
- Runtime ID.
- Current frontend attachment state.
- Last received sequence.
- Replay-buffer range.
- Whether a replay gap occurred.

These diagnostics will distinguish:

- Socket loss.
- Tauri process restart.
- Frontend listener loss.
- Replay-buffer overflow.
- World/character metadata mismatch.

## Testing Matrix

The implementation should include automated backend tests for:

- Connection registration and replacement.
- Session-ID protection.
- Event sequence assignment.
- Replay-buffer trimming.
- Gap detection.
- Disconnect cleanup.

Manual or integration tests should cover:

1. Edit a child Svelte component while connected.
2. Force a complete frontend reload.
3. Modify `App.svelte` while connected.
4. Reload while the world is actively sending output.
5. Reload while no output is arriving.
6. Reload after the remote host disconnects.
7. Close a world tab and confirm the socket closes.
8. Reconnect and confirm the old socket is replaced.
9. Restart the WebView while the Tauri process remains alive.
10. Restart the Tauri process and confirm connections do not return.
11. Reload a popped-out surface without affecting the world connection.
12. Exceed the replay buffer and confirm a gap is reported.

## Recommended First Milestone

The smallest useful implementation is:

1. Add backend metadata and `list_mud_connections()`.
2. Add `detach()` and `attach()` to `MudConnection`.
3. Recover active connections on frontend startup.
4. Change frontend cleanup to detach instead of disconnect.
5. Add sequence numbers and a small replay buffer.

This should make full frontend reloads and most frontend crashes recoverable without moving transcript ownership or UI state into Rust.

## Future Option: Survive Native Process Crashes

If the requirement later expands to survive a complete Tauri-process crash, the current in-process `ConnectionManager` is insufficient. The socket workers would need to move into a separate connection broker process, with the Tauri app communicating with it over IPC.

That is a substantially larger system involving:

- Broker startup and shutdown.
- Authentication between app and broker.
- Process supervision.
- Broker version compatibility.
- Orphan cleanup and connection leases.
- IPC event replay.

It should remain a separate future project rather than being mixed into the frontend-reload migration.
