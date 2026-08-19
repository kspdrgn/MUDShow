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
  - commands flow from the surface to the controller
  - snapshots flow from the controller to the surface
- The component should not be the source of truth for its own cross-window behavior.
- Surface-specific command and snapshot types must be shared between the component and the controller that owns the surface.

## Transport
- The transport layer is an adapter, not business logic.
- It must support both in-app surfaces and popped-out windows.
- The component should not need to know which transport backend is active.
- Stale updates must be ignored when a surface has moved, closed, or been replaced.
- A popped-out window must be able to reconnect and resync from the owning controller.

## Placement and Lifecycle
- A surface may appear in any of these placements:
  - hidden
  - tabbed in the main surface host
  - docked in the main surface host
  - docked in the main window
  - floating in the main window
  - popped out into a native window
- The in-app placement model may include multiple layout styles as long as they behave as a single surface contract.
- Placement changes must not change the surface’s type contract.
- Opening, closing, focusing, resizing, and visibility changes are surface lifecycle concerns, not component-local implementation details.

## Snapshot Rules
- Start with full snapshots for simplicity.
- Keep the design open to delta or patch updates later if a surface becomes high-volume.
- Snapshot revisions must allow the surface to reject stale updates.

## Current Surfaces

### Notes
- Notes are per-character private text.
- The notes surface can be opened from the active world tab and can be popped out.
- The controller owns the note text, draft state, and persistence behavior.
- The component renders the current note text and emits typed edit and command intent.

### Debug Console
- The debug console shows raw session input, output, and status information for a world session.
- The debug console can be opened from the active world tab and can be popped out.
- The controller owns the debug entry list and keeps it current as new raw traffic arrives.
- The component renders the current entry list, supports selection and copy behavior, and emits typed intent back to the controller.

### Tree Viewer Surfaces
- Tree-style surfaces show hierarchical data with selection and expansion behavior.
- They can live in the window host and be popped out.
- The controller owns the tree model and the current view state.
- The component renders the current snapshot and emits typed tree-view intent.

### Fuzzball Storage Viewer
- The fuzzball storage viewer shows live hierarchical storage data for a world connection.
- It can be opened in the window host and popped out.
- The controller owns both the storage data and the view state needed to browse it.
- The component renders the current storage snapshot and emits typed browse/load intent.

## App-Shell Responsibilities
- The app shell creates and owns the surface transport hub for the running app instance.
- The app shell owns bridge sessions for popped-out windows and routes snapshots back to the matching surface instance.
- A surface component should not create its own global transport singleton.

## Expectations For New Surfaces
- Define the typed command and snapshot contracts first.
- Keep view state out of the component when the UI needs to survive placement changes.
- Keep data state in controller-owned code when the surface reads or mutates real app data.
- Route the surface through the shared transport layer when it must work across windows.
