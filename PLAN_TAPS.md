# Tapestries Plugin Plan

## Purpose

- Define the first in-repo plugin for Tapestries MUCK, also called Taps.
- Keep the plan focused on what is specific to Taps versus what belongs to the generic plugin system.
- Use the simulated Tapestries server in `C:\_\_projects\SomeMUDClientTestServer\Server` as the primary development target while shaping features. Not all planned features are supported by the simulator.
- Build the plugin so the Taps-specific logic can later be separated from the host app without changing the user-facing behavior.

## General Taps Definitions

### Taps World Concepts

- Taps is a world with its own custom commands, status displays, character attributes, and formatting conventions.
- Some Taps features are stateful, meaning the app may need to query the server for current values before rendering the UI.
- Some Taps features are editable, meaning the app needs to present forms or selectors that reflect the currently active character state.
- Some Taps features are lists or panels that summarize server-managed state rather than freeform transcript text.

### Known Taps Properties

#### Character Dictionary Model

- Each character has a dictionary-like tree of folders and properties that the player can edit.
- All character-specific data is exposed through that character dictionary.
- The root folder can be read with `exa me=/`, which lists all root folders and properties and a total count of everything listed.
- Individual properties can be read with `exa me=<path>`, such as `exa me=/_/de` for the root description.
- Character property paths should be treated as full paths inside the character dictionary, not as loose text labels.
- The plugin backend should parse property responses into structured folder and value records where possible.
- The app should treat `str` lines as string values and `dir` lines as folders when reading character dictionary output.
- The plugin should be able to refresh or cache dictionary data so editors and lists can stay in sync with the server.
- A property name is the name of any data item stored in the character, and may hold its own value as well as child items.
- A property with no direct value but with child items is shown as `dir <path>:(no value)`.
- A property with a direct value and child items may still report as `str`, with the value representing the property's own stored data.
- The trailing slash in a path can indicate that the query is asking for child items beneath that node.

Property response format:

- `str <path>:<value>` means a single string property.
- `dir <path>:(no value)` means a folder or directory node.
- `<path>` is the full path into the character dictionary.

Examples:

- `exa me=/redesc#` can return `str /redesc#/:5`, meaning the parent property stores the value `5` and contains child items.
- `exa me=/prefs` can return `dir /prefs/:(no value)`, meaning `/prefs` has child items but no direct value of its own.
- `exa me=/prefs/` can list child properties such as `str /prefs/leash:24` and `str /prefs/leashlock/:0`.

Set:

- Command: `@set me=<path>:<value>`
- Response:
  - `Property set.`

#### Lists, Eval, And Prop

- Taps also uses list properties as a structured form of character data.
- Lists are stored as directories containing multiple string properties, with each property representing one line of list content.
- By convention, list directories end with a hash symbol, such as `/redesc#`.
- When listed by `exa`, a list reports the number of lines it contains, for example `str /redesc#/:5`.
- The plugin should treat list-backed directories as ordered multi-line content rather than ordinary folders.
- The plugin backend should preserve line order when reading or writing list-backed data.
- Character descriptions may transclude properties or entire lists through MPI code that the server resolves before the final output is shown.
- A list path may expose both the parent node value and child line items, so the plugin should track the parent count separately from the line entries.

Examples:

- Property inclusion: `{eval:{prop:_/wingsdesc,{owner:this}}}` includes the string property `/_/wingsdesc` in the output.
- List inclusion: `{eval:{list:redesc}}` includes the content of `/redesc#`.
- Recursive inclusions: Within an {eval:...} block, any prop or list inclusions will be parsed. These inclusions may contain inclusions of their own, which do not require a separate {eval:...} since the outer eval is still active.

#### Ride Mode

- Ride mode is a string value.
- Known ride modes are `ride`, `hand`, `walk`, and `fly`.
- The plugin should treat ride mode as a server-owned value that the user can query and update through the app UI.
- The active ride mode should be displayed in the ride-mode selector when the plugin opens or refreshes state.

Get:

- Command: `exa me=/ride/_mode`
- Response format:
  - `str /ride/_mode:<rideMode>`
  - `1 property listed.`

Set:

- Command: `@set me=/ride/_mode:<rideMode>`
- Response:
  - `Property set.`

#### Self Description

- The character self-description is stored as a string property.
- The plugin should treat this as editable character state rather than plain transcript text.
- The description editor should initialize from the server value when possible.
- The description editor should use the same character dictionary property model as the rest of the editable character fields.

Get:

- Command: `exa me=/_/de`
- Response format:
  - `str /_/de:<description>`
  - `1 property listed.`

### Taps-Specific Data vs Plugin Integration

- Taps-specific data is the world meaning itself, such as ride mode, morphs, CInfo, WF, and WS.
- The app integration points of the plugin should be agnostic to the plugin itself, the core app code should support generic functions to support worlds and not just Tapestries.
- Plugin integration is how the app exposes that data through host-managed UI surfaces and backend helpers.
- The plugin should not own windows or layout code directly.
- The plugin should describe what it wants to show or edit, and the host should provide the actual UI capabilities.

## Taps Feature Groups

### Character State

- Ride mode
- Description and related character appearance fields
- CInfo
- Morph data
- Watch-for status
- Who-species status

### UI Surfaces

- Dropdown selector for active ride mode
- Description editor form
- Morph list panel
- Morph editor form
- WF side panel
- WS side panel
- CInfo editor form

## In-Memory Dictionary Cache

- The plugin should maintain an in-memory cache of the active character dictionary.
- The cache should be the shared source of truth for plugin behavior while the plugin is active.
- UI surfaces, query helpers, and declarative rules should all read from the same cached dictionary model.
- The cache should preserve the server’s path syntax so plugin configuration can reference paths exactly as the server presents them.
- Cached entries should represent both the node’s direct value and whether the node has child items.
- The cache should support folders, string properties, integer properties, list-backed nodes, and any other server-reported property types without flattening them too early.
- The cache should allow partial refreshes when only a subtree changes, but still support full reloads from `exa me=/` when needed.
- The cache should remember whether a node was queried as a direct property or as a child listing, since those can produce different server responses.

### Proposed Cached Node Shape

- Path: the full server path, such as `/prefs/`, `/redesc#`, or `/_/de`
- Type: `str`, `int`, `dir`, or another server-reported type
- Value: the node’s direct stored value, when present
- Has children: whether the node exposes child items
- Child keys: the names or paths of known child entries
- Source: whether the cache came from a direct `exa`, a subtree listing, or a follow-up property read
- Updated at: when the node was last refreshed

### Cache Behavior

- Root loads should start from `exa me=/` when the plugin needs a broad refresh.
- Child listing queries should populate subtree nodes without discarding the parent node’s own value.
- List-backed directories should keep the parent count and the ordered child entries together.
- For list-backed nodes, the line count is just the node’s string value, not a separate data item.
- Declarative rules should be able to match against cached node paths using the same syntax the server uses.
- Path references in plugin config should not need a separate translation layer if the server already exposes the path directly.
- The cache should be safe to reuse for UI rendering, server synchronization, and parsing decisions.

## Phase 1 First Step

- Build a dictionary debug view first.
- The debug view should show the cached character dictionary, including its shape, nodes, values, and child relationships.
- The debug view should present as a tree of properties and directories, allowing the user to see the hierarchical relationship of all the data.
- The debug view should make it obvious when data is stale, partially loaded, or missing.
- The debug view should be the first visible proof that the plugin can read Taps state, cache it, and expose it through the host UI.
- The debug view can later support richer editor and list flows once the cache model is proven.
- The debug view should allow selection of individual tree nodes.
- The debug view should support its own context menu on selected nodes, with options to copy the selected node path or the selected node value.

## Plugin Menu

- The plugin will need a menu entry or entry point so the user can open the dictionary debug view and other plugin surfaces.
- The menu should fit into the host-owned plugin UI model rather than becoming a separate window system.
- The menu location is not decided yet.
- Candidate placements include a world tab menu, a plugin submenu, a tab-bar menu item, or another host-controlled plugin launcher.
- The menu design should work with the planned tabbed subwindow model so plugin logic can route to reusable plugin-owned views.
- Global triggers or plugin routing logic should be able to send the user to the dictionary debug view from the menu or from other plugin actions.

## Tabbed Subwindows And Routing

- Some plugin surfaces will likely be better represented as tabbed subwindows instead of transient popups.
- The dictionary debug view may eventually live as one of those tabbed subwindows if it grows beyond a simple panel.
- Routing from triggers or plugin logic should open the correct plugin surface without requiring the plugin to manage layout directly.
- The host should own the mechanics of opening, focusing, closing, and switching between plugin subwindows.
- The host will have its own native tabbed subwindows to support routing output from global triggers.
- The existing 'notes' and 'debug console' panels may be relocated to the tabbed subwindow interface once ready.

## Planned Plugin Features

### Ride-Mode Selector

- Show the currently active ride mode.
- Allow the user to select a different active ride mode from a dropdown.
- Query the current mode from the server or from the most recently known plugin state.
- Keep the selector synced with Taps state so it reflects server-side changes made elsewhere.
- Use the selected mode to affect how ride and carry-related messages are displayed.
- Support the four known ride modes by default: `ride`, `hand`, `walk`, and `fly`.
- Use the `exa me=/ride/_mode` query for loading the current value.
- Use `@set me=/ride/_mode:<rideMode>` for applying changes.

### Description Editor

- Allow the user to edit their currently active character description.
- Support editing related character attributes such as scent and custom message format.
- Show a form that reflects the current server-side values when the editor opens.
- Send updates through the plugin backend rather than requiring the user to manually type commands.
- Use `exa me=/_/de` to load the current self-description before editing.
- Treat the self-description as the primary source of truth for the description editor’s initial value.
- Keep room in the editor model for additional editable properties that may be discovered later.

### Morph List

- Show a list of available morphs for the active character.
- Display each morph as a named copy of the character’s description info.
- Allow the user to switch between morphs from the list.
- Keep the list in sync with known Taps state and any refresh or query actions the plugin performs.

### Morph Editor

- Allow the user to edit morph data directly.
- Support editing without forcing the user to switch their character to the morph first.
- Reuse the same editor concepts as the description editor where possible.
- Keep the form-based editing flow consistent with the rest of the plugin UI.

### WF List

- Show watch-for status in a dedicated side panel.
- Present it as a summary view rather than transcript text.
- Keep it readable at a glance and easy to refresh.

### WS List

- Show who-species status in a dedicated side panel.
- Display other characters in the current room.
- Include their species and idle information.
- Keep the list scannable because it is likely to update often.

### CInfo Editor

- Allow the user to edit character info through a form.
- Treat CInfo as a first-class editable Taps feature.
- Keep the editor host-managed, with plugin-supplied field definitions or field behavior where needed.

## Integration Notes

### Declarative First

- Prefer declarative definitions for Taps fields, panels, and selectors.
- Use config to declare which server values the plugin needs, which commands it uses, and which host surfaces it wants.
- Keep the first version narrow enough to prove the plugin model without overbuilding a generic Taps framework.

### Backend Support

- Add Taps-specific parsing and state extraction in backend-facing code.
- Centralize text matching for Taps messages so repeated parsing rules are not duplicated in the UI.
- Support querying, caching, and refreshing the Taps data that powers the selectors and lists.
- Make backend helpers reusable by future MUCK plugins that need similar state synchronization.
- Handle the distinction between ordinary properties, directories, list-backed directories, and MPI-expanded references.
- Track both a property's direct value and its child-item presence when parsing `exa` output.
- Expose the in-memory dictionary cache as a reusable backend service for selectors, editors, and declarative hooks.

### Frontend Support

- Use host-owned forms, dropdowns, lists, and side panels.
- Keep editor rendering in the app rather than in plugin code.
- Make each Taps surface open, close, and refresh in the same general way as other world panels.

## Suggested Initial Behavior

- Start with read-only support for the Taps state that can be queried safely.
- Start with the dictionary debug view so we can see the cache structure before building richer editors.
- Add the ride-mode selector early because it is a compact way to prove server sync and host UI plumbing.
- Add one editor flow early, most likely Description or CInfo, so we can validate form editing and save/apply handling.
- Add list panels after the editor path works, since they mainly prove ongoing synchronization and display.

## Open Questions

- Which Taps values can be queried directly, and which require command-based refreshes?
- Which features are safe to cache locally, and which should always be treated as server-authoritative?
- What is the minimum command set needed for the first round of Taps integrations?
- How should the plugin show stale data when the server response is delayed?
- Which fields in description, morphs, and CInfo should be editable in phase 1 versus later?
- Should WF and WS be auto-refreshing, manually refreshed, or both?

## Phase 0 Split Points For Taps

- Declarative configuration for Taps commands, queries, and UI declarations.
- Backend support for matching Taps output and maintaining the plugin’s view of current state.
- Frontend support for the selectors, editors, and side panels requested by Taps.
- A first plugin implementation that stays in-repo for now but can be split out later.

## Next Steps

- Define the exact Taps state model the plugin needs to track.
- Inventory the commands and output patterns the simulated Taps server exposes.
- Decide the first editor or list to build as the plugin proof-of-concept.
- Draft the host/plugin hook list for Taps before implementing UI details.
