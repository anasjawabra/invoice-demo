export const MAX_BUFFERED_CSV_BYTES = 32 * 1024 * 1024;
const abortError = () => Object.assign(new Error('export_cancelled'), { name: 'AbortError' });

// Validate a bounded prefix, then write each network chunk before reading more.
// The file stream commits only on close; errors/cancellation abort that stream.
export async function saveCsvResponse(response, { handle, signal, onProgress, maxBufferedBytes = MAX_BUFFERED_CSV_BYTES } = {}) {
  if (!response.ok) throw new Error('download_failed');
  if (!/^text\/csv(?:;|$)/i.test(response.headers.get('Content-Type') || '')) throw new Error('not_csv');
  const length = Number(response.headers.get('Content-Length'));
  if (!handle && length > maxBufferedBytes) { await response.body?.cancel(); throw new Error('too_large'); }
  if (!response.body) throw new Error('download_failed');
  const reader = response.body.getReader();
  const buffered = []; let prefix = ''; let prefixBytes = 0; let valid = false; let writer; let bytes = 0; let lastProgress = 0;
  const decoder = new TextDecoder();
  const cancel = () => { reader.cancel().catch(() => {}); writer?.abort().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  const check = () => { if (signal?.aborted) throw abortError(); };
  try {
    for (;;) {
      check(); const { done, value } = await reader.read(); check();
      if (done) break;
      bytes += value.byteLength;
      if (!handle && bytes > maxBufferedBytes) throw new Error('too_large');
      if (!valid) {
        const part = value.subarray(0, Math.max(0, 8192 - prefixBytes)); prefixBytes += part.byteLength;
        prefix += decoder.decode(part, { stream: true });
        valid = /(?:^|\r?\n)invoice_id(?:,|\r?\n)/.test(prefix.replace(/^\uFEFF/, ''));
        if (!valid && prefixBytes >= 8192) throw new Error('not_csv');
        buffered.push(value);
        if (valid && handle) {
          writer = await handle.createWritable(); check();
          for (const chunk of buffered) { check(); await writer.write(chunk); }
          buffered.length = 0;
        }
      } else if (handle) { await writer.write(value); check(); }
      else buffered.push(value);
      if (Date.now() - lastProgress >= 100) { onProgress?.(bytes); lastProgress = Date.now(); }
    }
    if (!valid) throw new Error('not_csv');
    check();
    if (writer) { await writer.close(); check(); }
    onProgress?.(bytes);
    return { bytes, blob: handle ? null : new Blob(buffered, { type: 'text/csv;charset=utf-8' }) };
  } catch (error) {
    await writer?.abort().catch(() => {});
    throw error;
  } finally {
    signal?.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {}); reader.releaseLock();
  }
}
