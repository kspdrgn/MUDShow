# Triggers

There are two classes of triggers implemented so far
- Highlights - Simple word matching to apply distinctive style in the output
- Rules - Complex regexp matching to fully control style or routing of output

Highlights and rules are persisted together in the `triggers` collection. Each trigger has a `type` field:
- `highlight` - Simple word or phrase matching.
- `rule` - Regular expression matching.

The triggers tree has fixed bottom controls to add a new highlight or a new rule, and selecting either new item opens an unsaved draft in the editor pane.
New highlights and rules appear in the tree only after the editor is saved. Highlight, rule label, and rule pattern changes refresh the tree after the editor is saved.
Highlight type triggers are sorted above rule type triggers in the editor tree.

The triggers tree context menu supports copying selected highlight and rule triggers as JSON and pasting valid trigger JSON. Paste validates every item and imports only entries that match the current trigger schemas.

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

Highlights use the same editor layout model as rules: local draft changes, a fixed bottom delete/cancel/save action bar, action controls, and a match behavior section.
Highlight styling supports foregroundColor and backgroundColor.

Actions in the highlight and rule editors have a toggle control to enable or disable them. Any persisted actions are assumed to be active. Inactive actions should not be persisted.
Action controls use a compact responsive layout and should fit three controls per row when the editor pane is wide enough.

Action fields:
- foregroundColor
- backgroundColor
- opacity
