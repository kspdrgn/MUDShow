# Session Logging

Session logging records the visible transcript for a world tab to a user-chosen file.

## Scope

- Logging is started and stopped per world tab.
- A logged tab writes its current transcript history first, then appends subsequent session output as it arrives.
- Logging continues independently of connection state until the user stops it.
- Logging does not create a new tab or change which tab is active.

## File Naming

- When logging starts, the app creates a filename automatically from the current `YYYY-MM-DD` date, world name, and character name.
- The generated name should be human readable and filesystem safe.
- The user may rename the active log file while logging continues.
- Renaming the log file moves the active file to the new path and keeps logging into that same file.
- A rename action should allow either small edits to the generated name or full replacement of the filename.

## Log Folder

- App Settings include a default log folder location.
- If the configured folder is missing or invalid, the app should fall back to a safe default location.
- The logging feature should use the configured default folder unless the user chooses a different destination.

## Visibility

- When logging is active, the UI shows a second status indicator dot beneath the connection status dot on the input bar and the tab.
- The logging indicator is visible whenever the tab is actively recording to a file.
- The output window displays a status message when logging starts and when logging stops.

## User Actions

- The user can start logging the active world tab.
- The user can stop logging when logging is active.
- The user can rename the active log file while logging is active.

## File Contents

- The log file contains the same transcript the user would read in the session output view.
- Logging captures the transcript in display order.
- The log should remain readable as plain text.
