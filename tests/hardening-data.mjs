import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { runtimeMode, requireDemoBackend } from '../server/runtimeMode.js';
import { streamCsv } from '../server/csvStream.js';
import { checkBytes, checkZipBudget } from '../src/data/fileBudget.js';
import JSZip from 'jszip';

for (const [env, mode] of [[{}, 'demo'], [{ NODE_ENV: 'production' }, 'production'], [{ APP_MODE: 'demo', NODE_ENV: 'production' }, 'demo'], [{ APP_MODE: 'production' }, 'production'], [{ APP_MODE: 'typo' }, 'blocked']]) assert.equal(runtimeMode(env), mode);
const saved = process.env.APP_MODE; process.env.APP_MODE = 'production';
let status, result;
assert.equal(requireDemoBackend({ writeHead(code) { status = code; }, end(body) { result = JSON.parse(body); } }), false);
assert.equal(status, 503); assert.equal(result.error, 'production_backend_not_configured');
if (saved === undefined) delete process.env.APP_MODE; else process.env.APP_MODE = saved;

assert.throws(() => checkBytes(new Uint8Array(16 * 1024 * 1024)), /file_budget/);
const zip = new JSZip(); zip.file('word/document.xml', '<doc>test</doc>');
checkZipBudget(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
zip.file('bomb', new Uint8Array(17 * 1024 * 1024));
const bomb = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
assert.ok(bomb.length < 100000); assert.throws(() => checkZipBudget(bomb), /archive_budget/);
assert.throws(() => checkZipBudget(new Uint8Array(12)), /invalid_archive/);
const broken = await new JSZip().file('x', 'x').generateAsync({ type: 'uint8array' });
const view = new DataView(broken.buffer, broken.byteOffset, broken.byteLength); view.setUint32(broken.length - 6, 0xfffffff0, true);
assert.throws(() => checkZipBudget(broken), /archive_budget/);

class Socket extends EventEmitter {
  destroyed = false; chunks = []; backpressure = false;
  write(value) { this.chunks.push(value); return !this.backpressure; }
  end() { this.ended = true; }
}
let returned = false;
function* data() { try { for (let i = 0; i < 100; i++) yield String(i); } finally { returned = true; } }
const socket = new Socket(); socket.backpressure = true;
const done = streamCsv(socket, data());
await new Promise((resolve) => setImmediate(resolve)); assert.equal(socket.chunks.length, 1);
await new Promise((resolve) => setImmediate(resolve)); assert.equal(socket.chunks.length, 1);
socket.emit('close'); await done; assert.ok(returned); assert.equal(socket.listenerCount('drain'), 0);
const complete = new Socket(); const finished = streamCsv(complete, data());
await new Promise((resolve) => setImmediate(resolve)); assert.equal(complete.chunks.length, 1);
await finished; assert.equal(complete.chunks.length, 100); assert.ok(complete.ended);
console.log('Runtime gate, archive budgets, backpressure, cooperative export and disconnect cleanup passed.');
