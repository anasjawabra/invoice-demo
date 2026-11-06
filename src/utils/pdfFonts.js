// The IBM Plex Sans Arabic files the printed report embeds, inlined as data URIs by Vite (`?inline`) so the print document needs no network and no CDN.
// Loaded lazily by the PDF export only (≈190 KB). Node (tests, scripts/make-report-pdf.mjs) does not import this file: it reads the same files with fs.
import ar400 from '@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2?inline';
import ar600 from '@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-600-normal.woff2?inline';
import ar700 from '@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2?inline';
import la400 from '@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-latin-400-normal.woff2?inline';
import la600 from '@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-latin-600-normal.woff2?inline';
import la700 from '@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-latin-700-normal.woff2?inline';

export const PDF_FONT_URLS = { 'arabic-400': ar400, 'arabic-600': ar600, 'arabic-700': ar700, 'latin-400': la400, 'latin-600': la600, 'latin-700': la700 };

// → { 'arabic-400': 'data:font/woff2;base64,…', … }: in a production build the imports above already are data URIs; the dev server serves them as same-origin paths, which are fetched and
// inlined here, so the print window (about:blank) and a saved copy of the document never depend on the app's URL.
export async function loadPdfFontUris() {
  const out = {};
  for (const [k, u] of Object.entries(PDF_FONT_URLS)) {
    if (String(u).startsWith('data:')) { out[k] = u; continue; }
    const buf = new Uint8Array(await (await fetch(u)).arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    out[k] = `data:font/woff2;base64,${btoa(bin)}`;
  }
  return out;
}
