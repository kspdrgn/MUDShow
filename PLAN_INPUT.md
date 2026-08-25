# Input and Prose Experience Plan

MUDShow should treat roleplay text as a draft that happens to be sent to a
world, rather than only as a long command. The writing tools should remain
quiet, fast, reversible, and tolerant of intentional roleplay conventions.

## Existing input features

- Spellcheck with custom squiggle styles and spelling suggestions.
- Basic Tab completion for words that have appeared in the transcript.
- Input history with guards that preserve input text, including when an input
  bar is closed.
- Multiple input bars so users can work on several drafts at once.

## Constraints

- Do not introduce special characters such as em dashes or typographic
  ellipses. Connected worlds may accept only a basic character set.
- Do not draft replies from arbitrary transcript text.
- A future click-to-reply feature may support structured world communication
  such as pages, whispers, and channels.
- Writing assistance must not silently rewrite intentional fragments, dialect,
  fictional words, capitalization, or other roleplay conventions.

## Planned and promising features

### Safe text normalization

Provide optional, reversible corrections for common mechanical errors:

- Capitalize the first word of a sentence.
- Remove duplicate spaces.
- Normalize line endings.
- Normalize quotation marks only when supported by the world’s character set.
- Trim accidental whitespace when sending.
- Warn about unsupported characters instead of silently replacing them.

Corrections should be configurable as automatic, suggest-only, or disabled.
They should occur at safe boundaries such as a space, newline, or send action,
and must remain undoable with the normal undo shortcut.

### World-specific input translation and send preview

Some worlds may require escape sequences such as `%r` for newline or `%t` for
tab. The user should be able to write natural multiline text while MUDShow
translates it for the destination world.

- Configure newline, tab, and related translations per world.
- Show the exact encoded text in a send preview when useful.
- Display character and line counts.
- Warn when approaching a known world input limit.
- Keep the original draft unchanged after translation.

### Repeated-word highlighting

Advise users when their own prose repeats descriptive words too closely.

- Analyze only text entered by the user, not transcript text.
- Start with repeated non-stopwords rather than attempting full grammatical
  classification.
- Support a configurable distance, such as the current sentence or recent
  paragraph.
- Show nearby occurrences and a count.
- Offer thesaurus alternatives from the warning.
- Allow dismissing a warning for the current draft or permanently for a word.

Possible warning levels:

- Immediate repetition in one sentence.
- Repetition across nearby sentences.
- Frequent reuse throughout the current draft.

### Grammar and readability advice

Provide non-destructive annotations for likely issues such as:

- Run-on sentences.
- Missing punctuation between clauses.
- Repeated punctuation or spacing.
- Unusually long sentences.
- Inconsistent quotation or apostrophe usage.

Warnings should be individually dismissible and should never assume that every
fragment or unusual construction is incorrect.

### Thesaurus

Add thesaurus lookup to the existing word context-menu workflow.

- Open from a selected word or the word under the cursor.
- Group alternatives by tone or meaning where possible.
- Support a short definition alongside alternatives.
- Replace text only after an explicit user choice.
- Preserve capitalization when replacing a word.
- Preserve grammatical form where possible, such as replacing `walked` with
  another past-tense verb.
- Make replacement immediately undoable.

### Definition lookup

Allow users to look up a concise definition for the selected word. The lookup
should help distinguish near-synonyms before the user chooses a replacement.

Shared workflow:

`word warning -> definition -> thesaurus alternatives -> replace -> undo`

### Structured click-to-reply

Support replies only for recognized communication messages, not arbitrary
transcript lines.

- Add a reply affordance to page, whisper, and channel messages.
- Focus an existing input bar or open a new one.
- Insert the configured command prefix and sender name.
- Leave the cursor ready for the user’s reply.
- Do not quote or automatically send the original message.
- Configure command templates per world, for example:
  - `page {sender}=`
  - `whisper {sender}=`
  - `:{channel} `

## Recommended implementation order

1. World-specific input translation with optional send preview.
2. Safe normalization with undo and suggest-only mode.
3. Repeated-word detection limited to the current user draft.
4. Thesaurus and definition lookup.
5. Grammar and readability annotations.
6. Configurable click-to-reply actions for recognized communication messages.

## Shared design direction

Build a draft-analysis layer that annotates input without changing it. Spellcheck,
repetition detection, grammar advice, and future writing tools should share the
same annotation, selection, dismissal, and context-menu behavior.

All assistance should be:

- Non-destructive.
- Reversible.
- Fast enough to run while typing.
- Configurable per app, world, or character where appropriate.
- Compatible with plain-text world protocols.
