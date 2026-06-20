import { copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tscScript = path.resolve(rootDir, 'node_modules', 'typescript', 'bin', 'tsc');
const viteScript = path.resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const nodeBinPath = process.execPath;
const nodeTargetTriple = getNodeTargetTriple();
const stagedNodePath = path.resolve(rootDir, 'src-tauri', 'bin', `node-${nodeTargetTriple}.exe`);

const childEnv = {
  ...process.env,
  PATH: `${path.dirname(process.execPath)};${process.env.PATH ?? ''}`,
};

function getNodeTargetTriple() {
  if (process.platform !== 'win32') {
    throw new Error(`Unsupported platform for desktop packaging: ${process.platform}`);
  }

  if (process.arch === 'x64') {
    return 'x86_64-pc-windows-msvc';
  }

  if (process.arch === 'arm64') {
    return 'aarch64-pc-windows-msvc';
  }

  throw new Error(`Unsupported architecture for desktop packaging: ${process.arch}`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: childEnv,
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0 && !signal) {
        resolve(undefined);
        return;
      }

      reject(new Error(`${path.basename(command)} failed ${signal ? `with signal ${signal}` : `with exit code ${code ?? 1}`}`));
    });
  });
}

async function stageNodeBinary() {
  await mkdir(path.dirname(stagedNodePath), { recursive: true });
  await copyFile(nodeBinPath, stagedNodePath);
}

async function main() {
  await rm(path.resolve(rootDir, 'src-tauri', 'bin'), { recursive: true, force: true });
  await run(process.execPath, [tscScript, '-p', 'backend/tsconfig.json']);
  await run(process.execPath, [viteScript, 'build', '--config', 'frontend/vite.config.ts']);
  await stageNodeBinary();
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
