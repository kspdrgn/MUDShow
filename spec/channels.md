# Channels

World channels are host-managed surfaces inside a PlayScreen. A shared channel controller owns their registration, activation, hide/show state, and close behavior. They sit above the transcript and input areas and provide a compact bar plus a separate panel area.

## Current Behavior

- The controller owns channel state and decides which channel is active.
- The channels bar lives at the top of the PlayScreen.
- The channels bar keeps channel tabs anchored to the left and provides a right-anchored host-controls area for custom world-level controls.
- Host controls are registered separately from channel tabs and can be shown in the bar without opening a channel panel.
- The bar can hide itself when no channel is open, and it stays hidden until at least one channel has been registered in that world tab.
- A thin hover area below the top bar can reveal the bar again.
- If only host controls are registered and no channel is active, moving the pointer away from the reveal zone hides the bar again.
- Right-clicking a channel tab opens a generic context menu with a Close option.
- Right-clicking the empty bar area or the Hide button does nothing.
- Only one channel may be visible at a time; opening a channel hides the others.
- Each registered channel tab has a close button that unregisters it from the bar and hides it if it is open.
- The Hide control closes the active channel and collapses the channel panel.
- If a channel is explicitly opened, it stays visible until the user chooses Hide.
- The channel panel appears beneath the bar when a channel is open.
- The channel panel includes a bottom-edge resize handle so the user can adjust its height.
- `PlayScreen` owns the visual shell and layout behavior for the bar and panel, while the controller owns the open/close state.

## Current Host Use

- Channel content is rendered as a host-managed component inside the channel panel.
- Plugin-owned systems can manage their own channel tabs through the same controller API if they need hosted channel content.
- The debug console is no longer a channel; it is a separate host-managed surface in the window host.
- The notes surface is no longer a channel; it is a separate host-managed surface in the window host.

## Scope

- Channels are only for world PlayScreens.
- App-level tabs and settings tabs are not channels.
- The debug console is world-scoped but is hosted as a separate surface outside the channel bar and panel.
- The notes surface is character-scoped but is hosted through the window host instead of the channel harness.
- Highlights and rules are not part of the current channel system.
