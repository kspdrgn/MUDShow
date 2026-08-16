# World Tabs and Channels Plan

## Purpose

- Define the host-level channel system for world PlayScreens.
- Move channel lifecycle and state management into a shared controller service in the session/service layer.
- Keep `PlayScreen.svelte` as a thin view that renders the current channel state and forwards DOM events.
- Provide a shared UI surface that can be used by built-in app features and later plugins.
- Keep the host responsible for layout, routing, and channel management rather than letting features own arbitrary windows.

## Core Idea

- Each world PlayScreen can contain a set of channels.
- A channel represents one focused surface within the world tab.
- The host manages which channel is active, how it is routed to, and how it is rendered.
- A channel controller service in the shared service layer owns the lifecycle for channel registration, activation, hiding, closing, and tab-level metadata.
- `PlayScreen.svelte` should render controller state instead of storing channel lifecycle state itself.
- Only one channel may be visible at a time; opening one channel hides the others.
- Channels are not separate app tabs at the top level; they live inside the active world PlayScreen.

## Goals

- Move Notes out of the current toggle-only panel system and into a selectable channel.
- Move Debug Console out of the current toggle-only panel system and into a selectable channel.
- Move the channel bar, channel panel, and open/close logic into a controller service.
- Let the user switch between existing channels directly without needing menu shortcuts.
- Allow triggers to route content to one or more channels.
- Allow plugin logic to route content to one or more channels through the same host mechanism later.
- Allow plugin-owned systems to manage their own channel tabs through the controller API.
- Allow plugins to add small UI controls to the channel area, such as buttons, menus, and dropdown selectors, once the controller is stable.

## Non-Goals

- Do not let plugins create arbitrary native windows.
- Do not let plugins directly manage world layout structure.
- Do not replace the top-level tab bar with channels.
- Do not require every PlayScreen surface to become a channel if it does not benefit from that model.

## Host Responsibilities

- Create, show, hide, activate, and close world channels.
- Preserve channel state while the world tab remains open.
- Keep channel routing consistent for app features and later plugins.
- Expose a stable surface for plugin-provided controls in the channel header area.
- Keep the controller in control of which channel is open, which are registered, and whether the bar is pinned.
- Keep `PlayScreen.svelte` in control of DOM-specific work such as focus, hover detection, resize handling, and layout clamping.

## Candidate Channel Types

### Notes

- A selectable notes channel replaces the current notes toggle panel.
- The notes view remains world or character scoped as it is today.
- The user can switch to Notes directly from the channel strip.

### Debug Console

- A selectable debug console channel replaces the current debug console toggle panel.
- The console continues to show raw incoming data, outgoing commands, and status messages.
- The user can open it directly from the channel strip.

## Routing Model

- The controller should support routing content to a specific channel by name or identifier.
- A single event may route to one or more channels when appropriate.
- Route sources can include built-in app features, arbitrary triggers, plugin logic, and manual user actions.
- The routing system should not depend on plugins existing.
- Plugins should be able to use the same routing path as host features, so there is one channel model instead of several overlapping ones.
- Routing behavior for future image/link channels should be governed by app settings if those channels are added later.

## UI Model

- World channels should live in the PlayScreen near the transcript and input areas.
- The channel area should allow small controls from plugins in addition to tab labels.
- The channel UI should support:
  - text labels
  - icons or badges where useful
  - buttons
  - dropdown selectors
  - compact menus
- The host should decide how the channel area collapses or wraps on smaller windows.
- The UI should make it obvious when routed content is being shown in a special channel such as images or links.

## Notes Migration

- Notes now live in the world channel area as a built-in channel.
- The migration keeps the same stored notes data and spellcheck editor behavior.
- The content model for notes should remain stable during the UI migration.
- Existing notes shortcuts remain as a way to focus the Notes channel.

## Debug Console Migration

- The debug console now lives in the world channel area as the first built-in channel.
- The migration keeps the same rolling debug stream and existing debug shortcuts.
- The console still shows the same data categories, just through the channel shell instead of the old standalone panel.

## Controller Migration

- Extract the current channel lifecycle logic from `PlayScreen.svelte` into a controller service.
- Let the controller own channel registration, visibility, active tab selection, and close/hide behavior.
- Keep the PlayScreen responsible for rendering the controller state and relaying UI events.
- Preserve the current bar/panel interaction model while moving the state machine out of the component.
- Keep the controller generic enough to support future built-in channels and later plugin-provided channels.
- Put the controller in the shared service layer so plugin-owned systems can call it directly without reaching into `PlayScreen.svelte`.

## Plugin Surface

- Plugins should be able to contribute controls to the channel header area.
- Plugin controls should be small and host-rendered, not freeform DOM.
- Plugins should be able to request routing to one or more channels.
- Plugins should be able to manage their own channel tabs through the controller API without knowing layout internals.

## Data Model Questions

- Which channel state should live in the controller service versus in world session state?
- Should the controller be per world tab, per world session key, or both?
- Which channels are persistent while the world tab stays open, and which are transient?
- How should routing behave when multiple targets are valid?
- How should the host represent a channel that has no current content but may receive routed content later?

## Suggested First Cut

- Introduce a controller service that owns channel lifecycle and state.
- Move Notes and Debug Console control flow into the controller first.
- Keep `PlayScreen.svelte` as a render target for controller state, not the owner of the state machine.
- Remove the old fixed-panel assumptions from channel toggling once the controller is in place.
- Make the controller available through the shared DI/session service layer so plugin-owned systems can register and manage their own tabs later.
- Add plugin header controls only after the controller and view split is stable.

## Relationship To Plugins

- `PLAN_PLUGIN.md` should continue defining the plugin system itself.
- `PLAN_TAPS.md` should continue focusing on the Taps plugin that will eventually use these host surfaces.
- This plan defines the app-level world channel host and its controller service that both built-in features and plugins can use.
- Trigger routing and plugin routing should share the same host mechanism so the user experiences one coherent system.

## Next Steps

- Define the controller API and the state it owns.
- Extract the channel state machine out of `PlayScreen.svelte`.
- Move Notes and Debug Console lifecycle handling into the controller.
- Remove leftover fixed-panel assumptions from the PlayScreen channel logic.
- Update the spec if the controller split changes any user-visible behavior.
