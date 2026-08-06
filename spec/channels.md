# Channels

World channels are host-managed surfaces inside a PlayScreen. They sit above the transcript and input areas and provide a compact bar plus a separate panel area.

## Current Behavior

- The channels bar lives at the top of the PlayScreen.
- The bar can hide itself when no channel is open, and it stays hidden until at least one channel has been registered in that world tab.
- A thin hover area below the top bar can reveal the bar again.
- Right-clicking a channel tab opens a generic context menu with a Close option.
- Right-clicking the empty bar area or the Hide button does nothing.
- Only one channel may be visible at a time; opening a channel hides the others.
- Each registered channel tab has a close button that unregisters it from the bar and hides it if it is open.
- The Hide control closes the active channel and collapses the channel panel.
- If a channel is explicitly opened, it stays visible until the user chooses Hide.
- The channel panel appears beneath the bar when a channel is open.
- The channel panel includes a bottom-edge resize handle so the user can adjust its height.

## Current Host Use

- The debug console channel is registered on demand the first time the user opens it, but it continues to receive raw output while hidden after that.
- The notes channel is registered on demand the first time the user opens it, and it keeps the saved character text available while hidden after that.
- The host owns the channel state and decides which channel is active.
- Channel content is rendered as a host-managed component inside the channel panel.
- Notes use the same channel shell as the debug console.

## Scope

- Channels are only for world PlayScreens.
- App-level tabs and settings tabs are not channels.
- The notes channel is character-scoped within the host-managed shell, while the debug console remains world-scoped.
