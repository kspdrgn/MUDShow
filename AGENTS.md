# AGENTS.md

## Local Setup Notes

- This repo runs inside a restricted sandbox. Prefer commands that stay inside `C:\_\_projects\MUDShow`.
- The effective checkout path in this environment can differ from the displayed workspace root. Before using absolute paths in commands or patches, confirm the current working directory and prefer relative paths when possible.
- The Tauri app lives in `tauri/` in this checkout. Use that path for Cargo, Tauri, and release bundle commands instead of `src-tauri/`.
- The repo defaults to pnpm's normal global store for local development. In the sandbox, if pnpm needs a writable store inside the checkout, use the repo-local `.pnpm-store` explicitly for that command.
- If `pnpm` reports an unexpected store location, rerun `pnpm install` from the repo root after deleting `node_modules` only if the user has already asked for that.
- If a frontend TypeScript pass fails because the sandbox denies the pnpm-linked launcher under `node_modules/.pnpm`, the sandbox should use a copy-style pnpm install against the local store first, then run TypeScript through the explicit Node runtime. A reliable fallback is:
  - `pnpm install --store-dir=.pnpm-store --config.package-import-method=copy`
  - `C:\Users\D\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe node_modules/typescript/lib/tsc.js --noEmit -p tsconfig.json`
  - Do not use `pnpm exec tsc` or the `node_modules/.bin/tsc` shim if they resolve back into the blocked pnpm virtual store.
- Tauri commands may need an explicit Node path in the shell environment. This note is guidance for the shell command itself; it does not automatically change `PATH` for you. If `node` is not on `PATH`, use the known runtime binary directly:
  - `C:\Users\D\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
- For Tauri build/dev commands in this repo, make sure `node` is available before invoking `pnpm tauri:dev`, `pnpm tauri:build`, `pnpm dev`, or `pnpm build`.
- Prefer the existing npm scripts and Tauri commands for desktop workflows instead of inventing new shell wrappers.
- Git may reject the repo with a safe-directory warning in this environment. If that happens, use `git -c safe.directory=<repo path> ...` for the command you need instead of assuming the checkout is broken.
- If a Windows shell command fails with a sandbox or path-related process error, retry with a simpler single-command form and re-check the current working directory before assuming the repository layout is wrong.

## Release Build Notes

- `pnpm build` may download Windows bundle tools on first run.
- If the build fails with a sandbox/network error during bundling, request escalated permissions rather than retrying the same command repeatedly.
- Keep release-only changes compatible with Tauri packaging and GitHub Actions.
- If `cargo check` or a Tauri dev/build run fails after a clean because generated build outputs are missing, rerun the relevant Tauri command to regenerate them.
