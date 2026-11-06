import React, { useMemo, useRef, useState } from 'react';
import { useL } from '../../utils/bi';
import { RecordLink } from '../../utils/returnContext';
import { invoicePath } from '../../utils/paths';
import { PayStatusChip, Chip, CONFLICT_LABEL, KIND_LABEL, SOURCE_LABEL, RESOLVE_HINT } from './EnforcementUI';
import { ORIGIN_LABEL, isHardConflict } from '../../data/orderMatching';
import { rowState, selectionFor, totalsFor, summaryLines, NOT_IDENTIFIED, matchCriteria, PARTIAL_MATCH, confidenceOf, CONFIDENCE_LABEL } from '../../data/orderSummary';
import { samplesForOrder, SIM_LABEL } from '../../data/ocrSimulation';
import { FORMAT_LABEL, UNREAD_REASON } from '../../data/docText';
import { locLabel } from '../../data/docxText';
import { METHOD_NOTE } from './OrderDocuments';
import { rowFlags, withCriteria } from '../../data/sanadDocs/reviewFlags';
import { ENTITIES } from '../../data/catalog';
import { fmtRiyadh } from '../../data/clock';
import { useOrderWork } from './useOrderWork';
import { WorkflowBanner, ManualSearch, ConfirmSummary, OutcomePanel, CorrectionNote } from './SanadDocumentWorkflow';
import { assessOrder, confirmationSummary, canConfirm, manualReferencesFrom, originKinds } from '../../data/sanadWorkflow';
import { SHOW_INTERNAL_NOTES } from '../../data/uiFlags';


const amanahLabel = (en, ar) => { const e = ENTITIES.find((x) => x.en === en); return e ? (ar ? e.ar : e.en) : (en || '—'); };
const FLAG_CLS = { bad: 'rv-tag--bad', warn: 'rv-tag--warn', info: '' };

// where an extracted number was found: the document, its page and the highlighted passage (the snippet is the line of the document the number was read from)
function Found({ row, L, B, ar }) {
  const docs = row.origins.filter((o) => o.docId);
  const others = row.origins.filter((o) => !o.docId);
  return (
    <>
      {docs.map((o, i) => (
        <div key={i} className="oj-found">
          <span className="muted" style={{ fontSize: 12 }}>{B(ORIGIN_LABEL[o.type] || { en: o.type, ar: o.type })}{o.docName !== 'manual-entry' && <> · <span dir="ltr">{o.docName}</span></>}{o.docName !== 'manual-entry' && o.pages?.length ? ` · ${L('p.', 'ص')} ${o.pages.join(',')}` : ''}{o.locs?.length ? ` (${o.locs.map((x) => locLabel(x, ar)).join('، ')})` : ''}</span>
          {o.snippet && <mark className="oj-snip" dir="rtl">{o.snippet}</mark>}
        </div>
      ))}
      {others.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{others.map((o, i) => <span key={i}>{i ? ' · ' : ''}{B(ORIGIN_LABEL[o.type] || { en: o.type, ar: o.type })}</span>)}</div>}
    </>
  );
}

// a saved link: who confirmed it, when, and the supporting document (name · pages · passage) — kept in the link itself
export function LinkEvidence({ link }) {
  const { L, ar } = useL();
  if (!link || link.status !== 'confirmed') return null;
  const ev = (link.evidence || []).filter((e) => (e.docId || e.docName) && e.docId !== 'manual-entry');
  const manualEv = (link.evidence || []).filter((e) => e.docId === 'manual-entry' && e.snippet);
  return (
    <div className="oj-linkev" style={{ fontSize: 12 }}>
      <div className="rp-ok"><b>{L('Confirmed', 'مؤكَّد')}</b> {L('by', 'بواسطة')} {link.reviewedBy || '—'} · <span dir="ltr">{link.reviewedAt ? fmtRiyadh(link.reviewedAt) : '—'}</span></div>
      {ev.map((e, i) => <div key={i} className="muted"><span dir="ltr">{e.docName}</span>{e.pages?.length ? ` · ${L('p.', 'ص')} ${e.pages.join(',')}` : ''}{e.snippet && <> — <q dir="rtl">{e.snippet}</q></>}</div>)}
      {manualEv.map((e, i) => <div key={`m${i}`} className="muted">{L('Explanation', 'الشرح')}: {e.snippet}</div>)}
      {link.reviewNote ? <div className="muted">{L('Note', 'ملاحظة')}: {link.reviewNote}</div> : null}
      {link.amountAck && <div className="rp-warn"><b>{L('Difference acknowledged', 'أُقرّ بالفرق')}</b>: <span dir="ltr">{link.amountAck.difference}</span> ({L('order', 'الأمر')} <span dir="ltr">{link.amountAck.orderAmount}</span> · {L('invoices', 'الفواتير')} <span dir="ltr">{link.amountAck.invoicesTotal}</span>) — {link.amountAck.reason}</div>}
    </div>
  );
}

// The order's journey in three plain steps — 1 add the document · 2 analyse it · 3 review and confirm the links — with ONE primary action and ONE consolidated review table.
// References from the structured field, the description, the notes and every document are combined automatically; nothing asks for a separate confirmation per source.
export default function OrderJourney({ c, rev, rows: rowsIn, results = [], loading, error, onRetry, comp, inputFor, others, onMessage, setTick, setFocus, docSlot = null, docState = null }) {
  const { L, B, ar, sar } = useL();
  const work = useOrderWork({ order: c, rev, onMessage, L, B });
  const fileRef = useRef(null);
  const [ran, setRan] = useState(false); const [manual, setManual] = useState(''); const [ov, setOv] = useState({}); const [done, setDone] = useState(null); const [fix, setFix] = useState({}); const [why, setWhy] = useState({}); const [moreOpen, setMoreOpen] = useState(false); const [ack, setAck] = useState({ acknowledged: false, reason: '' }); const [fixing, setFixing] = useState(null); const [fixForm, setFixForm] = useState({ to: '', reason: '' });
  const docs = c.docs || []; const canReview = rev.canDo.enforcementReview; const canUpload = rev.canDo.enforcementUpload; // links / references → enforcement.review · documents and their analysis → enforcement.upload
  // D22 — three criteria must agree (invoice number · Amanah · amount). The order's amount is compared with the invoices matched by reference: the one invoice, or their total.
  const { rows, orderTotal } = useMemo(() => withCriteria(c, rowsIn), [c, rowsIn]);
  const pending = docs.filter((d) => !d.extraction && d.kind !== 'manual');
  const ownSamples = samplesForOrder(work.samples, c.enforceNum);
  const visible = useMemo(() => rows.filter((r) => rowState(r).kind !== 'duplicate'), [rows]); // a reference that is the same invoice as another row is merged into that row (its evidence is kept)
  const selected = useMemo(() => selectionFor(rows, ov), [rows, ov]);
  const totals = totalsFor(c, comp.reconciliation, selected);
  const sum = summaryLines(comp, rows);
  const assess = useMemo(() => assessOrder(c, results, { docState }), [c, results, docState]);
  const confirmedTotalNow = totals.confirmedTotal;
  const summary = useMemo(() => confirmationSummary(c, selected, { confirmedTotal: confirmedTotalNow }), [c, selected, confirmedTotalNow]);
  const can = canConfirm(summary, ack);
  const linkedIds = useMemo(() => new Set(visible.map((r) => r.value)), [visible]);
  const analysed = docs.length > 0 && pending.length === 0;
  const step2done = ran || (analysed && docs.length > 0) || visible.length > 0;
  const nothingRead = (ex) => ex.pages.length > 0 && ex.pages.every((p) => p.needsOcr);
  const badDocs = docs.filter((d) => d.extraction && nothingRead(d.extraction) && !(d.ocrCovered || []).length);

  const run = async () => {
    onMessage(null); const out = await work.analyze();
    if (out) { setRan(true); setTick((x) => x + 1); if (out.missing) onMessage({ ok: false, text: L(`${out.missing} document(s) have no original file in this browser and could not be analysed: restore the file first.`, `${out.missing} مستند بلا ملف أصلي في هذا المتصفح فلم يُحلَّل: استعد الملف أولاً.`) }); }
  };
  const confirmSelected = () => {
    if (!can.ok) return;
    const ok = []; let fails = 0; let lastErr = null;
    for (const { row, candidate } of selected) {
      const r = rev.enforcement.confirm(c.enforceNum, candidate.invoiceId, { note: why[candidate.invoiceId] || '', input: { ...inputFor(row, candidate), amountCheck: summary.amountCheck }, ack: summary.requiresAck ? { acknowledged: ack.acknowledged, reason: ack.reason } : null });
      if (r.ok) ok.push(candidate); else { fails += 1; lastErr = r.error; }
    }
    setOv({}); setDone(ok); setAck({ acknowledged: false, reason: '' });
    onMessage(fails ? { ok: false, text: lastErr === 'amount_ack_required' ? L('A difference needs your acknowledgment and a reason before confirming.', 'الفرق يحتاج إقرارك وسبباً قبل التأكيد.') : L(`${fails} link(s) could not be recorded.`, `تعذّر تسجيل ${fails} رابط.`) } : null);
  };
  const toggle = (id, on) => setOv((m) => ({ ...m, [id]: on }));
  const noLinkNote = L('Confirming links the invoice to the enforcement order, and the exclusion rules then apply to it (linked to a confirmed enforcement order). It does not approve legal action or mark the invoice paid.', 'التأكيد يربط الفاتورة بأمر التنفيذ، وتُطبَّق عليها بعد ذلك قواعد الاستبعاد (مرتبطة بأمر تنفيذ مؤكد). ولا يعتمد إجراءً قانونياً ولا يجعل الفاتورة مسدّدة.');
  const effectNote = L('Only confirmation applies the exclusion; extraction or a proposed link does not affect any amount.', 'التأكيد وحده هو ما يطبّق الاستبعاد؛ الاستخراج أو الربط المقترح لا يؤثر في أي مبلغ.');
  const selIds = new Set(selected.map((x) => x.candidate.invoiceId));
  const pendingRows = visible.filter((r) => { const k = rowState(r); if (k.kind === 'confirmed' || k.kind === 'rejected') return false; if ((c.dismissedRefs || []).includes(r.key)) return false; return !(k.candidate && selIds.has(k.candidate.invoiceId)); });
  const tone = (t) => (t === 'warn' ? 'rp-warn' : 'rp-ok');
  // the four steps of the flow: 1 the document · 2 extraction · 3 the reviewer checks the matches · 4 confirmation (the step in progress is the first one not done)
  const sanadDocIn = !!docState && docState !== 'missing' && docState !== 'loading'; const sanadExtracted = ['extracted', 'under_review', 'reviewed'].includes(docState);
  const confirmedN = (c.links || []).filter((l) => l.status === 'confirmed').length;
  const doneFlags = [sanadDocIn || docs.length > 0 || visible.length > 0, (sanadExtracted || step2done) && (sanadDocIn || docs.length > 0 || visible.length > 0), visible.length > 0 && pendingRows.length === 0 && (selected.length > 0 || confirmedN > 0), confirmedN > 0 && selected.length === 0 && pendingRows.length === 0 && visible.length > 0];
  const nowStep = doneFlags.findIndex((d) => !d) + 1; // 0 = everything done
  const stateOf = (k) => (doneFlags[k - 1] ? 'done' : k === nowStep ? 'now' : 'todo');
  const digit = (k) => L(String(k), '٠١٢٣٤٥٦٧٨٩'[k]);
  const STEP_WORD = { done: L('done', 'منتهية'), now: L('in progress', 'جارية'), todo: L('not started', 'لم تبدأ') };

  const resultChip = (st, row) => {
    const n = row.candidates.length;
    if (st.kind === 'confirmed') return <Chip def={{ en: 'Linked', ar: 'مربوط', cls: 'rv-cat--enforcement' }} />;
    if (st.kind === 'ready') return row.partialMatch ? <Chip def={{ en: PARTIAL_MATCH.en, ar: PARTIAL_MATCH.ar, cls: 'rv-cat--partial' }} /> : <Chip def={{ en: 'Full match', ar: 'مطابقة تامة', cls: 'rv-cat--collected' }} />;
    if (st.kind === 'weak') return <Chip def={{ en: 'Match on an incomplete number', ar: 'مطابقة برقم ناقص', cls: 'rv-cat--partial' }} />;
    if (st.kind === 'rejected') return <Chip def={{ en: 'Rejected before', ar: 'رُفض سابقاً', cls: 'rv-cat--excluded' }} />;
    if (st.kind === 'corrupted') return <Chip def={{ en: 'Corrupted number — cannot be matched', ar: 'رقم مشوّه — لا يمكن مطابقته', cls: 'rv-cat--overdue' }} />;
    if (st.kind === 'needs_evidence') return <Chip def={{ en: 'Conflict — evidence needed', ar: 'تعارض — يلزم دليل', cls: 'rv-cat--overdue' }} />;
    if (st.kind === 'ambiguous') return <Chip def={{ en: `Ambiguous — ${n} invoices`, ar: `ملتبس — ${n} فواتير`, cls: 'rv-cat--partial' }} />;
    return <Chip def={{ en: 'Not found in the system', ar: 'غير موجود في النظام', cls: 'rv-cat--overdue' }} />;
  };

  return (
    <div className="oj ed-flow" aria-label={L('From the document to the link', 'من المستند إلى الربط')} id="journey">
      <ol className="oj-steps" aria-label={L('Steps', 'الخطوات')}>
        {[[1, L('Document', 'المستند')], [2, L('Extraction', 'الاستخراج')], [3, L('Reviewer check', 'مراجعة المراجع')], [4, L('Confirmation', 'التأكيد')]].map(([k, t]) => (
          <li key={k} className={`oj-step oj-step--${stateOf(k)}`} aria-current={stateOf(k) === 'now' ? 'step' : undefined}><span className="oj-step__n" aria-hidden="true">{stateOf(k) === 'done' ? '✓' : digit(k)}</span><span className="oj-step__t">{t}<span className="sr-only"> — {STEP_WORD[stateOf(k)]}</span></span></li>
        ))}
      </ol>

      <WorkflowBanner assess={assess} />

      {assess.mode === 'confirm_directly'
        ? <details className="ed-more wf-secondary"><summary>{L('Read the document (optional — not needed for this order)', 'قراءة المستند (اختياري — غير لازم لهذا الأمر)')}</summary><div className="ed-more__body">{docSlot && React.cloneElement(docSlot, { optional: true })}</div></details>
        : docSlot}

      <ManualSearch c={c} rev={rev} onMessage={onMessage} setTick={setTick} recommended={assess.manualRecommended} linkedIds={linkedIds} />

      {/* other ways to add references (another file, a prepared sample, typed numbers) and the analysis of the fields / description / those documents */}
      <details className="ed-more" open={moreOpen || pending.length > 0 || !!work.progress || badDocs.length > 0} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
        <summary>{L('Other ways to add references: another file, a prepared sample, typed numbers — then analyse', 'طرق أخرى لإضافة المراجع: ملف آخر أو عينة معدّة أو إدخال يدوي — ثم التحليل')}</summary>
        <div className="ed-more__body" style={{ display: 'grid', gap: 14 }}>
      {/* 1 · add */}
      <div className="oj-panel">
        <h3>{L('Another file, a prepared sample or typed numbers', 'ملف آخر أو عينة معدّة أو إدخال يدوي')}</h3>
        <div className="oj-row">
          <label style={{ display: 'grid', gap: 3, fontSize: 13 }}>{L('Upload a file (PDF or Word .docx)', 'رفع ملف (PDF أو Word .docx)')}
            <input ref={fileRef} className="input" type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.tif,.tiff,application/pdf" disabled={!canUpload || work.busy} onChange={async (e) => { const f = e.target.files?.[0]; await work.addFile(f); if (fileRef.current) fileRef.current.value = ''; setTick((x) => x + 1); }} />
          </label>
          <span className="rv-tag rv-tag--warn">{L('Simulation — pending the link to the Sanad database', 'محاكاة – بانتظار الربط مع قاعدة بيانات سند')}</span>
        </div>
        {/* D19: the target flow is automatic retrieval from Sanad; until that integration exists the manual upload above stays, and this step is shown only to illustrate the future flow */}
        <div className="oj-row" style={{ alignItems: 'center' }}>
          <button type="button" className="btn oj-primary" disabled title={L('Not available yet — needs the Sanad database link', 'غير متاح بعد — يحتاج الربط مع قاعدة بيانات سند')}>{L('Retrieve the document from Sanad automatically (future)', 'استرجاع المستند من سند تلقائيًا (مستقبلًا)')}</button>
          {SHOW_INTERNAL_NOTES && <span className="muted" style={{ fontSize: 13 }}>{L('Future flow: the system fetches the order’s document from Sanad, reads it (OCR) and matches the invoice number + Amanah + amount.', 'المسار المستقبلي: تجلب المنظومة مستند الأمر من سند، وتقرؤه (OCR)، وتطابق رقم الفاتورة + الأمانة + المبلغ.')}</span>}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBlockEnd: 4 }}>{L('Or choose a prepared demo sample for this order', 'أو اختر عينة معدّة لهذا الأمر')} <span className="rv-tag rv-tag--warn">{B(SIM_LABEL)}</span></div>
          {ownSamples.length ? (
            <div className="oj-samples">{ownSamples.map((s) => { const added = docs.some((d) => d.sampleId === s.id); return (
              <button key={s.id} type="button" className="oj-sample" disabled={!canUpload || work.busy || added} onClick={async () => { await work.addSample(s); setTick((x) => x + 1); }}>
                <b>{B(s.title)}</b><small>{B(s.what)}</small><small>{added ? L('Already added', 'أُضيفت بالفعل') : L('Scanned document — read by a labelled simulation, not real OCR', 'مستند ممسوح — يُقرأ بمحاكاة معلّمة وليس OCR حقيقياً')}</small>
              </button>); })}</div>
          ) : <div className="muted" style={{ fontSize: 13 }}>{L('No prepared sample exists for this order. Upload a file or type the references.', 'لا توجد عينة معدّة لهذا الأمر. ارفع ملفاً أو أدخل المراجع يدوياً.')}</div>}
        </div>
        {docs.length > 0 && (
          <ul className="oj-docs" aria-label={L('Added documents', 'المستندات المضافة')}>{docs.map((d) => { const ex = d.extraction; const unreadN = ex ? ex.pages.filter((p) => p.needsOcr && !(d.ocrCovered || []).includes(p.page)).length : 0; return (
            <li key={d.id}>
              <b dir="ltr">{d.kind === 'manual' ? L('Typed references', 'مراجع مُدخلة') : d.name}</b>
              {d.kind !== 'manual' && <span className="muted">{B(FORMAT_LABEL[ex?.format || d.format || 'pdf'] || FORMAT_LABEL.unknown)}</span>}
              {d.kind === 'prepared_sample' && <span className="rv-tag rv-tag--warn">{L('prepared sample', 'عينة معدّة')}</span>}
              {!ex && d.kind !== 'manual' && <span className="rv-tag">{L('ready to analyse', 'جاهز للتحليل')}</span>}
              {ex && !nothingRead(ex) && <span className="rv-tag rv-tag--ok">{L(`analysed · ${ex.refs.length} reference(s)`, `حُلِّل · ${ex.refs.length} مرجع`)}</span>}
              {ex && nothingRead(ex) && <span className="rv-tag rv-tag--bad">{L('nothing could be read', 'لم يُقرأ منه شيء')}</span>}
              {ex && !nothingRead(ex) && <span className="muted" style={{ fontSize: 12 }}>{B(METHOD_NOTE[ex.method] || { en: ex.method, ar: ex.method })}</span>}
              {unreadN > 0 && <span className="rv-tag rv-tag--bad">{unreadN === 1 ? L('1 page not read', 'صفحة واحدة لم تُقرأ') : L(`${unreadN} pages not read`, `${unreadN} صفحات لم تُقرأ`)}</span>}
            </li>); })}</ul>
        )}
        {badDocs.length > 0 && (
          <div className="rp-limit rp-limit--warn" role="alert"><b>{L('A document could not be read', 'تعذّرت قراءة مستند')}:</b> {badDocs.map((d) => <div key={d.id}><span dir="ltr">{d.name}</span> — {B(UNREAD_REASON[d.extraction.pages[0].reason || 'no_text_layer'])}</div>)}{L('Nothing was read from it and nothing is attributed to it. Options: ', 'لم يُقرأ منه شيء ولا يُنسب إليه شيء. الخيارات: ')}{ownSamples.length > 0 && L('choose a prepared sample (recorded separately from your file), ', 'اختر عينة معدّة (تُسجَّل منفصلة عن ملفك)، ')}{L('type the numbers by hand, or supply external OCR text in the details below.', 'أو أدخل الأرقام يدوياً، أو زوّد نص OCR خارجياً في التفاصيل أدناه.')}</div>
        )}
      </div>

      {/* 2 · analyse */}
      <div className="oj-panel">
        <h3>{L('Analyse the fields, the description and the added documents', 'تحليل الحقول والوصف والمستندات المضافة')}</h3>
        <div className="oj-row">
          <button type="button" className="btn btn-primary oj-primary" disabled={!canUpload || work.busy} onClick={run} title={canUpload ? undefined : L(rev.gates['enforcement.upload'].reason.en, rev.gates['enforcement.upload'].reason.ar)}>{work.busy ? L('Analysing…', 'جارٍ التحليل…') : L('Analyse and link invoices', 'تحليل وربط الفواتير')}</button>
          {SHOW_INTERNAL_NOTES && <span className="muted" style={{ fontSize: 13 }}>{L('Combines the references in the fields, the description, the notes and every document, then matches each one.', 'يجمع المراجع من الحقول والوصف والملاحظات وكل مستند، ثم يطابق كل مرجع.')}</span>}
        </div>
        {work.progress && (
          <div className="oj-progress" role="status" aria-live="polite">
            {work.progress.simulated ? <><span className="rv-tag rv-tag--warn">{B(SIM_LABEL)}</span> {L(`Reading page ${work.progress.page} of ${work.progress.of}…`, `قراءة الصفحة ${work.progress.page} من ${work.progress.of}…`)}</> : L('Reading the document…', 'جارٍ قراءة المستند…')}
            <div className="muted" style={{ fontSize: 12 }} dir="ltr">{work.progress.name}</div>
          </div>
        )}
      </div>
        </div>
      </details>

      {/* 3 · review and confirm */}
      <div className="ed-step" id="review">
        <div className="ed-step__head"><span className="ed-step__n" aria-hidden="true">{digit(3)}</span><h3>{L('Review the matches', 'مراجعة المراجع')}</h3></div>
        {error && <div className="rp-limit rp-limit--warn" role="alert">{L('The data service could not match the references.', 'تعذّر على خدمة البيانات مطابقة المراجع.')} <button type="button" className="btn btn-sm" onClick={onRetry}>{L('Retry', 'إعادة المحاولة')}</button></div>}
        {(step2done || visible.length > 0) && (
          <ul className="oj-summary" aria-label={L('Summary', 'الملخص')}>
            <li className={tone(sum.refs.tone)}>{B(sum.refs)}</li>
            {sum.ext && <li className={tone(sum.ext.tone)}>{B(sum.ext)}</li>}
            {sum.fin && <li className={tone(sum.fin.tone)}>{B(sum.fin)}</li>}
          </ul>
        )}
        {!visible.length && step2done && !loading && <div className="rp-limit rp-limit--warn" role="status"><b>{B(NOT_IDENTIFIED)}.</b> {L('This is not “no related invoices”: nothing in the fields, the description, the notes or the added documents names one.', 'وهذا لا يعني «لا فواتير مرتبطة»: لا شيء في الحقول ولا الوصف ولا الملاحظات ولا المستندات المضافة يذكر فاتورة.')}</div>}

        {done && done.length > 0 && (
          <div className="oj-success" role="status" aria-live="polite">
            <b className="rp-ok">{done.length === 1 ? L('1 invoice was linked to the order.', 'تم ربط فاتورة واحدة بالأمر.') : L(`${done.length} invoices were linked to the order.`, `تم ربط ${done.length} فواتير بالأمر.`)}</b>
            <ul>{done.map((k) => <li key={k.invoiceId}><span dir="ltr">{k.invoiceId}</span> · <span dir="ltr">{sar(k.grossAmount)}</span> · <RecordLink to={invoicePath(k.invoiceId)}>{L('View the invoice', 'عرض الفاتورة')}</RecordLink><LinkEvidence link={(c.links || []).find((l) => l.invoiceId === k.invoiceId)} /></li>)}</ul>
            <div className="muted" style={{ fontSize: 12 }}>{noLinkNote}</div>
          </div>
        )}
        {loading && !visible.length && <div role="status" className="muted">{L('Matching the references…', 'جارٍ مطابقة المراجع…')}</div>}
        {visible.length > 0 && (
          <>
            <div className="rp-tablewrap" tabIndex={0}><table className="oj-table" aria-label={L('Consolidated review', 'المراجعة الموحّدة')}>
              <thead><tr><th>{L('Extracted number · where it was found', 'الرقم المستخرج · موضعه في المستند')}</th><th>{L('Matched invoice', 'الفاتورة المطابقة')}</th><th>{L('Entity', 'الجهة')}</th><th className="num">{L('Invoice amount', 'مبلغ الفاتورة')}</th><th>{L('Invoice status', 'حالة الفاتورة')}</th><th>{L('Matching evidence', 'أدلة المطابقة')}</th><th>{L('Result · flags', 'النتيجة · التنبيهات')}</th><th>{L('Select', 'تحديد')}</th></tr></thead>
              <tbody>{visible.map((row) => {
                const st = rowState(row); const cand = st.candidate; const id = cand?.invoiceId;
                const checked = !!cand && (st.kind === 'confirmed' || selected.some((x) => x.candidate.invoiceId === id));
                const hard = cand ? (row.unresolved[id] || []).filter(isHardConflict) : [];
                const dupes = rows.filter((r) => r.duplicateOf === row.value);
                const flags = rowFlags(row);
                return (
                  <tr key={row.key}>
                    <td><b dir="ltr">{row.value}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{B(KIND_LABEL[row.kind] || { en: row.kind, ar: row.kind })}{row.normalized ? ` → ${row.normalized}` : ''}</div>
                      <Found row={row} L={L} B={B} ar={ar} />
                      {row.origins.some((o) => o.raw && o.raw !== row.value) && <div className="muted" style={{ fontSize: 12 }} dir="ltr">{L('as written', 'كما كُتب')}: «{row.origins.find((o) => o.raw && o.raw !== row.value).raw}»</div>}
                      {dupes.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{L('Also written as', 'مكتوب أيضاً بصيغة')}: <span dir="ltr">{dupes.map((d) => d.value).join(', ')}</span> ({L('same invoice — evidence kept, amount counted once', 'الفاتورة نفسها — الدليل محفوظ والمبلغ مرة واحدة')})</div>}
                      {st.kind === 'confirmed' && <LinkEvidence link={row.link} />}
                      <CorrectionNote corr={c.corrections?.[row.key]} />
                    </td>
                    <td>
                      {cand && <><RecordLink to={invoicePath(id)} dir="ltr"><b>{id}</b></RecordLink> · {B(SOURCE_LABEL[cand.source] || { en: cand.source, ar: cand.source })}
                        {(row.resolved[id] || []).map((r) => <div key={r.conflict} className="rp-ok" style={{ fontSize: 12 }}>✓ {L('conflict resolved by evidence', 'حُسم التعارض بدليل')}</div>)}
                        {(others.get(id) || []).map((o) => <div key={o.enforceNum} className="muted" style={{ fontSize: 12 }}>{L('also on', 'عليها أيضاً')} <RecordLink to={`/enforcement-orders/${o.enforceNum}`} dir="ltr">{o.enforceNum}</RecordLink></div>)}
                      </>}
                      {st.kind === 'ambiguous' && (
                        <div className="oj-cands"><b>{L('Candidates', 'المرشحون')}:</b>
                          {row.candidates.slice(0, 5).map((k) => <div key={k.invoiceId}><RecordLink to={invoicePath(k.invoiceId)} dir="ltr">{k.invoiceId}</RecordLink> · {amanahLabel(k.amanahEn, ar)} · <span dir="auto">{B(k.payerName)}</span> · <span dir="ltr">{sar(k.grossAmount)}</span>{c.debtorIdx != null && k.payerIdx === c.debtorIdx && <> <span className="rv-tag">{L('payer = order debtor (supporting only)', 'الدافع = مدين الأمر (دعم فقط)')}</span></>}</div>)}
                          {row.candidates.length > 5 && <div className="muted">+{row.candidates.length - 5}</div>}
                        </div>
                      )}
                      {!cand && st.kind !== 'ambiguous' && <span className="muted">—</span>}
                    </td>
                    <td>{cand ? <><span>{amanahLabel(cand.amanahEn, ar)}</span>{cand.payerName && <div className="muted" style={{ fontSize: 12 }} dir="auto">{B(cand.payerName)}</div>}</> : <span className="muted">—</span>}</td>
                    <td className="num" dir="ltr">{cand ? <>{sar(cand.grossAmount)}{cand.outstanding != null && Math.abs(cand.outstanding - cand.grossAmount) > 0.5 && <div className="muted" style={{ fontSize: 12 }}>{L('outstanding', 'المتبقي')} {sar(cand.outstanding)}</div>}</> : '—'}</td>
                    <td>{cand ? <><PayStatusChip status={cand.paymentStatus} />
                      {(cand.sourceCancelled || cand.cancelled) && <div><span className="rv-tag rv-tag--bad">{L('cancelled in the source', 'ملغاة في المصدر')}</span></div>}
                      {cand.excluded && !cand.cancelled && !cand.sourceCancelled && ((c.links || []).some((l) => l.invoiceId === cand.invoiceId && l.status === 'confirmed') ? <div><span className="rv-tag rv-tag--ok">{L('Excluded: linked to a confirmed enforcement order', 'مستبعدة: مرتبطة بأمر تنفيذ مؤكد')}</span></div> : <div><span className="rv-tag">{L('already excluded (another order or reason)', 'مستبعدة أصلاً (بأمر آخر أو لسبب آخر)')}</span></div>)}
                      {cand.enfConflict && <div><span className="rv-tag rv-tag--bad">{L('source / enforcement conflict', 'تعارض المصدر والتنفيذ')}</span></div>}</> : <span className="muted">—</span>}</td>
                    <td>{row.criteria && cand ? (
                      <ul className="oj-crit" aria-label={L('Matching criteria', 'معايير المطابقة')}>
                        {[[L('Invoice number', 'رقم الفاتورة'), row.criteria.invoiceNo], [L('Amanah', 'الأمانة'), row.criteria.amanah], [L('Amount', 'المبلغ'), row.criteria.amount]].map(([lbl, ok]) => <li key={lbl} className={ok === true ? 'rp-ok' : ok === false ? 'rp-bad' : 'muted'}><span aria-hidden="true">{ok === true ? '✓' : ok === false ? '✗' : '—'}</span> {lbl}</li>)}
                        {row.confidence && <li className="oj-conf" style={{ marginBlockStart: 4 }}><b>{L('Confidence', 'درجة التيقن')}:</b> <span dir="ltr">{row.confidence.score}%</span> — {B(CONFIDENCE_LABEL[row.confidence.level])}</li>}
                      </ul>) : <span className="muted">—</span>}</td>
                    <td>{resultChip(st, row)}
                      {flags.length > 0 && <div className="oj-flags" aria-label={L('Flags', 'التنبيهات')}>{flags.map((f) => <div key={f.key}><span className={`rv-tag ${FLAG_CLS[f.tone]}`}>{B(f)}</span></div>)}</div>}
                      {flags.some((f) => f.key === 'amount_difference') && <div className="muted" style={{ fontSize: 12 }}>{L('Order amount', 'مبلغ الأمر')} <span dir="ltr">{sar(c.amount)}</span> · {L('matched invoices', 'الفواتير المطابقة')} <span dir="ltr">{sar(orderTotal)}</span></div>}
                      {st.kind === 'ambiguous' && <div className="rp-limit rp-limit--warn" style={{ margin: '4px 0' }}>{B(RESOLVE_HINT.ambiguous_reference)}
                        {canReview && <div className="oj-row" style={{ marginBlockStart: 4 }}><input className="input" dir="ltr" style={{ width: 200 }} aria-label={L('Full invoice number', 'رقم الفاتورة الكامل')} placeholder="177-2200000054" value={fix[row.key] || ''} onChange={(e) => setFix((m) => ({ ...m, [row.key]: e.target.value }))} />
                          <button type="button" className="btn btn-sm" disabled={!(fix[row.key] || '').trim()} onClick={() => { if (work.addManual(fix[row.key])) { setFix((m) => ({ ...m, [row.key]: '' })); setTick((x) => x + 1); } }}>{L('Add as evidence', 'إضافة كدليل')}</button></div>}
                      </div>}
                      {st.kind === 'needs_evidence' && <div className="rp-limit rp-limit--warn" style={{ margin: '4px 0' }}>{hard.map((x) => <div key={x}>{B(RESOLVE_HINT[x] || { en: '', ar: '' })}</div>)}</div>}
                      {st.kind === 'corrupted' && <div className="rp-limit rp-limit--warn" style={{ margin: '4px 0' }}>{L('A spreadsheet turned this number into scientific notation, so its digits are lost: it is never matched, padded or repaired. Look for the full number in the description or a document, or ask the source for the original value.', 'حوّل جدول بيانات هذا الرقم إلى صيغة علمية فضاعت أرقامه: فلا يُطابق ولا يُكمَّل ولا يُصحَّح. ابحث عن الرقم الكامل في الوصف أو مستند، أو اطلب القيمة الأصلية من المصدر.')}</div>}
                      {st.kind === 'unmatched' && <div className="muted" style={{ fontSize: 12 }}>{L('Possibly a typing or OCR error — never replaced by a “similar” invoice.', 'ربما خطأ طباعة أو OCR — ولا يُستبدل بفاتورة «مشابهة».')}</div>}
                      {st.kind === 'weak' && <div className="muted" style={{ fontSize: 12 }}>{L('Incomplete number that matches one invoice — not preselected.', 'رقم ناقص يطابق فاتورة واحدة — غير محدد مسبقاً.')}</div>}
                      {canReview && (st.kind === 'ready' || st.kind === 'weak' || st.kind === 'needs_evidence') && !row.link && <div><button type="button" className="rv-link" onClick={() => { rev.enforcement.reject(c.enforceNum, id, { note: why[id] || '', input: inputFor(row, cand) }); }}>{L('Not an invoice of this order', 'ليست من فواتير هذا الأمر')}</button></div>}
                      {canReview && (st.kind === 'unmatched' || st.kind === 'corrupted' || st.kind === 'ambiguous') && !(c.dismissedRefs || []).includes(row.key) && <div className="oj-row" style={{ gap: 10 }}><button type="button" className="rv-link" onClick={() => { setFixing(fixing === row.key ? null : row.key); setFixForm({ to: '', reason: '' }); }}>{L('Correct the number…', 'تصحيح الرقم…')}</button>
                        {st.kind !== 'ambiguous' && <button type="button" className="rv-link" onClick={() => rev.enforcement.dismiss(c.enforceNum, row.key, {})}>{L('Set aside', 'استبعاد')}</button>}</div>}
                      {fixing === row.key && (() => {
                        const options = visible.filter((r2) => r2.key !== row.key && !(c.dismissedRefs || []).includes(r2.key) && rowState(r2).candidate && rowState(r2).kind !== 'duplicate');
                        const chosen = options.find((r2) => r2.value === fixForm.to);
                        const submitFix = () => {
                          if (!fixForm.to.trim() || !fixForm.reason.trim()) { onMessage({ ok: false, text: L('Choose or type the corrected number and give the reason.', 'اختر الرقم المصحَّح أو اكتبه واذكر السبب.') }); return; }
                          const typed = !chosen;
                          if (typed) { const ex = manualReferencesFrom(fixForm.to, { origin: 'manual_entry', reason: fixForm.reason, orderNo: c.enforceNum }); if (!ex.refs.length || !rev.enforcement.addManual(c.enforceNum, ex).ok) { onMessage({ ok: false, text: L('The corrected number was not recognised as an invoice number.', 'لم يُتعرَّف على الرقم المصحَّح كرقم فاتورة.') }); return; } }
                          const origin = typed ? 'manual_entry' : (originKinds(chosen).includes('manual_search') ? 'manual_search' : originKinds(chosen).includes('manual_entry') ? 'manual_entry' : 'document_ocr_simulated');
                          const r = rev.enforcement.dismiss(c.enforceNum, row.key, { correctedTo: chosen ? chosen.value : fixForm.to.trim(), origin, reason: fixForm.reason });
                          onMessage(r.ok ? { ok: true, text: L('Correction recorded. The original number is kept; the corrected one goes through the same checks.', 'سُجّل التصحيح. يبقى الرقم الأصلي كما هو، ويمر الرقم المصحَّح بالفحوص نفسها.') } : { ok: false, text: L('Could not record the correction.', 'تعذّر تسجيل التصحيح.') });
                          setFixing(null); setTick((x) => x + 1);
                        };
                        return (
                          <div className="wf-fix" role="group" aria-label={L('Correct the number', 'تصحيح الرقم')}>
                            <label style={{ display: 'grid', gap: 3, fontSize: 12 }}>{L('Replace it with a number found elsewhere in this order', 'استبدله برقم وُجد في هذا الأمر')}
                              <select className="input" value={options.some((r2) => r2.value === fixForm.to) ? fixForm.to : ''} onChange={(e) => setFixForm((f) => ({ ...f, to: e.target.value }))}>
                                <option value="">{L('— choose —', '— اختر —')}</option>{options.map((r2) => <option key={r2.key} value={r2.value}>{r2.value}</option>)}</select></label>
                            <label style={{ display: 'grid', gap: 3, fontSize: 12 }}>{L('…or type the corrected number', '…أو اكتب الرقم المصحَّح')}
                              <input className="input" dir="ltr" value={chosen ? '' : fixForm.to} onChange={(e) => setFixForm((f) => ({ ...f, to: e.target.value }))} placeholder="177-407940123186" /></label>
                            <label style={{ display: 'grid', gap: 3, fontSize: 12 }}>{L('Reason (required)', 'السبب (مطلوب)')}
                              <textarea className="input" rows={2} value={fixForm.reason} onChange={(e) => setFixForm((f) => ({ ...f, reason: e.target.value }))} aria-required="true" /></label>
                            <div className="oj-row"><button type="button" className="btn btn-sm btn-primary" onClick={submitFix}>{L('Record the correction', 'تسجيل التصحيح')}</button><button type="button" className="btn btn-sm" onClick={() => setFixing(null)}>{L('Cancel', 'إلغاء')}</button></div>
                          </div>);
                      })()}
                      {(st.kind === 'unmatched' || st.kind === 'corrupted') && (c.dismissedRefs || []).includes(row.key) && <span className="rv-tag">{L('set aside', 'مستبعد')}</span>}
                    </td>
                    <td>{cand && st.kind !== 'ambiguous' ? <label className="ed-hit"><input type="checkbox" className="oj-check" checked={checked} disabled={!st.selectable || !canReview} aria-label={`${L('Select', 'تحديد')} ${id}`} onChange={(e) => toggle(id, e.target.checked)} /></label> : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
            <div className="oj-total" role="group" aria-label={L('Selected total', 'إجمالي المحدد')}>
              <span>{L('Selected now', 'المحدد الآن')}: <b>{selected.length}</b> {L('invoice(s)', 'فاتورة')} · <b dir="ltr">{sar(totals.selectedTotal)}</b></span>
              <span>{L('Already linked', 'المربوط سابقاً')}: <b>{totals.confirmedCount}</b> · <b dir="ltr">{totals.confirmedTotal == null ? '—' : sar(totals.confirmedTotal)}</b></span>
              <span>{L('Order amount', 'مبلغ الأمر')}: <b dir="ltr">{sar(totals.orderAmount)}</b></span>
              <span className={totals.difference != null && Math.abs(totals.difference) > 1 ? 'rp-warn' : 'rp-ok'}>{L('Difference', 'الفرق')}: <b dir="ltr">{totals.difference == null ? '—' : sar(totals.difference)}</b></span>
            </div>
            {SHOW_INTERNAL_NOTES && <div className="rp-limit">{L('Amount basis: the invoice gross (before exclusions and payments), each invoice counted once. A difference does not prevent confirming valid links, and equal amounts would not prove every invoice was identified.', 'أساس المبلغ: إجمالي الفاتورة (قبل الاستبعاد والمدفوعات)، وكل فاتورة تُحتسب مرة. والفرق لا يمنع تأكيد الروابط الصحيحة، وتساوي المبلغ لا يثبت أن كل الفواتير حُددت.')} {noLinkNote}</div>}
            </>
        )}
      </div>
      <div className="ed-step ed-confirm" id="confirm">
        <div className="ed-step__head"><span className="ed-step__n" aria-hidden="true">{digit(4)}</span><h3>{L('Confirmation', 'التأكيد')}</h3>
          {confirmedN > 0 && pendingRows.length > 0 && <span className="rv-tag rv-tag--warn">{L('Partial confirmation', 'تأكيد جزئي')}</span>}
          {confirmedN > 0 && pendingRows.length === 0 && !(totals.difference != null && Math.abs(totals.difference) > 1) && <span className="rv-tag rv-tag--ok">{L('All references decided', 'كل المراجع محسومة')}</span>}
          {confirmedN > 0 && pendingRows.length === 0 && totals.difference != null && Math.abs(totals.difference) > 1 && <span className="rv-tag rv-tag--warn">{L(`Confirmed total differs from the order amount by ${sar(Math.abs(totals.difference))}`, `المؤكد يختلف عن مبلغ الأمر بمقدار ${sar(Math.abs(totals.difference))}`)}</span>}</div>
        {visible.length === 0 && <div className="muted" style={{ fontSize: 13 }}>{L('Nothing to confirm yet: the matches appear above once references are read.', 'لا شيء للتأكيد بعد: تظهر المطابقات أعلاه عند قراءة المراجع.')}</div>}
        {visible.length > 0 && (
          <>
            <ConfirmSummary summary={summary} rows={rows} pendingN={pendingRows.length} confirmedN={confirmedN} ack={ack} setAck={setAck} />
            <div className="oj-pending" role="status" aria-live="polite">
              <span>{L(`Selected to confirm: ${selected.length}`, `المحدد للتأكيد: ${selected.length}`)}</span> · <span className={pendingRows.length ? 'rp-warn' : 'rp-ok'}>{L(`Pending (not confirmed by this action): ${pendingRows.length}`, `بانتظار القرار (لن يشملها هذا التأكيد): ${pendingRows.length}`)}</span>
              {pendingRows.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{L('Only the invoices you select are confirmed. Unresolved references (unmatched, ambiguous, incomplete or conflicting) stay pending until you decide on them.', 'يُؤكَّد فقط ما تحدده من الفواتير. المراجع غير المحسومة (غير مطابقة أو ملتبسة أو ناقصة أو متعارضة) تبقى معلّقة حتى تقرر بشأنها.')}</div>}
            </div>
            <div className="oj-effect">{effectNote}</div>
            <div className="oj-row">
              <button type="button" className="btn btn-primary oj-primary" disabled={!canReview || !can.ok} onClick={confirmSelected}>{L('Confirm the selected invoices’ link to the enforcement order', 'تأكيد ربط الفواتير المحددة بأمر التنفيذ')}</button>
              {!canReview && <span className="muted" data-testid="confirm-denied">{L(`Your role can look but not confirm links. ${rev.gates['enforcement.review'].reason?.en || ''}`, `دورك يتيح الاطلاع دون تأكيد الروابط. ${rev.gates['enforcement.review'].reason?.ar || ''}`)}</span>}
              {canReview && !can.ok && selected.length > 0 && <span className="rp-warn" style={{ fontSize: 13 }}>{can.why === 'ack_required' ? L('Acknowledge the difference and give a reason to enable the button.', 'أقرّ بالفرق واذكر السبب لتفعيل الزر.') : ''}</span>}
            </div>
          </>
        )}
        <OutcomePanel links={c.links || []} />
      </div>
    </div>
  );
}
