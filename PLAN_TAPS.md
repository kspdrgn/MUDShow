# Tapestries Plugin Plan

Current implemented behavior is specified in `spec/taps.md`, with generic
property behavior in `spec/fuzzball.md`. This plan tracks future Taps design
and implementation work; it is not the source of truth for behavior already
shipped.

## Purpose

- Define the first in-repo plugin for Tapestries MUCK, also called Taps.
- Keep the plan focused on what is specific to Taps versus what belongs to the generic plugin system.
- Assume Taps surfaces will live inside the host-managed world channel system described in `PLAN_CHANNELS.md` and `spec/channels.md`, rather than in separate plugin-owned windows.
- Use the simulated Tapestries server in `..\SomeMUDClientTestServer\Server` as the primary development target while shaping features. Not all planned features are supported by the simulator.
- Build the plugin so the Taps-specific logic can later be separated from the host app without changing the user-facing behavior.

## General Taps Definitions

### Taps World Concepts

- Taps is a world with its own custom commands, status displays, character attributes, and formatting conventions.
- Some Taps features are stateful, meaning the app may need to query the server for current values before rendering the UI.
- Some Taps features are editable, meaning the app needs to present forms or selectors that reflect the currently active character state.
- Some Taps features are lists or panels that summarize server-managed state rather than freeform transcript text.

### Known Taps Properties

#### Character Dictionary Model

- Taps character data should be treated as structured property-tree data, but the low-level property cache and property interface belong to the dedicated FuzzBall plugin described in `PLAN_FUZZBALL.md`.
- Taps-specific features should ask that shared plugin for reads, writes, refreshes, and shared property cache state instead of reimplementing property parsing directly.
- Taps should not duplicate the property-path syntax, response parsing rules, or command plumbing that the shared FuzzBall layer already owns.

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

Get: `examine me=/ride/_mode`

#### Self Description

- The character self-description is stored as a string property.
- The plugin should treat this as editable character state rather than plain transcript text.
- The description editor should initialize from the server value when possible.
- The description editor should use the same character dictionary property model as the rest of the editable character fields.

Get: `examine me=/_/de`

### Taps-Specific Data vs Plugin Integration

- Taps-specific data is the world meaning itself, such as ride mode, morphs, CInfo, WF, and WS.
- The app integration points of the plugin should be agnostic to the plugin itself, and the core app code should support generic functions for worlds rather than only Tapestries.
- Plugin integration is how the app exposes that data through host-managed UI surfaces and backend helpers.
- Taps expects to interface with a dedicated FuzzBall muck plugin for property cache and property interface access.
- Taps should consume the shared FuzzBall property cache and property interface rather than defining its own storage layer.
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

- Dropdown selector for active ride mode, shown as a compact channels-bar control
- Description editor form, hosted in a modal window with pop-out support
- Morph list panel, launched from the channels bar and hosted in a world channel or other host-managed surface as needed
- Morph editor form, hosted in a modal window with pop-out support
- WF side panel, hosted in a side channel
- WS side panel, hosted in a side channel
- CInfo editor form, hosted in a modal window with pop-out support

### Hosting Map

- Channels bar: shortcut buttons, menu controls, and other compact entry points for Taps
- Top channels: text-heavy Taps surfaces that benefit from a top-mounted world tab
- Side channels: compact list surfaces such as WF and WS
- Modal windows: mixed-data editors such as Description, Morph, and CInfo
- Pop out windows: modal integrations that the user wants to move outside the main app window
- The channels bar acts as the primary Taps menu, even when the destination surface lives somewhere else

### Channels Integration

- Taps should treat the host channel bar as the primary entry point for all plugin UI.
- Some Taps surfaces will be routed into top channels, but others will use side channels or modal windows instead.
- Taps plugin logic should request routing through the host’s shared channel and window model so it can coexist with Notes, Debug Console, and future routed surfaces.
- Any compact Taps controls that need to appear in the world chrome should remain small host-rendered controls, not full layouts owned by the plugin.

## Plugin Menu

- The channels bar is the main menu and primary entry point for Taps.
- The plugin will need shortcut buttons, dropdowns, and menu controls in the channels bar so the user can open Taps surfaces and other plugin surfaces.
- The menu should fit into the host-owned plugin UI model and route to the correct host-managed surface rather than becoming a separate window system.
- Candidate placements for the controls include a world tab menu area, a plugin submenu in the channels bar, a tab-bar menu item, or another host-controlled launcher.
- Global triggers or plugin routing logic should be able to send the user to any Taps surface from the channels bar or from other plugin actions.

## Channel Routing

- Some Taps surfaces will likely be better represented as channels instead of transient popups.
- Routing from triggers or plugin logic should open the correct Taps surface without requiring the plugin to manage layout directly.
- The host should own the mechanics of opening, focusing, closing, and switching between world channels.
- The existing Notes and Debug Console surfaces already use the channel shell, so Taps should follow the same pattern where it needs persistent world-visible UI.
- Any future tabbed-subwindow behavior should be treated as a host routing implementation detail, not a plugin-owned layout system.

## Planned Plugin Features

### Ride-Mode Selector

- Show the currently active ride mode.
- Allow the user to select a different active ride mode from a dropdown.
- Query the current mode from the server or from the most recently known plugin state.
- Keep the selector synced with Taps state so it reflects server-side changes made elsewhere.
- Use the selected mode to affect how ride and carry-related messages are displayed.
- Support the four known ride modes by default: `ride`, `hand`, `walk`, and `fly`.
- Use the `exa me=/ride/_mode` query for loading the current value through the shared FuzzBall property interface.
- Use `@set me=/ride/_mode:<rideMode>` for applying changes through the shared FuzzBall property interface.

### Description Editor

- Allow the user to edit their currently active character description.
- Support editing related character attributes such as scent and custom message format.
- Show a form that reflects the current server-side values when the editor opens.
- Send updates through the plugin backend rather than requiring the user to manually type commands.
- Use `exa me=/_/de` to load the current self-description through the shared FuzzBall property interface before editing.
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
- Prefer declarative definitions that describe what channel a surface should open in, when a surface should be routed, and which compact controls belong in the channel header area.
- Use config to declare which server values the plugin needs, which commands it uses, and which host surfaces it wants.
- Keep the first version narrow enough to prove the plugin model without overbuilding a generic Taps framework.

### Backend Support

- Add Taps-specific parsing and state extraction in backend-facing code.
- Centralize text matching for Taps messages so repeated parsing rules are not duplicated in the UI.
- Support querying and refreshing the Taps data that powers the selectors and lists through the shared FuzzBall property interface.
- Make backend helpers reusable by future MUCK plugins that need similar state synchronization.
- Handle the distinction between ordinary properties, directories, list-backed directories, and MPI-expanded references.
- Track both a property's direct value and its child-item presence when parsing `exa` output.
- Consume the shared property cache exposed by the FuzzBall plugin for selectors, editors, and declarative hooks.

### Frontend Support

- Use host-owned forms, dropdowns, lists, channel panels, and channel header controls.
- Keep editor rendering in the app rather than in plugin code.
- Make each Taps surface open, close, focus, and refresh in the same general way as other world channels.

## Suggested Initial Behavior

- Start with read-only support for the Taps state that can be queried safely.
- Add the ride-mode selector early because it is a compact way to prove server sync and host UI plumbing.
- Add one editor flow early, most likely Description or CInfo, so we can validate form editing and save/apply handling.
- Add list panels after the editor path works, since they mainly prove ongoing synchronization and display.

## Open Questions

- Which Taps values can be queried directly, and which require command-based refreshes?
- Which features should be read from the shared cache, and which should always be treated as server-authoritative?
- What is the minimum command set needed for the first round of Taps integrations?
- How should the plugin show stale data when the server response is delayed?
- Which fields in description, morphs, and CInfo should be editable in phase 1 versus later?
- Should WF and WS be auto-refreshing, manually refreshed, or both?

## Phase 0 Split Points For Taps

- Declarative configuration for Taps commands, queries, and UI declarations.
- Backend support for matching Taps output and maintaining the plugin’s view of current state.
- Frontend support for the selectors, editors, side panels, and channel routing requested by Taps.
- A first plugin implementation that stays in-repo for now but can be split out later.

## Next Steps

- Define the exact Taps state model the plugin needs to track.
- Inventory the commands and output patterns the simulated Taps server exposes.
- Decide which Taps surfaces should be assigned to which world channels first.
- Draft the host/plugin hook list for Taps before implementing UI details.
- Align the first editor with the channel shell so the initial proof-of-concept matches the new host model.
