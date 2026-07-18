# Style - Settings for fonts and colors used by input and output area

Style settings are designed to work at three levels: app, world, character.
Only the app level is wired up right now.

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

# Output / Input Styles UI

Output and Input have the same style settings UI.

Settings areas, for both output and input:
- Font - Fonts UI
- Foreground - Colors UI
- Background - Colors UI

Each style area has an override toggle that controls whether the draft value is considered active. If the draft value matches the inherited or default value, the toggle automatically turns off. When a toggle is off, the current draft value stays in the UI but is treated as inactive and is not persisted.

The app-level style settings are live and persist to the app storage file. App defaults are the baseline values that output/input inherit from when nothing is overridden.

## Fonts UI

- Font Source - Toggle between selecting built-in fonts and system fonts. Each option has its own selections of family and style and the other set will be disabled:
  - Font Family
  - Font Style, if available
- Font Size, number picker

## Colors UI

- Foreground Color picker
- Background Color, color picker
- Background Image - Placeholder, to be implemented later. Will have file picker and options for how the image will fit in the window, and transparency percent or gradient options.

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
