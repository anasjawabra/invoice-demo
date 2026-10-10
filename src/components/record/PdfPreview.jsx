import React, { useEffect, useRef, useState } from 'react';
import { useL } from '../../utils/bi';
import { loadPdfLib, sha256Hex, isPdf } from '../../data/pdfText';
import { getFile, putFile } from '../../data/enforcementStore';

// Is the original PDF stored in THIS browser? (A backup keeps the extracted references and history but never the file.)
export function useDocFiles(docIds, tick = 0) {
  const [state, setState] = useState({});
  const key = docIds.join('|');
  useEffect(() => {
    let off = false;
    (async () => { const m = {}; for (const id of docIds) m[id] = !!(await getFile(id)); if (!off) setState(m); })();
    return () => { off = true; };
  }, [key, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return state; // id → true / false (undefined while checking)
}

// The re-upload action. The replacement is associated ONLY if its SHA-256 equals the document's recorded identity; otherwise it is refused.
export function RestoreDocument({ doc, onRestored, compact = false }) {
  const { L } = useL();
  const [msg, setMsg] = useState(null); const ref = useRef(null);
  const pick = async (file) => {
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!isPdf(bytes)) { setMsg({ bad: true, t: L('This is not a PDF file.', 'هذا ليس ملف PDF.') }); return; }
      const hash = await sha256Hex(bytes);
      if (hash !== doc.id) { setMsg({ bad: true, t: L(`Not the same document: the file's SHA-256 (${hash.slice(0, 10)}…) differs from the recorded one (${doc.id.slice(0, 10)}…). It was NOT associated. To use a different file, add it as a new document on the order.`, `ليس المستند نفسه: بصمة الملف (${hash.slice(0, 10)}…) تختلف عن المسجّلة (${doc.id.slice(0, 10)}…). لم يُربط. لاستخدام ملف مختلف أضفه كمستند جديد على الأمر.`) }); return; }
      const ok = await putFile(doc.id, { name: file.name, size: file.size, type: 'application/pdf', bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), at: Date.now() });
      if (!ok) { setMsg({ bad: true, t: L('The browser could not store the file.', 'تعذّر على المتصفح حفظ الملف.') }); return; }
      setMsg({ bad: false, t: L('Identity confirmed (same SHA-256). The original PDF is available again.', 'تأكدت الهوية (البصمة نفسها). عاد ملف PDF الأصلي متاحاً.') });
      onRestored?.(file.name);
    } finally { if (ref.current) ref.current.value = ''; }
  };
  return (
    <div className="rp-limit rp-limit--warn" role="group" aria-label={L('Original PDF unavailable', 'ملف PDF الأصلي غير متاح')}>
      <b>{L('The original PDF is not available in this browser', 'ملف PDF الأصلي غير متاح في هذا المتصفح')}</b>
      {!compact && <div>{L('The extracted references, page numbers, evidence and the confirmed-link history are kept; only the file itself is missing (backups do not include PDF files).', 'تبقى المراجع المستخرجة وأرقام الصفحات والأدلة وسجل الروابط المؤكدة؛ والمفقود هو الملف نفسه فقط (النسخ الاحتياطية لا تتضمن ملفات PDF).')}</div>}
      <label style={{ display: 'inline-grid', gap: 3, marginTop: 6 }}>{L('Add the file again (its identity is checked)', 'أعد إضافة الملف (يُتحقق من هويته)')}
        <input ref={ref} className="input" type="file" accept="application/pdf,.pdf" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {msg && <div role="status" className={msg.bad ? 'rp-bad' : 'rp-ok'} style={{ marginTop: 4 }}>{msg.t}</div>}
    </div>
  );
}

// One page of the stored PDF, drawn by pdf.js (the real file, not a mock-up).
export default function PdfPreview({ doc, page = 1, onRestored, tick = 0 }) {
  const { L } = useL();
  const canvas = useRef(null);
  const [state, setState] = useState({ status: 'loading', pages: 0 });
  const [pg, setPg] = useState(page);
  useEffect(() => { setPg(page || 1); }, [page, doc.id]);
  useEffect(() => {
    let off = false; let pdf = null;
    (async () => {
      setState((s) => ({ ...s, status: 'loading' }));
      const rec = await getFile(doc.id);
      if (!rec) { if (!off) setState({ status: 'missing', pages: 0 }); return; }
      try {
        const lib = await loadPdfLib();
        pdf = await lib.getDocument({ data: new Uint8Array(rec.bytes.slice(0)), isEvalSupported: false, verbosity: 0 }).promise;
        const n = Math.min(Math.max(1, pg), pdf.numPages);
        const p = await pdf.getPage(n); const vp = p.getViewport({ scale: 1.5 }); const c = canvas.current; if (!c || off) return;
        c.width = vp.width; c.height = vp.height;
        await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        if (!off) setState({ status: 'ready', pages: pdf.numPages });
      } catch (e) { if (!off) setState({ status: 'error', pages: 0, msg: String(e?.message || e) }); } finally { /* pdf destroyed on unmount */ }
    })();
    return () => { off = true; try { pdf?.destroy(); } catch { /* none */ } };
  }, [doc.id, pg, tick]);
  if (state.status === 'missing') return <RestoreDocument doc={doc} onRestored={onRestored} />;
  return (
    <div className="rp-pdf">
      <div className="rp-pdf__bar">
        <b dir="ltr" style={{ overflowWrap: 'anywhere' }}>{doc.name}</b>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" disabled={pg <= 1} onClick={() => setPg((x) => Math.max(1, x - 1))} aria-label={L('Previous page', 'الصفحة السابقة')}>‹</button>
          <span dir="ltr">{pg} / {state.pages || (doc.extraction?.pages?.length ?? '…')}</span>
          <button type="button" className="btn btn-sm" disabled={state.pages ? pg >= state.pages : false} onClick={() => setPg((x) => x + 1)} aria-label={L('Next page', 'الصفحة التالية')}>›</button>
        </span>
      </div>
      {state.status === 'loading' && <div role="status" className="muted">{L('Drawing the page…', 'جارٍ عرض الصفحة…')}</div>}
      {state.status === 'error' && <div role="alert" className="rp-bad">{L('The PDF could not be drawn.', 'تعذّر عرض ملف PDF.')} {state.msg}</div>}
      <canvas ref={canvas} role="img" aria-label={`${doc.name} — ${L('page', 'صفحة')} ${pg}`} style={{ display: state.status === 'ready' ? 'block' : 'none' }} />
    </div>
  );
}
