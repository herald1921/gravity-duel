import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173, watch: { usePolling: true, interval: 250 } },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { emptyOutDir: false, rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } }, chunkSizeWarningLimit: 1600 },
});
