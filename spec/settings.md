# Settings and Permanent State

- App settings
- World and character settings
- Fonts and colors settings
- Highlight settings

# Persistence / Storage

The application database is stored in a JSON file to be easily readable and manageable by the user. The file stores a version of the schema used, which is used to automatically upgrade the database file to newer versions. Any breaking change to the storage schema should increment the storage version used.

# App Settings

Setting tabs:
- Database
- Window
- Transcript
- Logging
- Connections
- Spellcheck
- Default Style
- UI

The app settings screen shows these sections as a left-side tab rail, with the first tab selected by default and the active pane rendered to the right.
While the app settings tab stays open, it remembers the last selected sub-tab. If the app settings tab is closed and later reopened, it starts back on the first sub-tab by default.

## Database - customize storage of app settings
- Selection of storage mode, locked to 'external json file' mode for now
- Displays current database file location
  - Reveal file - A white 'folder' button opens the current database folder in the OS file manager and selects the file.
  - Move file - A yellow 'file move' button opens a native save dialog, copies the database file to the selected location, and removes the old file after a successful copy when it is safe to do so.
  - Pick different file - A red 'file open' button opens a native file picker dialog starting at the current database file location. The user can select a JSON database file, and the app will set this file as the current database file and load from it, ignoring the original file.
- The app uses the default location when this setting is null or invalid.
- The location of the database file is stored within the app's webview storage, so custom locations can be remembered.
- All settings (besides the location of the settings file) are saved immediately to the database file

## Window - behavior of the entire app window
- Flash window title when new activity arrives (this might be moved into world or character options)
- Keep window on-top
- Window transparency

## Transcript - behavior of output area
- Keep current output in view when scrolling - enables split output when scrolling up.
- Show image link previews - A boolean app setting controls whether image URLs in transcript links may later render inline previews. The default is off.

## Logging
- Displays default log folder location, not directly editable
  - Button to open the folder in OS native explorer
  - Button to open a native folder picker to select a different folder, no logs will be moved
- The app uses a safe default location when this setting is null or invalid.
- Session logs are created in this folder unless the user explicitly chooses a different destination.

## Connections
- Connection timeout time
- Connection retry count
- Send TCP keep-alive signals

## Spellcheck
- Dictionary to use for input spellchecker

## Default Style
- Shared style settings shell for the app-wide defaults, with no override controls since this is the bottom level used by any worlds or characters
- App default style is stored top level in the settings file as "style"
- See `spec/style.md` for details on how styles can be customized and the UI for it

## UI
- App color and font scheme - locked to 'midnight' for now, which is a dark mode

# World Settings
- Connection info:
  - name, host, port
  - secure/plain connection choice
  - verify secure connection choice

# Character Settings
  - optional preferred output width
  - rolling output history limit
  - activity sound setting

# Settings stored per world + character

Some settings can be stored anywhere in a tree hierarchy of worlds and their characters.

Many settings can apply to a MU world as a whole or only to specific characters within the world. This interface appears as a tree with each known MU world, containing each owned character.

A 'Default' character exists for every world, which cannot be renamed. The default character is used to connect without using any specific character settings.

Named characters can store input and output history, and can override style settings provided by the default character.

## World / Character Style Settings

Uses hierarchical settings.

Font and color settings options are the same between worlds and characters. World styles can override app styles. Character styles can override world styles and app styles.

## Trigger / Highlight Settings

Uses hierarchical settings.
