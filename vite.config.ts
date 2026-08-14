import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    strictPort: true,
    watch: {
      usePolling: true
    },
    hmr: {
      host: '127.0.0.1'
    },
  },
  test: {
    environment: 'node'
  }
});
