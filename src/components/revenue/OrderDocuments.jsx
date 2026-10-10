import React, { useState } from 'react';
import { useL } from '../../utils/bi';
import { fmtRiyadh } from '../../data/clock';
import { buildExtraction, splitOcrText } from '../../data/orderMatching';
import { FORMAT_LABEL, UNREAD_REASON } from '../../data/docText';
import { locLabel } from '../../data/docxText';
import { SIM_LABEL } from '../../data/ocrSimulation';
import PdfPreview, { useDocFiles } from '../record/PdfPreview';
import { Section } from '../record/RecordPage';

// How the text of a page reached the system — kept apart on purpose (stored per record), and never called «OCR performed by this system».
export const METHOD_NOTE = {
  text_layer: { en: 'Digital PDF text extraction (read by this system)', ar: 'استخراج نص PDF رقمي (قرأه النظام)' },
  docx_text: { en: 'Word document: paragraphs and tables (read by this system)', ar: 'مستند Word: الفقرات والجداول (قرأها النظام)' },
  ocr_simulated: { en: `${SIM_LABEL.en} — a prepared sample, not real OCR`, ar: `${SIM_LABEL.ar} — عينة معدّة وليست OCR حقيقياً` },
  ocr_system: { en: 'OCR engine of this system (not connected)', ar: 'محرك OCR في هذا النظام (غير متصل)' },
  ocr_import: { en: 'OCR text imported from an external tool (not performed by this system)', ar: 'نص OCR مستورد من أداة خارجية (لم يُنفَّذ في هذا النظام)' },
  manual_entry: { en: 'Typed by a person', ar: 'أدخله شخص' }
};

// Evidence of the order's documents (inside «details»): the real file beside what was read from it, page by page (a Word file by location), the method of each reading, and a way to
// supply text for pages that could not be read. Adding and analysing documents happens in the three-step journey above, not here.
export default function OrderDocuments({ order, rev, onMessage, focus = null, tick = 0, onChanged }) {
  const { L, B, ar } = useL();
  const [sel, setSel] = useState(0); const [page, setPage] = useState(1);
  const [sup, setSup] = useState({});
  const docs = order.docs || []; const canReview = rev.canReview;
  const files = useDocFiles(docs.map((d) => d.id), tick);
  const d = docs[Math.min(sel, docs.length - 1)] || null;
  React.useEffect(() => { if (focus) { const i = docs.findIndex((x) => x.id === focus.docId); if (i >= 0) { setSel(i); setPage(focus.page || 1); } } }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const say = (ok, text) => onMessage({ ok, text });

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
    say(true, L(`Recorded ${ex.refs.length} invoice reference(s) from page(s) ${ex.pages.map((p) => p.page).join(', ')} — ${B(METHOD_NOTE[mode])}.`, `سُجّل ${ex.refs.length} مرجع فاتورة من الصفحة/الصفحات ${ex.pages.map((p) => p.page).join('، ')} — ${B(METHOD_NOTE[mode])}.`));
  };

  if (!d) return <div className="muted">{L('No document yet. Add one in step 1.', 'لا مستند بعد. أضف مستنداً في الخطوة 1.')}</div>;
  const ex = d.extraction; const exact = ex?.exactPages !== false; const method = ex?.method;
  const unread = (ex?.pages || []).filter((p) => p.needsOcr && !(d.ocrCovered || []).includes(p.page));
  const s = sup[d.id] || {};
  return (
    <>
      {docs.length > 1 && <div role="tablist" aria-label={L('Documents', 'المستندات')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{docs.map((x, i) => <button key={x.id} role="tab" aria-selected={i === sel} type="button" className={`btn btn-sm${i === sel ? ' btn-primary' : ''}`} onClick={() => { setSel(i); setPage(1); }}><span dir="ltr">{x.kind === 'manual' ? L('Typed references', 'مراجع مُدخلة') : x.name}</span></button>)}</div>}
      {d.kind === 'manual' ? (
        <div className="rp-ev"><div className="rp-limit">{B(METHOD_NOTE.manual_entry)}. {L('There is no file: these references were typed by a person.', 'لا يوجد ملف: أدخل شخص هذه المراجع.')}</div>
          <ul>{(ex?.refs || []).map((r) => <li key={r.value} dir="ltr">{r.value}</li>)}</ul></div>
      ) : (
        <div className="rp-split">
          <div><PdfPreview doc={d} page={page} tick={tick} onRestored={(name) => { rev.enforcement.restoreFile(order.enforceNum, d.id, name); onChanged?.(); }} /></div>
          <div className="rp-ev">
            <div className="muted" style={{ fontSize: 12 }}><span dir="ltr">{d.name}</span> · {B(FORMAT_LABEL[ex?.format || d.format || 'pdf'] || FORMAT_LABEL.unknown)} · {(d.size / 1024).toFixed(1)} KB · {L('added', 'أُضيف')} {fmtRiyadh(d.addedAt)} · SHA-256 <span dir="ltr">{String(d.id).slice(0, 12)}…</span>{files[d.id] === false && <> · <b className="rp-warn">{L('original file unavailable — only the extracted evidence remains', 'الملف الأصلي غير متاح — بقي الدليل المستخرج فقط')}</b></>}{d.fileRestoredAt && <> · {L('file restored', 'استُعيد الملف')} {fmtRiyadh(d.fileRestoredAt)}</>}</div>
            {!ex && <div className="rp-limit rp-limit--warn">{L('Not analysed yet — press «Analyse and link invoices».', 'لم يُحلَّل بعد — اضغط «تحليل وربط الفواتير».')}</div>}
            {ex && ex.pages.length > 0 && ex.pages.every((p) => p.needsOcr) && !(d.ocrCovered || []).length && <div className="rp-limit rp-limit--warn"><b>{L('Nothing was read from this file.', 'لم يُقرأ شيء من هذا الملف.')}</b> {L('No method applies: it is kept as the original, and no reference is attributed to it.', 'لا تنطبق أي طريقة: يُحفظ الأصل ولا يُنسب إليه أي مرجع.')}</div>}
            {ex && !(ex.pages.length > 0 && ex.pages.every((p) => p.needsOcr) && !(d.ocrCovered || []).length) && <div className="rp-limit"><b>{L('Method', 'الطريقة')}:</b> {B(METHOD_NOTE[method] || { en: method, ar: method })}{method === 'ocr_simulated' && <> <span className="rv-tag rv-tag--warn">{B(SIM_LABEL)}</span></>}</div>}
            {ex && (
              <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Pages read', 'الصفحات المقروءة')}>
                <thead><tr><th>{exact ? L('Page', 'الصفحة') : L('Locations', 'المواضع')}</th><th>{L('How it was read', 'كيف قُرئت')}</th><th>{L('Status', 'الحالة')}</th></tr></thead>
                <tbody>{ex.pages.map((p) => {
                  const covered = (d.ocrCovered || []).includes(p.page); const sup2 = (d.supplements || []).find((x) => x.pages.includes(p.page));
                  const locs = !exact ? [...new Set((ex.refs || []).flatMap((r) => r.occurrences.map((o) => o.loc)).filter(Boolean))] : [];
                  return (
                    <tr key={p.page} aria-current={p.page === page}>
                      <td>{exact ? <button type="button" className="rv-link" onClick={() => setPage(p.page)}>{p.page}</button> : <span style={{ fontSize: 12 }}>{L('no exact page numbers (Word)', 'لا ترقيم صفحات دقيق (Word)')}{locs.length ? <div className="muted">{locs.map((x) => locLabel(x, ar)).join(' · ')}</div> : null}</span>}</td>
                      <td style={{ fontSize: 12 }}>{p.needsOcr && !covered ? '—' : p.needsOcr ? B(METHOD_NOTE[sup2?.method || 'ocr_import']) : B(METHOD_NOTE[method] || { en: method, ar: method })}</td>
                      <td>{p.needsOcr && !covered ? <span className="rv-tag rv-tag--bad">{B(UNREAD_REASON[p.reason || 'no_text_layer'])}</span> : <span className="rv-tag rv-tag--ok">{covered ? L('text supplied', 'نص مُزوَّد') : L('read', 'مقروءة')}</span>}</td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
            {ex && <div className="muted" style={{ fontSize: 12 }}>{L(`${ex.refs?.length || 0} invoice reference(s) in this document`, `${ex.refs?.length || 0} مرجع فاتورة في هذا المستند`)}{ex.statedAmount != null && <> · {L('the document states a total of', 'يذكر المستند إجمالياً')} <span dir="ltr">{ex.statedAmount.toLocaleString('en-US')}</span>{Math.abs(ex.statedAmount - order.amount) > 1 && <span className="rv-tag rv-tag--bad"> {L('differs from the order amount in Sanad', 'يختلف عن مبلغ الأمر في سند')}</span>}</>}</div>}
            {ex?.orderNumberMismatch && <div className="rp-limit rp-limit--warn" role="alert"><b>{L('This document names a different order', 'يذكر هذا المستند أمراً مختلفاً')}</b> ({(ex.orderNumbersInDocument || []).join(', ')}). {L('A link found only in it cannot be confirmed.', 'ولا يمكن تأكيد رابط ورد فيه وحده.')}</div>}
            {unread.length > 0 && <div className="rp-limit rp-limit--warn" role="alert"><b>{exact ? L(`${unread.length} page(s) not read: ${unread.map((p) => p.page).join(', ')}`, `${unread.length} صفحة لم تُقرأ: ${unread.map((p) => p.page).join('، ')}`) : L('The file was not read', 'لم يُقرأ الملف')}</b></div>}
            {canReview && unread.length > 0 && (
              <Section id="supply" secondary title={L('Supply text for unread pages', 'تزويد نص للصفحات غير المقروءة')}>
                <div className="rv-form">
                  <label>{L('Where the text came from', 'مصدر النص')}<select className="input" value={s.mode || 'ocr_import'} onChange={(e) => setSup((m) => ({ ...m, [d.id]: { ...s, mode: e.target.value } }))}><option value="ocr_import">{B(METHOD_NOTE.ocr_import)}</option><option value="manual_entry">{B(METHOD_NOTE.manual_entry)}</option></select></label>
                  <label>{L('Starting page', 'صفحة البداية')}<input className="input" type="number" min="1" style={{ width: 90 }} value={s.page ?? (unread[0]?.page || 1)} onChange={(e) => setSup((m) => ({ ...m, [d.id]: { ...s, page: e.target.value } }))} /></label>
                </div>
                <label style={{ display: 'grid', gap: 4 }}>{L('Text (one page, or pages separated by «--- page N ---» lines)', 'النص (صفحة واحدة، أو صفحات تفصلها أسطر «--- page N ---»)')}<textarea className="input" style={{ height: 90, paddingBlock: 8 }} dir="ltr" value={s.text || ''} onChange={(e) => setSup((m) => ({ ...m, [d.id]: { ...s, text: e.target.value } }))} placeholder="INV-2025-0000123" /></label>
                <div><button type="button" className="btn btn-sm btn-primary" onClick={submitSupplement}>{L('Record the text', 'تسجيل النص')}</button></div>
                <div className="rp-limit">{L('This is not OCR performed by this system. The text must come from an external OCR tool or be typed from the document; it is recorded as such.', 'هذا ليس OCR ينفّذه هذا النظام. يجب أن يأتي النص من أداة OCR خارجية أو يُكتب من المستند؛ ويُسجَّل كذلك.')}</div>
              </Section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
