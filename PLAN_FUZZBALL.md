# FuzzBall Property Tree Plugin Plan

## Purpose

- Define a shared FuzzBall plugin layer for MUCK worlds that use FuzzBall-compatible property trees.
- Keep player-property access in one place so world-specific plugins can depend on it instead of reimplementing property parsing, caching, and read/write behavior.
- Focus this first pass on property trees and standard property access.
- Defer gender/pronoun handling for now.

## Working Assumptions

- The plugin represents one owned player character at a time.
- The plugin maintains a cache of that character’s property tree data.
- Dependent plugins can read and write player properties through this shared property interface and property cache.
- Some worlds may customize the names of character-side properties, so override data must be accepted from other plugins or world-specific configuration.
- The app-level integration shape is not decided yet.
- The mechanism other plugins will use to call this plugin is not decided yet.

## What We Know From Official FuzzBall Sources

### Property trees are hierarchical

- FuzzBall properties are stored in tree-like propdirs rather than a flat list.
- A property can hold a value and also contain children.
- `/` is the property-directory separator.
- `examine` can list a whole propdir, a single property, or a recursive subtree.

Source:
- [MUCK Reference Manual for FBMuck 6.00](https://www.fuzzball.org/docs/muckhelp.html)

### Player-side property access uses standard commands

- `@set me=property:value` sets a string property on the player’s own object.
- `@set me=property:` clears that property and any sub-properties under it.
- `@set me=:clear` removes all properties from the object.
- `@propset` supports typed writes, including `string`, `integer`, `float`, `dbref`, and `lock`.
- `@propset ... = erase:<property>` removes a property, including the subtree beneath it when appropriate.

Sources:
- [MUCK Reference Manual for FBMuck 6.00](https://www.fuzzball.org/docs/muckhelp.html)
- [MUCK Manual: Commands](https://www.fuzzball.org/docs/muckman/commands.html)

### Standard character-side properties exist, but may vary by world

- The manuals document several standard character-side fields implemented as properties.
- These include the common description and message-style fields used by player objects.
- Because worlds can customize or extend naming, the shared plugin should not hard-code only one canonical property map.

Sources:
- [MUCK Reference Manual for FBMuck 6.00](https://www.fuzzball.org/docs/muckhelp.html)
- [MUCK Manual: Commands](https://www.fuzzball.org/docs/muckman/commands.html)

## Proposed Plugin Responsibilities

### 1. Own one player context

- Track the currently selected FuzzBall player character.
- Treat that player as the root object for property reads and writes.
- Make the player identity explicit in plugin state so dependent plugins do not have to guess which character is active.

### 2. Maintain a property cache

- Cache property-tree data for the active player.
- Preserve hierarchy so callers can read both leaf values and directory-like branches.
- Cache enough structure to support:
  - single-property reads
  - subtree reads
  - property listings
  - targeted writes and clears
- Keep cache invalidation rules simple at first, then refine them once we know the app integration model.
- Treat the cache as the shared source of truth for dependent plugins while the FuzzBall layer is active.
- Keep the server’s path syntax intact so dependent plugins can reference paths exactly as the server presents them.
- Remember whether a node came from a direct property read or from a child listing, since those responses can differ.

### 3. Provide property interface APIs

- Expose a small property interface for reading a property value by tree path.
- Expose a subtree read API for propdir-style access.
- Expose a property interface for writing string and typed values.
- Expose a property delete/clear API.
- Expose a tree refresh API so dependent plugins can force a reload when needed.

### 4. Intercept chunked incoming world lines

- Scan every incoming world line for property data.
- Run the interception after the debug console has handled the raw data and after the world stream has already been split into line chunks.
- Run the interception before rendering decisions are made.
- Assume property data lines do not contain ANSI escapes or command characters.
- Keep version 1 capture always active for the connection instead of relying on any special request state.
- In future versions, property lines may be omitted from the Transcript while an explicit plugin request is actively expecting them, but user-requested property output should still display in the Transcript.

### 5. Maintain an in-memory session cache

- Keep the cache in the frontend.
- Key the cache by world id and character id.
- Use an empty character id for world-only connections.
- Scope the cache to the world tab session.
- Let the cache survive disconnect and reconnect actions.
- Destroy the cache when the world tab is closed.
- Do not persist the cache.

### 6. Provide a built-in tree-editor host window

- Host the tree editor inside the existing `WindowHost`.
- Treat the tree editor as built-in app UI rather than a separate plugin-owned window system.
- Allow the tree data to come from plugin code.
- Allow tree expansion behavior to be hooked by plugin code.
- Keep the initial version focused on the tree itself and omit a separate detail pane.
- Render tree node labels from plugin-provided data.
- Support individual node selection.
- Support a custom context menu for the selected node, with actions supplied by plugin code.
- Make the tree editor non-modal.
- Allow the tree editor to move within the app.
- Allow the tree editor to pop out into its own window.

### 7. Connect the debug storage view to the tree editor

- Populate the tree editor immediately from any property cache data already present in the session.
- If there is no cache data yet, request the root directory properties when the tree editor opens.
- Request child properties when a node is expanded.
- Update the tree view whenever the cache data changes.
- Keep the initial version read-only: view and query only, with no editing or writing.
- Include the node name, value type, and value or no-value state in the node labels.
- Provide context menu actions for copying the node path and copying the node value.

## Candidate Data Model

### Player binding

- `worldId`
- `characterId` or empty string for world-only connections
- `worldTabId`
- `playerObjectId` or equivalent backend handle
- `activeProfile`
- `cacheKey` or equivalent frontend lookup key

### Cache

- `treeRoot`
- `treeVersion`
- `lastSyncAt`
- `dirtyPaths`
- `sourceRevision` or equivalent backend change marker if available
- `isPersisted = false`
- `scope = world tab session`

### Cached Node Shape

- Path: the full server path, such as `/prefs/`, `/redesc#`, or `/_/de`
- Type: `str`, `int`, `dir`, or another server-reported type
- Value: the node’s direct stored value, when present
- Label: the display label provided to the tree editor
- Is directory: whether the node should render as an expandable branch
- Is value loaded: whether the node has an explicit captured value
- Is expanded: whether the node's children have been queried yet
- Child keys: the names or paths of known child entries
- Updated at: when the node was last refreshed

### Cache Behavior

- Root loads should start from `exa me=/` when a broad refresh is needed.
- Child listing queries should populate subtree nodes without discarding the parent node’s own value.
- List-backed directories should keep the parent count and the ordered child entries together.
- For list-backed nodes, the line count is part of the node value model rather than a separate data item.
- The cache should be safe to reuse for UI rendering, server synchronization, and parsing decisions.
- `examine` output should be treated as a node listing plus a terminal summary line, not as one flat property value.
- A listing can contain both `dir` nodes and `str` nodes in the same response.
- `dir /{path}/:(no value)` means a directory node with no direct value.
- `str /{path}/:{value}` means a directory node, the trailing `/` indicates there are child nodes.
- `str /{path}:(no value)` means a leaf value if the path does not include a trailing `/`.
- A `0 properties listed.` response means the path is missing or the listing returned nothing useful to cache.
- A numeric summary line such as `1 property listed.` or `7 properties listed.` is expected after every path request.
- Version 1 will intentionally be simple and best-effort rather than request-scoped.
- Version 1 will not correlate request and response, and it will be possible to spoof property data with ordinary world output that happens to match the grammar.
- Version 1 cache updates will replace stored values with any new incoming property values that match the accepted grammar.
- Version 1 will not depend on `N properties listed.` for completeness checks or end-of-response detection.
- Version 1 capture is always active for the connection, and all incoming lines are eligible for inspection.
- Version 1 will only capture lines that match the known `dir` / `str` / `int` property output shapes and include a full property path.
- Version 1 will never capture the `N properties listed.` summary line.
- When the same property path appears again, the new node data replaces the old node data.
- If a child path arrives before a parent node has been seen, synthesize the missing parent as a `dir` node until an explicit node value is detected.
- The cache nodes only store the path, reported data type, value text, and tree-state flags needed for display and expansion.
- The cache does not preserve the raw captured text from the server.

### Property Text Grammar

- Root example:
  - `dir /_/:(no value)`
  - `dir /_page/:(no value)`
  - `str /_scent:Smells like the dragons she lives with, of exercise and school and play.`
  - `dir /morph#/:(no value)`
  - `str /redesc#/:7`
  - `11 properties listed.`
- Missing-property example:
  - `0 properties listed.`
- Valueless-directory example:
  - `dir /morph#/:(no value)`
  - `1 property listed.`
- Directory-contents example:
  - `dir /morph#/boxers#/:(no value)`
  - `dir /morph#/pants#/:(no value)`
  - `2 properties listed.`
- Value-directory example:
  - `str /redesc#/:7`
  - `1 property listed.`
- Leaf value example:
  - `str /ride/_mode:walk`
  - `1 property listed.`
- Directory-children example:
  - `str /redesc#/1:    Kayol is a strange fox, an unusual wolf, and an even stranger jackal.`
  - `str /redesc#/7:    The wolf wears blue tinted goggles, sometimes pushed up onto his forehead's short natural headfur to reveal striking amber eyes.`
- For version 1 of capture, assume any line matching the `dir` / `str` / `int` property output shape can be captured into the property cache when it includes a full path.

### Cache Nodes Schema

- path - Full path to the node. Includes leading '/'. Normalized to remove trailing '/'.
- name - Name of this individual node, without any '/'.
- label - Display label built from the node name, type, and value text.
- isDir - True if the node is a directory branch.
- valueType - 'str', 'int', or 'none' based on reported node data type. 'dir' nodes have valueType of 'none'.
- value - Value stored as string. Undefined if valueType is 'none'.
- isValueLoaded - True if this node's value and type are known, false if this node has been assumed as an intermediate directory in a larger path.
- isExpanded - True if this node's children have been queried yet.
- children - Child nodes.

### Version 2 Capture Strategy (Later)

Version 2 of the capture system should move toward an expectation-based capture strategy:
  - Treat property data as expected only after sending, or after the user sends, an interrogation command such as `examine`, `exa`, or `ex` if it matches the pattern of a property interrogation.
  - Use that expectation to compare subsequent output against the requested path.
  - Check `... properties listed.` counts against the number of properties received before the summary line.

### Tree Editor Host Window

- The built-in tree editor should be hosted inside the existing `WindowHost`.
- The tree data should be supplied by plugin code.
- Expansion hooks should be provided by plugin code.
- The initial version should not include a separate detail pane.
- The tree should support individual node selection.
- The selected node should expose a plugin-defined context menu.
- The tree editor should be non-modal, movable within the app, and pop-out capable.

### Debug Storage View

- Provide a storage debug view for the active player’s property tree as the first visible proof of the shared storage layer.
- Show the cached tree shape, node labels, values, child relationships, and freshness state.
- Make it obvious when data is stale, partially loaded, or missing.
- Populate immediately from any property cache data already present in the session.
- If no cache data exists yet, request the root directory properties on open.
- Request child properties when a node is expanded.
- Update the tree view whenever cache data changes.
- Allow selection of individual tree nodes.
- Support copy-path and copy-value actions from the storage debug view.
- The initial version is query-only and does not support editing or writing.
- Node labels should include the node name, value type, and value or no-value state.
- The node context menu should expose copy-path and copy-value actions.
- Root refresh should send `examine me=/`.
- Refreshing an individual node should send `examine me=<path>` for that node's path.
- Expanding a collapsed directory node should issue a non-recursive query for that node's contents.
- Use the storage debug view to validate the read, write, refresh, and cache behavior before higher-level MUCK plugins depend on it.

## Proposed API Surface

### Read operations

- `get(path)`

### Write operations

- `setValue(path, value, type?)`
- `clearValue(path)`

## Integration Questions Still Open

- How does the FuzzBall plugin fit into the app surface?
- Is this a host plugin, a world plugin dependency, or both?
- How will other plugins call into this plugin’s API?
- Do we want sync calls, async calls, or both?
- How should the plugin signal cache freshness to dependents?
- Should reads always come from cache unless explicitly refreshed, or should some reads hit the backend directly?
- How should write confirmation work when the backend accepts a command but the tree is not immediately refreshed?
- Where should server-specific overrides live?
- How should the plugin behave if a world does not support a property-tree feature that a dependent plugin expects?

## Out of Scope For Now

- Gender and pronoun support.
- Pronoun substitution helpers.
- Any broader MUCK character UX outside property access.
- World-specific gameplay logic.
- UI design for the eventual plugin surface.

## Suggested First Implementation Slice

- Define the canonical property-tree data model.
- Define the override schema for character-side property names.
- Implement read-only tree caching for one owned player character.
- Add write and clear operations once read behavior is stable.
- Add a refresh/invalidation story once we know how the app will trigger backend updates.
- Build the storage debug view so the property interface can be exercised directly before Taps-specific features rely on it.
- Add the plugin-to-plugin access model after the API itself is stable enough to depend on.

## Notes From The Manuals

- Property trees are an actual first-class FuzzBall concept, not just a convenience wrapper.
- `@set` is the simplest player-side command path for property writes.
- `@propset` is the typed property path when the caller needs explicit value typing.
- `examine` is the natural read path for property trees and propdirs.
- The manuals describe a standard property layout, but the plugin should leave room for world-specific naming differences.

## Primary References

- [MUCK Reference Manual for FBMuck 6.00](https://www.fuzzball.org/docs/muckhelp.html)
- [MUCK Manual: Commands](https://www.fuzzball.org/docs/muckman/commands.html)
- [MUCK Manual: Contents](https://www.fuzzball.org/docs/muckman/)
