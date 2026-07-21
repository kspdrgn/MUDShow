# Triggers

There are two classes of triggers implemented so far
- Highlights - Simple word matching to apply distinctive style in the output
- Rules - Complex regexp matching to fully control style or routing of output

Highlights and rules are persisted together in the `triggers` collection. Each trigger has a `type` field:
- `highlight` - Simple word or phrase matching.
- `rule` - Regular expression matching.

Each trigger also has an owner:
- `app` - Applies to every connected character.
- `world` - Applies to every connected character in that world.
- `character` - Applies only to that character.

World-only connections use world-owned and app-owned triggers. Shared triggers for a world belong to the world itself.

For a connected character, active triggers are evaluated from the most specific owner to the least specific owner:
1. character-owned triggers
2. world-owned triggers
3. app-owned triggers

Rule evaluation and highlight evaluation both use owner priority: character-owned triggers, then world-owned triggers, then app-owned triggers, with persisted order preserved within each owner and type. Rules are evaluated before highlights so matched rules can stop later rule evaluation or highlight evaluation. Matching continues through later owner levels and later triggers unless a rule explicitly stops later processing.

The triggers tree has fixed bottom controls to add a new highlight or a new rule, and selecting either new item opens an unsaved draft in the editor pane.
New highlights and rules appear in the tree only after the editor is saved. Highlight, rule label, and rule pattern changes refresh the tree after the editor is saved.
Highlight type triggers are displayed above rule type triggers in the editor tree for each owner. The tree shows app-owned triggers, then worlds, then each world's characters and owned triggers. App, world, and character rows are selectable owner rows. Selecting an owner row supports owner-level actions such as adding a trigger or pasting trigger JSON into that owner.

Only named characters are shown as character trigger owner targets.

The tree supports single selection, CTRL multi-selection of individual rows, and SHIFT range selection across the visible flattened tree rows. If exactly one trigger is selected, the corresponding editor is shown. If exactly one owner is selected, an owner summary and owner-level actions are shown. If multiple rows are selected, a multi-selection summary and valid bulk actions are shown.

The triggers tree context menu supports copying selected highlight and rule triggers as JSON and pasting valid trigger JSON. Copy includes only selected trigger definitions, not selected owner rows. Copied JSON omits ownership and ids. Paste validates every item and imports only entries that match the current trigger schemas. Pasted JSON may contain `id` or `owner` fields, but those fields are ignored. Pasted triggers receive new ids and the selected paste target owner. If the user explicitly selects an app, world, or character owner row and uses paste JSON, pasted triggers are inserted into that owner. If a trigger row is the paste target, pasted triggers are inserted into that trigger's owner.

The user can drag an individual trigger row in the tree. While dragging, the tree shows an insertion line between rows, including at the top or bottom of the visible list, instead of highlighting a row as the target. Dropping on an insertion line moves the trigger to the owner implied by that line and updates persisted ownership when the owner changes. A moved trigger keeps its id and trigger fields.

Within an owner, highlights are always displayed above rules. Dragging within the same trigger type reorders within that type. If a dragged trigger is moved across the highlight/rule display boundary, it is clamped to the nearest valid position for its own type in that owner. For example, dragging a rule upward into the highlight section places it at the top of that owner's rule group, because rules cannot display above highlights.

Insertion lines at owner boundaries use the row above the line as the owner context, unless the line is at the very top of an owner section. This prevents dropping at the end of one owner's trigger list from unexpectedly moving the trigger into the next world or character. Multiple-trigger drag can be added later.

If a trigger editor has unsaved changes and the user attempts to move away, close the editor, select something else, drag the trigger to a different owner, or otherwise lose the draft, the app shows an unsaved changes warning before discarding or replacing the dirty draft.

# Rules

Rules are matched against output text as it arrives. If there is a match, actions may be triggered such as changing the output style.

Regexp rules without wholeLine apply actions to capture groups when the pattern has explicit capture groups. For example, `not a match \((.*)\)` matches the whole phrase but applies its action only to the captured text inside the parentheses. If the pattern has no capture groups, the action applies to the text directly matched by the regexp as a whole. Regexp rules with wholeLine apply actions to the entire matching line regardless of capture groups or matched substring length.

These sections describe the schema fields of rule type triggers:

General fields:
- label - Organizational label, no functional logic.
- pattern - Regular expression to match. JavaScript regexp flavor.
- sampleText - Example text to test matching or not matching. This is saved to make editing complex rules easy and consistent.

The rules editor shows the saved test text with a labeled preview pane that highlights current regexp matches. Delete, cancel, and save controls stay in a fixed action bar at the bottom of the editor pane while the main rule editor content scrolls independently.

Match behavior fields:
- wholeLine - Any match will apply its action to the entire line, not just capture groups or the matched text
- caseSensitive - Controls the 'i' flag of regular expression to match case.
- stopOtherRules - When the rule matches, stop evaluating later rules for the current input.
- stopHighlights - When the rule matches, stop evaluating highlights for the current input.

Highlights use the same editor layout model as rules: local draft changes, a fixed bottom delete/cancel/save action bar, action controls, and a match behavior section.
Highlight styling supports foregroundColor and backgroundColor.

Actions in the highlight and rule editors have a toggle control to enable or disable them. Any persisted actions are assumed to be active. Inactive actions should not be persisted.
Action controls use a compact responsive layout and should fit three controls per row when the editor pane is wide enough.

Action fields:
- foregroundColor
- backgroundColor
- opacity
