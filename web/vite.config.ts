import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/** The local server (`npm run serve` or `npm run dev:fake`) that `npm run dev:web` talks to. */
const API_TARGET = 'http://127.0.0.1:4321';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Served by the local server at /docs/ (src/http/docs.ts).
  base: '/docs/',
  plugins: [react()],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    // Everything outside /docs/ is the API: forward it to the local server.
    proxy: { '^/(?!docs(/|$))': { target: API_TARGET, changeOrigin: true } },
  },
});
