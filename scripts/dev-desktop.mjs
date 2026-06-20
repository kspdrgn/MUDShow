import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tscScript = path.resolve(rootDir, 'node_modules', 'typescript', 'bin', 'tsc');
const viteScript = path.resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const nodeBinDir = path.dirname(process.execPath);
const childEnv = {
  ...process.env,
  PATH: `${nodeBinDir};${process.env.PATH ?? ''}`,
};

const running = [];
let exiting = false;

function execOnce(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    ...options,
  });

  child.stdout?.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr?.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));

  return child;
}

function run(name, command, args, options = {}) {
  const child = execOnce(name, command, args, options);
  running.push(child);
  child.on('exit', (code, signal) => {
    if (exiting) {
      return;
    }

    exiting = true;
    stopAll();
    if (signal) {
      process.exitCode = 1;
      return;
    }

    process.exitCode = code ?? 1;
  });

  return child;
}

function runNodeScript(name, args, options = {}) {
  const child = spawn(process.execPath, args, {
    cwd: rootDir,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    ...options,
  });

  running.push(child);
  child.stdout?.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr?.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on('exit', (code, signal) => {
    if (exiting) {
      return;
    }

    exiting = true;
    stopAll();
    if (signal) {
      process.exitCode = 1;
      return;
    }

    process.exitCode = code ?? 1;
  });

  return child;
}

function stopAll() {
  for (const child of running) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }
}

process.on('SIGINT', () => {
  exiting = true;
  stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  exiting = true;
  stopAll();
  process.exit(0);
});

try {
  await new Promise((resolve, reject) => {
    const build = execOnce('backend-build', process.execPath, [tscScript, '-p', 'backend/tsconfig.json']);
    build.on('exit', (code, signal) => {
      if (code === 0 && !signal) {
        resolve(undefined);
        return;
      }

      reject(new Error(`backend-build failed ${signal ? `with signal ${signal}` : `with exit code ${code ?? 1}`}`));
    });
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

runNodeScript('proxy', ['dist/backend/proxy.js', 'port=8080']);
run('frontend', process.execPath, [viteScript, 'dev', '--config', 'frontend/vite.config.ts']);
