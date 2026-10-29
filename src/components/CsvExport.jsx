import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useL } from '../utils/bi';
import { downloadBlob } from '../utils/download';
import { csvDownloadName } from '../utils/csv';
import { saveCsvResponse } from '../utils/saveCsv';
export default function CsvExport({ href, postUrl, payload, fileName = 'invoices.csv' }) {
  const { L } = useL(); const request = useRef(null);
  const initiatingAction = useRef(null); const retryDirect = useRef(false);
  const directTrigger = useRef(null); const wasPending = useRef(false);
  const focused = useRef(null); const trigger = useRef(null); const cancelButton = useRef(null); const retryButton = useRef(null);
  const [pending, setPending] = useState(false); const [error, setError] = useState(null); const [status, setStatus] = useState('');
  const [bytes, setBytes] = useState(0);
  const directSave = typeof window.showSaveFilePicker === 'function';
  useEffect(() => {
    setPending(false); setError(null); setStatus('');
    return () => { request.current?.abort(); request.current = null; };
  }, [payload, postUrl]);
  useLayoutEffect(() => {
    const previous = focused.current;
    const finishing = wasPending.current && !pending; wasPending.current = pending;
    if (previous && (finishing || !previous.isConnected || previous.disabled) && (document.activeElement === document.body || document.activeElement === previous && previous.disabled)) {
      (pending ? cancelButton.current : error ? retryButton.current || initiatingAction.current : initiatingAction.current || trigger.current)?.focus({ preventScroll: true });
    }
  }, [pending, error]);
  const cancel = () => { request.current?.abort(); request.current = null; setPending(false); setStatus('cancelled'); };
  const run = async (event, direct = false) => {
    event?.preventDefault(); if (request.current) return;
    initiatingAction.current = direct ? directTrigger.current : trigger.current; retryDirect.current = direct;
    const controller = new AbortController(); request.current = controller; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 120000);
    setPending(true); setError(null); setStatus('');
    setBytes(0);
    try {
      const handle = direct ? await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }] }) : null;
      if (controller.signal.aborted || request.current !== controller) return;
      // Keep the request's complete context fixed, and never decode the full CSV into a JS string.
      const response = await fetch(postUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, signal: controller.signal });
      const { blob } = await saveCsvResponse(response, { handle, signal: controller.signal, onProgress: (n) => { if (request.current === controller) setBytes(n); } });
      if (controller.signal.aborted || request.current !== controller) return;
      if (blob) downloadBlob(blob, csvDownloadName(response.headers.get('Content-Disposition')));
      setStatus(handle ? 'saved' : 'started');
    } catch (failure) {
      if (request.current === controller && failure.name === 'AbortError' && !timedOut) setStatus('cancelled');
      else if (request.current === controller && (!controller.signal.aborted || timedOut)) setError(['not_csv', 'too_large'].includes(failure.message) ? failure.message : 'failed');
    } finally {
      clearTimeout(timer); if (request.current === controller) { request.current = null; setPending(false); }
    }
  };
  const label = pending ? L('Preparing CSV…', 'جارٍ إعداد CSV…') : L('Export CSV', 'تصدير CSV');
  return <div className="rv-export" onFocusCapture={(e) => { focused.current = e.target; }} style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
    {href.length > 6000 ? <form method="post" action={postUrl} onSubmit={run}><input type="hidden" name="q" value={payload} /><button ref={trigger} type="submit" className="btn btn-sm" disabled={pending}>{label}</button></form>
      : <a ref={trigger} className="btn btn-sm" href={href} download aria-disabled={pending || undefined} aria-busy={pending || undefined} onClick={run}>{label}</a>}
    {directSave && <button ref={directTrigger} type="button" className="btn btn-sm" disabled={pending} onClick={(e) => run(e, true)}>{L('Save large CSV to file', 'حفظ CSV كبير في ملف')}</button>}
    {pending && <button ref={cancelButton} type="button" className="btn btn-sm btn-ghost" onClick={cancel}>{L('Cancel export', 'إلغاء التصدير')}</button>}
    {pending && bytes > 0 && <span role="status" className="muted">{L('Received', 'تم الاستلام')} {(bytes / 1048576).toFixed(1)} MiB</span>}
    {error && <span role="alert">{error === 'too_large' ? (directSave ? L('This file exceeds the 32 MiB browser download limit. Use “Save large CSV to file”.', 'يتجاوز الملف حد التنزيل في المتصفح البالغ 32 MiB. استخدم «حفظ CSV كبير في ملف».') : L('This file exceeds 32 MiB. Narrow the filters or open this page in a browser supporting direct file saving.', 'يتجاوز الملف 32 MiB. ضيّق نطاق التصفية أو افتح الصفحة في متصفح يدعم الحفظ المباشر للملفات.')) : error === 'not_csv' ? L('The download response was not a CSV file. Retry the export.', 'لم تكن استجابة التنزيل ملف CSV. أعد محاولة التصدير.') : L('Could not download the CSV. Check the connection and retry.', 'تعذّر تنزيل CSV. تحقق من الاتصال وأعد المحاولة.')} {error !== 'too_large' && <button ref={retryButton} type="button" className="btn btn-sm" onClick={(e) => run(e, retryDirect.current)}>{L('Retry export', 'إعادة محاولة التصدير')}</button>}</span>}
    {status && <span role="status" className="muted">{status === 'saved' ? L('CSV file saved.', 'تم حفظ ملف CSV.') : status === 'started' ? L('CSV download started.', 'بدأ تنزيل ملف CSV.') : L('Export cancelled.', 'أُلغي التصدير.')}</span>}
  </div>;
}
