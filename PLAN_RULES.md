# Highlights and Rules Implementation Plan

This plan covers splitting the current highlight system into two distinct top-level concepts:

- `highlights` for simple word and phrase coloring
- `rules` for advanced regexp-based matching that can work at the line or multi-word span level

The goal is to keep simple highlights easy to add, edit, and reason about, while giving the new regexp system room to grow into line-aware transcript handling later.

## Intent

The current highlight feature should stay lightweight:

- it colors words or short phrases
- it does not change the meaning or context of the line
- it should remain the easiest thing in the app to add and edit

The new `rules` feature should be more powerful:

- it should support raw regexp matching
- it should work on whole lines or larger spans of transcript text
- it should support anchors, wildcards, and other advanced regexp features
- it should create a foundation for future transcript classification and routing

Future uses for `rules` may include:

- identifying direct messages and pulling them into separate tabs
- dimming system messages to reduce visual noise
- tagging transcript lines for later processing

## Current Repo Touch Points

Likely implementation areas in the current codebase:

- `frontend/src/lib/types.ts`
- `frontend/src/lib/storage.ts`
- `frontend/src/lib/formatting.ts`
- `frontend/src/lib/components/HighlightsPanel.svelte`
- `frontend/src/lib/components/Transcript.svelte`
- `frontend/src/lib/session.ts`
- `frontend/src/lib/session-playback-actions.ts`
- `frontend/src/lib/world-session.ts`
- `spec/spec.md`
- `spec/settings.md`
- `README.md`
- `WISHLIST.md`
- `tauri/src/storage.rs`

## Proposed Model

### `highlights`

Use this name for the existing feature.

Behavior:

- exact-ish word or phrase coloring
- simple match controls only
- fast to scan and easy to edit
- no line-level semantics

Recommended defaults:

- keep the existing color workflow
- keep case-sensitive and whole-word toggles if they still help the simple case
- keep the UI friction low

### `rules`

Use this name for the new advanced matching system.

Behavior:

- raw regexp patterns
- line-level or span-level matching
- more expressive matching control
- support for future transcript classification behavior

Recommended defaults:

- treat rules as advanced
- make the regexp nature explicit in the UI
- allow future rule metadata to describe how a match should be handled, not just what color to apply

## Storage Direction

The user wants both concepts stored top level for now, with a future option to move them into world or character scope.

Recommended storage shape:

- keep `highlights` at the top level
- keep `rules` at the top level
- leave room for later hierarchy without forcing it now

That suggests a storage model that can later be extended to something like:

- app-level `highlights` and `rules`
- world-level overrides or additions
- character-level overrides or additions

Important constraint:

- do not bake in a one-way schema that makes hierarchical storage hard later

## Suggested Work Order

### 1. Rename the concept in docs and code comments

- Update user-facing language so the current feature is called `highlights`.
- Reserve `rules` for the regexp system.
- Make sure the docs reflect the split clearly.

Checklist:

- [ ] Update `spec/spec.md` to distinguish `highlights` and `rules`.
- [ ] Update `spec/settings.md` to describe both top-level collections.
- [ ] Update `README.md` to describe the new split.
- [ ] Update `WISHLIST.md` wording if it still refers to “complex highlights”.

### 2. Split the data model

- Add a separate type for `rules`.
- Keep `highlights` as the simple color-rule type.
- Make storage serialize and deserialize both collections independently.

Checklist:

- [ ] Extend `frontend/src/lib/types.ts` with a `Rule` type.
- [ ] Update `frontend/src/lib/storage.ts` to persist `highlights` and `rules` separately.
- [ ] Update any schema migration or normalization logic.
- [ ] Keep old saves compatible if the current data only contains one highlight list.

### 3. Keep the existing highlight pipeline simple

- Preserve current text-color application for `highlights`.
- Keep the simple rule path easy to understand and low-risk.
- Avoid making the keyword system depend on the new regexp machinery.

Checklist:

- [ ] Keep the current `highlights` editor flow mostly intact.
- [ ] Keep simple matching fast and readable.
- [ ] Avoid adding regexp complexity to the simple highlight UI.

### 4. Add the new rules pipeline

- Create a separate match builder for `rules`.
- Apply rules at the raw transcript line or message level, not as a generic text decoration pass.
- Make the pipeline capable of later returning structured match metadata, not just HTML spans.

Checklist:

- [ ] Define how a rule match is represented.
- [ ] Decide whether the rule engine works on raw lines, parsed transcript entries, or both.
- [ ] Add support for anchors and multi-word matching.
- [ ] Ensure the rule system can evolve into routing or classification later.

### 5. Separate UI entry points

- Keep `highlights` in the easy, lightweight panel.
- Add a distinct UI for `rules`.
- Make the advanced system feel intentionally different so users do not confuse the two.

Checklist:

- [ ] Update the existing highlights panel label and help text.
- [ ] Add a new rules panel or editor.
- [ ] Keep the highlights form minimal.
- [ ] Provide a clearer warning or explanation for regexp syntax in the rules editor.

### 6. Wire transcript rendering and future transcript classification

- Preserve the current word-highlighting behavior for rendered text.
- Give `rules` a path to act earlier in the transcript lifecycle.
- Design the system so line-level handling can be added without rewriting the simple highlight flow.

Checklist:

- [ ] Keep text coloring separate from line classification.
- [ ] Decide where rule matches are attached to transcript data.
- [ ] Leave room for future transcript tabs or filtered views.

### 7. Plan for future hierarchy without implementing it yet

- Keep top-level storage first.
- Add a migration path in the design for world and character scoping later.
- Avoid naming or API choices that make scope layering awkward.

Checklist:

- [ ] Document the eventual hierarchy option in the spec or notes.
- [ ] Keep storage keys and types flexible enough for later nesting.
- [ ] Avoid hard-coding top-level-only assumptions into the UI copy.

## Risks

- Mixing the simple and advanced systems too early could make the current highlight UI harder to use.
- If regexp rules are exposed too directly, the common case may become more confusing instead of simpler.
- If the storage model is not split cleanly now, future world/character scoping will be harder to add.
- If rules are applied too late in rendering, line-level behaviors like dimming or tab routing will be difficult to support later.

## Recommended Decisions

1. Keep the current simple feature as `highlights`.
2. Name the advanced regexp system `rules`.
3. Store both at the top level for now.
4. Keep the simple highlight pipeline separate from the rule pipeline.
5. Design the rule system so it can later support line-level transcript handling.
6. Leave room for world-level and character-level storage later, but do not force that complexity into the first pass.

## Open Questions

1. Should `rules` initially be visible in the same panel as `highlights`, or should it get its own panel immediately?
2. Should `rules` match against raw server lines, parsed transcript lines, or a normalized transcript model?
3. Should the first version of `rules` only color matched text, or should it already carry metadata for future handling?
4. Should world and character scoping be designed now in the storage schema, or introduced only after the top-level split lands?

## Acceptance Criteria

- The current simple feature is clearly called `highlights`.
- The advanced regexp feature is clearly called `rules`.
- `highlights` continue to behave as easy word or phrase coloring.
- `rules` support regexp-based matching for more complex transcript cases.
- Both collections are stored separately at the top level.
- The codebase stays ready for later world-level or character-level scoping.

## Task Breakdown

### Phase 1: Lock the terminology

- Update all user-facing text so the existing feature is called `highlights`.
- Update all user-facing text so the new regexp system is called `rules`.
- Make sure the distinction is clear in the spec, README, and planning docs.

### Phase 2: Split the storage model

- Add a separate persisted collection for `rules`.
- Keep the existing `highlights` collection intact for the simple color use case.
- Update normalization and migration logic so old saves still load safely.

### Phase 3: Preserve the simple highlight path

- Keep the current highlight editor lightweight.
- Keep the current text-color application flow for highlights.
- Avoid pushing regexp complexity into the existing highlight workflow.

### Phase 4: Build the rules engine

- Define the rule data shape.
- Implement regexp matching for transcript lines or line-like units.
- Support advanced pattern features like anchors, wildcards, and multi-word matches.
- Leave hooks for future match metadata and transcript routing.

### Phase 5: Add the rules editor

- Create a separate UI for `rules`.
- Make the regexp nature of the feature obvious.
- Keep the highlight editor and rules editor visually and functionally distinct.
- Use a rules panel that is structurally similar to the highlights panel.
- Add controls in both panels to switch directly between `highlights` and `rules`.
- Present the rules panel as a summary list or table of existing rules and their behavior.
- Open a modal for creating and editing a rule instead of relying on inline editing.
- Put regexp helpers, a cheatsheet, and a live preview/test area in the modal.
- Reserve the modal for rule behavior controls such as classification, coloring, and routing.

### Phase 6: Connect rules to transcript handling

- Apply highlights only as text coloring.
- Apply rules in the earlier transcript processing path.
- Keep the architecture ready for future features like DM extraction and system-message dimming.

### Phase 7: Prepare for hierarchy later

- Keep top-level storage as the first step.
- Document how the same model could later move into world or character scope.
- Avoid hard-coding assumptions that would block future per-world or per-character ownership.

### Phase 8: Verify the end result

- Confirm simple highlights still work exactly as expected.
- Confirm rules can match advanced regexp patterns reliably.
- Confirm existing saves still load.
- Confirm the data model leaves room for future scoping changes.

## UI Plan

### Highlights Panel

The highlights panel stays the quick, low-friction place for simple word and phrase coloring.

Expected behavior:

- users add and edit highlight entries inline
- users can switch to the rules panel from here
- the panel stays compact and easy to scan

### Rules Panel

The rules panel should feel like the organized overview for more powerful matching logic.

Expected behavior:

- users see a summary list or table of all existing rules
- each row summarizes the rule pattern and its behavior
- each row makes it clear whether the rule colors text, classifies lines, routes output, or otherwise affects transcript handling
- users can switch back to highlights from here
- users open the edit modal from the list rather than editing everything inline

### Rule Edit Modal

The modal is the main interaction surface for complex rule editing.

Expected behavior:

- regexp input and validation
- regexp cheatsheet or syntax helper
- live preview of sample transcript text
- test input for trying patterns before saving
- behavior controls for classification, coloring, and routing
- save and cancel actions that feel deliberate rather than inline

### Navigation Flow

Recommended entry flow:

1. User opens the existing highlights panel.
2. User switches to the rules panel from a toggle or tab-like control.
3. User selects a rule or creates a new one.
4. User edits the rule in the modal.
5. User saves and returns to the rules summary list.

This keeps the simple highlight workflow intact while making the advanced rules feature feel intentionally separate.
