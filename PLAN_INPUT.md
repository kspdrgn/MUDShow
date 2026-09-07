# Future Input and Prose Experience Plan

MUDShow should treat roleplay text as a draft that happens to be sent to a
world, rather than only as a long command. Future writing tools should remain
quiet, fast, reversible, and tolerant of intentional roleplay conventions.

The current input bars, multi-draft behavior, command history, transcript word
completion, and spellcheck behavior are specified in `spec/input.md` and are
not repeated here.

## Constraints

- Do not introduce special characters such as em dashes or typographic
  ellipses when preparing text for connected worlds.
- Do not draft replies from arbitrary transcript text.
- Writing assistance must not silently rewrite intentional fragments, dialect,
  fictional words, capitalization, or other roleplay conventions.
- Corrections and suggestions must be non-destructive, reversible, and
  compatible with plain-text world protocols.

## Future Work

### Safe text normalization

Provide optional, reversible corrections for common mechanical errors:

- Capitalize the first word of a sentence.
- Remove duplicate spaces.
- Normalize line endings.
- Normalize quotation marks only when supported by the world's character set.
- Trim accidental whitespace when sending.
- Warn about unsupported characters instead of silently replacing them.

Corrections should be configurable as automatic, suggest-only, or disabled.
They should occur at safe boundaries such as a space, newline, or send action,
and remain undoable with the normal undo shortcut.

### World-specific input translation and send preview

Some worlds may require escape sequences such as `%r` for newline or `%t` for
tab. Let users write natural multiline text while MUDShow translates it for
the destination world.

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

### Grammar and readability advice

Provide non-destructive annotations for likely issues such as run-on
sentences, missing punctuation between clauses, repeated punctuation or
spacing, unusually long sentences, and inconsistent quotation or apostrophe
usage. Warnings should be individually dismissible and should never assume
that every fragment or unusual construction is incorrect.

### Thesaurus and definition lookup

Extend the existing word context-menu workflow with optional lookup tools:

- Open a thesaurus or concise definition for the selected word or the word
  under the cursor.
- Group alternatives by tone or meaning where possible.
- Replace text only after an explicit user choice.
- Preserve capitalization and grammatical form where possible.
- Make replacement immediately undoable.

The intended workflow is:

`word warning -> definition -> thesaurus alternatives -> replace -> undo`

### Structured click-to-reply

Support replies only for recognized communication messages, not arbitrary
transcript lines.

- Add a reply affordance to page, whisper, and channel messages.
- Focus an existing input bar or open a new one.
- Insert the configured command prefix and sender name.
- Leave the cursor ready for the user's reply.
- Do not quote or automatically send the original message.
- Configure command templates per world, for example `page {sender}=`,
  `whisper {sender}=`, or `:{channel} `.

## Recommended Order

1. World-specific input translation with optional send preview.
2. Safe normalization with undo and suggest-only mode.
3. Repeated-word detection limited to the current user draft.
4. Thesaurus and definition lookup.
5. Grammar and readability annotations.
6. Configurable click-to-reply actions for recognized communication messages.

## Shared Design Direction

Build a draft-analysis layer that annotates input without changing it. Future
normalization, repetition detection, grammar advice, lookup tools, and
click-to-reply actions should share annotation, selection, dismissal, and
context-menu behavior. Configuration may be app-, world-, or
character-scoped where appropriate.
