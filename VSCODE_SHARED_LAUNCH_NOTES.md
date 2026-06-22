# VS Code Shared Launch Notes

VS Code does **not** provide a native `extends` or `include` mechanism for `launch.json`.
So the safest pattern is:

- keep the project-shared debug config in the repo
- keep developer-specific values out of source control
- use VS Code features that support overrides instead of copying the whole config

## Recommended approach

1. Commit a shared launch config in `.vscode/launch.json` or keep a checked-in example like `vscode.launch.json.example`.
2. Put only stable, team-wide defaults in that file.
3. Let developers override personal values with:
   - user settings via `${config:...}`
   - environment variables via `${env:...}`
   - local, untracked files referenced from the shared config
4. Use platform-specific sections (`windows`, `linux`, `osx`) when the only difference is OS behavior.

## What works well

- Shared `program`, `request`, `type`, and `preLaunchTask` values
- Personal ports, env files, paths, or flags via `${config:...}` and `${env:...}`
- A repo example file that developers can copy locally if they need a fully custom config

## What to avoid

- Copying full per-dev `launch.json` files into source control
- Relying on a fake merge workflow that VS Code does not support natively
- Hardcoding machine-specific paths into the shared config

## Example pattern

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Start proxy",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/backend/proxy.js",
      "cwd": "${workspaceFolder}",
      "preLaunchTask": "npm: build",
      "console": "integratedTerminal",
      "serverReadyAction": {
        "pattern": "Proxy running on ws://localhost:([0-9]+)",
        "uriFormat": "http://localhost:%s",
        "action": "openExternally"
      },
      "envFile": "${config:mudshow.envFile}"
    }
  ]
}
```

Then each developer can set their own `mudshow.envFile` in local user settings.

## Docs

- [Debug configuration](https://code.visualstudio.com/docs/debugtest/debugging-configuration)
- [Variables reference](https://code.visualstudio.com/docs/reference/variables-reference)

