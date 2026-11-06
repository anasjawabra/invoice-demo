// Writes one SVG per chart kind × {ar, en} from synthetic sample blocks into scratch/chart-gallery/ (and an index.html to view them side by side; index.html#waterfall.ar shows one).
// Run: npm run make:chart-gallery  — or  npx esbuild scripts/make-chart-gallery.mjs --bundle --platform=node --format=esm --outfile=.test-build/chart-gallery.mjs && node .test-build/chart-gallery.mjs
import fs from 'node:fs';
import { chartSvg } from '../src/utils/chartKinds.js'; // chartKinds registers every renderer module (cartesian, hierarchy)
import { sampleBlocks } from './chart-samples.mjs';
import { cartesianBlocks } from './chart-samples-cartesian.mjs';

const dir = 'scratch/chart-gallery'; fs.mkdirSync(dir, { recursive: true });
const names = []; const sheets = { ar: [], en: [] };
for (const lang of ['ar', 'en']) {
  const blocks = { ...sampleBlocks(lang), ...cartesianBlocks(lang) };
  for (const [name, b] of Object.entries(blocks)) {
    fs.writeFileSync(`${dir}/${name}.${lang}.svg`, chartSvg(b, { lang })); names.push(`${name}.${lang}`);
    if (name in cartesianBlocks(lang)) { // the cartesian kinds also at phone width (responsive, w=340) and in one printable contact sheet per language
      fs.writeFileSync(`${dir}/${name}.${lang}.m.svg`, chartSvg(b, { lang, w: 340 })); names.push(`${name}.${lang}.m`);
      sheets[lang].push(`<section class="c"><h4>${name}</h4>${chartSvg(b, { lang, responsive: true, w: 640 })}</section>`);
      sheets[lang].push(`<section class="m"><h4>${name} · 340</h4>${chartSvg(b, { lang, responsive: true, w: 340 })}</section>`);
    }
  }
}
for (const lang of ['ar', 'en']) fs.writeFileSync(`${dir}/sheet.${lang}.html`, `<!doctype html><meta charset="utf-8"><title>cartesian ${lang}</title><style>body{font:12px sans-serif;background:#f4f5f7;margin:8px;display:grid;grid-template-columns:660px 360px;gap:6px 10px}section{background:#fff;border:1px solid #ddd;padding:4px}h4{margin:0 0 2px;color:#667085}</style><body>${sheets[lang].join('')}</body>`);
fs.writeFileSync(`${dir}/index.html`, `<!doctype html><meta charset="utf-8"><title>chart gallery</title><body style="font:14px sans-serif;background:#f4f5f7">${names.map((n) => `<h4>${n}</h4><img src="${n}.svg" style="background:#fff;width:100%;max-width:900px;border:1px solid #ddd">`).join('')}<script>const q=location.hash.slice(1);if(q)document.querySelectorAll('img').forEach((i)=>{const keep=i.src.includes('/'+q+'.svg');if(!keep){i.style.display='none';i.previousElementSibling.style.display='none';}});</script></body>`);
console.log(`${names.length} charts written to ${dir}/`);
