# Style - Settings for fonts and colors used by input and output area

Style settings can be stored at three levels: app, world, character.

The style UI is built as a reusable shared shell that tracks whether it is controlling app style, a world style, or a character style.

Storage of style settings in database file:
- App - "style" object at top level
- World - "style" object within a world
- Character - "style" object within a world character

Each "style" object has the same schema. 

Style settings have three main areas in the UI:
- Output
- Input
- Preview

# Preview

Shows example output using the currently applicable styles, which may use inherited app or world options

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

The app-level style settings use the same UI for layout testing, but app defaults are still the baseline values that output/input inherit from when nothing is overridden.

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
