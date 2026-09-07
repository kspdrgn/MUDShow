import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = resolve(repoRoot, 'dist', 'regression-tests');
const testDir = resolve(outputDir, 'tests');

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'package.json'), '{"type":"commonjs"}\n', 'utf8');
const testFiles = (await readdir(testDir)).filter((name) => name.endsWith('.test.js')).map((name) => resolve(testDir, name));

const child = spawn(process.execPath, ['--test', ...process.argv.slice(2), ...testFiles], {
  cwd: repoRoot,
  stdio: 'inherit',
  windowsHide: true,
});

child.on('exit', (code) => process.exit(code ?? 1));
