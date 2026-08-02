# Svelte Guidance

This document covers Svelte-specific code organization guidance for the frontend, independent of Tauri and independent of any particular app feature.

## Service Boundaries

Keep the top-level app shell thin. It should coordinate tabs, settings, persistence, and app-wide shortcuts, while feature-focused service modules own the behavior for distinct areas such as tabs, app settings, triggers, and world-tab interactions.

Use `.svelte` components for the view layer and immediate event wiring, and move stateful workflows into `.ts` modules when:

- the logic is shared across multiple components
- the logic spans multiple tabs or survives rerenders
- the logic is easier to reason about as a named service boundary
- the logic would otherwise force lots of callback plumbing through the component tree

Examples of the kind of split this guide supports:

- app-shell coordination in `session.ts`
- tab and world-tab behavior in a dedicated tab service module
- app settings state and flags in a dedicated settings service module
- world-scoped actions in feature-specific world service modules

## Keep In `.svelte`

- Markup and layout structure
- Props and events that define the component interface
- Local view state that only exists to drive the template
- Direct DOM refs, lifecycle hooks, and event wiring needed by the template
- Small one-off adapters that simply forward UI events to callbacks

## Split Into `.ts`

- Pure helper functions
- Validation, normalization, and formatting logic
- Derived state that can be computed without touching the template
- Reusable logic that is shared by multiple components
- Nontrivial async flows, request state machines, or drag/position math
- Anything that would be easier to test as plain TypeScript

## Where To Put Helper Files

- Put component-specific helpers in the same component folder as the `.svelte` file.
- Put shared helpers in the global `frontend/src/lib/` folder when they are used by multiple feature areas.
- Prefer names that match the component or feature they support, such as `play-width.ts`, `triggers-tree.ts`, or `style-settings.ts`.
- Prefer a service-style name when the helper owns feature state or a long-lived workflow, such as a tabs service, settings service, or world service.
- Use the component folder for closely related helpers that would be awkward to discover elsewhere.
- Use the global `lib` folder for utilities that are clearly cross-cutting and not tied to one component family.

## Rule Of Thumb

If a piece of code describes how the UI looks or responds, keep it near the component.

If a piece of code describes how data is transformed, validated, measured, or shared, move it into `.ts`.
