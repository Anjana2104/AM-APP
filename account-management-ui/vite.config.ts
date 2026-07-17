import { defineConfig } from 'vite';

export default defineConfig({
  base: '/eam/',
  server: {
    proxy: {
      // Forward /api/* to the Express backend (Vite dev only)
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
