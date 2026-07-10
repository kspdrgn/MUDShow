# AGENTS.md

## Instruction Sources - AGENTS.md and AGENTS.local.md

- Treat this file as the shared project-wide instruction set.
- If a local `AGENTS.local.md` file exists in the repository root, read it before starting work and follow its instructions too.
- Instructions in `AGENTS.local.md` may override conflicting instructions in this shared `AGENTS.md` file. The `AGENTS.local.md` file is intended only for instructions that are specific to the local system.
- Do not create `AGENTS.local.md` unless the user explicitly asks for it.
- If a task encounters sandbox restrictions that could be worked around by agent instructions, offer to add these instructions to the `AGENTS.local.md` file.

## Local Setup Notes

- The Tauri app lives in `tauri/` in this checkout. Use that path for Cargo, Tauri, and release bundle commands instead of `src-tauri/`.
- The repo uses npm for local development. If dependencies need to be refreshed in the sandbox, use `npm ci` from the repo root.
- If a frontend TypeScript pass fails because the sandbox denies the shell launcher under `node_modules/.bin`, use the explicit Node runtime described in `AGENTS.local.md` and avoid relying on a shell shim if it resolves poorly in the sandbox.
- For Tauri build/dev commands in this repo, make sure `node` is available before invoking `npm run tauri:dev`, `npm run tauri:build`, `npm run dev:frontend`, or `npm run build`.
- Prefer the existing npm scripts and Tauri commands for desktop workflows instead of inventing new shell wrappers.
- Git may reject the repo with a safe-directory warning in this environment. If that happens, use `git -c safe.directory=<repo path> ...` for the command you need instead of assuming the checkout is broken.
- If a Windows shell command fails with a sandbox or path-related process error, retry with a simpler single-command form, confirm the current working directory, and check `AGENTS.local.md` for any machine-specific path guidance before assuming the repository layout is wrong.

## Release Build Notes

- `npm run build` may download Windows bundle tools on first run.
- If the build fails with a sandbox/network error during bundling, request escalated permissions rather than retrying the same command repeatedly.
- Keep release-only changes compatible with Tauri packaging and GitHub Actions.
- If `cargo check` or a Tauri dev/build run fails after a clean because generated build outputs are missing, rerun the relevant Tauri command to regenerate them.
