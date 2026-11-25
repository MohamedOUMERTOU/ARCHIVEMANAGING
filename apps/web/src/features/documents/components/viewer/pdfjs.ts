import { GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/*
 * Réglages communs de pdf.js. Le « worker » (analyse du PDF hors du fil principal) et les ressources
 * (polices standard, tables de caractères, décodeurs wasm des scans JPEG 2000 / JBIG2) sont servis par
 * l'application elle-même : rien n'est chargé depuis un site extérieur.
 * Les ressources sont copiées dans /pdfjs/ par le plugin « ged-pdfjs-assets » (vite.config.ts).
 */
// « ?v=2 » : une première version de nginx servait ce fichier avec un mauvais type MIME ; les
// navigateurs l'avaient gardé en cache (« immutable », 1 an). Changer l'adresse force un nouveau
// téléchargement. À incrémenter si un tel incident se reproduit.
GlobalWorkerOptions.workerSrc = `${workerUrl}?v=2`;

const base = `${import.meta.env.BASE_URL}pdfjs/`;

export const PDF_RESOURCES = {
  cMapUrl: `${base}cmaps/`,
  standardFontDataUrl: `${base}standard_fonts/`,
  wasmUrl: `${base}wasm/`,
  iccUrl: `${base}iccs/`,
  // Formulaires dynamiques XFA et scripts : jamais exécutés
  enableXfa: false,
} as const;
