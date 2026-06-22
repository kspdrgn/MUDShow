# AGENTS.md

## Local Setup Notes

- This repo runs inside a restricted sandbox. Prefer commands that stay inside `C:\_\_projects\MUDShow`.
- The effective checkout path in this environment can differ from the displayed workspace root. Before using absolute paths in commands or patches, confirm the current working directory and prefer relative paths when possible.
- The Tauri app lives in `tauri/` in this checkout. Use that path for Cargo, Tauri, and release bundle commands instead of `src-tauri/`.
- The repo expects the local pnpm store at `.pnpm-store` via `.npmrc`. Do not switch back to the global pnpm store unless you intentionally want to reinstall dependencies.
- If `pnpm` reports an unexpected store location, rerun `pnpm install` from the repo root after deleting `node_modules` only if the user has already asked for that.
- Tauri commands may need an explicit Node path in the shell environment. If `node` is not on `PATH`, use the known runtime binary:
  - `C:\Users\D\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
- For Tauri build/dev commands in this repo, make sure `node` is available before invoking `pnpm start` or `pnpm build`.
- Prefer the existing npm scripts and Tauri commands for desktop workflows instead of inventing new shell wrappers.
- Git may reject the repo with a safe-directory warning in this environment. If that happens, use `git -c safe.directory=<repo path> ...` for the command you need instead of assuming the checkout is broken.
- If a Windows shell command fails with a sandbox or path-related process error, retry with a simpler single-command form and re-check the current working directory before assuming the repository layout is wrong.

## Release Build Notes

- `pnpm build` may download Windows bundle tools on first run.
- If the build fails with a sandbox/network error during bundling, request escalated permissions rather than retrying the same command repeatedly.
- Keep release-only changes compatible with Tauri packaging and GitHub Actions.
- If `cargo check` or a Tauri dev/build run fails after a clean because generated build outputs are missing, rerun the relevant Tauri command to regenerate them.
