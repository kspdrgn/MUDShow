# Session Logging

Session logging records the visible transcript for a world tab to a user-chosen file.

## Scope

- Logging is started and stopped per world tab.
- A logged tab writes its current transcript history first, then appends subsequent session output as it arrives.
- Logging continues independently of connection state until the user stops it.
- Logging does not create a new tab or change which tab is active.

## Entry UI

- The context menu of a world tab will contain two options to initiate logging actions:
  - quick log - begins logging with no user input
  - logging... - open a logging control modal

## Logging Config Modal

A modal window will provide options for the current world tab
- Show logging status
- Log file location.
  - Show current log file location
  - Similar to app settings database file location, the location display will provide controls to view the file in its folder, and to move the live file.
  - User may edit the log file name to rename the file on-the-fly. The file will be copied to the new name, and logging will continue in the new file. Logging must queue pending log entries until the log file move is successful.
  - User may append a log file onto an existing file by using the move action and selecting an existing file. The existing file contents will be preserved, and logging will append to this file.
- Start logging if not started
- Stop logging if started

## File Naming

- When logging starts, the app creates a filename automatically from the current `YYYY-MM-DD` date, world name, and character name.
- The generated name should be human readable and filesystem safe.
- The user may rename the active log file while logging continues.
- Renaming the log file moves the active file to the new path and keeps logging into that same file.
- A rename action should allow either small edits to the generated name or full replacement of the filename.

## Log Folder

- App Settings include a default log folder location.
  - User may open the folder in native OS file explorer, or move the folder, similar to app settings database file controls. Moving the log folder in this way will not move any existing log files, or disrupt active logging sessions.
- If the configured folder is missing or invalid, the app should fall back to a safe default location. The default save location is the user profile folder, similar to app settings database file handling, with fallback to a temp folder.
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
- The log file will not contain any ANSI codes such as color, and will not contain any content injected by this app such as image file previews
