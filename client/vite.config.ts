/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

/**
 * Ressources de pdf.js servies par l'application sous /pdfjs/ (aucun appel à un site extérieur) :
 * polices standard, tables de caractères (CJK…), profils de couleur et décodeurs wasm des scans
 * (JPEG 2000, JBIG2). En développement elles sont lues dans node_modules ; au build, copiées dans dist.
 */
function pdfjsAssets(): Plugin {
  const root = path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
  const dirs = ['cmaps', 'standard_fonts', 'iccs', 'wasm'];
  // quickjs sert aux scripts des PDF, que la GED n'exécute jamais
  const files = () =>
    dirs.flatMap((dir) =>
      readdirSync(path.join(root, dir))
        .filter((f) => !f.startsWith('LICENSE') && !f.startsWith('quickjs'))
        .map((f) => `${dir}/${f}`),
    );
  const types: Record<string, string> = { '.wasm': 'application/wasm', '.js': 'text/javascript' };

  return {
    name: 'ged-pdfjs-assets',
    configureServer(server) {
      const known = new Set(files());
      server.middlewares.use('/pdfjs/', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0] ?? '').replace(/^\/+/, '');
        if (!known.has(rel)) {
          next();
          return;
        }
        res.setHeader('Content-Type', types[path.extname(rel)] ?? 'application/octet-stream');
        res.end(readFileSync(path.join(root, rel)));
      });
    },
    generateBundle() {
      for (const f of files()) {
        this.emitFile({ type: 'asset', fileName: `pdfjs/${f}`, source: readFileSync(path.join(root, f)) });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), pdfjsAssets()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // AG Grid (~1 Mo) et pdf.js sont chargés à la demande : fichiers à part
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
