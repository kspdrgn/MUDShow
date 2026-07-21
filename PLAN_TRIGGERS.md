# Hierarchical Triggers Implementation Plan

This plan covers replacing separate `highlights` and `rules` storage with one hierarchical `triggers` model.

The new model treats highlights and rules as two trigger types:

- `highlight` triggers for simple word and phrase styling
- `rule` triggers for regexp-based styling and future trigger behavior

The goal is to let users manage triggers at app, world, and character scope from one tree, while keeping connected character evaluation predictable.

## Intent

Users should be able to organize triggers where they belong:

- app-wide triggers apply everywhere
- world triggers apply to every character in that world
- character triggers apply only to that character
- the default character cannot own triggers; shared defaults for a world belong to the world itself

Connected characters evaluate triggers in this order:

1. character triggers
2. world triggers
3. app triggers

This order means more specific settings get first chance to match and style output. Rule evaluation and highlight evaluation both use this owner priority. Rules are evaluated before highlights so matched rules can stop later rule evaluation or highlight evaluation with `stopOtherRules` or `stopHighlights`.

Conflicting highlight behavior is intentionally not further specified in this plan. Preserve current behavior and revisit only if real use shows a need.

## Storage Direction

Persist highlights and rules together under `triggers`.

Do not preserve the old `rules` and `highlights` storage keys. This is an intentional breaking storage change for this feature.

Recommended top-level database shape:

```json
{
  "schemaVersion": 4,
  "worlds": [],
  "characters": [],
  "triggers": [],
  "history": {},
  "notes": {},
  "style": {}
}
```

Recommended trigger ownership fields:

- `id` - Stable trigger id for selection, drag/drop, copy/paste, and editing.
- `type` - Either `highlight` or `rule`.
- `owner` - Scope where the trigger is stored.
- `owner.kind` - `app`, `world`, or `character`.
- `owner.worldId` - Present only for world-owned triggers.
- `owner.characterId` - Present only for character-owned triggers.

Recommended discriminated trigger shapes:

```ts
type TriggerOwner =
  | { kind: 'app' }
  | { kind: 'world'; worldId: string }
  | { kind: 'character'; characterId: string };

type HighlightTrigger = {
  id: string;
  type: 'highlight';
  owner: TriggerOwner;
  pattern: string;
  foregroundColor: string;
  backgroundColor: string;
  caseSensitive: boolean;
  wordBoundary: boolean;
};

type RuleTrigger = {
  id: string;
  type: 'rule';
  owner: TriggerOwner;
  label: string;
  pattern: string;
  foregroundColor?: string;
  backgroundColor?: string;
  opacity?: number;
  wholeLine: boolean;
  caseSensitive: boolean;
  stopOtherRules: boolean;
  stopHighlights: boolean;
  sampleText: string;
};

type Trigger = HighlightTrigger | RuleTrigger;
```

## Tree Model

The triggers editor tree should represent ownership directly.

Tree structure:

- app
  - app-owned highlight triggers
  - app-owned rule triggers
  - worlds
    - world-owned highlight triggers
    - world-owned rule triggers
    - characters
      - character-owned highlight triggers
      - character-owned rule triggers

The default character must not appear as a trigger owner target and must not own character-level triggers.

Display sorting within each owner:

1. highlights
2. rules

Within each type, preserve persisted order unless the user later gets explicit reorder controls.

When drag/drop transfers a trigger to a different owner, insert it at the end of the same-type group in the target owner unless a later explicit reorder feature changes this.

Worlds, characters, and `app` are selectable tree items. If selected, they should show actions that make sense for that owner. At minimum, selected owners should support paste and add actions that create triggers owned by that selected scope.

## Selection Behavior

The tree should support multiple selected items.

Selection rules:

- Plain click selects one item and clears the previous selection.
- CTRL-click toggles one item in the current selection.
- SHIFT-click selects the contiguous range between the anchor item and clicked item.
- The range is based on the visible flattened tree order.
- Selecting app, worlds, or characters is valid.
- Selected app, world, and character items participate in context actions even though they are not triggers.

Editor behavior:

- If exactly one trigger is selected, show its highlight or rule editor.
- If exactly one owner is selected, show an owner summary and owner-level actions.
- If multiple items are selected, show a compact multi-selection summary and available bulk actions.
- If the selection contains multiple triggers, copy should include all selected triggers.
- If the selection contains only owners, paste should target the most specific selected owner when there is one owner, and otherwise ask the user to choose a target in the UI before applying paste.

## Context Menu

The triggers tree should expose a context menu with:

- `copy as JSON`
- `paste JSON`

Context menu availability:

- `copy as JSON` is enabled when the selection contains at least one trigger.
- `paste JSON` is enabled when there is a clear target owner: app, a world, a character, or a trigger whose current owner can be used as the target.

Copy behavior:

- Copy the JSON definitions of all selected triggers.
- Do not include selected app, world, or character owner records in the copied JSON.
- Omit trigger `id` and `owner` from the copied JSON.
- Use a JSON string that can round-trip through the paste action.
- Prefer an array payload even when copying one trigger.

Recommended copy payload:

```json
[
  {
    "type": "highlight",
    "pattern": "example",
    "foregroundColor": "#f1c40f",
    "backgroundColor": "#000000",
    "caseSensitive": false,
    "wordBoundary": true
  }
]
```

Paste behavior:

- Parse the clipboard as JSON.
- Accept either one trigger object or an array of trigger objects.
- Validate each item against the current trigger schemas.
- Ignore any pasted `id` or `owner` fields.
- Create new ids for pasted triggers.
- Replace the owner with the paste target owner.
- Insert valid pasted highlights above valid pasted rules within the target owner group.
- Ignore invalid items and report how many were skipped.
- If no pasted items are valid, do not modify storage.
- If an app, world, or character owner is explicitly selected, use that owner as the paste target.
- If a trigger row is the paste target, use that trigger's current owner as the paste target.

## Drag And Drop

Users can drag individual trigger items in the tree.

Drag behavior:

- Only triggers are draggable in the first implementation.
- Dragging a trigger onto `app`, a world, or a character transfers ownership to that target.
- Transferring ownership also transfers persistence location because the owner field is the persistence location.
- Dragging a trigger onto another trigger should target that trigger's owner.
- Dragging multiple selected triggers can be added later; initial support can be one dragged trigger at a time.

Drop validation:

- app target sets owner to `{ kind: 'app' }`
- world target sets owner to `{ kind: 'world', worldId }`
- character target sets owner to `{ kind: 'character', characterId }`
- dropped triggers keep their `type`, editor fields, and id
- dropped triggers are appended to the same-type group in the target owner
- after drop, rebuild the tree and keep the moved trigger selected
- if the dragged trigger has unsaved editor changes, show the unsaved changes warning before moving it

## Dirty Editor Protection

Highlight and rule editors should track local dirty state.

When a trigger draft has unsaved changes, warn before any action would discard or replace that draft:

- selecting another tree row
- closing the triggers tab or editor surface
- deleting the selected trigger
- dragging the selected trigger to another owner
- any other action that would replace the active editor draft

The same warning should cover moving a trigger as part of drag/drop. The app should not silently transfer stale saved data while unsaved edits are visible.

## Evaluation

For a connected character, build the active trigger list from:

1. triggers owned by the connected character
2. triggers owned by the connected character's world
3. triggers owned by app

For each trigger type, preserve ownership priority and persisted order within each owner. The editor tree still displays highlights above rules for readability, but formatting may split the active trigger list by type.

Recommended selector:

```ts
function getTriggersForCharacter(
  triggers: Trigger[],
  character: CharacterRecord,
): Trigger[] {
  return [
    ...getOwnerTriggers(triggers, { kind: 'character', characterId: character.id }),
    ...getOwnerTriggers(triggers, { kind: 'world', worldId: character.worldId }),
    ...getOwnerTriggers(triggers, { kind: 'app' }),
  ];
}
```

Rendering can still split the active list into highlight and rule matchers internally if that keeps the formatting code simple. The persisted source of truth should remain `triggers`.

Rule stop controls:

- `stopOtherRules` stops evaluation of later rules when the rule matches.
- `stopHighlights` stops evaluation of highlights when the rule matches.
- Preserve current behavior for overlapping or conflicting highlights until a concrete need appears.

Formatter sequencing should evaluate rules before highlights so `stopHighlights` can suppress highlight application for input matched by a stopping rule. Connected characters must still receive the correct owner sources in character, world, app priority.

## Deletion Behavior

Deleting a world deletes its world-owned triggers and the character-owned triggers for all characters in that world.

Deleting a character deletes that character's character-owned triggers.

Delete confirmations should warn that contained triggers will be removed. The default character cannot own triggers, so there is no default-character trigger cleanup path.

## Current Repo Touch Points

Likely implementation areas:

- `frontend/src/lib/types.ts`
- `frontend/src/lib/storage.ts`
- `frontend/src/lib/formatting.ts`
- `frontend/src/lib/session-state.ts`
- `frontend/src/lib/session.ts`
- `frontend/src/lib/session-playback-actions.ts`
- `frontend/src/lib/components/settings/TriggersPane.svelte`
- `frontend/src/lib/components/settings/HighlightsPanel.svelte`
- `frontend/src/lib/components/settings/RuleEditorPanel.svelte`
- `frontend/src/lib/components/play/PlayScreen.svelte`
- `frontend/src/lib/components/play/Transcript.svelte`
- `spec/spec.md`
- `spec/settings.md`
- `spec/triggers.md`
- `tauri/src/storage.rs`

## Suggested Work Order

### 1. Update the spec

- Describe `triggers` as the canonical persisted collection.
- Document `type: 'highlight' | 'rule'`.
- Document app, world, and character ownership.
- Document that the default character cannot own triggers.
- Document connected character evaluation order.
- Document JSON copy/paste owner/id behavior.
- Document drag/drop ownership transfer.
- Document unsaved trigger editor warnings.
- Document rule stop controls.
- Document deletion cleanup for world-owned and character-owned triggers.
- Remove or replace claims that rules and highlights are persisted separately.

Checklist:

- [x] Update `spec/triggers.md`.
- [x] Update `spec/settings.md`.
- [x] Update `spec/spec.md`.
- [x] Update `spec/layout.md`.

### 2. Replace the data model

- Add `TriggerOwner`, `HighlightTrigger`, `RuleTrigger`, and `Trigger`.
- Remove app state that treats highlights and rules as separate source-of-truth collections.
- Keep draft types if they remain useful for the two editor panels.

Checklist:

- [ ] Update `frontend/src/lib/types.ts`.
- [ ] Add helpers for owner equality, owner labels, and owner-specific filtering.
- [ ] Add helpers for sorting triggers within an owner.
- [ ] Add rule fields `stopOtherRules` and `stopHighlights`.

### 3. Replace persistence

- Bump the storage schema version.
- Replace `highlights` and `rules` with `triggers` in persistent data.
- Remove old `HIGHLIGHT_KEY` and `RULE_KEY` webview storage as active storage.
- Update the Tauri default JSON seed.
- Do not migrate old `highlights` or `rules` keys unless a later decision changes the no-backwards-compatibility requirement.

Checklist:

- [ ] Update `PersistentData`.
- [ ] Add `normalizeTrigger`.
- [ ] Add type-specific normalization for highlight and rule triggers.
- [ ] Default missing `stopOtherRules` and `stopHighlights` to `false`.
- [ ] Add `loadTriggers` and `saveTriggers`.
- [ ] Replace `loadHighlights`, `saveHighlights`, `loadRules`, and `saveRules` call sites.
- [ ] Update `loadSessionData`.
- [ ] Update `tauri/src/storage.rs` default database JSON.

### 4. Refactor session state

- Store one `triggers` array in session state.
- Derive active character triggers when rendering a play tab.
- Keep the currently selected triggers context world/character ids for opening the triggers tab from world or character context menus.

Checklist:

- [ ] Replace state fields `highlights` and `rules` with `triggers`.
- [ ] Update save handlers to operate on trigger ids instead of array indexes.
- [ ] Keep editor drafts unsaved until save, as the current trigger editor does.

### 5. Rebuild the triggers tree

- Build a visible flattened tree with stable item ids.
- Render app, worlds, characters, and owned triggers in hierarchy.
- Display highlight triggers above rule triggers in every owner group.
- Use trigger ids rather than indexes for selection and editing.

Checklist:

- [ ] Add flattened tree item model.
- [ ] Add selected item set.
- [ ] Add selection anchor for SHIFT range selection.
- [ ] Exclude the default character from trigger owner targets.
- [ ] Implement click, CTRL-click, and SHIFT-click behavior.
- [ ] Add owner summary view.
- [ ] Add multi-selection summary view.

### 6. Add JSON copy and paste

- Add tree context menu.
- Serialize selected triggers to JSON.
- Parse JSON clipboard content into trigger candidates.
- Validate pasted items with the same schema normalization used by storage.
- Create new ids and assign the paste target owner.

Checklist:

- [ ] Implement `copy as JSON`.
- [ ] Implement `paste JSON`.
- [ ] Ignore pasted `id` and `owner` fields.
- [ ] Report skipped invalid pasted items.
- [ ] Add user-visible paste failure feedback.

### 7. Add drag ownership transfer

- Make trigger tree rows draggable.
- Accept drops on app, world, character, and trigger rows.
- Convert trigger-row drops into that trigger's owner.
- Persist the updated owner immediately.

Checklist:

- [ ] Add drag data for one trigger id.
- [ ] Add drop target detection.
- [ ] Update owner on drop.
- [ ] Append moved triggers to the target owner's same-type group.
- [ ] Keep selection stable after transfer.

### 8. Add dirty editor protection

- Track whether the active highlight or rule editor draft differs from saved trigger data.
- Show an unsaved changes warning before selection changes, closing, delete, drag/drop transfer, or other actions that would discard the draft.
- Continue the requested action only after the user confirms or saves/discards the draft.

Checklist:

- [ ] Track dirty trigger editor state.
- [ ] Add a reusable unsaved changes confirmation for trigger editors.
- [ ] Guard tree selection changes.
- [ ] Guard delete actions.
- [ ] Guard trigger drag/drop ownership transfer.

### 9. Update transcript evaluation

- Derive active triggers for each connected character.
- Split active triggers into highlight and rule lists only at the formatting boundary.
- Preserve existing highlight and rule rendering semantics unless explicitly changed.
- Honor rule `stopOtherRules` and `stopHighlights` controls when a rule matches.

Checklist:

- [ ] Add active trigger selector.
- [ ] Update `PlayScreen.svelte`.
- [ ] Update `Transcript.svelte`.
- [ ] Update formatting inputs to accept derived trigger lists or a unified trigger list.
- [ ] Implement `stopOtherRules`.
- [ ] Implement `stopHighlights`.

### 10. Verify behavior

- Confirm app-owned triggers still apply everywhere.
- Confirm world-owned triggers apply to every character in that world.
- Confirm character-owned triggers apply only to that character.
- Confirm the default character cannot own triggers.
- Confirm evaluation order is character, world, app.
- Confirm highlights display above rules in the tree.
- Confirm copy/paste round-trips valid trigger JSON.
- Confirm pasted `id` and `owner` fields are ignored.
- Confirm invalid pasted JSON does not corrupt storage.
- Confirm drag/drop changes ownership and persistence.
- Confirm dirty trigger edits warn before selection changes, close, delete, or drag/drop.
- Confirm deleting worlds and characters removes their contained triggers.
- Confirm `stopOtherRules` and `stopHighlights` alter evaluation as intended.

## Risks

- Index-based selection will become fragile once triggers can move between owners; trigger ids should replace indexes early.
- Context paste can be ambiguous when multiple owners are selected; the UI needs a clear target rule.
- Drag/drop can accidentally move triggers if drop affordances are too subtle; show owner targets clearly.
- Dirty editor handling needs to cover indirect loss of draft changes, including drag/drop and selection changes.
- Keeping separate `highlights` and `rules` arrays in session state too long will make hierarchy harder to reason about.
- Rule and highlight ordering affects visual output, so sorting needs to be deliberate and consistent between tree and evaluation.
- Rule stop controls can expose formatter ordering assumptions, so tests should cover rule/highlight interaction.

## Recommended Decisions

1. Use a single persisted `triggers` array.
2. Use `type` as the discriminator, not separate arrays.
3. Use `owner` as the persistence scope.
4. Use stable trigger ids for editing, selection, drag/drop, and copy/paste.
5. Display highlights above rules inside each owner.
6. Evaluate connected character triggers in character, world, app order.
7. Treat old `rules` and `highlights` storage as obsolete for this change.
8. Do not allow default-character trigger ownership.
9. Preserve current conflicting-highlight behavior for now.
10. Add rule-level `stopOtherRules` and `stopHighlights` controls.

## Acceptance Criteria

- The database persists triggers under `triggers`, not `rules` or `highlights`.
- Highlight and rule triggers are separated by a `type` field.
- App, world, and character ownership is represented in persisted trigger data.
- The default character cannot own triggers.
- The tree supports single selection, CTRL multi-selection, and SHIFT range selection.
- App, world, and character rows are selectable and expose valid actions.
- The context menu can copy selected trigger definitions as JSON.
- The context menu can paste valid trigger JSON into app, world, or character ownership.
- Pasted JSON ignores incoming ids and ownership.
- The user can drag an individual trigger to app, world, or character ownership.
- Dirty editor forms warn before unsaved changes are lost, including during drag/drop.
- Connected characters evaluate character triggers, then world triggers, then app triggers.
- Rules can stop later rule evaluation with `stopOtherRules`.
- Rules can stop highlight evaluation with `stopHighlights`.
- Deleting worlds and characters removes their contained triggers.
- The spec documents the final behavior.
