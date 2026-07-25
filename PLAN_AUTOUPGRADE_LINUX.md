# Linux Auto-Upgrade Plan for MUDShow

## Goal

Produce Linux AppImage releases through the existing release pipeline so users can either:

- download the AppImage manually from GitHub, or
- install updates through Tauri's updater flow

## Scope

This plan covers Linux AppImage release production and updater compatibility only.

It does not try to solve AUR, Debian, RPM, or other package-manager distribution paths yet.

## Short Answer

Linux auto-updates with Tauri are practical if we standardize on AppImage for direct-download Linux releases.

The key pieces are:

- a project-owned Tauri signing keypair
- `latest.json` release metadata published with each release
- CI building the AppImage and its signature
- the Release workflow publishing the AppImage, signature, and metadata together

That gives us one Linux artifact that works for both manual GitHub downloads and Tauri updater installs.

## What The Current Plans Say

`PLAN_LINUX.md` is directionally correct that AppImage should be the first Linux updater path.

`PLAN_AUTOUPGRADE.md` is also correct that Linux auto-updates need AppImage rather than a raw executable.

The main refinement for this plan is to make the release pipeline produce the AppImage in a way that works for both:

- direct manual download from GitHub Releases
- Tauri updater metadata and signature validation

## Recommended Linux Release Model

Use one Linux distribution artifact for the updater path:

- AppImage for Linux users who download releases directly
- AppImage for Tauri updater installs

Keep package-manager distributions for later. They should update through their own package managers, not through the app self-replacing.

## What Tauri Needs

Tauri's Linux updater path is AppImage-based.

That means we need:

- CI-generated AppImage build output
- the matching `.sig` file
- a public signing key embedded in app config
- the private signing key available in CI
- release metadata that points to the AppImage and signature

For a GitHub-hosted release flow, the metadata should be stable and easy for the app to fetch, such as a `latest.json` asset under the release download URL.

## Implementation Plan

### 1. Standardize on AppImage for Linux releases

- Make AppImage the supported Linux direct-download format.
- Do not rely on the raw executable as the user-facing Linux release path.
- Keep the output naming and packaging stable across releases so the release manifest stays predictable.

### 2. Add updater support to the app

- Add the Tauri updater plugin if it is not already present.
- Configure the updater public key in `tauri/tauri.conf.json`.
- Point the updater endpoint at the Linux release metadata.
- Keep the app-side update flow simple:
  - check for updates
  - download update
  - install now
  - install on exit

### 3. Generate and protect the signing keypair

- Generate one project signing keypair for Tauri updates.
- Store the private key outside the repo in CI secrets or an equivalent secure store.
- Keep the public key in the repo config.
- Make sure the release workflow injects the private key through environment variables during the Linux build.

### 4. Enable Linux updater artifact generation

- Turn on `createUpdaterArtifacts` in the Linux CI build.
- Verify the Linux build produces:
  - the AppImage
  - the AppImage signature
- Keep the artifact names consistent with the filenames used in the release metadata.

### 5. Update the Linux CI build job

- Build Linux releases on a supported Ubuntu runner, not on a distro that would create fragile runtime dependencies.
- Install the Tauri Linux build dependencies needed for AppImage packaging.
- Stamp the build version from the release versioning step before bundling.
- Produce the AppImage in CI so the Release workflow can publish the finished artifact.

### 6. Update the release workflow

- Publish the CI-built Linux AppImage as a GitHub Release asset.
- Publish the matching `.sig` file alongside it.
- Publish `latest.json` or equivalent updater metadata with the same release.
- Keep the metadata, version, and signature in sync so the updater can verify the exact file users download.

### 7. Make manual downloads and updater installs share the same artifact

- Use the same CI-built AppImage file for both manual GitHub downloads and updater distribution.
- Do not generate a separate "updater-only" Linux artifact unless we later discover a real reason to split them.
- Make sure the GitHub Release assets are obvious to a human user who wants to download the AppImage manually.

### 8. Add validation checks

- Confirm the release job produces an AppImage that launches on Linux.
- Confirm the release job publishes a valid signature file.
- Confirm the updater metadata points at the published AppImage.
- Confirm the app can detect, download, and install a Linux update from the release metadata.

## Suggested CI / Release Outputs

At minimum, each Linux release should publish:

- `MUDShow-<version>.AppImage`
- `MUDShow-<version>.AppImage.sig`
- `latest.json`

If we later decide to keep additional Linux packaging formats, they should be separate release assets and should not change the AppImage updater path.

## Open Questions

- Should the Linux release metadata live in `latest.json` at the GitHub release download URL, or do we want a separate static endpoint later?
- Should the app check Linux updates automatically on startup, or only when the user asks?
- Do we want to keep a raw Linux executable as a supplemental artifact, or move fully to AppImage for direct downloads?
- Do we want to add package-manager releases later, or keep Linux distribution focused on AppImage for now?

## Suggested First Pass

1. Generate and store the Tauri signing keypair securely.
2. Turn on Linux AppImage bundling and `createUpdaterArtifacts` in CI.
3. Publish the CI-built AppImage, `.sig`, and `latest.json` from the release workflow.
4. Point the app updater config at the Linux release metadata.
5. Verify a release can be downloaded manually and also installed through the updater.
