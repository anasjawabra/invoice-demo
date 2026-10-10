import React, { useRef, useState } from 'react';
import { useL } from '../../utils/bi';
import { fmtRiyadh } from '../../data/clock';
import { buildExtraction, splitOcrText } from '../../data/orderMatching';
import { extractFromPdf, sha256Hex, isPdf, MAX_PDF_BYTES } from '../../data/pdfText';
import { putFile, getFile } from '../../data/enforcementStore';

const METHOD_NOTE = {
  text_layer: { en: 'text layer of the PDF', ar: 'طبقة النص في ملف PDF' },
  ocr_import: { en: 'OCR text imported from an external tool', ar: 'نص OCR مستورد من أداة خارجية' },
  manual_entry: { en: 'typed by a person from the document', ar: 'أدخله شخص من المستند' }
};

// The order's document(s): add the PDF, see exactly which pages were read and which were not, supplement unread pages. NOTHING here is simulated:
// the PDF text layer is really read; a page without text is reported as unread; OCR is not available, so its text must come from outside.
export default function OrderDocumentsPanel({ order, rev, onMessage }) {
  const { L, B } = useL();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [sup, setSup] = useState({}); // per document: { mode:'ocr_import'|'manual_entry', page, text }
  const docs = order.docs || [];
  const canReview = rev.canReview;
  const say = (ok, text) => onMessage({ ok, text });

  const addFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) { say(false, L('The file is larger than 15 MB.', 'الملف أكبر من 15 ميغابايت.')); return; }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!isPdf(bytes)) { say(false, L('This is not a PDF file.', 'هذا ليس ملف PDF.')); return; }
      const id = await sha256Hex(bytes);
      if (docs.some((d) => d.id === id)) { say(false, L('This exact file is already attached to the order.', 'هذا الملف نفسه مرفق بالأمر بالفعل.')); return; }
      let extraction;
      try { extraction = await extractFromPdf(bytes, { orderNo: order.enforceNum }); } catch { say(false, L('The PDF could not be read (damaged or password-protected).', 'تعذّرت قراءة ملف PDF (تالف أو محمي بكلمة مرور).')); return; }
      const stored = await putFile(id, { name: file.name, size: file.size, type: 'application/pdf', bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), at: Date.now() });
      const r = rev.enforcement.recordDocument(order.enforceNum, { id, name: file.name, size: file.size, kind: 'uploaded', addedAt: new Date().toISOString(), fileStored: stored, extraction });
      if (!r.ok) { say(false, L('Could not record the document.', 'تعذّر تسجيل المستند.')); return; }
      const unread = extraction.pages.filter((p) => p.needsOcr).length;
      say(true, L(`Read ${extraction.pages.length} page(s): ${extraction.refs.length} invoice reference(s) found${unread ? `; ${unread} page(s) have no text layer and were NOT read` : ''}.`, `قُرئت ${extraction.pages.length} صفحة: وُجد ${extraction.refs.length} مرجع فاتورة${unread ? `؛ و${unread} صفحة بلا طبقة نص ولم تُقرأ` : ''}.`));
    } catch (e) { say(false, L(`Could not add the document (${e?.message || 'unknown error'}).`, `تعذّرت إضافة المستند (${e?.message || 'خطأ غير معروف'}).`)); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const openFile = async (d) => {
    const rec = await getFile(d.id);
    if (!rec) { say(false, L('The PDF file itself is not stored in this browser (only its extracted references are kept, e.g. after restoring a backup). Add the file again to view it.', 'ملف PDF نفسه غير محفوظ في هذا المتصفح (تُحفظ المراجع المستخرجة فقط، مثلاً بعد استعادة نسخة احتياطية). أضف الملف مرة أخرى لعرضه.')); return; }
    const url = URL.createObjectURL(new Blob([rec.bytes], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const submitSupplement = (d) => {
    const s = sup[d.id] || {}; const mode = s.mode || 'ocr_import';
    const text = String(s.text || '').trim();
    if (!text) { say(false, L('Enter the text first.', 'أدخل النص أولاً.')); return; }
    const unread = (d.extraction?.pages || []).filter((p) => p.needsOcr && !(d.ocrCovered || []).includes(p.page));
    const startPage = Number(s.page) || unread[0]?.page || 1;
    let pages = splitOcrText(text);
    if (pages.length === 1) pages = [{ ...pages[0], page: startPage }];
    else pages = pages.map((p) => ({ ...p, page: startPage + p.page - 1 }));
    const ex = buildExtraction(pages, mode, { orderNo: order.enforceNum });
    const r = rev.enforcement.recordSupplement(order.enforceNum, d.id, ex);
    if (!r.ok) { say(false, L('Could not record the text.', 'تعذّر تسجيل النص.')); return; }
    setSup((m) => ({ ...m, [d.id]: { ...s, text: '' } }));
    say(true, L(`Recorded ${ex.refs.length} invoice reference(s) from page(s) ${ex.pages.map((p) => p.page).join(', ')} (${B(METHOD_NOTE[mode])}).${ex.orderNumberMismatch ? ' ' + L('Note: the text names a different order number.', 'تنبيه: يذكر النص رقم أمر مختلفاً.') : ''}`, `سُجّل ${ex.refs.length} مرجع فاتورة من الصفحة/الصفحات ${ex.pages.map((p) => p.page).join('، ')} (${B(METHOD_NOTE[mode])}).${ex.orderNumberMismatch ? ' ' + 'تنبيه: يذكر النص رقم أمر مختلفاً.' : ''}`));
  };

  const od = order.orderDocument;
  return (
    <div className="card card-pad">
      <h2 className="rv-sec-title">{L('2 · The order document', '2 · مستند الأمر')}</h2>
      <p className="rv-sec-sub">{L('When Sanad’s structured data is missing, incomplete or does not match, the invoice references are read from the order document — every page, including tables and later pages.', 'عندما تكون بيانات سند المهيكلة ناقصة أو غير مكتملة أو لا تطابق، تُقرأ مراجع الفواتير من مستند الأمر — كل الصفحات بما فيها الجداول والصفحات اللاحقة.')}</p>

      <div className="rv-form" style={{ marginBottom: 8 }}>
        <button type="button" className="btn btn-sm" disabled aria-describedby="sanad-doc-note" title={L('Integration dependency', 'اعتماد على تكامل غير متصل')}>{L('Retrieve the PDF from Sanad', 'جلب ملف PDF من سند')}</button>
        <label>{L('Add the order PDF', 'إضافة ملف PDF للأمر')}
          <input ref={fileRef} className="input" type="file" accept="application/pdf,.pdf" disabled={!canReview || busy} onChange={(e) => addFile(e.target.files?.[0])} aria-label={L('Add the order PDF', 'إضافة ملف PDF للأمر')} />
        </label>
        {busy && <span role="status" className="muted">{L('Reading the PDF…', 'جارٍ قراءة ملف PDF…')}</span>}
        {!canReview && <span className="muted">{L('Read-only role', 'دور للقراءة فقط')}</span>}
      </div>
      <div id="sanad-doc-note" className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        {od && od.retrievable === false ? L('Automatic retrieval of the order PDF from Sanad is not connected (integration dependency). Add the file by hand.', 'الجلب الآلي لملف PDF للأمر من سند غير متصل (اعتماد على تكامل). أضف الملف يدوياً.') : ''}
      </div>

      {!docs.length && <div className="rv-empty">{L('No document attached to this order yet.', 'لا يوجد مستند مرفق بهذا الأمر بعد.')}</div>}

      {docs.map((d) => {
        const ex = d.extraction || { pages: [], refs: [], others: [] };
        const unread = ex.pages.filter((p) => p.needsOcr && !(d.ocrCovered || []).includes(p.page));
        const s = sup[d.id] || {};
        return (
          <div key={d.id} className="rv-callout" style={{ marginTop: 8, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div><b dir="ltr">{d.name}</b> <span className="muted" style={{ fontSize: 12 }}>· {(d.size / 1024).toFixed(1)} KB · {L('added', 'أُضيف')} {fmtRiyadh(d.addedAt)} · SHA-256 <span dir="ltr">{String(d.id).slice(0, 12)}…</span></span></div>
              <button type="button" className="btn btn-sm" onClick={() => openFile(d)}>{L('Open the PDF', 'فتح ملف PDF')}</button>
            </div>
            <div className="rv-table-wrap" tabIndex={0}>
              <table className="rv-table" style={{ minWidth: 0 }}>
                <thead><tr><th>{L('Page', 'الصفحة')}</th><th>{L('Read by', 'قُرئت بواسطة')}</th><th className="num">{L('Characters', 'عدد الأحرف')}</th><th>{L('Status', 'الحالة')}</th></tr></thead>
                <tbody>{ex.pages.map((p) => {
                  const covered = (d.ocrCovered || []).includes(p.page);
                  return (
                    <tr key={p.page}>
                      <td>{p.page}</td>
                      <td>{p.needsOcr && !covered ? '—' : p.needsOcr ? B((d.supplements || []).some((x) => x.method === 'manual_entry' && x.pages.includes(p.page)) ? METHOD_NOTE.manual_entry : METHOD_NOTE.ocr_import) : B(METHOD_NOTE[ex.method])}</td>
                      <td className="num">{p.chars}</td>
                      <td>{p.needsOcr && !covered ? <span className="rv-tag rv-tag--bad">{L('NOT read — no text layer (scanned image); OCR is not connected', 'لم تُقرأ — بلا طبقة نص (صورة ممسوحة)؛ ومحرك OCR غير متصل')}</span> : <span className="rv-tag rv-tag--ok">{covered ? L('covered by supplied text', 'مغطاة بنص مُدخل') : L('read', 'مقروءة')}</span>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {L(`${ex.refs.length} invoice reference(s) found in total`, `${ex.refs.length} مرجع فاتورة في المجموع`)}
              {ex.statedAmount != null && <> · {L('the document states a total of', 'يذكر المستند إجمالياً قدره')} <span dir="ltr">{ex.statedAmount.toLocaleString('en-US')}</span> {Math.abs(ex.statedAmount - order.amount) > 1 && <span className="rv-tag rv-tag--bad">{L('differs from the order amount in Sanad', 'يختلف عن مبلغ الأمر في سند')}</span>}</>}
            </div>
            {ex.orderNumberMismatch && <div className="rv-callout rv-callout--bad" role="alert"><b>{L('This document names a different order', 'يذكر هذا المستند أمراً مختلفاً')}</b> ({(ex.orderNumbersInDocument || []).join(', ')}). {L('It may not belong to this order: links found only in it need a written reason to confirm.', 'قد لا ينتمي إلى هذا الأمر: الروابط الواردة فيه فقط تحتاج سبباً مكتوباً للتأكيد.')}</div>}
            {unread.length > 0 && (
              <div className="rv-callout rv-callout--warn" role="alert"><b>{L(`${unread.length} page(s) were not read`, `${unread.length} صفحة لم تُقرأ`)}</b> ({unread.map((p) => p.page).join(', ')}). {L('The order cannot be shown as fully matched until their references are supplied below, or you record that they hold none (supply their text without references).', 'لا يمكن عرض الأمر مطابقاً بالكامل قبل تزويد مراجع هذه الصفحات أدناه، أو تسجيل أنها لا تحوي مراجع (بتزويد نصها دون مراجع).')}</div>
            )}
            {canReview && (
              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>{L('Supply references for pages that could not be read', 'تزويد مراجع للصفحات التي تعذّرت قراءتها')}</summary>
                <div className="rv-form" style={{ marginTop: 8 }}>
                  <label>{L('How the text was obtained', 'كيف أُخذ النص')}
                    <select className="input" value={s.mode || 'ocr_import'} onChange={(e) => setSup((m) => ({ ...m, [d.id]: { ...s, mode: e.target.value } }))}>
                      <option value="ocr_import">{B(METHOD_NOTE.ocr_import)}</option>
                      <option value="manual_entry">{B(METHOD_NOTE.manual_entry)}</option>
                    </select>
                  </label>
                  <label>{L('Starting page', 'صفحة البداية')}
                    <input className="input" type="number" min="1" style={{ width: 90 }} value={s.page ?? (unread[0]?.page || 1)} onChange={(e) => setSup((m) => ({ ...m, [d.id]: { ...s, page: e.target.value } }))} />
                  </label>
                  <label style={{ flex: 1, minWidth: 260 }}>{L('Text (one page, or pages separated by a form feed / «--- page N ---» lines)', 'النص (صفحة واحدة، أو صفحات تفصلها فواصل أو أسطر «--- page N ---»)')}
                    <textarea className="input" style={{ height: 90, paddingBlock: 8 }} dir="ltr" value={s.text || ''} onChange={(e) => setSup((m) => ({ ...m, [d.id]: { ...s, text: e.target.value } }))} placeholder="INV-2025-0000123" />
                  </label>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => submitSupplement(d)}>{L('Record the text', 'تسجيل النص')}</button>
                </div>
                <p className="muted" style={{ fontSize: 12 }}>{L('This is not OCR: this demo has no OCR engine. The text must come from an external OCR tool, or be typed from the document by a person; it is recorded as such and its links need your confirmation.', 'هذا ليس OCR: لا يوجد محرك OCR في هذا العرض. يجب أن يأتي النص من أداة OCR خارجية أو أن يُكتب من المستند بواسطة شخص؛ ويُسجَّل كذلك وتحتاج روابطه إلى تأكيدك.')}</p>
              </details>
            )}
            {(d.supplements || []).length > 0 && <div className="muted" style={{ fontSize: 12 }}>{(d.supplements || []).map((x, i) => <div key={i}>{fmtRiyadh(x.at)} · {x.by} · {B(METHOD_NOTE[x.method])} · {L('pages', 'الصفحات')} {x.pages.join(', ')} · {x.refs} {L('invoice reference(s)', 'مرجع فاتورة')}</div>)}</div>}
          </div>
        );
      })}
    </div>
  );
}
