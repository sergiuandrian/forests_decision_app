/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Default base is "/" (works for Vercel and dev).
  // For GitHub Pages, the deploy workflow sets VITE_BASE_PATH=/forests_decision_app/.
  const base = env.VITE_BASE_PATH || '/';

  return {
    plugins: [react()],
    base,
    define: {
      'process.env': {},
    },
    server: {
      port: 3000,
      host: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            leaflet: ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
      },
    },
  };
});