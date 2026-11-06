// Writes the hierarchy / flow chart gallery (donut · treemap · sunburst · sankey, AR + EN, wide and 340 px) from synthetic blocks into scratch/chart-gallery-hier/ (SVG per sample + index.html; index.html#sankey.ar shows one).
// Run: npx esbuild scripts/make-chart-gallery-hier.mjs --bundle --platform=node --format=esm --log-level=error --outfile=.test-build/chart-gallery-hier.mjs && node .test-build/chart-gallery-hier.mjs
import fs from 'node:fs';
import '../src/utils/chartKinds.js';
import { chartSvg } from '../src/utils/chartDraw.js';
import { hierSamples } from './chart-samples-hier.mjs';

const dir = 'scratch/chart-gallery-hier'; fs.mkdirSync(dir, { recursive: true });
const names = []; const NARROW = ['donut_other', 'treemap', 'sunburst', 'sankey', 'sankey_ext', 'treemap_long', 'sankey_long'];
for (const lang of ['ar', 'en']) {
  for (const [name, b] of Object.entries(hierSamples(lang))) {
    fs.writeFileSync(`${dir}/${name}.${lang}.svg`, chartSvg(b, { lang })); names.push({ n: `${name}.${lang}`, w: 900 });
    if (NARROW.includes(name)) { fs.writeFileSync(`${dir}/${name}.${lang}.w340.svg`, chartSvg(b, { lang, w: 340 })); names.push({ n: `${name}.${lang}.w340`, w: 340 }); }
  }
}
const page = (list) => `<!doctype html><meta charset="utf-8"><title>hier chart gallery</title><body style="font:13px sans-serif;background:#f4f5f7;margin:8px">${list.map((x) => `<h5 style="margin:10px 0 2px">${x.n}</h5><img src="${x.n}.svg" style="background:#fff;width:${x.w}px;border:1px solid #ddd">`).join('')}</body>`;
fs.writeFileSync(`${dir}/index.html`, page(names));
for (const kind of ['donut', 'treemap', 'sunburst', 'sankey']) for (const lang of ['ar', 'en']) for (const wide of [true, false]) fs.writeFileSync(`${dir}/_${kind}.${lang}.${wide ? 'wide' : 'narrow'}.html`, page(names.filter((x) => x.n.startsWith(kind) && x.n.includes(`.${lang}`) && (wide ? x.w === 900 : x.w === 340))));
console.log(`${names.length} charts written to ${dir}/`);
