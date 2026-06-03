import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      // Forward /api/* to the Express backend
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
