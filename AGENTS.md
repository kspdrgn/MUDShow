# AGENTS.md

## Local Setup Notes

- This repo runs inside a restricted sandbox. Prefer commands that stay inside `C:\_\_projects\MUDShow`.
- The repo expects the local pnpm store at `.pnpm-store` via `.npmrc`. Do not switch back to the global pnpm store unless you intentionally want to reinstall dependencies.
- If `pnpm` reports an unexpected store location, rerun `pnpm install` from the repo root after deleting `node_modules` only if the user has already asked for that.
- Tauri commands may need an explicit Node path in the shell environment. If `node` is not on `PATH`, use the known runtime binary:
  - `C:\Users\D\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
- For Tauri build/dev commands in this repo, make sure `node` is available before invoking `pnpm tauri:dev` or `pnpm tauri:build`.
- Prefer the existing scripts in `scripts/` for desktop workflows instead of inventing new shell wrappers.

## Release Build Notes

- `pnpm tauri:build` may download Windows bundle tools on first run.
- If the build fails with a sandbox/network error during bundling, request escalated permissions rather than retrying the same command repeatedly.
- The desktop sidecar is expected to be bundled as part of the release build, so keep release-only changes compatible with Tauri packaging.
