# Auto-Upgrade Plan for MUDShow

## Goal

Implement Tauri Updater inside the app so MUDShow can check for updates, download them, and install them safely.

## Scope

This document is only about the app-level updater implementation.

Platform-specific packaging, artifact naming, and release pipeline details live in:

- [PLAN_AUTOUPGRADE_WINDOWS.md](/C:/_/projects/MUDShow/PLAN_AUTOUPGRADE_WINDOWS.md)
- [PLAN_AUTOUPGRADE_LINUX.md](/C:/_/projects/MUDShow/PLAN_AUTOUPGRADE_LINUX.md)

## Short Answer

The app needs a small updater layer that can:

- check the configured release endpoint
- show update availability to the user
- download the update with progress feedback
- install the update and relaunch cleanly

The app should not care how the release artifact was built. It only needs to know the updater endpoint, the public signing key, and the user-facing update flow.

## What Belongs Here

- Updater plugin wiring in the app
- App-side update state and lifecycle
- UI for checking and installing updates
- Progress, error, and release-note presentation
- Safe shutdown and relaunch behavior
- Channel handling if we add stable or beta tracks later

## What Does Not Belong Here

- Windows installer packaging details
- Linux AppImage packaging details
- CI artifact naming
- Release workflow publishing rules
- Platform-specific release notes

Those details belong in the platform-specific plans.

## Implementation Plan

### 1. Add updater support to the app

- Add the Tauri updater plugin to the app.
- Wire the updater public key into the app config.
- Keep the updater endpoint configurable by platform.

### 2. Add an updater controller in the app

- Create one place that owns update checks, downloads, and installs.
- Expose the current updater state to the UI.
- Track states such as:
  - idle
  - checking
  - available
  - downloading
  - ready to install
  - installing
  - failed

### 3. Build the user-facing update flow

- Add a small update entry point in settings or a similar low-clutter location.
- Show the currently installed version.
- Show update availability and release notes when present.
- Let the user choose:
  - check now
  - install now
  - remind me later
  - install on exit

### 4. Handle installation safely

- Disconnect active MUD sessions before the update installs.
- Close the app cleanly before the installer or updater relaunches it.
- Avoid double-starting an install if one is already in progress.

### 5. Support release notes and errors

- Show release notes when the endpoint provides them.
- Show download and install failures in a readable way.
- Keep the UI simple enough that update problems do not block normal play.

### 6. Leave room for channels later

- Keep the app ready for stable/beta channel separation later if we decide to add it.
- Avoid hard-coding assumptions that only work for a single release stream.

### 7. Verify the updater flow

- Confirm the app can detect an available update.
- Confirm the app can download it.
- Confirm the app can install it and relaunch successfully.
- Confirm the app handles a no-update case cleanly.

## Open Questions

- Should the app check for updates automatically on launch, or only when the user asks?
- Should the app prompt immediately when an update is found, or wait for user action?
- Should update checks be on by default for all release channels?
- Do we want one release channel first, with beta support later?

## Suggested First Pass

1. Add the updater plugin wiring.
2. Build the app-side updater controller.
3. Add a minimal settings-page update UI.
4. Add safe shutdown and relaunch behavior.
5. Verify the updater flow against the release metadata produced by the platform plans.
