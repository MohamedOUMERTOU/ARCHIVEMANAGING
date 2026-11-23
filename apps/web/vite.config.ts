/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // AG Grid (~1 Mo) est chargé à la demande (components/shared/AgGridView) : fichier à part, seul gros fichier
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    // Quand le serveur Spring Boot tourne (port 8080), /api lui est transmis
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
