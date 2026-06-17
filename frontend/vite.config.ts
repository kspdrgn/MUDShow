import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const frontendRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: frontendRoot,
  plugins: [svelte()],
  build: {
    outDir: path.resolve(frontendRoot, '../dist/frontend'),
    emptyOutDir: true,
  },
});
