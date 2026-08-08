# Side Channels Plan

## Purpose

- Define the host-managed side channel system for world PlayScreens.
- Provide a side-mounted surface for long lists of short items.
- Keep side channels separate from the top channel bar and from modal windows.
- Let plugins and built-in features use the same host shell for list-style UI.

## Core Idea

- Side channels are mounted along the side of the PlayScreen.
- They are optimized for compact, scannable lists rather than large editable forms.
- The host owns which side channel is active, how it is rendered, and how it is resized.
- Only one side channel may be visible at a time unless the host later decides otherwise.

## Good Fits

- WF, as a contact-style list of known characters and their online status.
- WS, as a room list showing who is present and related metadata.
- Other compact lists that benefit from persistent visibility while the world tab is open.

## Host Responsibilities

- Create, show, hide, activate, and close side channels.
- Preserve side channel state while the world tab remains open.
- Keep list rendering readable at a glance.
- Handle scrolling, selection, and refresh behavior for dense text lists.
- Expose a stable surface for plugin routing into side channels.

## Plugin Surface

- Plugins should be able to request a named side channel.
- Plugins should be able to route data into a side channel without owning layout.
- Plugins should be able to contribute small controls that affect a side channel if needed.
- Side channels should stay host-rendered, not freeform plugin DOM.

## Suggested First Cut

- Add the side channel shell to the world PlayScreen.
- Implement WF and WS as the first side channel candidates.
- Define the minimal host API for opening and refreshing a side channel.
- Keep the first version narrow enough to prove the layout and routing model.

## Relationship To Other Plans

- `PLAN_CHANNELS.md` defines the top channel bar and its controls.
- `PLAN_WINDOWS.md` defines modal and pop-out window behavior.
- `PLAN_TAPS.md` should map Taps list-style surfaces such as WF and WS to side channels.

## Next Steps

- Define the side channel data model and layout.
- Decide how side channels should collapse on narrow windows.
- Decide whether WF and WS share a common list shell or separate view types.
- Draft the host events needed to open and refresh side channels.
