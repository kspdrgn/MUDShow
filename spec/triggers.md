# Triggers

There are two classes of triggers implemented so far
- Highlights - Simple word matching to apply distinctive style in the output
- Rules - Complex regexp matching to fully control style or routing of output

The triggers tree has fixed bottom controls to add a new highlight or a new rule, and selecting either new item opens an unsaved draft in the editor pane.
New highlights and rules appear in the tree only after the editor is saved. Highlight, rule label, and rule pattern changes refresh the tree after the editor is saved.

# Rules

Rules are matched against output text as it arrives. If there is a match, actions may be triggered such as changing the output style.

Regexp with match groups will apply actions only to the match groups, unless wholeLine applies.

These sections describe the storage schema of rules:

General fields:
- label - Organizational label, no functional logic.
- pattern - Regular expression to match. JavaScript regexp flavor.
- sampleText - Example text to test matching or not matching. This is saved to make editing complex rules easy and consistent.

The rules editor shows the saved test text with a labeled preview pane that highlights current regexp matches. Delete, cancel, and save controls stay in a fixed action bar at the bottom of the editor pane while the main rule editor content scrolls independently.

Match behavior fields:
- wholeLine - Any match will apply its action to the entire line, not just the matched text
- caseSensitive - Controls the 'i' flag of regular expression to match case.

Highlights use the same editor layout model as rules: local draft changes, a fixed bottom delete/cancel/save action bar, action controls, and a match behavior section.
Highlight styling supports foregroundColor and backgroundColor.

Actions in the rule editor have a toggle control to enable or disable them. Any rule actions that are persisted are assumed to be active. Inactive rule actions should not be persisted.
Rule action controls use a compact responsive layout and should fit three controls per row when the editor pane is wide enough.

Action fields:
- foregroundColor
- backgroundColor
- opacity
