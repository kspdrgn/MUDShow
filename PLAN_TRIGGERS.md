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

Connected characters evaluate triggers in this order:

1. character triggers
2. world triggers
3. app triggers

This order means more specific settings get first chance to match and style output. Unless a future rule action explicitly stops later processing, matching should continue through the ordered trigger list so existing layered styling behavior remains understandable.

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

Sorting within each owner:

1. highlights
2. rules

Within each type, preserve persisted order unless the user later gets explicit reorder controls.

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
- Create new ids for pasted triggers.
- Replace the owner with the paste target owner.
- Insert valid pasted highlights above valid pasted rules within the target owner group.
- Ignore invalid items and report how many were skipped.
- If no pasted items are valid, do not modify storage.

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
- after drop, rebuild the tree and keep the moved trigger selected

## Evaluation

For a connected character, build the active trigger list from:

1. triggers owned by the connected character
2. triggers owned by the connected character's world
3. triggers owned by app

For each ownership level, sort highlights above rules, matching the editor tree.

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
- Document connected character evaluation order.
- Remove or replace claims that rules and highlights are persisted separately.

Checklist:

- [ ] Update `spec/triggers.md`.
- [ ] Update `spec/settings.md`.
- [ ] Update `spec/spec.md`.

### 2. Replace the data model

- Add `TriggerOwner`, `HighlightTrigger`, `RuleTrigger`, and `Trigger`.
- Remove app state that treats highlights and rules as separate source-of-truth collections.
- Keep draft types if they remain useful for the two editor panels.

Checklist:

- [ ] Update `frontend/src/lib/types.ts`.
- [ ] Add helpers for owner equality, owner labels, and owner-specific filtering.
- [ ] Add helpers for sorting triggers within an owner.

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
- Sort highlight triggers above rule triggers in every owner group.
- Use trigger ids rather than indexes for selection and editing.

Checklist:

- [ ] Add flattened tree item model.
- [ ] Add selected item set.
- [ ] Add selection anchor for SHIFT range selection.
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
- [ ] Keep selection stable after transfer.

### 8. Update transcript evaluation

- Derive active triggers for each connected character.
- Split active triggers into highlight and rule lists only at the formatting boundary.
- Preserve existing highlight and rule rendering semantics unless explicitly changed.

Checklist:

- [ ] Add active trigger selector.
- [ ] Update `PlayScreen.svelte`.
- [ ] Update `Transcript.svelte`.
- [ ] Update formatting inputs to accept derived trigger lists or a unified trigger list.

### 9. Verify behavior

- Confirm app-owned triggers still apply everywhere.
- Confirm world-owned triggers apply to every character in that world.
- Confirm character-owned triggers apply only to that character.
- Confirm evaluation order is character, world, app.
- Confirm highlights sort above rules in the tree.
- Confirm copy/paste round-trips valid trigger JSON.
- Confirm invalid pasted JSON does not corrupt storage.
- Confirm drag/drop changes ownership and persistence.

## Risks

- Index-based selection will become fragile once triggers can move between owners; trigger ids should replace indexes early.
- Context paste can be ambiguous when multiple owners are selected; the UI needs a clear target rule.
- Drag/drop can accidentally move triggers if drop affordances are too subtle; show owner targets clearly.
- Keeping separate `highlights` and `rules` arrays in session state too long will make hierarchy harder to reason about.
- Rule and highlight ordering affects visual output, so sorting needs to be deliberate and consistent between tree and evaluation.

## Recommended Decisions

1. Use a single persisted `triggers` array.
2. Use `type` as the discriminator, not separate arrays.
3. Use `owner` as the persistence scope.
4. Use stable trigger ids for editing, selection, drag/drop, and copy/paste.
5. Sort highlights above rules inside each owner.
6. Evaluate connected character triggers in character, world, app order.
7. Treat old `rules` and `highlights` storage as obsolete for this change.

## Acceptance Criteria

- The database persists triggers under `triggers`, not `rules` or `highlights`.
- Highlight and rule triggers are separated by a `type` field.
- App, world, and character ownership is represented in persisted trigger data.
- The tree supports single selection, CTRL multi-selection, and SHIFT range selection.
- App, world, and character rows are selectable and expose valid actions.
- The context menu can copy selected trigger definitions as JSON.
- The context menu can paste valid trigger JSON into app, world, or character ownership.
- The user can drag an individual trigger to app, world, or character ownership.
- Connected characters evaluate character triggers, then world triggers, then app triggers.
- The spec documents the final behavior.
