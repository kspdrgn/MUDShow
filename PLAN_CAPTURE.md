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

## Echo and Look Capture

- An `echo` command can help mark the end of a manual `look` capture.
- The `echo` result should be treated as one signal, not the only source of truth.
- Output racing means the echoed text may not arrive directly after the intended response.
- Capture sessions should therefore consider multiple signals before deciding they are complete.

## Suggested Capture Model

- Open a capture session when the user initiates a look or similar inspect action.
- Send the look command.
- Use follow-up signals such as echo, prompt return, or quiet time to judge completion.
- Keep confidence or provenance on capture end decisions so later logic can revise them.
- Allow manual correction or future server-specific tuning when automatic capture is wrong.

## Long-Term Shape

- Keep the capture model separate from the raw transcript stream.
- Let interception feed the rich history schema rather than bypass it.
- Preserve room for later integrations like Echo, Name Awareness, and conversation breakout routing.

