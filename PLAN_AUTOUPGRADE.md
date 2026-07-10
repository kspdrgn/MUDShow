# Auto-Upgrade Plan for MUDShow

## Short Answer

Yes, this can work with a bundled desktop release, including an installer-based release flow, but not with the current packaging exactly as-is.

The current repo already produces Windows installers on `main` (`msi` and `nsis`) and publishes them to GitHub Releases, but Tauri's updater needs a few extra pieces:

- signed update artifacts
- updater plugin wiring in the app
- release assets or a static update JSON that points to the right artifact
- UI flow for "update now" and "remind me on exit"

For Windows specifically, Tauri supports updater installs from MSI and NSIS releases, and the install step will quit the app as part of the update process.

## What the Repo Does Today

- The Tauri config currently bundles the app, but does not enable updater support in `tauri/tauri.conf.json`.
- The CI workflow stamps the version and switches release targets between app-only builds and installer builds in `.github/workflows/ci.yml`.
- The release workflow publishes the installers and the standalone executable to GitHub Releases in `.github/workflows/release.yml`.
- The app already handles `ExitRequested` and `Exit` so it can disconnect from the MUD cleanly in `tauri/src/main.rs`.

## Recommended Path

Use the Tauri updater plugin with GitHub Releases as the source of truth.

That gives us:

- version checks against the latest release
- a signed update artifact
- a simple release pipeline that still lands on GitHub
- support for prompting the user either immediately or on app exit

## Implementation Plan

### 1. Decide the update packaging strategy

- Keep the current installer release flow for end users.
- Add updater artifacts alongside the regular installer assets.
- Prefer one Windows update path for simplicity if release maintenance starts to feel heavy, but do not require that decision up front.

### 2. Add updater support to the app

- Add the Tauri updater plugin.
- Configure the updater public key in `tauri/tauri.conf.json`.
- Add a small UI entry point for:
  - checking for updates
  - downloading the update
  - offering to install now
  - offering to install on exit
- Make sure the exit path still disconnects MUD sessions before the installer starts.

### 3. Add signing and artifact generation to the build

- Generate and store the Tauri signing keys securely.
- Add the private key to the build environment in CI.
- Enable `createUpdaterArtifacts` in the Tauri bundle config.
- Verify the build produces both:
  - the normal installer files
  - the updater-side signed artifacts Tauri expects

### 4. Update GitHub release publishing

- Publish the updater JSON or updater assets needed by the plugin.
- Keep the existing release notes flow.
- Make sure the update metadata always points to the exact versioned artifact for the matching platform.
- Keep `main` as the only branch that publishes real release artifacts.

### 5. Add the in-app user flow

- Check for updates on startup or after the main window is ready.
- If an update is found, show a lightweight prompt with:
  - install now
  - remind me later
  - install when closing the app
- If the user chooses "on exit", persist that preference for the current session or character profile.
- If the user closes the app while an update is pending, prompt again before exit or immediately launch the installer, depending on the install mode.

### 6. Handle platform-specific behavior

- On Windows, expect the installer to exit the app during install.
- On Linux and macOS, verify the updater package format and any restart behavior separately.
- Keep any "close and relaunch" logic platform-aware instead of assuming every OS behaves the same way.

### 7. Add tests and release checks

- Add a dry-run path or mocked update check for development builds.
- Verify the updater metadata and signed artifact names in CI.
- Confirm that a release build can:
  - detect a newer release
  - download it
  - install it
  - relaunch successfully

## Open Questions

- Do we want the updater to check only against stable releases, or should we eventually support beta/nightly channels?
- Should the user see the prompt on startup, on manual action only, or both?
- Do we want to keep both MSI and NSIS, or simplify to one Windows installer format before wiring up auto-update?

## Suggested First Pass

1. Add the updater plugin and config wiring.
2. Turn on updater artifact generation in CI.
3. Publish the matching signed update artifacts from GitHub Releases.
4. Add a simple "Check for updates" action in the UI.
5. Add the "offer on exit" flow once the basic update path is working.
