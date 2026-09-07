# Protocol Support and Data Pipeline

## Purpose

MUDShow must support the protocol traffic commonly used by MUD, MUSH, MUCK,
and MOO servers through one standard connection interface. Protocol handling
must be separate from transcript rendering so structured traffic can be
consumed by diagnostics, plugins, media features, and other data-pipeline
consumers without appearing as ordinary world text.

## Supported Protocol Families

The connection layer must support these traffic categories:

- Plain Telnet text and Telnet control commands.
- MCP (Mud Client Protocol) messages carried through the negotiated Telnet
  connection.
- GMCP (Generic MUD Communication Protocol) messages carried through Telnet
  subnegotiation.
- MCMP (Mud Client Media Protocol over GMCP) messages carried as GMCP
  packages.

The protocol layer must preserve unknown or unsupported Telnet and
subnegotiation traffic as classified protocol events. It must not silently
reinterpret such traffic as transcript text or discard it before diagnostics
can observe it.

## Standard Connection Interface

Every active world connection must expose one versioned event interface for
incoming and outgoing traffic. The interface must provide, at minimum:

- Connection lifecycle events.
- Raw byte events before protocol interpretation.
- Telnet negotiation and subnegotiation events.
- Plain text chunks and newline-delimited text events.
- MCP message events.
- GMCP package events.
- MCMP media events.
- Protocol errors, malformed-frame events, and unsupported-message events.

Each traffic event must include:

- The connection and world-session identity.
- The traffic direction: incoming or outgoing.
- A timestamp or ordering value sufficient to reconstruct traffic order.
- The protocol family and event type.
- The original payload, subject to configured size and privacy limits.
- The decoded representation when decoding succeeds.
- Parse status and an error description when decoding fails.

The interface must be transport-neutral. Consumers must not need to know
whether the connection uses plain TCP or TLS, or whether the backend is Rust,
TypeScript, or another implementation.

## Framing and Decoding

Protocol decoding must occur at the connection boundary before traffic is
distributed to higher-level consumers.

The decoder must be stateful across network reads. A frame split across two or
more TCP reads must produce the same event as an intact frame. The decoder
must also support multiple frames, text, and protocol messages in one read.

The decoder must:

- Preserve raw bytes before interpretation.
- Correctly handle Telnet escaping and command framing.
- Distinguish Telnet control traffic from printable text.
- Recognize MCP framing and message boundaries.
- Recognize GMCP package names and payloads.
- Recognize MCMP packages transported through GMCP.
- Preserve ordering between text and structured events.
- Flush or classify partial frames at disconnect rather than silently losing
  them.
- Reject or classify malformed input without terminating the connection unless
  the transport itself fails.

Plain text must be normalized for transcript display only after protocol
framing has completed. Carriage-return and newline handling must not corrupt
protocol payloads.

## Pipeline Routing

The normalized event stream must fan out to the following consumers:

- The debug console receives complete raw traffic and decoded protocol events,
  including negotiation, unsupported messages, and parse errors.
- The transcript receives printable world text only.
- Transcript history stores printable transcript content only.
- Session logging records the visible transcript only by default.
- Plugins may consume normalized protocol events and text events.
- Diagnostics may observe all events and report parser or negotiation state.
- Future media renderers may consume MCMP events without implementing protocol
  framing themselves.

Protocol control traffic must never be inserted into the ordinary transcript
unless an explicit diagnostic display mode is enabled. Structured protocol
events must not be reduced to strings merely because no current UI consumes
them.

Outgoing commands and protocol replies must use the same interface. The
connection layer must identify whether outgoing traffic is ordinary user text,
automatic negotiation, or a protocol message.

## Negotiation and Capabilities

The connection layer must maintain per-connection protocol state, including
negotiated capabilities and enabled message families. It must support automatic
negotiation where required by the protocol and expose capability changes as
events.

World configuration must be able to select a protocol profile or explicitly
enable protocol families. Existing generic Telnet, FuzzBall, and Tapestries
world configurations must remain valid through storage migration.

Configuration must provide a safe fallback for servers that do not support a
requested protocol. Unsupported or declined capabilities must not prevent plain
text play unless the user has explicitly selected a mode that requires them.

## Plugin Interface

Plugins must consume the standard normalized interface rather than reading the
socket, parsing Telnet framing, or duplicating MCP, GMCP, or MCMP decoders.

The plugin contract must support, as applicable:

- Observing all normalized protocol events.
- Receiving typed MCP, GMCP, and MCMP events.
- Observing plain text lines after framing and newline normalization.
- Sending ordinary commands through the connection abstraction.
- Sending protocol messages through a typed or explicitly classified method.
- Receiving capability and connection lifecycle changes.

Plugin failures must be isolated from transport decoding and transcript
display. A plugin that cannot parse or handle a message must not prevent other
consumers from receiving it.

## MCMP Media Handling

MCMP traffic must be treated as structured media data, not ordinary transcript
text. The application must validate media metadata and enforce configurable
limits before handing media to a renderer or cache.

The implementation must define policies for:

- Permitted media types.
- Maximum metadata and payload sizes.
- Remote URI handling.
- Inline or encoded payload handling.
- Preview and rendering behavior when media is unsupported.
- Whether media is disabled, metadata-only, or enabled per world.

MCMP payloads must not cause unsolicited filesystem writes, native application
launches, or unrestricted resource loading. Session logs must record media
metadata or a safe placeholder rather than binary payloads by default.

## Diagnostics and Privacy

The debug console must make it possible to inspect protocol traffic when
troubleshooting a world. Diagnostics must distinguish raw bytes, decoded
payloads, transcript text, negotiation state, and parser errors.

Raw traffic and decoded protocol data are session-scoped diagnostic data. They
must not be persisted beyond existing debug-console or session-history policies
unless the user explicitly enables such persistence. Sensitive payloads must
follow the same user-visible diagnostics and logging controls as other session
content.

## Limits and Failure Behavior

The protocol layer must enforce bounded limits for:

- Buffered incomplete frames.
- Individual protocol frames.
- MCP, GMCP, and MCMP payloads.
- Nested or recursively decoded data where applicable.
- Diagnostic retention and event queue size.

When a limit is exceeded, the connection must emit a classified protocol error,
discard only the affected frame or bounded unit of data, and continue when safe.
The application must not allow malformed or hostile protocol traffic to cause
unbounded memory growth, UI freezes, or uncontrolled logging.

## Testing Requirements

Protocol support must include tests for:

- Frames split at every meaningful byte boundary.
- Multiple interleaved text and protocol messages.
- Telnet escaping and negotiation responses.
- MCP message parsing and malformed messages.
- GMCP package parsing and malformed payloads.
- MCMP-over-GMCP decoding and media-policy enforcement.
- Unknown protocol commands and packages.
- Partial frames at disconnect.
- Size-limit and queue-limit behavior.
- Stable event ordering across all pipeline consumers.
- Transcript exclusion of control traffic.
- Debug-console visibility of raw and decoded traffic.
- Plugin failure isolation.
- Storage migration for existing world compatibility values.

Integration tests must use a controllable fixture server that can fragment,
combine, interleave, and delay protocol traffic independently of TCP read
boundaries.

## Specification Boundary

This document defines the required behavior and consumer boundaries. It does
not prescribe a particular parser library, serialization format, backend
language, media renderer, or plugin packaging mechanism. Those implementation
choices must preserve the versioned event contract and routing rules defined
here.
