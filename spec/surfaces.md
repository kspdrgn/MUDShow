# Surfaces Spec

## Purpose
- Define how surface components behave when they can render in the main app or in a popped-out window.
- Keep surface UI thin: the component renders the current state and emits typed intent, while controllers own the real state.

## Surface Model
- A surface is a logical feature that can be shown in multiple placements.
- A surface may have multiple instances when the product allows it, and each instance stays separate.
- Each surface has a stable identity that survives docking, hiding, popping out, and returning to the main window.
- The same surface contract must work whether the view is in-app or in its own window.

## Ownership
- Controllers own the canonical surface state.
- A surface may be backed by one controller or by separate view-state and data-state controllers.
- The component should receive one coherent presentation model even if that model is assembled from multiple controllers.
- View concerns and data concerns must remain separate, even when they are delivered through the same surface.

## Communication
- Use a directional model:
  - commands flow from the surface to its controller, never directly to other surfaces.
  - snapshots flow from the controller to the surface.
- The component should not be the source of truth for its own cross-window behavior.
- Surface-specific command and snapshot types must be shared between the component and the controller that owns the surface.

## Transport
- The transport layer is an adapter, not business logic.
- It must support both in-app surfaces and popped-out windows.
- The component should not need to know which transport backend is active.
- Stale updates must be ignored when a surface has moved, closed, or been replaced.
- A popped-out window must be able to reconnect and resync from the owning controller.
- If the main app reloads while a native surface remains open, the next pop-in
  event must recover the surface registration and controller state before
  docking it, rather than treating the return as stale.

## Placement and Lifecycle
- Each surface instance may appear in only one of these placements:
  - non-existent, not spawned yet. surfaces may not be hidden completely.
  - docked panel in a tabbed edge group of a world tab.
  - floating panel in a world tab.
  - popped out into a native window.
- The in-app placement model may include multiple layout styles as long as they behave as a single surface contract.
- Placement changes must not change the surface’s type contract.
- Opening, closing, focusing, resizing, and visibility changes are surface lifecycle concerns, not component-local implementation details.
- A surface instance persists its last placement and, for floating or native-window hosts, its last position and size locally on the device.
- When an instance is opened again, saved placement, position, and size take precedence over the registration or opener's default spawn values.
- Saved native-window placement is reopened as a native window with its saved bounds; saved floating placement is restored in Dockview and clamped to the current viewport.
- Closing a surface does not discard its saved placement metadata. Invalid or unavailable bounds are ignored in favor of safe defaults.

### Surface Registry
- The surface registry owns host-neutral registration metadata and open surface-instance lifecycle state.
- Each registration has a stable surface id, a default title, surface kind, and capabilities describing whether it can close, dock, float, pop out, or have multiple instances.
- Each open instance has its own stable instance id, title, active state, size/position metadata, current placement, and optional `previousDockedEdge` value.
- Moving an instance to an edge updates `previousDockedEdge`. Floating and native-window transitions preserve that value.
- Returning a floating or native surface to a dock uses `previousDockedEdge`; surfaces without one default to the top edge.
- Registry placement identifies whether an instance is in Dockview or a native window; Dockview adapters may further describe grid, edge, or floating placement.
- Dockview and native-window hosts are adapters of the registry. They translate registry lifecycle and placement changes into host-specific operations and report resulting state back to the registry.
- The registry does not render Svelte components and does not own surface data models or transport sessions.
- Dockview is the in-app surface host. Native pop-out windows remain a separate host adapter and must use the surface registry for lifecycle state.
- The former in-app WindowHost and WindowShell components are not part of the surface architecture. Native-window transport may retain a small serialized window DTO at the Tauri boundary, but it is not an application-side surface registry.

### Dockview Edge Auto-Hide

The Dockview library gates auto-hide behavior behind an Enterprise subscription which we do not have. We have created a small custom auto-hide functionality for edge groups:
- Edge tab groups may use the custom in-app auto-hide behavior when the Dockview auto-hide module is unavailable.
- Each hidden edge group has a reveal trigger along its edge: wider top, right, and left edge triggers are available for their respective groups.
- Hovering a reveal trigger shows a compact, non-layout preview of that edge group's surface tabs and custom controls. The native Dockview group remains hidden so the reading area does not shift while the pointer is passing by.
- Selecting a surface tab in the preview expands the group and shows the selected surface in the normal Dockview interface. Activating a custom preview control invokes that control without expanding the group or showing the full bar.
- Reveal triggers are disabled for edge groups with no tabs or custom UI; a group containing either tabs or rendered custom UI remains revealable.
- While a panel tab is being dragged, all edge groups remain visible as drop targets for the duration of the drag. Their normal auto-hide and empty-group cleanup are restored when the drag ends.
- The hide timer is two seconds. It starts when an edge group becomes empty and collapsed, when a populated edge group becomes collapsed, when the pointer leaves that edge group, or when the pointer leaves the Dockview sandbox.
- The timer resets when the pointer enters the edge group, when the pointer enters the Dockview sandbox, when the group is expanded, or when the reveal trigger makes the group visible.
- Auto-hide may only hide a group that is currently collapsed. Expanded groups must remain visible.
- An edge group with no registered tabs is hidden immediately and does not start an auto-hide timer.
- When a new surface is spawned into an edge group, that group is made visible and expanded immediately, even if it was auto-hidden. The spawn reveal cancels the current hide timer so the surface is initially readable.

### In-App Floating Panels
- In-app floating panels are hosted by Dockview’s floating overlay within the center viewport, while the host preserves each panel’s window-relative position when the top edge group changes size or visibility.
- Floating panels remain registered and retain their Dockview placement while their world tab is inactive; when the world tab becomes visible again, the host relayouts and restores their saved positions.
- The Dockview host translates each floating panel’s anchored bounds when the floating overlay moves, then reapplies them after the layout settles.
- Floating-panel dragging clamps the title bar to the app window while allowing the panel body to overlap edge dock groups.
- User drag and resize operations update the saved anchored bounds before later edge-group repositioning.
- Reopening a floating surface restores its saved anchored bounds even when its surface definition now specifies a different default size or spawn placement.
- Dockview remains responsible for normal viewport clamping; native pop-out windows are outside this behavior.
- During a Dockview tab drag, configured edge groups are temporarily made visible as drop targets. Their prior hidden state is restored when the drag ends, except that a newly populated target remains available for its new surface.

## Snapshot Rules
- Start with full snapshots for simplicity.
- Keep the design open to delta or patch updates later if a surface becomes high-volume.
- Snapshot revisions must allow the surface to reject stale updates.

## Current Surfaces

### Notes
- Notes are per-character private text.
- The notes surface can be opened from the active world tab, docked in the per-world Dockview host, floated in-app, and popped out into a native window.
- When rendered in Dockview, the host owns the title and placement actions; the Notes component renders the editor surface and spellcheck interactions.
- The world-session notes service owns working note text, loading, debounced persistence, and close-time flushing. The surface controller owns draft and transport state; the component renders the current note text and emits typed edit and command intent.

### Debug Console
- The debug console shows raw session input, output, and status information for a world session.
- The debug console can be opened from the active world tab, docked in the per-world Dockview host, and popped out into a native window.
- The controller owns the debug entry list and keeps it current as new raw traffic arrives.
- The component renders the current entry list, supports selection and copy behavior, and emits typed intent back to the controller.

### Tree Viewer Surfaces
- Tree-style surfaces show hierarchical data with selection and expansion behavior.
- Any branch, including the root branch, can be collapsed and expanded again.
- The collapse-all action collapses the root as well as every descendant branch.
- The dummy tree viewer can be opened in the active world tab’s Dockview host, floated in-app, or popped out into a native window.
- Closing the owning world tab closes the dummy tree viewer and clears any popped-out native-window state.
- The controller owns the tree model and the current view state.
- The component renders the current snapshot and emits typed tree-view intent.

### Fuzzball Storage Viewer
- The FuzzBall storage viewer is a plugin-contributed tree surface. Its
  product behavior, activation rules, cache behavior, and load commands are
  specified in `spec/fuzzball.md`.
- It follows the generic surface placement, transport, lifecycle, and
  controller-ownership rules in this document.

### Standalone Dummy Window
- The standalone dummy window is a developer test surface with static content.
- It can be opened multiple times in the active world tab, docked in Dockview, floated in-app, or popped out to a native window.
- The legacy window record remains only as lifecycle and native-window bookkeeping while its in-app content is hosted by Dockview.

## App-Shell Responsibilities
- The app shell creates and owns the surface transport hub for the running app instance.
- The app shell owns bridge sessions for popped-out windows and routes snapshots back to the matching surface instance.
- A surface component should not create its own global transport singleton.

## Plugin Surface Adapters

- Plugin actions are aggregated by the world-session plugin session and
  rendered by the world controls; an action that opens a surface transfers
  focus to that surface.
- A contributed surface is registered in the shared `SurfaceRegistry` with
  its renderer id and capabilities before its first instance is opened.
- The renderer id selects the host adapter for both Dockview panels and
  native-window bridge snapshots. The plugin does not receive a separate
  placement or window API.
- When a native plugin window returns after an app reload, the host invokes the
  registered surface restore handler before recreating the Dockview instance.
  If the owning plugin session is unavailable, the host keeps the serialized
  window record but does not fabricate plugin data.
- Plugin controllers and caches are session-scoped and disposable. The host
  owns saved placement metadata; it does not persist plugin data on the
  plugin's behalf.

## Expectations For New Surfaces
- Define the typed command and snapshot contracts first.
- Keep view state out of the component when the UI needs to survive placement changes.
- Keep data state in controller-owned code when the surface reads or mutates real app data.
- Route the surface through the shared transport layer when it must work across windows.
