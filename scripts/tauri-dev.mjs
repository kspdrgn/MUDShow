// This is a wrapper for 'tauri dev' that enables debugging of the internal WebView through external IDEs. Otherwise you have to rely on the build-in inspection dev-tools.
// This works by injecting a temporary config file on Windows builds to send the Chromium 'remote debugging port' config and let IDEs attach to it.
// Release mode skips this process and should not have remote debugging of any sort enabled.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const configPath = resolve(repoRoot, 'tauri', 'tauri.conf.json');
const configDir = resolve(repoRoot, 'tauri');
const tempConfigPath = resolve(
  configDir,
  `.mudshow-tauri-dev-${process.pid}-${Date.now()}.json`,
);
const remoteDebugPort = process.env.TAURI_REMOTE_DEBUGGING_PORT || '9222';

function addRemoteDebuggingArgs(config) {
  const windows = Array.isArray(config?.app?.windows) ? config.app.windows : [];

  if (windows.length === 0) {
    return config;
  }

  const nextWindows = windows.map((windowConfig) => {
    const existingArgs = typeof windowConfig.additionalBrowserArgs === 'string'
      ? windowConfig.additionalBrowserArgs.trim()
      : '';
    const remoteArg = `--remote-debugging-port=${remoteDebugPort}`;

    if (existingArgs.includes(remoteArg)) {
      return windowConfig;
    }

    return {
      ...windowConfig,
      additionalBrowserArgs: existingArgs
        ? `${existingArgs} ${remoteArg}`
        : remoteArg,
    };
  });

  return {
    ...config,
    app: {
      ...config.app,
      windows: nextWindows,
    },
  };
}

async function main() {
  const childArgs = ['dev'];

  if (process.platform === 'win32') {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const devConfig = addRemoteDebuggingArgs(config);
    writeFileSync(tempConfigPath, `${JSON.stringify(devConfig, null, 2)}\n`);
    console.log(
      `Enabling WebView2 remote debugging on port ${remoteDebugPort} for tauri dev.`,
    );
    childArgs.push('--config', tempConfigPath);
  }

  const tauriCli = resolve(repoRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
  const child = spawn(process.execPath, [tauriCli, ...childArgs], {
    stdio: 'inherit',
    windowsHide: true,
  });

  const cleanup = () => {
    try {
      rmSync(tempConfigPath, { force: true });
    } catch {
      // Best effort cleanup only.
    }
  };

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.once('SIGINT', () => forwardSignal('SIGINT'));
  process.once('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code) => {
    void cleanup();
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    void cleanup();
    throw error;
  });
}

try {
  await main();
} catch (error) {
  try {
    rmSync(tempConfigPath, { force: true });
  } catch {
    // Best effort cleanup only.
  }

  throw error;
}
