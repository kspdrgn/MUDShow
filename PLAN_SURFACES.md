# Surfaces - Unified modular UX hosting system

This plan tracks the migration from the current channels/windows split to a unified Surfaces system.

Dockview is the assumed in-app surface manager for this plan. It will handle top docks, side docks, nested tabs, floating panels, drag/drop between placements, and in-app layout persistence.
Popped-out separate windows still need their own cross-window transport and lifecycle handling.

The main goal is to let eligible UI components move between:
- top docked surfaces
- left docked surfaces
- right docked surfaces
- in-app floating surfaces
- popped-out separate windows

## Current State

- Channels are currently a top-mounted tabbed interface inside `PlayScreen`.
- Windows are currently free-floating components in the app window that can pop out into separate app windows.
- Some of the current UI is already host-managed, but the state and transport rules are still split across the channel and window systems.

## Desired State

- Eligible components become surfaces with a stable identity.
- A surface keeps its logical state even when placement changes.
- Dockview manages in-app placement, including top/side tabs, nested tabs, and floating panels.
- A surface can still be popped out into a separate window, but that path uses the app's cross-window transport rather than Dockview alone.
- All surface communication uses a common cross-window-capable channel.
- Surface instances remain separate when multiple instances are allowed.

## Migration Checklist

Use this table as a todo list. For each row:
- `View State` means the visible UI state lives in a controller/service instead of the component.
- `Data State` means the underlying data model lives in a controller/service instead of the component.
- `Comms` means the component uses the shared cross-window channel for input/output.
- `API` means the component has been migrated to the new Surfaces API instead of the old channel/window-specific API.

| Surface / Current Interface | Current Home | View State | Data State | Comms | API | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Notes | `frontend/src/lib/components/play/NotesPanel.svelte` | [ ] | [ ] | [ ] | [ ] | Character-scoped editor; currently lives inside the world channel system. |
| Debug Console | `frontend/src/lib/components/play/DebugConsolePanel.svelte` | [ ] | [ ] | [ ] | [ ] | World-scoped stream viewer; currently lives inside the world channel system. |
| Fuzzball Storage Viewer | `frontend/src/App.svelte` plus window-host records | [ ] | [ ] | [ ] | [ ] | Currently handled as a hosted window / pop-out workflow. |

## Supporting Systems

These are not surfaces themselves, but they need to be migrated or adapted so the surfaces can work cleanly.

| Support System | Current Home | View State | Data State | Comms | API | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| World Channels Bar | `frontend/src/lib/components/play/WorldChannelsBar.svelte` | [ ] | [ ] | [ ] | [ ] | Host shell for top-docked channel tabs and controls. |
| World Channels Panel | `frontend/src/lib/components/play/WorldChannelsPanel.svelte` | [ ] | [ ] | [ ] | [ ] | The current top panel host under the bar. |
| Window Host Shell | `frontend/src/lib/components/window-host/WindowHost.svelte` | [ ] | [ ] | [ ] | [ ] | Shared shell for hosted windows and future surfaces. |
| Popped-Out Window View | `frontend/src/lib/components/window-host/PoppedOutWindowView.svelte` | [ ] | [ ] | [ ] | [ ] | Separate window bootstrap and bridge logic. |
| Window Record Helpers | `frontend/src/lib/components/window-host/window-host.ts` | [ ] | [ ] | [ ] | [ ] | Shared placement / sizing record helpers that will likely become surface helpers. |
| PlayScreen Surface Host | `frontend/src/lib/components/play/PlayScreen.svelte` | [ ] | [ ] | [ ] | [ ] | Current layout owner for channels, transcript, and input bars. |

## Additional Concerns To Track

These look important enough that they should probably be tracked alongside the four migration columns above:

- Dockview configuration and layout state
- Placement and docking state for popped-out windows
- Stable identity and instance lifecycle
- Cross-window transport and message routing
- Focus, activation, and keyboard routing
- Persistence / rehydration after pop-out or placement changes
- Sizing, clamping, and drag / resize behavior
- Host controls and registration / unregistration

## Current State Notes

- `frontend/src/lib/session-channels.ts` is already acting like a channel controller for Notes and Debug Console.
- `frontend/src/App.svelte` still owns the hosted-window registry and pop in / pop out lifecycle.
- `frontend/src/lib/world-session-container.ts` already gives us a natural place to hang session-scoped services.
- The existing docs in `spec/layout.md`, `spec/channels.md`, `spec/output.md`, and `spec/di.md` already point toward a controller-driven model.

## Suggested Next Steps

- Define the Surfaces controller API.
- Decide whether surfaces should live in app-wide DI, world-session DI, or both.
- Split state ownership from placement ownership.
- Map Dockview groups and tabs to the existing surface types, including nested world tabs where useful.
- Introduce the cross-window transport before migrating more components.
- Move Notes and Debug Console onto the new API first.
