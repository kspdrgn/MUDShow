# Channels

World channels are host-managed surfaces inside a PlayScreen. They sit above the transcript and input areas and provide a compact bar plus a separate panel area.

## Current Behavior

- The channels bar lives at the top of the PlayScreen.
- The bar can hide itself when no channel is open.
- A thin hover area below the top bar can reveal the bar again.
- Only one channel may be visible at a time; opening a channel hides the others.
- The Hide control closes the active channel and collapses the channel panel.
- If a channel is explicitly opened, it stays visible until the user chooses Hide.
- The channel panel appears beneath the bar when a channel is open.
- The channel panel includes a bottom-edge resize handle so the user can adjust its height.

## Current Host Use

- The first implementation uses a real debug console channel to exercise the bar, reveal, hide, and resize behavior.
- The host owns the channel state and decides which channel is active.
- Channel content is rendered as a host-managed component inside the channel panel.
- Notes now use the same channel shell as the debug console and stay mounted while hidden.

## Scope

- Channels are only for world PlayScreens.
- App-level tabs and settings tabs are not channels.
- Notes and the debug console are the first built-in world channels and stay mounted in the host-managed channel shell while hidden.
