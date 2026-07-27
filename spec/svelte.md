# Svelte Guidance

This document covers Svelte-specific code organization guidance for the frontend, independent of Tauri and independent of any particular app feature.

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
- Use the component folder for closely related helpers that would be awkward to discover elsewhere.
- Use the global `lib` folder for utilities that are clearly cross-cutting and not tied to one component family.

## Rule Of Thumb

If a piece of code describes how the UI looks or responds, keep it near the component.

If a piece of code describes how data is transformed, validated, measured, or shared, move it into `.ts`.

