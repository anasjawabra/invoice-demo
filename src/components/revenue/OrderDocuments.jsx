import React, { useRef, useState } from 'react';
import { useL } from '../../utils/bi';
import { fmtRiyadh } from '../../data/clock';
import { buildExtraction, splitOcrText } from '../../data/orderMatching';
import { sha256Hex } from '../../data/pdfText';
import { extractDocument, detectFormat, FORMAT_LABEL, UNREAD_REASON, MAX_DOC_BYTES } from '../../data/docText';
import { putFile } from '../../data/enforcementStore';
import PdfPreview, { useDocFiles } from '../record/PdfPreview';
import { Section } from '../record/RecordPage';

// How the text of a page reached the system — kept apart on purpose, and never called «OCR performed by this system».
export const METHOD_NOTE = {
  text_layer: { en: 'Digital PDF text layer (read by this system)', ar: 'طبقة نص ملف PDF الرقمي (قرأها النظام)' },
  ocr_import: { en: 'OCR text imported from an external tool (not performed by this system)', ar: 'نص OCR مستورد من أداة خارجية (لم يُنفَّذ في هذا النظام)' },
  docx_text: { en: 'Word document: paragraphs and tables (read by this system)', ar: 'مستند Word: الفقرات والجداول (قرأها النظام)' },
  manual_entry: { en: 'Typed by a person from the document', ar: 'أدخله شخص من المستند' }
};

// The order's documents: add a PDF (retrieval from Sanad is not connected), see the REAL page beside what was read from it, and supply text for pages
// that could not be read. A scanned page has no text layer: it stays «not read» until text from an external OCR tool or typed references are supplied.
export default function OrderDocuments({ order, rev, onMessage, focus = null, tick = 0, onChanged }) {
  const { L, B } = useL();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0); const [page, setPage] = useState(1);
  const [sup, setSup] = useState({});
  const docs = order.docs || []; const canReview = rev.canReview;
  const files = useDocFiles(docs.map((d) => d.id), tick);
  const say = (ok, text) => onMessage({ ok, text });
  const d = docs[Math.min(sel, docs.length - 1)] || null;
  React.useEffect(() => { if (focus) { const i = docs.findIndex((x) => x.id === focus.docId); if (i >= 0) { setSel(i); setPage(focus.page || 1); } } }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const addFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_DOC_BYTES) { say(false, L('The file is larger than 15 MB.', 'الملف أكبر من 15 ميغابايت.')); return; }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const format = await detectFormat(bytes);
      const id = await sha256Hex(bytes);
      if (docs.some((x) => x.id === id)) { say(false, L('This exact file is already attached to the order.', 'هذا الملف نفسه مرفق بالأمر بالفعل.')); return; }
      let extraction;
      try { extraction = await extractDocument(bytes.slice(), { orderNo: order.enforceNum }); } catch { say(false, L('The file could not be read (damaged, password-protected or not what its extension says).', 'تعذّرت قراءة الملف (تالف أو محمي بكلمة مرور أو ليس بالصيغة التي يدّعيها امتداده).')); return; }
      const stored = await putFile(id, { name: file.name, size: file.size, type: file.type || 'application/octet-stream', bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), at: Date.now() });
      const r = rev.enforcement.recordDocument(order.enforceNum, { id, name: file.name, size: file.size, kind: 'uploaded', format, addedAt: new Date().toISOString(), fileStored: stored, extraction });
      if (!r.ok) { say(false, L('Could not record the document.', 'تعذّر تسجيل المستند.')); return; }
      const unread = extraction.pages.filter((p) => p.needsOcr).length;
      setSel(docs.length); setPage(1); onChanged?.();
      const readN = extraction.pages.length - unread;
      if (extraction.unsupported) { say(false, `${file.name}: ${B(FORMAT_LABEL[format] || FORMAT_LABEL.unknown)} — ${B(UNREAD_REASON[extraction.pages[0].reason])}. ${L('The file is kept with the order; no invoice references were identified from it.', 'حُفظ الملف مع الأمر؛ ولم تُحدَّد منه مراجع فواتير.')}`); }
      else say(true, L(`Opened ${extraction.pages.length} page(s): ${readN} read (${B(FORMAT_LABEL[format])}), ${extraction.refs.length} invoice reference(s) found${unread ? `; ${unread} page(s) have no text layer and were NOT read (this system performs no OCR)` : ''}.`, `فُتحت ${extraction.pages.length} صفحة: ${readN} قُرئت (${B(FORMAT_LABEL[format])}) ، ووُجد ${extraction.refs.length} مرجع فاتورة${unread ? `؛ و${unread} صفحة بلا طبقة نص ولم تُقرأ (لا يجري هذا النظام OCR)` : ''}.`));
    } catch (e) { say(false, L(`Could not add the document (${e?.message || 'unknown error'}).`, `تعذّرت إضافة المستند (${e?.message || 'خطأ غير معروف'}).`)); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const submitSupplement = () => {
    const s = sup[d.id] || {}; const mode = s.mode || 'ocr_import'; const text = String(s.text || '').trim();
    if (!text) { say(false, L('Enter the text first.', 'أدخل النص أولاً.')); return; }
    const unread = (d.extraction?.pages || []).filter((p) => p.needsOcr && !(d.ocrCovered || []).includes(p.page));
    const startPage = Number(s.page) || unread[0]?.page || 1;
    let pages = splitOcrText(text);
    pages = pages.length === 1 ? [{ ...pages[0], page: startPage }] : pages.map((p) => ({ ...p, page: startPage + p.page - 1 }));
    const ex = buildExtraction(pages, mode, { orderNo: order.enforceNum });
    const r = rev.enforcement.recordSupplement(order.enforceNum, d.id, ex);
    if (!r.ok) { say(false, L('Could not record the text.', 'تعذّر تسجيل النص.')); return; }
    setSup((m) => ({ ...m, [d.id]: { ...s, text: '' } })); onChanged?.();
    say(true, L(`Recorded ${ex.refs.length} invoice reference(s) from page(s) ${ex.pages.map((p) => p.page).join(', ')} — ${B(METHOD_NOTE[mode])}.${ex.orderNumberMismatch ? ' ' + L('Note: the text names a different order number.', 'تنبيه: يذكر النص رقم أمر مختلفاً.') : ''}`, `سُجّل ${ex.refs.length} مرجع فاتورة من الصفحة/الصفحات ${ex.pages.map((p) => p.page).join('، ')} — ${B(METHOD_NOTE[mode])}.${ex.orderNumberMismatch ? ' تنبيه: يذكر النص رقم أمر مختلفاً.' : ''}`));
  };

  const od = order.orderDocument;
  const unread = d ? (d.extraction?.pages || []).filter((p) => p.needsOcr && !(d.ocrCovered || []).includes(p.page)) : [];
  const s = d ? (sup[d.id] || {}) : {};
  return (
    <>
      <div className="rv-form">
        <button type="button" className="btn btn-sm" disabled aria-describedby="sanad-doc-note">{L('Retrieve the PDF from Sanad', 'جلب ملف PDF من سند')}</button>
        <label>{L('Add a document (PDF, Word .docx; scans/images and legacy .doc are kept but flagged unread)', 'إضافة مستند (PDF أو Word .docx؛ وتُحفظ الصور الممسوحة و.doc القديمة لكن تُعلَّم غير مقروءة)')}<input ref={fileRef} className="input" type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.tif,.tiff,application/pdf" disabled={!canReview || busy} onChange={(e) => addFile(e.target.files?.[0])} /></label>
        {busy && <span role="status" className="muted">{L('Reading the document…', 'جارٍ قراءة المستند…')}</span>}
      </div>
      <div id="sanad-doc-note" className="rp-limit">{od && od.retrievable === false ? L('Retrieval of the order PDF from Sanad is not connected (integration dependency): add the file by hand.', 'جلب ملف PDF للأمر من سند غير متصل (اعتماد على تكامل): أضف الملف يدوياً.') : ''}</div>
      {!docs.length && <div className="muted">{L('No document is attached to this order yet.', 'لا يوجد مستند مرفق بهذا الأمر بعد.')}</div>}
      {docs.length > 1 && <div role="tablist" aria-label={L('Documents', 'المستندات')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{docs.map((x, i) => <button key={x.id} role="tab" aria-selected={i === sel} type="button" className={`btn btn-sm${i === sel ? ' btn-primary' : ''}`} onClick={() => { setSel(i); setPage(1); }}><span dir="ltr">{x.name}</span></button>)}</div>}
      {d && (
        <div className="rp-split">
          <div><PdfPreview doc={d} page={page} tick={tick} onRestored={(name) => { rev.enforcement.restoreFile(order.enforceNum, d.id, name); onChanged?.(); }} /></div>
          <div className="rp-ev">
            <div className="muted" style={{ fontSize: 12 }}><span dir="ltr">{d.name}</span> · {B(FORMAT_LABEL[d.extraction?.format || 'pdf'] || FORMAT_LABEL.unknown)} · {(d.size / 1024).toFixed(1)} KB · {L('added', 'أُضيف')} {fmtRiyadh(d.addedAt)} · SHA-256 <span dir="ltr">{String(d.id).slice(0, 12)}…</span>{files[d.id] === false && <> · <b className="rp-warn">{L('original file unavailable', 'الملف الأصلي غير متاح')}</b></>}{d.fileRestoredAt && <> · {L('file restored', 'استُعيد الملف')} {fmtRiyadh(d.fileRestoredAt)}</>}</div>
            <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Pages read', 'الصفحات المقروءة')}>
              <thead><tr><th>{L('Page', 'الصفحة')}</th><th>{L('How it was read', 'كيف قُرئت')}</th><th>{L('Status', 'الحالة')}</th></tr></thead>
              <tbody>{(d.extraction?.pages || []).map((p) => {
                const covered = (d.ocrCovered || []).includes(p.page); const sup2 = (d.supplements || []).find((x) => x.pages.includes(p.page));
                return (
                  <tr key={p.page} aria-current={p.page === page}>
                    <td><button type="button" className="rv-link" onClick={() => setPage(p.page)}>{p.page}</button></td>
                    <td style={{ fontSize: 12 }}>{p.needsOcr && !covered ? '—' : p.needsOcr ? B(METHOD_NOTE[sup2?.method || 'ocr_import']) : B(METHOD_NOTE[d.extraction.method])}</td>
                    <td>{p.needsOcr && !covered ? <span className="rv-tag rv-tag--bad">{B(UNREAD_REASON[p.reason || 'no_text_layer'])}</span> : <span className="rv-tag rv-tag--ok">{covered ? L('text supplied', 'نص مُزوَّد') : L('read', 'مقروءة')}</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
            <div className="muted" style={{ fontSize: 12 }}>{L(`${d.extraction?.refs?.length || 0} invoice reference(s) found in this document`, `${d.extraction?.refs?.length || 0} مرجع فاتورة في هذا المستند`)}{d.extraction?.statedAmount != null && <> · {L('the document states a total of', 'يذكر المستند إجمالياً')} <span dir="ltr">{d.extraction.statedAmount.toLocaleString('en-US')}</span>{Math.abs(d.extraction.statedAmount - order.amount) > 1 && <span className="rv-tag rv-tag--bad"> {L('differs from the order amount in Sanad', 'يختلف عن مبلغ الأمر في سند')}</span>}</>}</div>
            {d.extraction?.orderNumberMismatch && <div className="rp-limit rp-limit--warn" role="alert"><b>{L('This document names a different order', 'يذكر هذا المستند أمراً مختلفاً')}</b> ({(d.extraction.orderNumbersInDocument || []).join(', ')}). {L('A link found only in it cannot be confirmed.', 'ولا يمكن تأكيد رابط ورد فيه وحده.')}</div>}
            {unread.length > 0 && <div className="rp-limit rp-limit--warn" role="alert"><b>{L(`${unread.length} page(s) not read: ${unread.map((p) => p.page).join(', ')}`, `${unread.length} صفحة لم تُقرأ: ${unread.map((p) => p.page).join('، ')}`)}</b> — {L('document extraction stays incomplete until their text is supplied below.', 'يبقى استخراج المستند ناقصاً حتى يُزوَّد نصها أدناه.')}</div>}
            {canReview && (
              <Section id="supply" secondary title={L('Supply text for unread pages', 'تزويد نص للصفحات غير المقروءة')}>
                <div className="rv-form">
                  <label>{L('Where the text came from', 'مصدر النص')}<select className="input" value={s.mode || 'ocr_import'} onChange={(e) => setSup((m) => ({ ...m, [d.id]: { ...s, mode: e.target.value } }))}><option value="ocr_import">{B(METHOD_NOTE.ocr_import)}</option><option value="manual_entry">{B(METHOD_NOTE.manual_entry)}</option></select></label>
                  <label>{L('Starting page', 'صفحة البداية')}<input className="input" type="number" min="1" style={{ width: 90 }} value={s.page ?? (unread[0]?.page || 1)} onChange={(e) => setSup((m) => ({ ...m, [d.id]: { ...s, page: e.target.value } }))} /></label>
                </div>
                <label style={{ display: 'grid', gap: 4 }}>{L('Text (one page, or pages separated by «--- page N ---» lines)', 'النص (صفحة واحدة، أو صفحات تفصلها أسطر «--- page N ---»)')}<textarea className="input" style={{ height: 90, paddingBlock: 8 }} dir="ltr" value={s.text || ''} onChange={(e) => setSup((m) => ({ ...m, [d.id]: { ...s, text: e.target.value } }))} placeholder="INV-2025-0000123" /></label>
                <div><button type="button" className="btn btn-sm btn-primary" onClick={submitSupplement}>{L('Record the text', 'تسجيل النص')}</button></div>
                <div className="rp-limit">{L('This is not OCR performed by this system. The text must come from an external OCR tool or be typed from the document; it is recorded as such, and its links still need your confirmation.', 'هذا ليس OCR ينفّذه هذا النظام. يجب أن يأتي النص من أداة OCR خارجية أو يُكتب من المستند؛ ويُسجَّل كذلك وتحتاج روابطه إلى تأكيدك.')}</div>
              </Section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
