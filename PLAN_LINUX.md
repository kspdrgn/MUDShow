# Linux Release and Upgrade Plan

## Recommendation

Treat Linux releases as multiple install channels rather than one universal installer.

1. AppImage plus Tauri updater for direct downloads from GitHub Releases.
2. AUR package for Arch Linux users.
3. Debian and RPM packages for distro package-manager installs.

The first updater-supported Linux release should be AppImage-only. AUR, Debian, and RPM packages should update through their package managers, not through the app replacing itself.

## Why AppImage First

Tauri's built-in updater has a clear Linux path for AppImage builds. When updater artifacts are enabled, Linux builds produce the normal AppImage plus a `.sig` signature file that the updater can verify and install.

AppImage is also the simplest direct-download Linux artifact because it does not require setting up distro repositories first. Users can download it, mark it executable, and run it.

The tradeoff is that AppImage bundles more dependencies and can be larger. That is acceptable for the first Linux release because it keeps release mechanics simple while the rest of the packaging story is still unsettled.

## Arch Linux Convention

On Arch, the native convention is an AUR package installed and updated with `pacman` or an AUR helper. Since package-manager installs are owned by the package manager, the app should not silently self-update those installs.

For Arch, create an AUR `PKGBUILD` later. It can either:

- Extract from the released `.deb`.
- Build from source.
- Install the AppImage as an AppImage-backed package.

The cleanest first AUR route is probably extracting from the `.deb` once the Debian package exists, because Tauri already generates a reasonable Debian package layout.

## Implementation Checklist

1. Add the Tauri updater plugin.

   ```sh
   npm run tauri add updater
   ```

2. Register the updater plugin in `tauri/src/main.rs`.

   The app currently builds from `tauri::Builder::default()` and registers custom invoke handlers there. Add the updater plugin during builder setup or before build.

3. Configure updater artifacts in `tauri/tauri.conf.json`.

   Add:

   ```json
   {
     "bundle": {
       "createUpdaterArtifacts": true
     },
     "plugins": {
       "updater": {
         "pubkey": "PUBLIC_KEY_CONTENTS",
         "endpoints": [
           "https://github.com/<owner>/<repo>/releases/latest/download/latest.json"
         ]
       }
     }
   }
   ```

   The public key is committed in config. The private key must not be committed.

4. Generate updater signing keys.

   ```sh
   npm run tauri signer generate -- -w ~/.tauri/mudshow.key
   ```

   Store the private key and password as GitHub Actions secrets.

5. Extend CI with a Linux release job.

   Build on `ubuntu-22.04` or Debian 12 rather than Arch so the resulting binary does not require a too-new glibc. The Linux job should produce at least:

   - `MUDShow*.AppImage`
   - `MUDShow*.AppImage.sig`
   - `latest.json`

   Optional later outputs:

   - `.deb`
   - `.rpm`

6. Publish Linux artifacts in `.github/workflows/release.yml`.

   The current release workflow publishes Windows artifacts only. Extend it to include the Linux AppImage, signature, and update manifest once the Linux CI artifact exists.

7. Add update UI.

   Add a small manual update surface in app settings:

   - Current app version.
   - Check for updates.
   - Available version and release notes.
   - Download progress.
   - Restart to apply.

   Keep this manual first. Auto-checking can come later.

8. Make package-manager builds updater-aware.

   For AUR, Debian repository, RPM repository, or other package-manager installs, either disable the self-updater at build time or show a "check releases" style message instead of installing updates inside the app.

## Repo Touch Points

- `tauri/tauri.conf.json`: add updater config and `createUpdaterArtifacts`.
- `tauri/Cargo.toml`: add `tauri-plugin-updater`.
- `tauri/src/main.rs`: register updater plugin or app-owned update commands.
- `package.json`: may gain `@tauri-apps/plugin-updater` if update checks are done directly from frontend code.
- `tauri/capabilities/default.json`: may need updater plugin permissions if using frontend plugin APIs directly.
- `.github/workflows/ci.yml`: add Linux build artifact job.
- `.github/workflows/release.yml`: publish Linux artifacts and `latest.json`.
- `frontend/src/lib/components/SettingsPage.svelte`: likely home for manual update UI.

## Suggested Architecture

Prefer a small Rust-owned update module over direct frontend-only updater calls.

The Rust side can own:

- Checking configured endpoints.
- Downloading and installing updates.
- Sending progress events to the frontend.
- Restarting the app after install.

The frontend can stay simple:

- Invoke `check_for_update`.
- Invoke `install_update`.
- Display progress and errors.

This keeps signing, endpoint behavior, and install details close to Tauri while the UI remains ordinary settings-page state.

## Open Questions

- What GitHub owner/repo URL should be used for the updater endpoint?
- Should the first Linux release publish only AppImage, or AppImage plus `.deb`?
- Should app settings expose update checks on all platforms at once, or start Linux-only?
- How should package-manager builds identify themselves so the app can suppress self-update?

## Useful References

- Tauri updater docs: https://v2.tauri.app/plugin/updater/
- Tauri AppImage docs: https://v2.tauri.app/distribute/appimage/
- Tauri AUR docs: https://v2.tauri.app/distribute/aur/
