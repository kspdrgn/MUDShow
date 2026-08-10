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
- `"/"` is the property-directory separator.
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

### 4. Support property-name overrides

- Accept override definitions for character-side property names.
- Merge overrides with shared defaults rather than replacing the full map.
- Let world-specific plugins or world configuration provide the overrides.
- Keep the override surface focused on property naming only, not on broader world behavior.

## Candidate Data Model

### Player binding

- `worldId`
- `characterId`
- `playerObjectId` or equivalent backend handle
- `activeProfile`

### Cache

- `treeRoot`
- `treeVersion`
- `lastSyncAt`
- `dirtyPaths`
- `sourceRevision` or equivalent backend change marker if available

### Cached Node Shape

- Path: the full server path, such as `/prefs/`, `/redesc#`, or `/_/de`
- Type: `str`, `int`, `dir`, or another server-reported type
- Value: the node’s direct stored value, when present
- Has children: whether the node exposes child items
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
- `dir ...:(no value)` means a directory node with no direct value.
- `str ...:<value>` means a leaf value, even when the path includes a trailing `/` in the listing output.
- A `0 properties listed.` response means the path is missing or the listing returned nothing useful to cache.
- A numeric summary line such as `7 properties listed.` should be preserved as the response count for the listing.
- Version 1 will intentionally be simple and best-effort rather than request-scoped.
- Version 1 will not correlate request and response, and it will be possible to spoof property data with ordinary world output that happens to match the grammar.
- Version 1 cache updates will replace stored values with any new incoming property values that match the accepted grammar.
- Version 1 will not depend on `N properties listed.` for completeness checks or end-of-response detection.
- Version 1 capture is always active for the connection, and all incoming lines are eligible for inspection.
- Version 1 will only capture lines that match the known `dir` / `str` / `int` property output shapes and include a full property path.
- Version 1 will never capture the `N properties listed.` summary line.
- When the same property path appears again, the new node data replaces the old node data.
- If a child path arrives before a parent node has been seen, synthesize the missing parent as a `dir` node until an explicit node value is detected.
- Version 1 stores only the path, reported data type, and value text for captured nodes.
- Version 1 does not preserve the raw captured line in the displayed tree data.

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

### Version 2 Strategy (Later)

Version 2 of the capture system should move toward an expectation-based capture strategy:
  - Treat property data as expected only after sending, or after the user sends, an interrogation command such as `examine`, `exa`, or `ex` if it matches the pattern of a property interrogation.
  - Use that expectation to compare subsequent output against the requested path.
  - Check `... properties listed.` counts against the number of properties received before the summary line.

### Storage Debug View

- Provide a storage debug view for the active player’s property tree as the first visible proof of the shared storage layer.
- Show the cached tree shape, nodes, values, child relationships, and freshness state.
- Make it obvious when data is stale, partially loaded, or missing.
- Allow selection of individual tree nodes.
- Support copy-path and copy-value actions from the storage debug view.
- Root refresh should send `examine me=/`.
- Refreshing an individual node should send `examine me=<path>` for that node's path.
- Expanding a collapsed directory node should issue a non-recursive query for that node's contents.
- Use the storage debug view to validate the read, write, refresh, and cache behavior before higher-level MUCK plugins depend on it.

### Property path representation

- Use normalized string paths for now.
- Keep path handling explicit about:
  - root versus subtree
  - leaf value versus directory node
  - empty or cleared values
  - missing values

### Override map

- Use a named map of canonical meanings to server-specific property paths.
- Example canonical meanings:
  - description
  - inside description
  - success message
  - failure message
  - object success message
  - object failure message
  - drop message
  - object drop message

## Proposed API Surface

### Read operations

- `getProperty(path)`
- `getPropertyTree(path)`
- `listProperties(path)`
- `hasProperty(path)`

### Write operations

- `setProperty(path, value, type?)`
- `clearProperty(path)`
- `clearPropertyTree(path)`
- `replacePropertyTree(path, tree)`

### Cache operations

- `refreshPropertyCache()`
- `invalidatePropertyCache(path?)`
- `getCachedPropertyTree()`

### Override operations

- `setPropertyOverrides(overrides)`
- `mergePropertyOverrides(overrides)`
- `resetPropertyOverrides()`

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
