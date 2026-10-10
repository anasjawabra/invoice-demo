import React, { useMemo, useRef, useState } from 'react';
import { useL } from '../../utils/bi';
import { RecordLink } from '../../utils/returnContext';
import { invoicePath } from '../../utils/paths';
import { PayStatusChip, Chip, CONFLICT_LABEL, KIND_LABEL, SOURCE_LABEL, RESOLVE_HINT } from './EnforcementUI';
import { ORIGIN_LABEL, isHardConflict } from '../../data/orderMatching';
import { rowState, selectionFor, totalsFor, summaryLines, NOT_IDENTIFIED } from '../../data/orderSummary';
import { samplesForOrder, SIM_LABEL } from '../../data/ocrSimulation';
import { FORMAT_LABEL, UNREAD_REASON } from '../../data/docText';
import { locLabel } from '../../data/docxText';
import { METHOD_NOTE } from './OrderDocuments';
import { useOrderWork } from './useOrderWork';

// The order's journey in three plain steps — 1 add the document · 2 analyse it · 3 review and confirm the links — with ONE primary action and ONE consolidated review table.
// References from the structured field, the description, the notes and every document are combined automatically; nothing asks for a separate confirmation per source.
export default function OrderJourney({ c, rev, rows, loading, error, onRetry, comp, inputFor, others, onMessage, setTick, setFocus }) {
  const { L, B, ar, sar } = useL();
  const work = useOrderWork({ order: c, rev, onMessage, L, B });
  const fileRef = useRef(null);
  const [ran, setRan] = useState(false); const [manual, setManual] = useState(''); const [ov, setOv] = useState({}); const [done, setDone] = useState(null); const [fix, setFix] = useState({}); const [why, setWhy] = useState({});
  const docs = c.docs || []; const canReview = rev.canReview;
  const pending = docs.filter((d) => !d.extraction && d.kind !== 'manual');
  const ownSamples = samplesForOrder(work.samples, c.enforceNum);
  const visible = useMemo(() => rows.filter((r) => rowState(r).kind !== 'duplicate'), [rows]); // a reference that is the same invoice as another row is merged into that row (its evidence is kept)
  const selected = useMemo(() => selectionFor(rows, ov), [rows, ov]);
  const totals = totalsFor(c, comp.reconciliation, selected);
  const sum = summaryLines(comp, rows);
  const analysed = docs.length > 0 && pending.length === 0;
  const step2done = ran || (analysed && docs.length > 0) || visible.length > 0;
  const now = !docs.length && !visible.length ? 1 : pending.length || !step2done ? 2 : 3;
  const stateOf = (k) => (k < now ? 'done' : k === now ? 'now' : 'todo');
  const nothingRead = (ex) => ex.pages.length > 0 && ex.pages.every((p) => p.needsOcr);
  const badDocs = docs.filter((d) => d.extraction && nothingRead(d.extraction) && !(d.ocrCovered || []).length);

  const run = async () => {
    onMessage(null); const out = await work.analyze();
    if (out) { setRan(true); setTick((x) => x + 1); if (out.missing) onMessage({ ok: false, text: L(`${out.missing} document(s) have no original file in this browser and could not be analysed: restore the file first.`, `${out.missing} مستند بلا ملف أصلي في هذا المتصفح فلم يُحلَّل: استعد الملف أولاً.`) }); }
  };
  const confirmSelected = () => {
    const ok = []; let fails = 0;
    for (const { row, candidate } of selected) { const r = rev.enforcement.confirm(c.enforceNum, candidate.invoiceId, { note: why[candidate.invoiceId] || '', input: inputFor(row, candidate) }); if (r.ok) ok.push(candidate); else fails += 1; }
    setOv({}); setDone(ok);
    onMessage(fails ? { ok: false, text: L(`${fails} link(s) could not be recorded.`, `تعذّر تسجيل ${fails} رابط.`) } : null);
  };
  const toggle = (id, on) => setOv((m) => ({ ...m, [id]: on }));
  const noLinkNote = L('Confirming creates links only. It does not approve legal action, mark an invoice paid, or change its confirmed financial treatment.', 'التأكيد ينشئ روابط فقط. ولا يعتمد إجراءً قانونياً ولا يجعل الفاتورة مسدّدة ولا يغيّر معالجتها المالية المؤكدة.');
  const tone = (t) => (t === 'warn' ? 'rp-warn' : 'rp-ok');

  const resultChip = (st, row) => {
    const n = row.candidates.length;
    if (st.kind === 'confirmed') return <Chip def={{ en: 'Linked', ar: 'مربوط', cls: 'rv-cat--enforcement' }} />;
    if (st.kind === 'ready') return <Chip def={{ en: 'Exact match', ar: 'مطابقة تامة', cls: 'rv-cat--collected' }} />;
    if (st.kind === 'weak') return <Chip def={{ en: 'Match on an incomplete number', ar: 'مطابقة برقم ناقص', cls: 'rv-cat--partial' }} />;
    if (st.kind === 'rejected') return <Chip def={{ en: 'Rejected before', ar: 'رُفض سابقاً', cls: 'rv-cat--excluded' }} />;
    if (st.kind === 'needs_evidence') return <Chip def={{ en: 'Conflict — evidence needed', ar: 'تعارض — يلزم دليل', cls: 'rv-cat--overdue' }} />;
    if (st.kind === 'ambiguous') return <Chip def={{ en: `Ambiguous — ${n} invoices`, ar: `ملتبس — ${n} فواتير`, cls: 'rv-cat--partial' }} />;
    return <Chip def={{ en: 'Not found in the system', ar: 'غير موجود في النظام', cls: 'rv-cat--overdue' }} />;
  };

  return (
    <section className="rp-section oj" aria-label={L('Link the order’s invoices', 'ربط فواتير الأمر')} id="journey">
      <ol className="oj-steps" aria-label={L('Steps', 'الخطوات')}>
        {[[1, L('Add the document', 'إضافة المستند')], [2, L('Analyse the document', 'تحليل المستند')], [3, L('Review and confirm the links', 'مراجعة وتأكيد الربط')]].map(([k, t]) => (
          <li key={k} className={`oj-step oj-step--${stateOf(k)}`} aria-current={stateOf(k) === 'now' ? 'step' : undefined}><span className="oj-step__n" aria-hidden="true">{stateOf(k) === 'done' ? '✓' : k}</span>{k}. {t}</li>
        ))}
      </ol>

      {/* 1 · add */}
      <div className="oj-panel" style={{ marginBlockStart: 14 }}>
        <h3>{L('1 · Add the document', '1 · إضافة المستند')}</h3>
        <div className="oj-row">
          <label style={{ display: 'grid', gap: 3, fontSize: 13 }}>{L('Upload a file (PDF or Word .docx)', 'رفع ملف (PDF أو Word .docx)')}
            <input ref={fileRef} className="input" type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.tif,.tiff,application/pdf" disabled={!canReview || work.busy} onChange={async (e) => { const f = e.target.files?.[0]; await work.addFile(f); if (fileRef.current) fileRef.current.value = ''; setTick((x) => x + 1); }} />
          </label>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBlockEnd: 4 }}>{L('Or choose a prepared demo sample for this order', 'أو اختر عينة معدّة لهذا الأمر')} <span className="rv-tag rv-tag--warn">{B(SIM_LABEL)}</span></div>
          {ownSamples.length ? (
            <div className="oj-samples">{ownSamples.map((s) => { const added = docs.some((d) => d.sampleId === s.id); return (
              <button key={s.id} type="button" className="oj-sample" disabled={!canReview || work.busy || added} onClick={async () => { await work.addSample(s); setTick((x) => x + 1); }}>
                <b>{B(s.title)}</b><small>{B(s.what)}</small><small>{added ? L('Already added', 'أُضيفت بالفعل') : L('Scanned document — read by a labelled simulation, not real OCR', 'مستند ممسوح — يُقرأ بمحاكاة معلّمة وليس OCR حقيقياً')}</small>
              </button>); })}</div>
          ) : <div className="muted" style={{ fontSize: 13 }}>{L('No prepared sample exists for this order. Upload a file or type the references.', 'لا توجد عينة معدّة لهذا الأمر. ارفع ملفاً أو أدخل المراجع يدوياً.')}</div>}
        </div>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{L('Type invoice numbers by hand', 'إدخال أرقام الفواتير يدوياً')}</summary>
          <div className="oj-row" style={{ marginBlockStart: 6 }}>
            <label style={{ flex: '1 1 260px', display: 'grid', gap: 3, fontSize: 13 }}>{L('One number per line (a full number such as INV-2025-0000123, or a serial of 4–7 digits)', 'رقم في كل سطر (رقم كامل مثل INV-2025-0000123 أو تسلسل من 4–7 أرقام)')}
              <textarea className="input" dir="ltr" style={{ height: 70, paddingBlock: 8 }} value={manual} onChange={(e) => setManual(e.target.value)} placeholder="INV-2025-0000123" disabled={!canReview} /></label>
            <button type="button" className="btn btn-sm" disabled={!canReview || !manual.trim()} onClick={() => { if (work.addManual(manual)) { setManual(''); setTick((x) => x + 1); } }}>{L('Add the numbers', 'إضافة الأرقام')}</button>
          </div>
          <div className="rp-limit">{L('Recorded as «typed by a person» — kept apart from any extraction.', 'تُسجَّل «أدخلها شخص» — منفصلة عن أي استخراج.')}</div>
        </details>
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
      <div className="oj-panel" style={{ marginBlockStart: 18 }}>
        <h3>{L('2 · Analyse the document', '2 · تحليل المستند')}</h3>
        <div className="oj-row">
          <button type="button" className="btn btn-primary oj-primary" disabled={!canReview || work.busy} onClick={run}>{work.busy ? L('Analysing…', 'جارٍ التحليل…') : L('Analyse and link invoices', 'تحليل وربط الفواتير')}</button>
          <span className="muted" style={{ fontSize: 13 }}>{L('Combines the references in the fields, the description, the notes and every document, then matches each one.', 'يجمع المراجع من الحقول والوصف والملاحظات وكل مستند، ثم يطابق كل مرجع.')}</span>
        </div>
        {work.progress && (
          <div className="oj-progress" role="status" aria-live="polite">
            {work.progress.simulated ? <><span className="rv-tag rv-tag--warn">{B(SIM_LABEL)}</span> {L(`Reading page ${work.progress.page} of ${work.progress.of}…`, `قراءة الصفحة ${work.progress.page} من ${work.progress.of}…`)}</> : L('Reading the document…', 'جارٍ قراءة المستند…')}
            <div className="muted" style={{ fontSize: 12 }} dir="ltr">{work.progress.name}</div>
          </div>
        )}
        {error && <div className="rp-limit rp-limit--warn" role="alert">{L('The data service could not match the references.', 'تعذّر على خدمة البيانات مطابقة المراجع.')} <button type="button" className="btn btn-sm" onClick={onRetry}>{L('Retry', 'إعادة المحاولة')}</button></div>}
        {(step2done || visible.length > 0) && (
          <ul className="oj-summary" aria-label={L('Summary', 'الملخص')}>
            <li className={tone(sum.refs.tone)}>{B(sum.refs)}</li>
            {sum.ext && <li className={tone(sum.ext.tone)}>{B(sum.ext)}</li>}
            {sum.fin && <li className={tone(sum.fin.tone)}>{B(sum.fin)}</li>}
          </ul>
        )}
        {!visible.length && step2done && !loading && <div className="rp-limit rp-limit--warn" role="status"><b>{B(NOT_IDENTIFIED)}.</b> {L('This is not “no related invoices”: nothing in the fields, the description, the notes or the added documents names one.', 'وهذا لا يعني «لا فواتير مرتبطة»: لا شيء في الحقول ولا الوصف ولا الملاحظات ولا المستندات المضافة يذكر فاتورة.')}</div>}
      </div>

      {/* 3 · review and confirm */}
      <div className="oj-panel" style={{ marginBlockStart: 18 }}>
        <h3>{L('3 · Review and confirm the links', '3 · مراجعة وتأكيد الربط')}</h3>
        {done && done.length > 0 && (
          <div className="oj-success" role="status" aria-live="polite">
            <b className="rp-ok">{done.length === 1 ? L('1 invoice was linked to the order.', 'تم ربط فاتورة واحدة بالأمر.') : L(`${done.length} invoices were linked to the order.`, `تم ربط ${done.length} فواتير بالأمر.`)}</b>
            <ul>{done.map((k) => <li key={k.invoiceId}><span dir="ltr">{k.invoiceId}</span> · <span dir="ltr">{sar(k.grossAmount)}</span> · <RecordLink to={invoicePath(k.invoiceId)}>{L('View the invoice', 'عرض الفاتورة')}</RecordLink></li>)}</ul>
            <div className="muted" style={{ fontSize: 12 }}>{noLinkNote}</div>
          </div>
        )}
        {loading && !visible.length && <div role="status" className="muted">{L('Matching the references…', 'جارٍ مطابقة المراجع…')}</div>}
        {visible.length > 0 && (
          <>
            <div className="rp-tablewrap" tabIndex={0}><table className="oj-table" aria-label={L('Consolidated review', 'المراجعة الموحّدة')}>
              <thead><tr><th>{L('Extracted reference', 'المرجع المستخرج')}</th><th>{L('Matched invoice', 'الفاتورة المطابقة')}</th><th className="num">{L('Invoice amount', 'مبلغ الفاتورة')}</th><th>{L('Match result', 'نتيجة المطابقة')}</th><th>{L('Select', 'تحديد')}</th></tr></thead>
              <tbody>{visible.map((row) => {
                const st = rowState(row); const cand = st.candidate; const id = cand?.invoiceId;
                const checked = !!cand && (st.kind === 'confirmed' || selected.some((x) => x.candidate.invoiceId === id));
                const hard = cand ? (row.unresolved[id] || []).filter(isHardConflict) : [];
                const dupes = rows.filter((r) => r.duplicateOf === row.value);
                return (
                  <tr key={row.key}>
                    <td><b dir="ltr">{row.value}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{B(KIND_LABEL[row.kind] || { en: row.kind, ar: row.kind })}{row.normalized ? ` → ${row.normalized}` : ''}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{row.origins.map((o, i) => <span key={i}>{i ? ' · ' : ''}{B(ORIGIN_LABEL[o.type] || { en: o.type, ar: o.type })}{o.pages?.length ? ` ${L('p.', 'ص')} ${o.pages.join(',')}` : ''}{o.locs?.length ? ` (${o.locs.map((x) => locLabel(x, ar)).join('، ')})` : ''}</span>)}</div>
                      {row.origins.some((o) => o.raw && o.raw !== row.value) && <div className="muted" style={{ fontSize: 12 }} dir="ltr">{L('as written', 'كما كُتب')}: «{row.origins.find((o) => o.raw && o.raw !== row.value).raw}»</div>}
                      {dupes.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{L('Also written as', 'مكتوب أيضاً بصيغة')}: <span dir="ltr">{dupes.map((d) => d.value).join(', ')}</span> ({L('same invoice — evidence kept, amount counted once', 'الفاتورة نفسها — الدليل محفوظ والمبلغ مرة واحدة')})</div>}
                    </td>
                    <td>
                      {cand && <><RecordLink to={invoicePath(id)} dir="ltr"><b>{id}</b></RecordLink> · {B(SOURCE_LABEL[cand.source] || { en: cand.source, ar: cand.source })}
                        <div className="muted" style={{ fontSize: 12 }} dir="auto">{B(cand.payerName)} · <PayStatusChip status={cand.paymentStatus} /></div>
                        {(row.conflicts[id] || []).map((x) => <span key={x} className={`rv-tag ${hard.includes(x) ? 'rv-tag--bad' : 'rv-tag--warn'}`}>{B(CONFLICT_LABEL[x] || { en: x, ar: x })}</span>)}
                        {(row.resolved[id] || []).map((r) => <div key={r.conflict} className="rp-ok" style={{ fontSize: 12 }}>✓ {L('conflict resolved by evidence', 'حُسم التعارض بدليل')}</div>)}
                        {(others.get(id) || []).map((o) => <div key={o.enforceNum} className="muted" style={{ fontSize: 12 }}>{L('also on', 'عليها أيضاً')} <RecordLink to={`/enforcement-orders/${o.enforceNum}`} dir="ltr">{o.enforceNum}</RecordLink></div>)}
                      </>}
                      {st.kind === 'ambiguous' && (
                        <div className="oj-cands"><b>{L('Candidates', 'المرشحون')}:</b>
                          {row.candidates.slice(0, 5).map((k) => <div key={k.invoiceId}><RecordLink to={invoicePath(k.invoiceId)} dir="ltr">{k.invoiceId}</RecordLink> · <span dir="auto">{B(k.payerName)}</span> · <span dir="ltr">{sar(k.grossAmount)}</span>{c.debtorIdx != null && k.payerIdx === c.debtorIdx && <> <span className="rv-tag">{L('payer = order debtor (supporting only)', 'الدافع = مدين الأمر (قرينة داعمة فقط)')}</span></>}</div>)}
                          {row.candidates.length > 5 && <div className="muted">+{row.candidates.length - 5}</div>}
                        </div>
                      )}
                      {!cand && st.kind !== 'ambiguous' && <span className="muted">—</span>}
                    </td>
                    <td className="num" dir="ltr">{cand ? sar(cand.grossAmount) : '—'}</td>
                    <td>{resultChip(st, row)}
                      {st.kind === 'ambiguous' && <div className="rp-limit rp-limit--warn" style={{ margin: '4px 0' }}>{B(RESOLVE_HINT.ambiguous_reference)}
                        {canReview && <div className="oj-row" style={{ marginBlockStart: 4 }}><input className="input" dir="ltr" style={{ width: 200 }} aria-label={L('Full invoice number', 'رقم الفاتورة الكامل')} placeholder="INV-2025-0000054" value={fix[row.key] || ''} onChange={(e) => setFix((m) => ({ ...m, [row.key]: e.target.value }))} />
                          <button type="button" className="btn btn-sm" disabled={!(fix[row.key] || '').trim()} onClick={() => { if (work.addManual(fix[row.key])) { setFix((m) => ({ ...m, [row.key]: '' })); setTick((x) => x + 1); } }}>{L('Add as evidence', 'إضافة كدليل')}</button></div>}
                      </div>}
                      {st.kind === 'needs_evidence' && <div className="rp-limit rp-limit--warn" style={{ margin: '4px 0' }}>{hard.map((x) => <div key={x}>{B(RESOLVE_HINT[x] || { en: '', ar: '' })}</div>)}</div>}
                      {st.kind === 'unmatched' && <div className="muted" style={{ fontSize: 12 }}>{L('Possibly a typing or OCR error — never replaced by a “similar” invoice.', 'ربما خطأ طباعة أو OCR — ولا يُستبدل بفاتورة «مشابهة».')}</div>}
                      {st.kind === 'weak' && <div className="muted" style={{ fontSize: 12 }}>{L('Incomplete number that matches one invoice — not preselected.', 'رقم ناقص يطابق فاتورة واحدة — غير محدد مسبقاً.')}</div>}
                      {canReview && (st.kind === 'ready' || st.kind === 'weak' || st.kind === 'needs_evidence') && !row.link && <div><button type="button" className="rv-link" onClick={() => { rev.enforcement.reject(c.enforceNum, id, { note: why[id] || '', input: inputFor(row, cand) }); }}>{L('Not an invoice of this order', 'ليست من فواتير هذا الأمر')}</button></div>}
                      {canReview && st.kind === 'unmatched' && !(c.dismissedRefs || []).includes(row.key) && <div><button type="button" className="rv-link" onClick={() => rev.enforcement.dismiss(c.enforceNum, row.key, {})}>{L('Set aside', 'استبعاد')}</button></div>}
                      {st.kind === 'unmatched' && (c.dismissedRefs || []).includes(row.key) && <span className="rv-tag">{L('set aside', 'مستبعد')}</span>}
                    </td>
                    <td>{cand && st.kind !== 'ambiguous' ? <input type="checkbox" className="oj-check" checked={checked} disabled={!st.selectable || !canReview} aria-label={`${L('Select', 'تحديد')} ${id}`} onChange={(e) => toggle(id, e.target.checked)} /> : <span className="muted">—</span>}</td>
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
            <div className="rp-limit">{L('Amount basis: the invoice gross (before exclusions and payments), each invoice counted once. A difference does not prevent confirming valid links, and equal amounts would not prove every invoice was identified.', 'أساس المبلغ: إجمالي الفاتورة (قبل الاستبعاد والمدفوعات)، وكل فاتورة تُحتسب مرة. والفرق لا يمنع تأكيد الروابط الصحيحة، وتساوي المبلغ لا يثبت أن كل الفواتير حُددت.')} {noLinkNote}</div>
            <div className="oj-row">
              <button type="button" className="btn btn-primary oj-primary" disabled={!canReview || !selected.length} onClick={confirmSelected}>{L('Confirm the selected invoice links', 'تأكيد ربط الفواتير المحددة')}{selected.length ? ` (${selected.length})` : ''}</button>
              {!canReview && <span className="muted">{L('Read-only role: you can review but not confirm.', 'دور للقراءة فقط: يمكنك المراجعة دون التأكيد.')}</span>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
