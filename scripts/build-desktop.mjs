import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteScript = path.resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

const childEnv = {
  ...process.env,
  PATH: `${path.dirname(process.execPath)};${process.env.PATH ?? ''}`,
};

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

async function main() {
  await run(process.execPath, [viteScript, 'build', '--config', 'frontend/vite.config.ts']);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
