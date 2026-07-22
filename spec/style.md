# Style - Settings for fonts and colors used by input and output area

Style settings are designed to work at three levels: app, world, character.
Only the app level is wired up right now, and its values are applied to the live connected world shell.

The style UI is built as a reusable shared shell that tracks whether it is controlling app style, a world style, or a character style.

Storage of style settings:
- App - persisted in the app storage file as the top-level `style` object
- World - planned for later
- Character - planned for later

Each "style" object has the same schema. 

Style settings have three main areas in the UI:
- Output
- Input
- Preview

# Preview

Shows example output using the currently applicable app styles and live app-wide overrides.

Preview area shows two parts to simulate how the app's output and input area will look:
- Output area displays several lines of example text.
- Input area displays one line of example text.
The connected world view uses the same resolved app-level values for its live output and input surfaces.

# Output / Input Styles UI

Output and Input have the same style settings UI.

Settings areas, for both output and input:
- Font - Fonts UI
- Foreground - Colors UI
- Background - Colors UI

Each color control has its own override toggle that controls whether that draft value is considered active. The toggle changes only when the user changes it explicitly.

When a color toggle is off, that control shows the inherited value for that scope. If the user changes a control away from that inherited value, the override turns on immediately and the new value is saved into that override. Turning the toggle back on later restores the stored override value immediately.

The app-level style settings are live and persist to the app storage file. App defaults are the baseline values that output/input inherit from when nothing is overridden.

## Fonts UI

- Font selection uses the app font shelf described in `spec/fonts.md`.
- The shelf includes built-in fonts and user-added system font families.
- Built-in font choices are always available:
  - JetBrains Mono
  - System UI
  - Serif
- System font families are added from a separate system font picker backed by the desktop font discovery layer.
- The normal style UI should show the compact shelf rather than every installed system font.
- If the selected shelf family has multiple available faces, the style UI may expose a style selector for weight, italic, and stretch variants.
- Missing system font shelf entries remain visible and can be replaced or deleted according to `spec/fonts.md`.
- Font Size, number picker

## Colors UI

- Foreground Color picker with native browser color control and text entry for exact CSS values, plus its own override toggle
- Background Color picker with native browser color control and text entry for exact CSS values, plus its own override toggle
- The hex color text field includes a copy button and normalizes pasted hex values to a consistent lower-case `#rrggbb` format when possible.
- Background Image - Placeholder section is shown in the UI with disabled controls and a struck-through header until it is implemented later. It will eventually have a file picker and options for how the image will fit in the window, plus transparency percent or gradient options.

# Override Behavior

Styles have four levels:
- Default app styles - These are hardcoded sensible default values that the app starts with.
- App styles - User overrides of the default styles used by every world and character.
- World styles - World-level overrides used by each of the world's characters.
- Character styles - Character-level overrides used only by one character.

Toggling and persistence:
- Each draft style value has a local UI state so users can toggle it off and back on without losing the last entered value.
- Turning a toggle off removes that setting from the persisted style data when persistence is enabled.
- Opening the style UI with no saved style data starts from the app style values.
