# Surface Protocol and Lifecycle

Surfaces are host-neutral feature instances. A surface controller owns its
model and view state; a host owns mounting, placement, focus, and window
mechanics. The same instance contract applies to an in-app panel and a
popped-out native window.

## Versioned boundary

Surface descriptors, open requests, commands, snapshots, and lifecycle events
carry protocol version 1. Values crossing the boundary must be JSON-safe.
Commands identify the surface and instance, include a request id, and carry
the controller revision the command was based on. Snapshots carry a strictly
increasing revision. Hosts ignore malformed, unsupported, or stale messages.

Commands flow from a host/view to the controller. Snapshots flow from the
controller to all attached views. A resync request returns the latest
controller snapshot without requiring the view to know where the controller
is hosted.

## Lifecycle

The generic lifecycle includes open, attach, detach, placement changes,
visibility changes, invalidation, resync, close, and dispose. Replacing an
instance with the same instance id closes the previous transport session so
late commands or snapshots cannot reach the replacement. Closing a controller
binding unsubscribes listeners, disposes the controller, and closes transport
delivery.

The registry keeps logical instance identity and placement separate from
rendering. Moving a surface through a native window preserves its prior dock
edge for a later return. Unregistering a surface removes its open instances.

FuzzBall, Taps, and other feature integrations may use this boundary later;
this protocol does not define or persist feature-specific state.
