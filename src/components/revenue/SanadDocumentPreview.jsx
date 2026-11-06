import React, { useEffect, useRef, useState } from 'react';
import { useL } from '../../utils/bi';
import { loadPdfLib } from '../../data/pdfText';
import { detectFormat, FORMAT_LABEL, UNREAD_REASON } from '../../data/docText';
import { readDocxPages } from '../../data/docxText';
import { readDocBytes } from '../../data/sanadDocs/service';
import '../../styles/sanad-docs.css';

// Preview of the document attached to a Sanad record, by what the file really is: a PDF page drawn by pdf.js, the text and tables of a Word file, an image as it is, anything else an explicit
// «nothing was read» notice. The bytes come from the Sanad document store (an uploaded file) or from the synthetic sample URL; the page is controlled by the parent so the transcript can follow it.
export default function SanadDocumentPreview({ doc, page = 1, onPage, onCount }) {
  const { L, B } = useL();
  const [bytes, setBytes] = useState(null); const [fmt, setFmt] = useState(null); const [err, setErr] = useState(null);
  const [count, setCount] = useState(0); const [status, setStatus] = useState('loading'); const [docx, setDocx] = useState([]); const [imgUrl, setImgUrl] = useState(null);
  const canvas = useRef(null); const pdfRef = useRef(null);

  useEffect(() => { // load the bytes once per document
    let off = false; setBytes(null); setFmt(null); setErr(null); setStatus('loading'); setCount(0); setDocx([]);
    (async () => {
      try {
        const b = await readDocBytes(doc); const f = await detectFormat(b); if (off) return;
        setBytes(b); setFmt(f);
        if (f === 'docx') { const r = await readDocxPages(b.slice()); if (off) return; setDocx(r.pages); setCount(r.pages.length || 1); setStatus('ready'); onCount?.(r.pages.length || 1); }
        else if (f === 'pdf') { const lib = await loadPdfLib(); const pdf = await lib.getDocument({ data: b.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise; if (off) { pdf.destroy(); return; } pdfRef.current = pdf; setCount(pdf.numPages); onCount?.(pdf.numPages); setStatus('ready'); }
        else setStatus('ready');
      } catch (e) { if (!off) { setErr(String(e?.message || e)); setStatus('error'); } }
    })();
    return () => { off = true; try { pdfRef.current?.destroy(); } catch { /* none */ } pdfRef.current = null; };
  }, [doc.sha256, doc.orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { // draw the current PDF page
    if (fmt !== 'pdf' || status !== 'ready' || !pdfRef.current) return undefined;
    let off = false;
    (async () => {
      try {
        const p = await pdfRef.current.getPage(Math.min(Math.max(1, page), pdfRef.current.numPages)); const vp = p.getViewport({ scale: 1.4 }); const c = canvas.current; if (!c || off) return;
        c.width = vp.width; c.height = vp.height; await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      } catch (e) { if (!off) { setErr(String(e?.message || e)); setStatus('error'); } }
    })();
    return () => { off = true; };
  }, [fmt, status, page, doc.sha256]);

  useEffect(() => { // an image: a temporary object URL
    if (fmt !== 'image' || !bytes) return undefined;
    const u = URL.createObjectURL(new Blob([bytes], { type: doc.type || 'image/png' })); setImgUrl(u); return () => URL.revokeObjectURL(u);
  }, [fmt, bytes, doc.type]);

  const n = count || 1; const pg = Math.min(Math.max(1, page), n);
  const paged = fmt === 'pdf' || fmt === 'docx';
  return (
    <div className="rp-pdf">
      <div className="rp-pdf__bar">
        <b dir="ltr" style={{ overflowWrap: 'anywhere' }}>{doc.name}</b>
        {paged ? (
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" className="btn btn-sm" disabled={pg <= 1} onClick={() => onPage?.(pg - 1)} aria-label={L('Previous page', 'الصفحة السابقة')}>‹</button>
            <span dir="ltr">{pg} / {n}</span>
            <button type="button" className="btn btn-sm" disabled={pg >= n} onClick={() => onPage?.(pg + 1)} aria-label={L('Next page', 'الصفحة التالية')}>›</button>
          </span>
        ) : fmt ? <span className="rv-tag">{B(FORMAT_LABEL[fmt] || FORMAT_LABEL.unknown)}</span> : null}
      </div>
      {status === 'loading' && <div role="status" className="muted">{L('Loading the document…', 'جارٍ تحميل المستند…')}</div>}
      {status === 'error' && <div role="alert" className="rp-bad">{L('The document could not be shown.', 'تعذّر عرض المستند.')} {err}</div>}
      {fmt === 'pdf' && <canvas ref={canvas} role="img" aria-label={`${doc.name} — ${L('page', 'صفحة')} ${pg}`} style={{ display: status === 'ready' ? 'block' : 'none' }} />}
      {fmt === 'docx' && docx[pg - 1] && <pre dir="auto" tabIndex={0} aria-label={`${doc.name} — ${L('page', 'صفحة')} ${pg}`} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'inherit', fontSize: 13, margin: 0, padding: 10, border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)' }}>{docx[pg - 1].text}</pre>}
      {fmt === 'image' && imgUrl && <img className="sd-img" src={imgUrl} alt={doc.name} />}
      {status === 'ready' && fmt && !paged && fmt !== 'image' && <div className="rp-limit rp-limit--warn" role="alert"><b>{B(UNREAD_REASON[fmt === 'doc' ? 'unsupported_format' : 'unknown_format'])}</b></div>}
      {status === 'ready' && fmt === 'image' && <div className="muted" style={{ fontSize: 12 }}>{L('An image: shown as it is. No text is read from it.', 'صورة: تُعرض كما هي. لا يُقرأ منها أي نص.')}</div>}
    </div>
  );
}
