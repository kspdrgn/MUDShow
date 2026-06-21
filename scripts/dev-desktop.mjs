import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteScript = path.resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const nodeBinDir = path.dirname(process.execPath);
const childEnv = {
  ...process.env,
  PATH: `${nodeBinDir};${process.env.PATH ?? ''}`,
};

const child = spawn(process.execPath, [viteScript, 'dev', '--config', 'frontend/vite.config.ts'], {
  cwd: rootDir,
  env: childEnv,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 1;
});
