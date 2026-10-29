import { MAX_IMPORT_BYTES } from './fileBudget';

export async function readImportFile(file, signal) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('file_budget_exceeded');
  const bytes = await file.arrayBuffer();
  if (signal?.aborted) throw new Error('import_cancelled');
  const worker = new Worker(new URL('./importWorker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const finish = (error, table) => {
      clearTimeout(timer); signal?.removeEventListener('abort', cancel); worker.terminate();
      if (error) reject(error); else resolve(table);
    };
    const cancel = () => finish(new Error('import_cancelled'));
    const timer = setTimeout(() => finish(new Error('import_timeout')), 15000);
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.table);
    worker.onerror = () => finish(new Error('import_worker_failed'));
    worker.postMessage({ bytes, name: file.name }, [bytes]);
  });
}
