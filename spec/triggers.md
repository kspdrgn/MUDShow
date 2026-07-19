# Triggers

There are two classes of triggers implemented so far
- Highlights - Simple word matching to apply distinctive style in the output
- Rules - Complex regexp matching to fully control style or routing of output

# Rules

Rules are matched against output text as it arrives. If there is a match, actions may be triggered such as changing the output style.

Regexp with match groups will apply actions only to the match groups, unless wholeLine applies.

These sections describe the storage schema of rules:

General fields:
- label - Organizational label, no functional logic.
- pattern - Regular expression to match. JavaScript regexp flavor.
- sampleText - Example text to test matching or not matching. This is saved to make editing complex rules easy and consistent.

Match behavior fields:
- wholeLine - Any match will apply its action to the entire line, not just the matched text
- caseSensitive - Controls the 'i' flag of regular expression to match case.

Actions in the rule editor have a toggle control to enable or disable them. Any rule actions that are persisted are assumed to be active. Inactive rule actions should not be persisted.

Action fields:
- foregroundColor
- backgroundColor
- opacity
