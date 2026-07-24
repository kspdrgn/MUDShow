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

## Fork / Permanent Worktree Startup Instructions

- Treat the checkout root as the top of the fork you opened, and do not assume a worktree id or parent folder naming scheme.
- The main code areas are `frontend/` for the UI, `tauri/` for the desktop shell and Rust code, `scripts/` for helper scripts, and `spec/` for the feature spec documents.
- For a fast orientation, open `README.md`, `package.json`, `spec/spec.md`, `tauri/tauri.conf.json`, and `scripts/tauri-dev.mjs` first.
- Do not assume `node`, `npm`, or `node_modules/` are already on PATH or installed in the fork.
- When you need to run npm scripts, choose the least disruptive startup path first:
  - Reuse an existing `node_modules/` tree from the parent worktree when it is already known-good and the task only needs a quick, matching dependency snapshot.
  - If the fork already has dependencies installed, invoke the package manager by absolute path or through the local runtime instructions in `AGENTS.local.md` instead of relying on PATH.
  - If dependencies are missing and a fresh install is appropriate, run `npm ci` from the repo root after launching npm through the local runtime path, not a shell shim.
- For the two common entry points, use the local runtime instructions rather than PATH:
  - `build:frontend` should be launched as documented in `AGENTS.local.md` for this fork.
  - `start` should be launched as documented in `AGENTS.local.md` for this fork.
- If a script fails because the shell cannot find `node` or `npm`, fix the launch path once and continue rather than repeatedly retrying the same broken command.
- If a fork needs machine-specific runtime or checkout-root guidance, put that in `AGENTS.local.md` so the shared file stays generic.

## Release Build Notes

- `npm run build` may download Windows bundle tools on first run.
- If the build fails with a sandbox/network error during bundling, request escalated permissions rather than retrying the same command repeatedly.
- Keep release-only changes compatible with Tauri packaging and GitHub Actions.
- If `cargo check` or a Tauri dev/build run fails after a clean because generated build outputs are missing, rerun the relevant Tauri command to regenerate them.
