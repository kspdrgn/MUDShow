import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const frontendRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
  root: frontendRoot,
  plugins: [svelte()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(frontendRoot, '../dist/frontend'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
