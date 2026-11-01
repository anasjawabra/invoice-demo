import assert from 'node:assert/strict';
const values = new Map([['ib_lang', 'en']]);
globalThis.sessionStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)) };
globalThis.window = { sessionStorage, location: { search: '' } };
const { post, get, api, bumpEpoch, ApiError } = await import('../src/api/client.js');
const originalFetch = globalThis.fetch;
const ok = (body = { ok: true }) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const cancelled = () => { const e = new Error('cancelled'); e.name = 'AbortError'; return e; };
try {
  let pending = [];
  globalThis.fetch = (_url, init) => new Promise((resolve, reject) => { pending.push(() => resolve(ok({ value: 'current' }))); init.signal.addEventListener('abort', () => reject(cancelled()), { once: true }); });
  const controller = new AbortController();
  const first = post('/isolation', { id: 1 }, { signal: controller.signal }).catch((e) => e);
  const second = post('/isolation', { id: 1 });
  assert.equal(pending.length, 2, 'one subscriber must not own another subscriber’s cancellation');
  controller.abort(); pending[1](); assert.equal((await first).name, 'AbortError'); assert.deepEqual(await second, { value: 'current' });
  let calls = 0; bumpEpoch();
  globalThis.fetch = async () => { calls++; await new Promise((r) => setTimeout(r, 10)); return ok(); };
  await Promise.all([post('/shared', {}), post('/shared', {})]); assert.equal(calls, 1, 'uncancelled identical reads still coalesce');
  await post('/shared', {}); assert.equal(calls, 1, 'valid responses are cached');
  for (const body of ['<html>error</html>', 'null', '[]']) {
    bumpEpoch(); globalThis.fetch = async () => new Response(body, { status: 200 });
    await assert.rejects(post('/malformed', {}), /invalid response/);
  }
  calls = 0; bumpEpoch();
  globalThis.fetch = async () => { calls++; return calls === 1 ? new Response('{broken') : ok({ recovered: true }); };
  await assert.rejects(get('/recovery'), /invalid response/); assert.deepEqual(await get('/recovery'), { recovered: true }); assert.equal(calls, 2, 'invalid data is never cached');
  calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError('Lost acknowledgement'); };
  await assert.rejects(api.upload([]), (e) => e.uncertain === true); assert.equal(calls, 1, 'uploads are not automatically replayed');
  calls = 0; await assert.rejects(api.clearUploads(), (e) => e.uncertain === true); assert.equal(calls, 1, 'clear is not automatically replayed');
  globalThis.fetch = async () => new Response('{broken', { status: 200 });
  await assert.rejects(api.upload([]), (e) => e.uncertain === true, 'an invalid write acknowledgement is not a confirmed failure');
  calls = 0; globalThis.fetch = async () => { calls++; if (calls === 1) throw new TypeError('Temporary outage'); return ok(); };
  await post('/read-retry', {}, { cached: false }); assert.equal(calls, 2, 'read-only network failures retry');
  calls = 0; globalThis.fetch = async () => { calls++; throw new TypeError('Offline'); };
  const retryController = new AbortController();
  const aborted = post('/cancel-backoff', {}, { signal: retryController.signal }).catch((e) => e);
  await new Promise((r) => setTimeout(r, 20)); retryController.abort(); assert.equal((await aborted).name, 'AbortError'); assert.equal(calls, 1);
  for (const bodyPending of [false, true]) {
    globalThis.fetch = (_url, init) => bodyPending
      ? Promise.resolve({ ok: true, status: 200, json: () => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(cancelled()), { once: true })) })
      : new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(cancelled()), { once: true }));
    await assert.rejects(post(`/timeout-${bodyPending}`, {}, { timeoutMs: 20 }), (e) => e.timeout === true && /too long/.test(e.message));
  }
  calls = 0; globalThis.fetch = async () => { calls++; return new Response('{"error":"unavailable"}', { status: 503 }); };
  await assert.rejects(post('/http-error', {}, { cached: false }), (e) => e instanceof ApiError && e.status === 503); assert.equal(calls, 1);
  values.set('ib_lang', 'ar'); globalThis.fetch = async () => new Response('not-json');
  await assert.rejects(post('/arabic-error', {}, { cached: false }), /استجابة غير صالحة/);
  console.log('Resilience data passed: cancellation isolation, read coalescing, strict JSON, cache recovery, no write replay, read retry, abortable backoff, header/body timeouts and localized errors.');
} finally { globalThis.fetch = originalFetch; }
