// Finds identifiers that are used but never declared or imported (the class of bug that only shows up at runtime in React components).
import fs from 'node:fs'; import path from 'node:path';
import { parse } from '@babel/parser'; import traverseMod from '@babel/traverse';
const traverse = traverseMod.default || traverseMod;
const GLOBALS = new Set(['window', 'document', 'console', 'Math', 'Number', 'String', 'Object', 'Array', 'JSON', 'Date', 'Promise', 'Map', 'Set', 'WeakMap', 'Symbol', 'Error', 'RegExp', 'Intl', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'URL', 'URLSearchParams', 'Blob', 'fetch', 'AbortController', 'sessionStorage', 'localStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Infinity', 'NaN', 'undefined', 'globalThis', 'structuredClone', 'Float64Array', 'Int32Array', 'Uint8Array', 'Uint16Array', 'Int16Array', 'BigInt', 'Boolean', 'Event', 'HTMLInputElement', 'FileReader', 'TextEncoder', 'TextDecoder', 'process', 'Buffer', 'encodeURIComponent', 'decodeURIComponent', 'ResizeObserver', 'IntersectionObserver', 'MutationObserver', 'getComputedStyle', 'matchMedia', 'alert', 'confirm', 'FormData', 'File', 'Image', 'performance', 'queueMicrotask', 'Uint32Array', 'Float32Array', 'DOMParser', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'Node', 'Element', 'HTMLElement', 'atob', 'btoa', 'escape', 'unescape']);
let bad = 0;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of [...walk('src'), ...walk('server')].filter((x) => /\.(jsx?|mjs)$/.test(x))) {
  let ast; try { ast = parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] }); } catch (e) { console.log(`PARSE ${f}: ${e.message}`); bad += 1; continue; }
  const seen = new Set();
  traverse(ast, { Program(p) { for (const name of Object.keys(p.scope.globals)) if (!GLOBALS.has(name) && !seen.has(name)) { seen.add(name); const ref = p.scope.globals[name]; console.log(`${f}:${ref.loc?.start.line}  undefined identifier "${name}"`); bad += 1; } } });
}
console.log(bad ? `${bad} problem(s)` : 'no undefined identifiers');
process.exit(bad ? 1 : 0);
