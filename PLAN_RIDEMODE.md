# Taps Ride-Mode Integration Plan

## Purpose

- Add an active Taps ride-mode integration for selecting the current ride mode from the top Dockview action group.
- Keep ride mode explicitly Taps-specific rather than treating it as a FuzzBall feature.
- Let Taps worlds inherit all generic FuzzBall property-tree functionality.
- Establish a reusable host-managed world-session action model for future compact world controls.

## Original Repository Seams

- `WorldCompatibility` originally supported only `telnet` and `fuzzball`.
- FuzzBall property capture and the storage viewer were originally gated directly on `compatibility === 'fuzzball'`.
- The top Dockview group originally had a hard-coded `exa me=/` action for opening the FuzzBall storage viewer.
- Taps planning already defines ride modes as `ride`, `hand`, `walk`, and `fly`.
- The ride-mode property is `/ride/_mode`.
- The existing FuzzBall storage cache is the intended shared source for Taps property reads and updates.

The migration has since added a plugin registry, Taps profile, generic world-session actions, plugin-contributed surfaces, and a FuzzBall/Taps service boundary. The remaining work is platform hardening and generic surface orchestration, not recreating these initial seams.

## Design Decision

Add `taps` as a world profile that composes the FuzzBall capability:

```text
telnet  -> telnet capability
fuzzball -> telnet + fuzzball capabilities
taps -> telnet + fuzzball + taps capabilities
```

For the initial implementation, retain the persisted field name `compatibility` for backwards compatibility and add the value `taps`.

Centralize capability checks instead of scattering direct string comparisons:

```ts
supportsFuzzball(world) // fuzzball or taps
supportsTaps(world)     // taps only
```

The implementation should use composition rather than JavaScript class inheritance:

- FuzzBall service: property parsing, caching, refresh, reads, writes, and storage inspection.
- Taps service: ride mode and later Taps-specific state such as morphs, CInfo, WF, and WS.
- Host: action registration, rendering, layout, and dispatch into the active world session.

Although these integrations remain bundled in the main application, they should be treated as in-process plugins. The boundary is behavioral and dependency-based; separate packages or runtime loading are not required for this phase.

## Clarified Platform Direction

The ride-mode work is also establishing the application’s future plugin boundary. The intended ownership split is:

- Plugins own session behavior, protocol parsing, domain state, and surface controllers.
- The surface host owns UX orchestration, mounting, placement, transport routing, and lifecycle.
- A session controller opens or updates a surface through a host port without knowing whether it is mounted in Dockview, a floating window, a native window, or another host.

The current implementation is a valid in-process seam, but it is not yet an external-plugin protocol. Before external loading is considered, harden the seam around serializable and versioned contracts:

- Separate surface identity from renderer identity.
- Define a generic surface-instance/controller protocol for open, snapshot/update, command, and dispose operations.
- Replace FuzzBall-specific host branches with generic renderer/controller capabilities.
- Add action and surface invalidation so plugin state changes reliably refresh host UX.
- Replace untyped service strings and open payloads with typed capability/request contracts.
- Preserve an adapter boundary so built-in and future external plugins use the same host API.

External package discovery, permissions, process isolation, and runtime loading remain outside the ride-mode feature. They become a later consumer of this hardened protocol.

## Current Integration Shape

Before the migration, FuzzBall was spread across host-level code rather than exposed through one plugin contract:

- `session-world-capture.ts` directly calls FuzzBall line capture.
- `App.svelte` directly owns FuzzBall cache, viewer state, transport, surface registration, and Dockview panel creation.
- `storage-viewer.ts` reaches directly into the world-session connection registry.
- `PlayDockviewSandbox.svelte` hard-codes the `exa me=/` action.
- The surface registry supports host-managed surfaces, but not plugin contributions for actions, stream hooks, or session services.

The ride-mode work established the minimum in-process contract needed to make FuzzBall the first reference plugin and Taps its first dependent plugin. The remaining work is to make the surface and lifecycle portions of that contract generic enough to support future external adapters.

## In-Process Plugin Contract

Define a host-owned plugin contract, with names subject to refinement during implementation:

```ts
interface WorldPlugin {
  id: string;
  label: string;
  canActivate(context: WorldPluginActivationContext): boolean;
  createSessionContribution(
    context: WorldPluginSessionContext,
  ): WorldPluginSessionContribution;
}
```

A session contribution may provide:

```ts
interface WorldPluginSessionContribution {
  services?: Record<string, unknown>;
  onIncomingLine?: (line: string) => void;
  onRawMessage?: (text: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  actions?: WorldSessionAction[];
  channels?: ChannelContribution[];
  surfaces?: SurfaceContribution[];
}
```

The host owns connection delivery, lifecycle, rendering, placement, and window mechanics. Plugins own domain state and behavior. Plugins must use stable host-provided ports rather than importing `App.svelte`, Dockview internals, or concrete connection registries.

The host session context should provide at least:

- world and character identity
- `WorldSessionKey`
- a narrow `WorldConnectionPort` for sending commands
- line and raw-message subscription/contribution hooks
- host surface and action registration functions
- session cleanup/disposal hooks

## Plugin Dependency Model

Introduce an integration registry or equivalent resolver that activates plugins for a world profile:

```text
telnet world  -> no protocol plugin
fuzzball world -> FuzzBall plugin
taps world    -> FuzzBall plugin + Taps plugin
```

Taps depends on the FuzzBall property service, not on FuzzBall implementation classes:

```ts
interface FuzzBallPropertyService {
  get(path: string): FuzzBallPropertySnapshot | null;
  refresh(path: string): void;
  set(path: string, value: string): Promise<void>;
  subscribe(listener: () => void): () => void;
}
```

FuzzBall owns property parsing, cache, refresh, reads, writes, and generic storage inspection. Taps owns the meaning of `/ride/_mode`, its allowed values, commands, and UI action. This service boundary must exist before adding more Taps features.

## FuzzBall Refactoring Prerequisite

Before implementing the ride selector, refactor the current FuzzBall pieces behind the plugin contract without changing the user-facing storage viewer:

- Wrap property capture and cache access in the FuzzBall session contribution.
- Move storage viewer action and surface contributions behind FuzzBall registration.
- Replace direct FuzzBall checks in the host with active-plugin/capability resolution.
- Keep the cache session-scoped and clear it with the owning world session.
- Keep the host’s existing surface registry and Dockview panel host as the rendering mechanism.
- Add tests proving the refactor preserves existing FuzzBall behavior.

## Scope

### In scope

- Add the `taps` world compatibility/profile option.
- Preserve and normalize existing `telnet` and `fuzzball` world records.
- Make Taps worlds receive FuzzBall capture and storage functionality.
- Replace the hard-coded top Dockview action with a generic world-session action list.
- Render a compact ride-mode dropdown beside the `exa me=/` action.
- Query, display, and update the four known ride modes.
- Document the behavior in the canonical specifications.

### Out of scope

- Implementing other Taps features such as morphs, CInfo, WF, or WS.
- Changing the user-facing FuzzBall storage viewer behavior.
- General plugin loading or external plugin packaging.
- Inferring ride mode from transcript text.
- Persisting ride mode locally as authoritative state.

## Data and Capability Model

### World profile

- Extend `WorldCompatibility` to `'telnet' | 'fuzzball' | 'taps'`.
- Add `taps` to the world editor selector.
- Update storage normalization to preserve `taps` values while treating unknown or missing values as `telnet`.
- Ensure existing saved `fuzzball` and `telnet` records behave unchanged.

The persisted profile is a compatibility-preserving activation hint for now. Internally, active plugin resolution should be the source of truth for feature availability; avoid adding new direct `compatibility` comparisons at call sites.

### Capability helpers

Create one shared module for profile checks, for example `world-capabilities.ts`:

- `supportsFuzzball(world)` returns true for `fuzzball` and `taps`.
- `supportsTaps(world)` returns true only for `taps`.
- Keep call sites independent of the persisted profile string where behavior depends on inherited capabilities.

Use `supportsFuzzball` for:

- FuzzBall incoming-line capture.
- FuzzBall property cache access.
- FuzzBall storage viewer visibility.
- Any future generic FuzzBall action.

Use `supportsTaps` for:

- Ride-mode actions.
- Taps-specific parsing and state.
- Future Taps channels, panels, and editors.

## World-Session Service Shape

Add Taps state at world-session scope, keyed by the existing world/character session identity.

Suggested ride-mode model:

```ts
type RideMode = 'ride' | 'hand' | 'walk' | 'fly';

interface RideModeState {
  value: RideMode | null;
  pendingValue: RideMode | null;
  loading: boolean;
  error: string | null;
  lastSyncedAt: number | null;
}
```

The service should:

- Use the shared FuzzBall property interface for reads and writes.
- Query `examine me=/ride/_mode` when the Taps session becomes active or when an explicit refresh is needed.
- Read the normalized value from the shared property cache.
- Accept only the four known values as active ride modes.
- Represent missing, unknown, or not-yet-loaded values as unavailable rather than silently selecting a mode.
- Send `@set me=/ride/_mode:<rideMode>` when the user selects a new mode.
- Avoid treating a sent command as confirmed until the cache reflects the selected value or the service receives an explicit failure signal.
- Clear or invalidate pending state on disconnect/reconnect as appropriate.
- Keep the state transient and session-scoped; the server remains authoritative.

## Generic World-Session Actions

The current top Dockview `exa me=/` button is hard-coded in `PlayDockviewSandbox.svelte`. Replace that special case with a host action model that can render compact controls supplied by the active world session.

Suggested action variants:

```ts
type WorldSessionAction =
  | {
      kind: 'button';
      id: string;
      label: string;
      title?: string;
      disabled?: boolean;
      onClick: () => void;
    }
  | {
      kind: 'select';
      id: string;
      label: string;
      title?: string;
      value: string | null;
      options: Array<{ value: string; label: string }>;
      disabled?: boolean;
      onChange: (value: string) => void;
    };
```

Requirements:

- Keep action definitions world-session scoped and derived from the active world profile.
- Render actions only in the top edge Dockview header action group.
- Preserve the existing `exa me=/` button for FuzzBall-capable worlds.
- Render the ride selector only for Taps worlds.
- Keep controls compact and usable with keyboard navigation.
- Ensure the action group handles Dockview location changes just as the current button does.
- Avoid making the Dockview component aware of Taps or FuzzBall business logic.

FuzzBall should contribute the existing `exa me=/` button through this model. Taps should contribute the ride-mode select through the same model. The Dockview host should render both without knowing either integration’s domain name.

The likely flow is:

```text
session state
  -> world-session service actions
  -> PlayScreen props
  -> PlayDockviewSandbox
  -> generic top-header action renderer
```

## Ride-Mode Behavior

### Initial load

- When a Taps world session is connected or activated, request `/ride/_mode` through the FuzzBall property service.
- Show a loading or unavailable state until the property value is known.
- Display the server value when it is one of `ride`, `hand`, `walk`, or `fly`.

### User selection

- Selecting an option sends the Taps-owned property update.
- Mark the control pending while awaiting synchronization.
- Prevent conflicting changes while a write is pending, or coalesce them deterministically.
- Update the visible selection when the shared cache reports the new value.
- Surface an unobtrusive error state if the write or refresh fails.

### External server changes

- Any later captured `/ride/_mode` value should update the selector.
- A server-side change must replace stale local display state.
- The selector must not persist a value that differs from the server.

### Unsupported sessions

- Telnet worlds show no ride-mode action.
- FuzzBall worlds show the FuzzBall storage action but no ride-mode action.
- Taps worlds show both inherited FuzzBall actions and the Taps ride-mode action.

## Implementation Areas

Likely files and responsibilities:

- `frontend/src/lib/types.ts` — add the `taps` profile type.
- `frontend/src/lib/storage.ts` — normalize persisted `taps` records.
- `frontend/src/lib/components/settings/WorldModal.svelte` — expose Taps in the world selector.
- New `frontend/src/lib/world-capabilities.ts` — centralize inherited capability checks.
- New Taps service/module under `frontend/src/lib/taps/` — ride-mode state, commands, and action definition.
- Existing FuzzBall service/cache modules — expose the stable read/write/cache subscription seam needed by Taps.
- `frontend/src/lib/session-world-capture.ts` — dispatch incoming lines through the active plugin session so FuzzBall capture is inherited by Taps.
- `frontend/src/lib/session-channels.ts` or a new world-action module — build session-specific compact actions.
- `frontend/src/lib/components/play/PlayScreen.svelte` — pass generic top actions through the host boundary.
- `frontend/src/lib/components/play/PlayDockviewSandbox.svelte` — render generic top Dockview actions.
- `frontend/src/App.svelte` and `frontend/src/lib/session.ts` — connect the active session to the Taps service and action model.
- `spec/layout.md` — document top Dockview world-session actions and placement.
- `spec/surfaces.md` — document generic host-rendered actions and FuzzBall/Taps visibility.
- `spec/spec.md` — add any new canonical spec document if the action/service contract warrants one.

## Testing Plan

### Unit tests

- Profile normalization accepts `taps`.
- Unknown profile values still normalize to `telnet`.
- `supportsFuzzball` returns true for `fuzzball` and `taps` only.
- `supportsTaps` returns true only for `taps`.
- Ride-mode parsing accepts the four known values and rejects unknown values.
- Ride-mode command generation uses the expected examine and set commands.
- Cache updates replace the current ride mode and clear matching pending state.
- Failed or unavailable values do not select an arbitrary fallback.

### Integration tests

- Taps sessions capture FuzzBall property lines.
- Taps sessions expose the storage viewer action.
- FuzzBall sessions do not expose ride mode.
- Taps sessions expose both storage and ride-mode actions.
- Telnet sessions expose neither feature.
- Selecting a ride mode sends the correct command through the active connection.
- A later server property update changes the dropdown selection.
- Disconnecting and reconnecting does not leak ride-mode state between world/character sessions.

### UI checks

- The ride selector appears beside `exa me=/` in the top Dockview group.
- It disappears when the group moves away from the top edge.
- It is keyboard accessible and has an accessible label/title.
- Loading, unavailable, pending, and error states remain compact and readable.
- Existing Dockview placement and storage-viewer behavior remain unchanged.

## Spec Updates Required

The implementation is incomplete until the behavior is represented in the canonical specs:

- Document `taps` as a world profile that inherits FuzzBall capabilities.
- Document the distinction between generic FuzzBall storage features and Taps-specific ride mode.
- Document the top Dockview action group and its generic button/select controls.
- Document ride-mode loading, server synchronization, update behavior, and supported values.
- Document that ride mode is transient session state and server-authoritative.
- Update any existing requirements that currently say the storage action appears only for exact `fuzzball` compatibility.

## Completion Checklist

### Generic plugin foundation

- [x] Define the host-owned in-process `WorldPlugin` contract.
- [x] Define the world-plugin activation context and session context.
- [x] Define a narrow host-provided connection port for plugin command sends.
- [x] Define session contribution hooks for lines, raw messages, connection lifecycle, actions, channels, and surfaces.
- [x] Add an integration registry or equivalent active-plugin resolver.
- [x] Ensure plugin lifecycle and disposal follow the owning world-session lifecycle.
- [x] Keep host rendering and placement responsibilities out of plugin code.
- [x] Establish plugin-owned surface identity and host-open routing.
- [x] Separate surface identity from renderer identity in the versioned surface descriptor.
- [ ] Complete end-to-end integration of the versioned surface protocol.
- [x] Define generic surface-instance lifecycle and command/snapshot contracts.
- [ ] Connect the existing surface host and FuzzBall controller to the generic surface protocol.
- [x] Mirror existing tree-data snapshots into the versioned generic snapshot store.
- [x] Route existing tree-data commands through the generic surface command router.
- [x] Supply tree-surface model providers and domain command hooks per surface instance.
- [x] Add plugin action invalidation for reliable host UX updates.
- [x] Replace plugin service-bag string lookups with typed service keys shared by providers and consumers.
- [x] Add a built-in FuzzBall surface-host adapter so App supplies generic host ports instead of plugin wiring.
- [x] Add an in-process provider-to-registry adapter that establishes the seam for future external providers.
- [x] Route FuzzBall cache invalidation subscription through the surface adapter instead of App.
- [x] Add surface-instance invalidation for snapshot/render updates through the generic snapshot store.

### Profile and capabilities

- [x] Add `taps` to `WorldCompatibility` and `WorldDraft`.
- [x] Add `taps` to the world editor.
- [x] Preserve existing saved world behavior during normalization.
- [x] Resolve active integrations from the profile rather than adding new direct profile checks.
- [x] Add and use centralized capability/plugin resolution for FuzzBall and Taps.
- [ ] Verify Taps worlds activate both FuzzBall and Taps integrations with concrete plugin instances.

### FuzzBall/Taps service boundary

- [x] Keep property parsing, cache, refresh, and generic property writes in the FuzzBall layer.
- [x] Define the stable `FuzzBallPropertyService` contract for dependent integrations.
- [x] Refactor FuzzBall capture behind its session contribution.
- [x] Refactor FuzzBall storage viewer action and surface registration metadata behind its plugin contribution; keep generic surface rendering/transport mechanics host-owned.
- [x] Expose FuzzBall storage viewer state/model/load operations through a plugin-provided service.
- [x] Route plugin surface opening through a generic host surface port with session payloads.
- [x] Extract FuzzBall viewer open/reuse/placement orchestration into a surface controller.
- [x] Move the FuzzBall storage instance-state map out of `App.svelte` into the surface controller.
- [x] Remove FuzzBall-specific transport-kind and source-state maps from `App.svelte`; surface controllers and model providers are now authoritative.
- [x] Remove FuzzBall-specific pop-out/window routing branches from `App.svelte` while preserving generic surface lifecycle behavior.
- [x] Move plugin surface registration and opening dispatch behind a generic `(pluginId, surfaceId)` surface-host handler path; keep the FuzzBall controller as the current adapter.
- [x] Route plugin surface-instance state disposal through a generic surface-identity disposer registry, including popped-out instance discard.
- [x] Route source-tab bulk plugin-surface discovery through a generic surface-identity provider registry; App owns the common cleanup mechanics.
- [x] Consolidate repeated native-window discard/pop-out cleanup into one generic host lifecycle helper shared by plugin and built-in surfaces.
- [x] Replace the FuzzBall-specific Dockview panel branch with the generic tree-data renderer.
- [x] Replace FuzzBall-specific Dockview transport/state branches with generic tree-data renderer and per-instance source-tab capabilities.
- [x] Replace FuzzBall-named tree renderer presentation flags with renderer-neutral display options.
- [x] Remove FuzzBall-specific surface IDs and cache naming from the generic App host paths.
- [x] Remove FuzzBall viewer-service access and initial-load logic from App-facing adapters.
- [x] Move FuzzBall domain-cache teardown from App into the FuzzBall session contribution lifecycle.
- [x] Route tree-data pop-out, rendering, and host placement by registered renderer identity.
- [x] Add a Taps service that depends on the FuzzBall property service.
- [x] Keep ride-mode constants and command knowledge in the Taps layer.
- [x] Scope ride-mode state to the world-session container and avoid local persistence.

### Generic top actions

- [x] Define generic world-session action contracts, including button and select variants.
- [x] Replace the hard-coded Dockview `exa me=/` action with generic action definitions.
- [x] Have FuzzBall contribute the `exa me=/` action.
- [x] Have Taps contribute the ride-mode select action.
- [x] Pass world-session actions through the PlayScreen host boundary.
- [x] Render button and select action variants in the top Dockview group.
- [x] Preserve top-edge-only visibility and existing Dockview location handling.
- [x] Keep Dockview rendering independent of Taps/FuzzBall business logic.
- [x] Keep ride-mode option construction inside the Taps integration rather than the generic action contract.

### Ride mode

- [x] Query `examine me=/ride/_mode` for active Taps sessions.
- [x] Display `ride`, `hand`, `walk`, and `fly` when known.
- [x] Show an explicit unavailable/loading state for missing or invalid values.
- [x] Send `@set me=/ride/_mode:<rideMode>` on selection.
- [x] Track pending writes, keep the selector editable after send completion, and treat later cache updates as authoritative.
- [x] React to externally changed server values.
- [x] Handle disconnect, reconnect, and write/refresh errors safely.
- [x] Refresh the generic ride-mode action when Taps state changes.

### Tests and documentation

- [x] Add plugin activation, dependency, lifecycle, and disposal tests.
- [x] Add registry coverage for plugin-contributed surface descriptors.
- [x] Add storage surface controller coverage for duplicate-window reuse and plugin surface opening.
- [ ] Add tests proving the FuzzBall refactor preserves full storage viewer behavior.
- [x] Add capability tests.
- [x] Add ride-mode parser and command tests.
- [ ] Add session/cache synchronization tests for Taps ride-mode state.
- [ ] Add concrete plugin action-visibility, surface-opening, and inheritance tests (the generic registry/capability coverage is present).
- [ ] Add end-to-end surface protocol, lifecycle, command, snapshot, and invalidation tests.
- [x] Add versioned snapshot-store tests for revision ordering, subscription, and disposal.
- [x] Add generic surface command-router coverage.
- [x] Add focused runtime decoder coverage for versioned surface commands and snapshots.
- [x] Add plugin-session subscription coverage for action invalidation.
- [ ] Verify the UI manually in the simulated Taps server when available.
- [ ] Update `spec/layout.md`.
- [ ] Update `spec/surfaces.md`.
- [ ] Update the high-level or new world-services spec with the final service contract.
- [x] Run the relevant TypeScript, Svelte, and existing test suites.

## Final Integration Execution Plan

Recovery scope follows `PLAN_DI_WORLD_SESSION.md`: preserve existing socket
reattachment and bounded replay; FuzzBall/Taps runtime state remains disposable
and may be re-queried. Optional webview caching is future feature-specific work.
The surface snapshots and lifecycle checks below support live views and pop-out
communication; they do not require backend copies or durable recovery of all
plugin state after a refresh.

The remaining work should be phased. The phases are grouped by ownership boundary and reload risk, not by individual file. The first phase that changes `App.svelte`, `session.ts`, `world-session-container.ts`, or the live Dockview wiring is a deliberate frontend restart boundary.

### Phase 0: Prepare and freeze

Purpose: make the risky transition reversible and keep the active connection safe.

- Finish pure contract, registry, capability, and ride-mode tests.
- Confirm the current working tree and preserve unrelated user changes.
- Do not wire the registry into the running application yet.
- Disconnect the active world tab before beginning Phase 1.
- Use the mock/local server for all subsequent connection verification.

Exit gate:

- The active connection is disconnected.
- The isolated plugin registry tests pass.
- A frontend restart is acceptable.

### Phase 1: Host runtime and session lifecycle

Purpose: introduce plugin activation without changing FuzzBall behavior yet.

- Add the plugin registry to the session/runtime construction path.
- Extend the world-session container with plugin session state.
- Create and dispose contributions with the owning world-session lifecycle.
- Route connection lifecycle, raw-message, and complete-line events to contributions.
- Aggregate plugin actions without rendering them yet.
- Keep the existing FuzzBall capture and storage paths active during this phase as a compatibility path.

Primary reload-sensitive files:

- `frontend/src/App.svelte`
- `frontend/src/lib/session.ts`
- `frontend/src/lib/world-session-container.ts`
- `frontend/src/lib/session-world-connection.ts`
- `frontend/src/lib/session-world-capture.ts`

Exit gate:

- Restart the frontend.
- Connect to the mock/local server.
- Confirm ordinary transcript output, raw debug output, reconnect, and tab close behavior.
- Confirm plugin contributions are disposed when a tab closes.

### Phase 2: FuzzBall reference-plugin migration

Purpose: move existing FuzzBall behavior behind the new host contract while preserving functionality.

- Create the FuzzBall plugin contribution.
- Expose the property service from the contribution/session container.
- Move property-line capture behind the plugin event hook.
- Move the storage viewer action and surface/panel coordination behind FuzzBall contribution APIs.
- Replace direct `App.svelte` FuzzBall ownership incrementally, keeping one source of truth for cache and window state.
- Replace exact `compatibility === 'fuzzball'` checks with active-plugin/capability resolution where appropriate.
- Remove the temporary compatibility path only after regression checks pass.

Primary reload-sensitive files:

- `frontend/src/App.svelte`
- `frontend/src/lib/fuzzball/capture.ts`
- `frontend/src/lib/fuzzball/storage-viewer.ts`
- `frontend/src/lib/fuzzball/storage-cache.ts`
- `frontend/src/lib/session-world-capture.ts`
- `frontend/src/lib/components/play/PlayDockviewSandbox.svelte`

Exit gate:

- FuzzBall worlds still capture property lines.
- The storage viewer opens, refreshes, expands, floats, and pops out as before.
- Closing a world tab clears only that session’s transient cache.
- Existing FuzzBall regression tests pass after a full frontend restart.

### Phase 3: Profile activation and Taps service

Purpose: activate Taps as a dependent integration without adding UI yet.

- Add `taps` to the persisted world profile model and editor.
- Resolve a Taps world to `[FuzzBall, Taps]` in dependency order.
- Keep regular FuzzBall worlds as `[FuzzBall]` and Telnet worlds with no integration.
- Create Taps session state in the plugin session container.
- Inject the FuzzBall property service into Taps.
- Implement ride-mode query, parsing, update, pending, and reconciliation behavior.
- Keep ride-mode state transient and server-authoritative.

Primary reload-sensitive files:

- `frontend/src/lib/types.ts`
- `frontend/src/lib/storage.ts`
- `frontend/src/lib/components/settings/WorldModal.svelte`
- `frontend/src/App.svelte`
- `frontend/src/lib/session.ts`
- `frontend/src/lib/world-session-container.ts`

Exit gate:

- Restart the frontend with a Taps-configured mock world.
- Confirm Taps activates FuzzBall first and Taps second.
- Confirm ride-mode service tests pass without any UI dependency.
- Confirm no Taps integration activates for Telnet or ordinary FuzzBall worlds.

### Phase 4: Generic top-action host

Purpose: expose plugin actions through the existing top Dockview group.

- Pass aggregated world-session actions through the PlayScreen boundary.
- Replace the hard-coded `exa me=/` button with generic action rendering.
- Have FuzzBall contribute the existing storage action.
- Preserve top-edge-only visibility and Dockview location handling.
- Render select actions with keyboard access, disabled states, and accessible labels.
- Keep the Dockview host independent of FuzzBall and Taps domain logic.

Primary reload-sensitive files:

- `frontend/src/App.svelte`
- `frontend/src/lib/components/play/PlayScreen.svelte`
- `frontend/src/lib/components/play/PlayDockviewSandbox.svelte`
- New generic world-action component(s)

Exit gate:

- FuzzBall worlds show `exa me=/`.
- Telnet worlds show no integration action.
- Dockview panel layout and placement behavior remain unchanged.
- The generic action renderer has component-level tests.

### Phase 5: Ride-mode selector

Purpose: connect the Taps service state to the generic host action UI.

- Have Taps contribute the ride-mode select action.
- Display `ride`, `hand`, `walk`, and `fly`.
- Add loading, unavailable, pending, and error states.
- Send the Taps-owned update command through the FuzzBall property service.
- Reconcile the selector from cache updates, including external server changes.
- Confirm that a failed update does not permanently change the displayed value.

Exit gate:

- A Taps session shows both the FuzzBall storage action and ride-mode selector.
- Selecting a mode sends the expected command.
- A server-side property update changes the selector.
- Disconnect/reconnect does not leak state between sessions.

### Phase 6: Documentation and final verification

- Update `spec/layout.md` with generic world-session actions and top Dockview placement.
- Update `spec/surfaces.md` with plugin-contributed actions and FuzzBall/Taps visibility.
- Add or update the canonical world-services/plugin specification.
- Run TypeScript, Svelte, FuzzBall, plugin-registry, and ride-mode tests.
- Validate against the simulated Taps server.
- Mark the completion checklist only after the relevant phase exit gate passes.

### Phase 7: Generic surface protocol and external-boundary preparation

Purpose: finish the platform seam exposed by the ride-mode implementation without loading external plugins yet.

- Define versioned serializable surface descriptors and open requests.
- Define surface-instance lifecycle, snapshot/update, command, and dispose contracts.
- Move FuzzBall window state and tree-data transport coordination behind its surface controller.
- Make Dockview and floating/native mounting consume generic surface renderer capabilities.
- Add action/surface invalidation so Taps pending and error state changes refresh the host.
- Replace stringly typed service and payload lookups with typed capability/request contracts.
- Add an adapter boundary for future built-in and external plugin providers.

Exit gate:

- FuzzBall and Taps still behave identically through the generic surface protocol.
- `App.svelte` contains no FuzzBall-specific transport or renderer branching.
- Surface lifecycle and command/snapshot behavior are covered by tests.
- The protocol is serializable and versioned, but no external runtime loading is introduced yet.
