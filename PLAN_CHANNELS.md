# World Tabs and Channels Plan

## Purpose

- Define the host-level channel system for world PlayScreens.
- Replace the current tab-less panel model for world-specific surfaces with explicit channels.
- Provide a shared UI surface that can be used by built-in app features, triggers, and later plugins.
- Keep the host responsible for layout, routing, and channel management rather than letting plugins own arbitrary windows.

## Core Idea

- Each world PlayScreen can contain a set of channels.
- A channel represents one focused surface within the world tab.
- The host manages which channel is active, how it is routed to, and how it is rendered.
- Only one channel may be visible at a time; opening one channel hides the others.
- Channels are not separate app tabs at the top level; they live inside the active world PlayScreen.

## Goals

- Move Notes out of the current toggle-only panel system and into a selectable channel.
- Move Debug Console out of the current toggle-only panel system and into a selectable channel.
- Let the user switch between existing channels directly without needing menu shortcuts.
- Allow triggers to route content to one or more channels.
- Allow plugin logic to route content to one or more channels through the same host mechanism.
- Allow plugins to add small UI controls to the channel area, such as buttons, menus, and dropdown selectors.

## Non-Goals

- Do not let plugins create arbitrary native windows.
- Do not let plugins directly manage world layout structure.
- Do not replace the top-level tab bar with channels.
- Do not require every PlayScreen surface to become a channel if it does not benefit from that model.

## Host Responsibilities

- Create, show, hide, activate, and close world channels.
- Preserve channel state while the world tab remains open.
- Keep channel routing consistent for app features, triggers, and plugins.
- Expose a stable surface for plugin-provided controls in the channel header area.
- Ensure channels remain accessible by mouse and keyboard.
- Keep the host in control of focus, scroll restoration, and layout clamping.

## Candidate Channel Types

### Notes

- A selectable notes channel should replace the current notes toggle panel.
- The notes view should remain world or character scoped as it is today.
- The user should be able to switch to Notes directly from the channel strip.

### Debug Console

- A selectable debug console channel should replace the current debug console toggle panel.
- The console should continue to show raw incoming data, outgoing commands, and status messages.
- The user should be able to open it directly from the channel strip.

### Images

- Image previews may be routed into a dedicated images channel instead of only appearing inline in the transcript.
- The images channel should present preview content in a way that is easier to browse than the main transcript.
- The existing hide-preview control may need to become channel aware, because the user may want to hide an image preview in the transcript while still seeing it in the images channel or vice versa.
- The host should track image-preview visibility per presentation surface rather than assuming one global hide state.

### Links

- Clickable links may be routed into a dedicated links channel instead of only being opened in place.
- The links channel should make link-oriented content easier to review, inspect, or revisit.
- The host should preserve normal click behavior when link routing is disabled.
- Link routing should be optional and controlled by app settings.

### Future Built-In Channels

- Triggers or highlights views, if the host chooses to expose them as channels.
- Logging or inspection views, if those need direct subwindow access later.
- Any other built-in world surface that benefits from persistent in-world tabbing.

## Routing Model

- The host should support routing content to a specific channel by name or identifier.
- A single event may route to one or more channels when appropriate.
- Route sources can include:
  - built-in app features
  - arbitrary triggers
- plugin logic
- manual user actions
- The routing system should not depend on plugins existing.
- Plugins should be able to use the same routing path as host features, so there is one channel model instead of several overlapping ones.
- Routing behavior for images and links should be governed by app settings so users can choose between inline behavior and dedicated channels.

## Routing Settings

- App settings should control whether image previews route to an images channel.
- App settings should control whether clickable links route to a links channel.
- The settings should define whether routed content is duplicated, moved, or both.
- The settings should define how hide/show controls behave when content can appear in more than one place.
- The settings should be easy to reason about so users know where content will go before interacting with it.

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

- Notes currently live in a panel that is toggled by shortcut or menu.
- The plan is to relocate notes into a channel while preserving the same stored notes data.
- The content model for notes should remain stable during the UI migration.
- Existing notes shortcuts may remain as a way to focus the Notes channel.

## Debug Console Migration

- The debug console currently lives in a panel that is toggled by shortcut or menu.
- The plan is to relocate it into a channel while preserving the same rolling debug stream.
- Existing debug shortcuts may remain as a way to focus the console channel.
- The debug console should still show the same data categories, just through the new subwindow structure.

## Plugin Surface

- Plugins should be able to contribute controls to the channel header area.
- Plugin controls should be small and host-rendered, not freeform DOM.
- Plugins should be able to request routing to one or more channels.
- Plugins should be able to use the world channel system without needing to know layout internals.

## Data Model Questions

- Are channels global to a world tab, or can they be scoped per character within the world tab?
- Which channels are persistent while the world tab stays open, and which are transient?
- How should routing behave when multiple targets are valid?
- How should the host represent a channel that has no current content but may receive routed content later?

## Suggested First Cut

- Introduce the host-level channel container inside PlayScreen.
- Move Notes into the new channel system first or alongside Debug Console.
- Move Debug Console into the new channel system next.
- Add images and links as optional routed channels if the routing model can be kept simple and understandable.
- Add routing hooks for built-in actions before wiring plugin integrations.
- Add plugin header controls only after the channel shell is stable.

## Relationship To Plugins

- `PLAN_PLUGIN.md` should continue defining the plugin system itself.
- `PLAN_TAPS.md` should continue focusing on the Taps plugin that will eventually use these host surfaces.
- This plan defines the app-level world channel host that both built-in features and plugins can use.
- Trigger routing and plugin routing should share the same host mechanism so the user experiences one coherent system.

## Next Steps

- Define the channel data structures and state model.
- Decide whether the Notes and Debug Console panels should be migrated together or in stages.
- Identify the host events that can route to a channel.
- Draft the minimal PlayScreen UI changes needed to show the channel strip.
- Clarify how plugin controls will be injected into the channel header area.
