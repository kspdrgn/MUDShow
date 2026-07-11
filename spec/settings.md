# Settings and Permanent State

- App settings
- World and character settings
- Fonts and colors settings
- Highlight settings

# Persistence / Storage

The application database is stored in a JSON file to be easily readable and manageable by the user. The file stores a version of the schema used, which is used to automatically upgrade the database file to newer versions. Any breaking change to the storage schema should increment the storage version used.

# App Settings

- Database file location
  - The app uses the default location when this setting is null or invalid.
  - The setting is only populated after the database file has been moved.
  - App settings include actions to reveal the current database folder and move the database file.
  - A white folder button opens the current database folder in the OS file manager and selects the file.
  - A red folder move button opens a native save dialog, copies the database file to the selected location, and removes the old file after a successful copy when it is safe to do so.
- Image link previews
  - A boolean app setting controls whether image URLs in transcript links may later render inline previews.
  - The default is off.
  - The setting is stored locally with the rest of the app settings.
- Show current output when scrolling up
- Default log folder location
  - The app uses a safe default location when this setting is null or invalid.
  - Session logs are created in this folder unless the user explicitly chooses a different destination.

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

Some settings can be stored anywhere in a tree heirarchy of worlds and their characters.

Many settings can apply to a MU world as a whole or only to specific characters within the world. This interface appears as a tree with each known MU world, containing each owned character.

A 'Default' character exists for every world, which cannot be renamed. The default character is used to connect without using any specific character settings.

Named characters can store input and output history, and can override style settings provided by the default character.

## Fonts and Colors Settings

Uses hierarchical settings.

Font and color settings are the same between worlds and characters. Characters can have override settings that are different from the world settings.

## Trigger / Highlight Settings

Uses hierarchical settings.
