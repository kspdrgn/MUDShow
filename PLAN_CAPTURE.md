# Capture and Interception Plan

## Rough Direction

- Treat transcript interception as a first-class part of the rich history model.
- Keep capture entirely in memory for now.
- Make capture sessions tentative until they stabilize.
- Avoid relying on a single hard end marker for captured output.

## Entity Mentions

- Known character names are a strong fit for interception because they are usually consistent in display.
- The history model should be able to store entity mentions separately from plain transcript text.
- Mention records should be useful for routing, styling, autocomplete, and later breakout views.

## Harder Boundaries

- Places are harder to capture because descriptions and naming do not always have reliable start and end markers.
- Character descriptions have the same problem when output continues after a description-like block.
- The capture system should support uncertain boundaries instead of assuming every block has a clean delimiter.

## Sentinel and Look Capture

- A world plugin or host capture service can send a unique sentinel token to the
  player's own world connection to mark the end of a manual `look` capture.
- The matching world response is a sentinel event, not ordinary user-authored
  world output. It may be hidden from the visible transcript while remaining
  retained in the frontend's canonical local transcript/history store.
- Capture completion must not depend on backend replay of transcript history;
  the active client records the relevant events locally as they arrive.
- Sentinel matching must use a per-request token with sufficient uniqueness and
  must not assume that the response arrives immediately after the captured
  output.
- A sentinel is one signal, not the only source of truth. Capture sessions
  should combine it with prompt return, quiet time, protocol metadata, and
  capture-specific confidence/provenance.
- Worlds may transform, suppress, delay, or refuse the sentinel. Capture must
  define timeout, cancellation, and fallback behavior for those cases.

## MU Integration

Beyond just reading text, the client can facilitate sending commands or establishing triggers and formatting in the MU world to aid in parsing.
- Establishing the sentinel command or response format to use
- Establishing consistent formatting of incoming page/whisper
- Sending a sentinel after capture-producing inputs, with the scope of automatic
  injection still to be decided

## Suggested Capture Model

- Open a capture session when the user initiates a look or similar inspect action.
- Send the look command.
- Use follow-up signals such as a sentinel, prompt return, protocol event, or
  quiet time to judge completion.
- Keep confidence or provenance on capture end decisions so later logic can revise them.
- Allow manual correction or future server-specific tuning when automatic capture is wrong.

## Long-Term Shape

- Keep the capture model separate from the raw transcript stream.
- Let interception feed the rich history schema rather than bypass it.
- Preserve room for later integrations like Sentinel, Name Awareness, and
  conversation breakout routing.

## Sentinel Routing Decisions

- [ ] Decide whether sentinel requests are issued directly by world plugins or
  through a host-owned capture/sentinel service.
- [ ] Define the outgoing request and matching incoming event metadata,
  including request identity, token identity, capture identity, and ordering.
- [ ] Define whether a matched sentinel is stored as a normal classified
  transcript entry or as a distinct event linked to the originating request.
- [ ] Define default visibility for sentinel requests and responses in the main
  transcript, debug console, logs, channels, and structured plugin surfaces.
- [ ] Define timeout, cancellation, duplicate-match, collision, malformed-
  response, and unsupported-world behavior.

## Related Plans

- `PLAN_PROTOCOLS.md` defines the ordered normalized event stream in which
  sentinel requests and matching responses must remain identifiable.
- `PLAN_PLUGIN.md` defines the plugin capability and host boundary for issuing
  sentinels and receiving their classified results.
- `PLAN_CHANNELS.md` defines whether retained sentinel events may be published
  to conversation channels or remain capture-only.
- `PLAN_DI_WORLD_SESSION.md` covers session-scoped ownership if sentinel or
  capture services are registered in the world-session container.

