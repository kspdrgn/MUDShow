# Windows Auto-Upgrade Plan for MUDShow

## Goal

Let Windows users upgrade MUDShow from inside the app without manually downloading a new installer each time.

## Scope

This plan covers the Windows updater path only.

Linux packaging and Linux auto-update behavior are intentionally out of scope for this document and will be handled separately later.

## Short Answer

Windows auto-updates with Tauri are a good fit for this repo.

The main things we need are:

- Tauri updater plugin wiring in the app
- a project-owned signing keypair
- update artifacts generated during CI
- release metadata published with each tagged build
- a small in-app flow for checking and installing updates

## Current State

- The repo already builds Windows release artifacts in CI.
- The current release workflow already publishes GitHub Releases from CI output.
- The app already disconnects cleanly on exit, which matters because the updater will need to close the app before installing.
- `tauri/tauri.conf.json` does not yet enable updater support.
- The project does not yet generate updater-specific artifacts or signatures.

## Recommended Windows Packaging Strategy

Keep the current Windows installer release flow, but make one installer format the primary updater target.

Recommended approach:

- use one installer format for auto-update metadata and install flow
- keep the other installer format only if we still want it for manual downloads or fallback distribution

This keeps the updater story simple and avoids maintaining multiple update paths unless we need them.

## What Tauri Needs

Tauri updater support is signature-based.

That means:

- the app embeds the public key
- CI holds the private key
- every update artifact is signed
- the app only installs updates that verify against the public key

Tauri can publish update metadata from a static JSON file or a release-hosted endpoint, including GitHub Releases.

## Implementation Plan

### 1. Add updater support to the app

- Add the Tauri updater plugin to the desktop app.
- Configure the updater public key in `tauri/tauri.conf.json`.
- Add a small update entry point in the UI.
- Support at minimum:
  - check for updates
  - download update
  - install now
  - install on exit

### 2. Decide the Windows update artifact we want to standardize on

- Pick the primary Windows installer format for updater use.
- Keep the other installer format only if we still want it as a manual download option.
- Make sure the release plan names the chosen installer format clearly so CI and release publishing stay consistent.

### 3. Generate and protect the signing keypair

- Generate one Tauri signing keypair for the project.
- Store the private key securely outside the repo.
- Keep the public key in the repo config.
- Do not rely on `.env` files for signing in CI, because Tauri expects the private key to be present in the build environment.

### 4. Turn on updater artifact generation in CI

- Enable `createUpdaterArtifacts` for Windows release builds.
- Make sure CI produces the signed updater artifact for the selected Windows installer format.
- Keep the normal installer build output too, so we do not lose the current manual install path.

### 5. Publish update metadata with each release

- Publish a `latest.json` style update manifest or equivalent GitHub-hosted metadata.
- Make sure the manifest points at the exact signed artifact for the released version.
- Include the release notes and version information in the metadata.
- Keep the metadata path stable so the app knows where to check.

### 6. Add the update flow in the app

- Check for updates on startup or from a menu action.
- Show a lightweight prompt when a newer version is available.
- Let the user choose:
  - install now
  - remind me later
  - install on exit
- Make sure the app disconnects MUD sessions before the update installer starts.

### 7. Update the release workflow

- Keep publishing GitHub Releases from `main`.
- Add the updater metadata and updater artifact to the release asset list.
- Keep the release tag and manifest version aligned.
- Make sure the release workflow fails loudly if the updater artifact is missing.

### 8. Validate the end-to-end flow

- Confirm CI generates the updater artifact and its signature.
- Confirm the app can detect a newer version.
- Confirm the app can download and install the update on Windows.
- Confirm the app relaunches cleanly after the installer finishes.

## Open Questions

- Which Windows installer format should be the primary updater target?
- Do we want updates to check automatically on startup, or only when the user asks?
- Do we want the app to prompt immediately when an update is found, or defer to a menu action first?
- Do we want one release channel only, or separate stable and beta channels later?

## Suggested First Pass

1. Add the updater plugin and public key wiring.
2. Pick the primary Windows installer format for updater use.
3. Turn on `createUpdaterArtifacts` in CI.
4. Publish updater metadata from the GitHub release workflow.
5. Add a minimal in-app "Check for updates" action.
6. Add the "install on exit" flow after the basic path works.
