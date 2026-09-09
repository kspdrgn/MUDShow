# AGENTS.md

## Instruction Sources

### AGENTS.md and AGENTS.local.md

- Treat this file as the shared project-wide instruction set.
- If a local `AGENTS.local.md` file exists in the repository root, read it before starting work and follow its instructions too.
- Instructions in `AGENTS.local.md` may override conflicting instructions in this shared `AGENTS.md` file. The `AGENTS.local.md` file is intended only for instructions that are specific to the local system.
- Do not create `AGENTS.local.md` unless the user explicitly asks for it.
- If a task encounters sandbox restrictions that could be worked around by agent instructions, offer to add these instructions to the `AGENTS.local.md` file.
- If a Windows shell command fails with a sandbox or path-related process error, retry with a simpler single-command form, confirm the current working directory, and check `AGENTS.local.md` for any machine-specific path guidance before assuming the repository layout is wrong.

### Specification

Specification (spec) documents are in `spec/`. See the `spec/spec.md` file for the canonical structure and behavior of the app.

The spec documents are intended to be concise, human readable descriptions of all core functionality. The spec is generally agnostic to particular tech and implementation.

For every feature or behavior added to the app, we need to ensure the entire functionality is described in the appropriate spec document. The files `WISHLIST.md` and these agent instructions are not meant to be a source of truth for app functionality.

## Local Setup Notes

- The Tauri app lives in `tauri/` in this checkout. Use that path for Cargo, Tauri, and release bundle commands instead of `src-tauri/`.
- The repo uses npm for local development. If dependencies need to be refreshed in the sandbox, use `npm ci` from the repo root.
- If a frontend TypeScript pass fails because the sandbox denies the shell launcher under `node_modules/.bin`, use the explicit Node runtime described in `AGENTS.local.md` and avoid relying on a shell shim if it resolves poorly in the sandbox.
- For Tauri build/dev commands in this repo, make sure `node` is available before invoking `npm run tauri:dev`, `npm run tauri:build`, `npm run dev:frontend`, or `npm run build`.
- Prefer the existing npm scripts and Tauri commands for desktop workflows instead of inventing new shell wrappers.
- Git may reject the repo with a safe-directory warning in this environment. If that happens, use `git -c safe.directory=<repo path> ...` for the command you need instead of assuming the checkout is broken.
- `svelte-check` is used to detect typescript errors and other issues in Svelte files that `tsc` will not detect.
  - If node is on the path (unlikely but possible with local setup) Run `npm run check:svelte`
  - Otherwise use the bundled Node runtime plus `scripts/check-svelte.cjs`.

Worker delegation and permanent-worktree procedures are documented in the local `.skills/spawn/SKILL.md` when that file is available.

## Forked Checkout Startup Instructions

- Treat the checkout root as the top of the fork you opened. Do not assume a worktree id or parent-folder naming scheme.
- If `AGENTS.local.md` is absent from the fork, continue with these shared instructions and do not block on inheriting machine-specific settings.
- For a fast orientation, open `README.md`, `package.json`, `spec/spec.md`, `tauri/tauri.conf.json`, and `scripts/tauri-dev.mjs` first.
- Do not assume `node`, `npm`, or `node_modules/` are already on PATH or installed in the fork.
- When dependencies are missing and a fresh install is appropriate, run `npm ci` from the repository root using the available Node/npm runtime.
- Prefer the existing project scripts for frontend and Tauri workflows instead of inventing shell wrappers.
- If a fork needs machine-specific runtime or checkout-root guidance, keep that in `AGENTS.local.md` so this shared file stays portable.

## Running App Control and Debugging

When asked to control or debug an already-running MUDShow app, try the platform's webview debugging connection before relying on screenshots or UI-only inspection.

### Windows

- Reserved for Windows-specific WebView2/Chrome debugging instructions.

### Linux

- Start the development app with `npm run tauri:dev` if it is not already running. Debug builds expose the WebKitGTK inspector on `127.0.0.1:9222`; release builds do not.
- Verify the connection with `curl http://127.0.0.1:9222/`. The response should identify the `MUDShow` target and show an inspector URL containing `Main.html?ws=`.
- Connect to the WebKit inspector WebSocket at the path shown by that page; for the main target it is normally `/socket/1/1/WebPage`. Complete a WebSocket upgrade, then exchange masked client frames containing JSON WebKit inspector protocol messages.
- This is WebKit's inspector protocol, not Chrome DevTools Protocol. Do not use `/json`, `/json/list`, `pwa-chrome`, or Chrome CDP assumptions. Confirm a `101 Switching Protocols` response and a protocol event such as `Target.targetCreated` before attempting control or debugging.
- Keep the connection on loopback. If port `9222` is unavailable, check the app log for `[devtools] WebKitGTK HTTP inspector: 127.0.0.1:9222` and check whether another process owns the port before changing the configured port.

## Release Build Notes

- `npm run build` may download Windows bundle tools on first run.
- If the build fails with a sandbox/network error during bundling, request escalated permissions rather than retrying the same command repeatedly.
- Keep release-only changes compatible with Tauri packaging and GitHub Actions.
- If `cargo check` or a Tauri dev/build run fails after a clean because generated build outputs are missing, rerun the relevant Tauri command to regenerate them.
