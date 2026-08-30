import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local: npm run dev → frontend, npm run dev:api → API on :3019
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3019',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3019',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
