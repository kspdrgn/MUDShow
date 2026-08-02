# Plugin System Plan

## Rough Direction

- Treat plugins as a first-class extension layer for MU* world-specific behavior.
- Keep MUCK-specific logic in a separate project so the core app stays small and stable.
- Let the app expose a narrow, well-defined host API instead of giving plugins free rein over arbitrary windows or DOM.
- Start with a plugin model that supports inspection, routing, enrichment, and small UI surfaces before expanding into deeper automation.
- Favor declarative plugin definitions over handwritten code whenever possible.
- Make the common plugin path approachable for non-Rust developers.
- Reserve code-heavy plugins for cases where declarative rules cannot express the behavior or where performance needs justify it.

## Phase 0

- Build the first plugin inside this repository so the host and plugin can evolve together.
- Structure the work so it can be separated later without rewriting the core logic.
- Treat the initial plugin as the reference implementation for the plugin system.
- Prefer shared internal modules and clear boundaries over immediate packaging or distribution concerns.
- Keep the first plugin narrow enough that we can prove the shape of the API before generalizing it.

## Phase 0 Split Points

### Declarative Configuration

- Define the plugin’s behavior in data first.
- Use a manifest or config file for names, enabled hooks, matching rules, and UI declarations.
- Keep behavior that looks like a policy or rule in config rather than code whenever practical.

### Backend Support

- Put reusable parsing, matching, routing, and state management behind backend-facing helpers.
- Make the backend services usable by both the in-repo first plugin and future external plugins.
- Keep backend APIs stable and focused on text processing, event classification, and plugin-owned data.

### Frontend Support

- Provide host-owned UI surfaces that plugins can request or populate.
- Keep rendering, layout, and window management in the app.
- Make the frontend APIs generic enough to support future plugins without redesigning the whole view layer.

## Why This Exists

- Different worlds need different interpretation rules.
- Some worlds will want command interception, output routing, or entity tracking that should not live in core app code.
- A separate plugin project makes it easier to iterate on MUCK-specific behavior without tying every release to core app changes.
- A declarative-first model lowers the learning curve and keeps the plugin ecosystem maintainable by more people.

## Likely Core Plugin Jobs

- Inspect outgoing commands before they are sent.
- Inspect incoming output as it arrives.
- Classify or reroute output into alternate panes.
- Enrich world and character records with plugin-managed metadata.
- Expose narrow custom UI surfaces such as buttons, menus, tabs, and generated form controls.

## Authoring Tiers

### 1. Declarative Plugin Packs

- Best for the majority of MUCK integrations.
- Express behavior as config, rules, entity definitions, and UI descriptors.
- Use host-provided matching and routing instead of custom code.
- Should be the default recommendation for new plugin authors.

### 2. Scripted Plugins

- Use a lightweight scripting language such as JavaScript or Lua for small pieces of custom logic.
- Suitable for plugins that need stateful decisions or bespoke parsing that cannot be described cleanly with rules alone.
- Still rely on host-provided UI and storage surfaces.

### 3. Compiled Sidecar Plugins

- Use Rust or another compiled language only when the plugin needs heavy processing or specialized integration.
- Best for performance-sensitive parsing, large lookup tables, or more advanced data pipelines.
- Should remain an advanced option, not the normal path.

## App-Level Capabilities the Host Should Provide

- Input hooks.
- Output hooks.
- Tabbed subwindows inside a world UI.
- A host-owned plugin menu or launcher entry point.
- Small custom world controls such as shortcut buttons and dropdowns.
- Side panels for plugin-managed lists such as people, exits, places, or known names.
- Modular form-fill editors for world entities.
- Per-world and per-character plugin data storage.
- Plugin logging and diagnostics.
- Declarative matching and routing primitives that plugins can configure without reimplementing them.
- Shared regex and text-processing helpers so plugins do not need to ship their own parser core.

## Current Integration Seams Already Present

- Input submission is already isolated in the world session action layer.
- Incoming raw data, parsed transcript data, and status messages already flow through distinct paths.
- Per-world session state already tracks panel visibility, activity, logging, and connection status.
- Persistence already distinguishes app-wide data, world/character data, notes, triggers, and transcript history.
- The transcript renderer already has a central point for styling and routing output.

## Candidate Host API Areas

### 1. Input Pipeline

- Pre-submit hook for command interception.
- Post-submit hook for logging, capture, or telemetry.
- Optional command transform hook that can rewrite or suppress outgoing text.
- Optional command metadata hook so plugins can attach intent to a command without altering the visible text.

### 2. Output Pipeline

- Raw byte or raw text hook for low-level inspection.
- Line-oriented text hook after newline normalization.
- Parsed event hook for server-emitted semantic events, if available.
- Output classification hook for routing to a side panel, tab, or plugin-owned buffer.
- Styling hook for tagging text spans, lines, or blocks.

### 3. Session and World State

- Plugin-owned data attached to a world record.
- Plugin-owned data attached to a character record.
- Optional transient session state for one active tab.
- Change notification hooks when world, character, or connection context changes.

### 4. UI Surfaces

- Custom world controls in the main play header or toolbar.
- A plugin launcher that opens plugin-owned surfaces.
- Tabbed plugin panels within a world tab.
- Dockable side panels for entity lists or inspectors.
- Declarative form sections for plugin-driven editors.
- Routing from triggers or plugin logic into host-managed plugin views.

### 5. Persistence

- Per-world plugin settings.
- Per-character plugin settings.
- Plugin-managed caches or indices.
- Migration support when plugin data schemas change.

## Important Design Constraints

- Plugins should not own arbitrary native windows.
- Plugins should not directly manipulate the app layout outside approved host surfaces.
- The core app should remain usable even when a plugin fails or is missing.
- Plugin code should be optional and world-scoped where possible.
- Plugin behavior should be deterministic enough that users can trust what happened and why.
- The common plugin workflow should avoid requiring Rust unless the plugin truly needs compiled code.

## Data Categories to Separate

- Host app settings.
- World connection settings.
- Character settings.
- Plugin configuration.
- Plugin-derived indexes or caches.
- Plugin runtime state for the current session.

## Questions We Need to Answer

### Scope

- Are plugins global, world-specific, character-specific, or all three?
- Should a single plugin be able to support many worlds, or should each world pick one plugin set?
- Can multiple plugins attach to the same world at once?

### Runtime and Packaging

- What language will plugins use for the default path?
- Will plugins run in-process, out-of-process, or in a sandboxed worker?
- Will the plugin project be its own repo, or a package inside a monorepo?
- How will plugins be installed, updated, and version-checked?
- Should the default plugin format be declarative config, script, or sidecar?

### Host API Shape

- Are hooks synchronous, asynchronous, or both?
- Can plugins cancel an action, transform it, or only observe it?
- How are hook priorities and conflicts resolved?
- What data is safe to expose to plugin code?

### UI Contract

- Which UI pieces are fully declarative from plugins, and which are fixed host components?
- Are tabbed subwindows just labeled views, or can they host richer layouts?
- How much styling control do plugins get?

### Persistence

- Where does plugin data live?
- How are plugin-owned migrations handled?
- What happens when a plugin is removed or disabled?

### Safety

- What permissions do plugins need for network, filesystem, clipboard, or process access?
- Do plugins run with user trust only, or do we want any verification/signing story later?
- How should failures surface to the user?
- What fallback behavior should the app use if a plugin is missing its optional runtime?

## Suggested First Cut

- Start with declarative read-only hooks for output and metadata enrichment.
- Add declarative input interception next, including optional command rewriting or capture triggers.
- Add plugin-owned per-world storage after the hook model is stable.
- Add narrow UI slots last, once the host-side layout contract is clear.
- Defer general-purpose plugin scripting until the declarative host API has proven where it falls short.
- For phase 0, implement only the minimum API needed by the first plugin, but shape it so the same code can later be extracted into a separate plugin package.

## Relationship To Capture Work

- `PLAN_CAPTURE.md` should continue focusing on interpretation of raw world output as events.
- This plugin plan should focus on how that interpretation is packaged, hosted, and surfaced.
- Capture logic may become one plugin type rather than a special-case core feature.
- If capture can be expressed declaratively, it should stay declarative and use the host's matching engine.

## Next Steps

- Inventory the exact app events that should become plugin hooks.
- Decide whether plugins are world-scoped, character-scoped, or both.
- Decide the plugin runtime boundary and packaging model.
- Define the minimum UI surfaces the host will guarantee.
- Draft the plugin data schema and migration story.
