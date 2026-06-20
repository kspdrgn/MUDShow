# Linux Build Plan

## Goal

Add Linux release builds alongside the existing Windows pipeline, with a path toward Arch Linux distribution through the AUR and `yay`.

## Current Constraints

- The current desktop build flow is Windows-specific.
- `scripts/build-desktop.mjs` stages a Windows Node sidecar (`node-*.exe`) and will fail on Linux.
- The existing CI/CD setup currently assumes Windows desktop packaging for the release artifact.

## Possible other approaches and unanswered questions

- Converting backend proxy from node to native Rust may be easier to produce multi-platform builds without needing to ship a Node runtime
- Not sure the best way to provide a Linux executable
- Not sure if we can produce the Linux build on a Windows machine. It would be acceptable if we need to use Linux system to produce Linux outputs, but it would be nice to build both from Windows.

## Phase 1: Linux Release Artifacts

### Target output

- Produce a Linux desktop artifact from CI.
- Prefer an AppImage as the first Linux deliverable.

### What needs to change

- Split the desktop build logic so Linux does not use the Windows-only sidecar staging path.
- Add a Linux CI job that:
  - checks out the repo with full history if GitVersion is used
  - installs Node, pnpm, Rust, and Linux system dependencies
  - computes the build version
  - builds the frontend and backend
  - runs the Tauri Linux bundler
  - uploads the Linux artifact

### Likely Linux dependencies

- Tauri’s Linux prerequisites include packages such as:
  - `webkit2gtk-4.1`
  - `openssl`
  - `curl`
  - `file`
  - `xdotool`
- Exact package names depend on the distro runner.

## Phase 2: Release Publishing

### Target behavior

- Keep CI responsible for building and validating the Linux artifact.
- Keep CD thin.
- CD should download the artifact from the matching CI run and publish it.

### Release assets

- Windows:
  - MSI
  - NSIS installer
- Linux:
  - AppImage

## Phase 3: Arch Linux / `yay`

### Preferred path

- Publish release artifacts from GitHub Releases.
- Create an AUR package that points at those release artifacts.
- Let users install via `yay`, which is just an AUR helper, not the package itself.

### AUR package shape

- Create a `PKGBUILD`.
- Use the GitHub release version as `pkgver`.
- Make the package depend on the libraries Tauri apps need on Arch.
- Generate `.SRCINFO`.
- Test with `makepkg`.
- Publish the package to the AUR.

## Versioning

- Use the same GitVersion-derived semantic version across Windows and Linux builds.
- Prefer one version per CI run so all artifacts from a build line up cleanly.

## Suggested Implementation Order

1. Add Linux CI packaging for AppImage.
2. Keep the existing GitVersion-based versioning.
3. Publish Linux artifacts from CD using the existing artifact handoff pattern.
4. Add an AUR package that consumes the release artifact.

