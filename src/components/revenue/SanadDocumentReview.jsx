import React, { useMemo, useState } from 'react';
import { useL } from '../../utils/bi';
import { shownActor } from '../../utils/actor';
import { fmtRiyadh } from '../../data/clock';
import SanadDocumentPreview from './SanadDocumentPreview';
import { reviewRows } from '../../data/sanadDocs/service';
import { sanadExtraction } from '../../data/sanadDocs/orderFeed';
import { KIND_LABEL } from './EnforcementUI';
import { displayValue } from '../../data/sanadDocs/compare';
import { SIM_LABEL, MISSING_IN_DOC, FIELD_STATUS_LABEL, ORIGIN_LABEL, REVIEW_ERROR } from '../../data/sanadDocs/labels';
import '../../styles/sanad-docs.css';

const ACTION_TEXT = { confirm: { ar: 'اعتماد', en: 'Confirmed' }, correct: { ar: 'تصحيح', en: 'Corrected' }, reject: { ar: 'رفض', en: 'Rejected' } };

// transcript text with the found passages highlighted: `marks` = [{ text, active }] (the active one stronger)
function Transcript({ text, marks }) {
  const parts = useMemo(() => {
    const lvl = new Array(text.length).fill(0);
    for (const m of marks) { const i = text.indexOf(m.text); if (i < 0) continue; for (let k = i; k < i + m.text.length; k += 1) lvl[k] = Math.max(lvl[k], m.active ? 2 : 1); }
    const out = []; let start = 0;
    for (let k = 1; k <= text.length; k += 1) if (k === text.length || lvl[k] !== lvl[start]) { out.push({ t: text.slice(start, k), level: lvl[start] }); start = k; }
    return out;
  }, [text, marks]);
  return <pre dir="rtl" tabIndex={0}>{parts.map((p, i) => (p.level ? <mark key={i} className={`sd-mark${p.level === 2 ? ' sd-mark--active' : ''}`}>{p.t}</mark> : <span key={i}>{p.t}</span>))}</pre>;
}

// Side-by-side review: the document (preview + its transcript with highlights) next to the extracted fields AND the structured Sanad value of each, with the origin of every value.
export default function SanadDocumentReview({ order, doc, extraction, reviews, canReview, onReview }) {
  const { L, B } = useL();
  const rows = useMemo(() => reviewRows(extraction, reviews, order), [extraction, reviews, order]);
  const [page, setPage] = useState(1); const [active, setActive] = useState(null);
  const total = extraction.pages.length || 1; const cur = extraction.pages.find((p) => p.page === page) || extraction.pages[0];
  const refs = useMemo(() => sanadExtraction(doc, extraction.pages, order.enforceNum).refs, [doc, extraction.pages, order.enforceNum]);
  const [activeRef, setActiveRef] = useState(null);
  const curPage = cur?.page || page;
  const marks = [...rows.filter((r) => r.page === curPage && r.snippet).map((r) => ({ text: r.snippet, active: r.key === active })),
    ...refs.flatMap((r) => r.occurrences.filter((o) => o.page === curPage).map((o) => ({ text: o.raw || r.value, active: activeRef === r.value })))];
  const jump = (r) => { setActive(r.key); setActiveRef(null); if (r.page) setPage(r.page); };
  const jumpRef = (r) => { setActiveRef(r.value); setActive(null); const o = r.occurrences[0]; if (o?.page) setPage(o.page); };

  return (
    <div className="sd-review">
      <div className="sd-left">
        <SanadDocumentPreview doc={doc} page={page} onPage={(p) => setPage(Math.min(Math.max(1, p), total))} />
        <div className="sd-text">
          <h4>{L(`Text of page ${cur?.page || page} (predefined transcript)`, `نص الصفحة ${cur?.page || page} (نص مُعدّ مسبقاً)`)} <span className="sd-tag-sim">{B(SIM_LABEL)}</span></h4>
          {cur ? <Transcript text={cur.text} marks={marks} /> : <span className="muted">—</span>}
          <div className="muted" style={{ fontSize: 12 }}>{L('Highlighted: where each extracted value and invoice number was found on this page.', 'المظلّل: موضع كل قيمة وكل رقم فاتورة مستخرج في هذه الصفحة.')}</div>
        </div>
      </div>
      <div className="sd-fields-col">
      <div className="sd-refs" aria-label={L('Invoice numbers found in the document', 'أرقام الفواتير الموجودة في المستند')}>
        <b>{L(`Invoice numbers found in the document (${refs.length})`, `أرقام الفواتير الموجودة في المستند (${refs.length})`)}</b> <span className="sd-tag-sim">{B(SIM_LABEL)}</span>
        {refs.length === 0 && <div className="muted">{L('No invoice number was found.', 'لم يُعثر على رقم فاتورة.')}</div>}
        <ol>{refs.map((r) => { const o = r.occurrences[0]; return (
          <li key={r.key || `${r.kind}|${r.value}`} className={activeRef === r.value ? 'sd-ref--active' : ''}>
            <span dir="ltr"><b>{r.value}</b></span> <span className="muted">· {B(KIND_LABEL[r.kind] || { en: r.kind, ar: r.kind })}</span>
            {r.kind === 'invoice_serial' && <span className="rv-tag rv-tag--warn">{L('incomplete number', 'رقم ناقص')}</span>}
            {o && <> · <button type="button" className="sd-linkbtn" onClick={() => jumpRef(r)}>{L(`page ${o.page}`, `الصفحة ${o.page}`)}</button><div className="muted" style={{ fontSize: 12 }}><q dir="rtl">{o.snippet}</q></div></>}
          </li>); })}</ol>
        <div className="muted" style={{ fontSize: 12 }}>{L('Matching these numbers to the ledger and confirming the links is done in step 3 «Review the matches» below. Extraction alone changes nothing.', 'مطابقة هذه الأرقام مع الفواتير وتأكيد الربط تتمّان في الخطوة ٣ «مراجعة المراجع» أدناه. الاستخراج وحده لا يغيّر شيئاً.')} <a href="#review">{L('Go to the review', 'الانتقال إلى المراجعة')}</a></div>
      </div>
      <div className="sd-fields" role="list" aria-label={L('Extracted fields', 'الحقول المستخرجة')}>
        {rows.map((r) => <FieldCard key={r.key} r={r} active={active === r.key} onJump={() => jump(r)} canReview={canReview} onReview={onReview} />)}
      </div>
      </div>
    </div>
  );
}

function FieldCard({ r, active, onJump, canReview, onReview }) {
  const { L, B, ar } = useL();
  const [mode, setMode] = useState(null); const [value, setValue] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const label = ar ? r.def.ar : r.def.en; const st = FIELD_STATUS_LABEL[r.status] || FIELD_STATUS_LABEL.extracted; const missing = r.extractedStatus === 'missing';
  const open = (m) => { setMode(m); setErr(null); setNote(''); setValue(m === 'correct' ? (r.review?.value ?? r.extracted ?? '') : ''); };
  const submit = async (action, v = value, n = note) => {
    setBusy(true); const res = await onReview(r.key, action, { value: v, note: n }); setBusy(false);
    if (res?.ok) { setMode(null); setErr(null); } else setErr(res?.error || 'storage_failed');
  };
  const dirText = r.def.kind === 'identifier' || r.def.kind === 'date' || r.def.kind === 'amount' ? 'ltr' : 'auto';
  return (
    <div role="listitem" className={`sd-field${active ? ' sd-field--active' : ''}${r.conflict && !r.review ? ' sd-field--conflict' : ''}`}>
      <div className="sd-field__head">
        <b>{label}</b>
        <span className="sd-row">
          <span className={`rv-tag ${st.cls}`}>{B(st)}</span>
          {!missing && <span className="rv-tag" title={L('Simulated confidence (predefined for the scenario)', 'ثقة محاكاة (محددة مسبقاً للسيناريو)')}>{L('confidence', 'الثقة')} <span dir="ltr">{Math.round(r.confidence * 100)}%</span></span>}
          {r.page && <button type="button" className="sd-linkbtn" onClick={onJump}>{L(`page ${r.page}`, `الصفحة ${r.page}`)}</button>}
        </span>
      </div>
      <div className="sd-vals">
        <div className="sd-val"><small>{L('Structured value', 'القيمة المهيكلة')} · {B(ORIGIN_LABEL.structured)}</small>{r.structured != null ? <span className="v" dir={dirText}>{r.structuredShown}</span> : <span className="v muted">—</span>}</div>
        <div className="sd-val"><small>{L('Extracted from the document', 'المستخرجة من المستند')} · {B(ORIGIN_LABEL.document)}</small>{missing ? <span className="v rp-warn">{B(MISSING_IN_DOC)}</span> : <span className="v" dir={dirText}>{r.extractedShown}</span>}</div>
        {r.final && <div className="sd-val sd-val--final"><small>{L('Approved value', 'القيمة المعتمدة')} · {B(ORIGIN_LABEL[r.final.origin])}</small><span className="v" dir={dirText}>{r.finalShown || '—'}</span></div>}
      </div>
      {r.snippet && <div className="muted" style={{ fontSize: 12 }}>{L('Found at', 'وُجدت في')}: <q dir="rtl">{r.snippet}</q></div>}
      {r.conflict && !r.review && <div className="rp-bad" role="alert" style={{ fontSize: 12 }}>{L('Conflict: the document differs from the Sanad record. A reviewer decision (with a reason) is required before the document value can be accepted.', 'تعارض: يختلف المستند عن سجل سند. يلزم قرار المراجع (مع السبب) قبل اعتماد قيمة المستند.')}</div>}
      {!r.conflict && r.differs && !r.review && <div className="rp-warn" style={{ fontSize: 12 }}>{L('Reads differently from the structured value (not a blocking conflict).', 'تُقرأ بصيغة تختلف عن القيمة المهيكلة (ليس تعارضاً مانعاً).')}</div>}
      {r.review && <div className="muted" style={{ fontSize: 12 }}>{L('Last decision', 'آخر قرار')}: {B(ACTION_TEXT[r.review.history.at(-1).action])} — {shownActor(r.review.by)} — <span dir="ltr">{fmtRiyadh(r.review.at)}</span></div>}
      {canReview && mode == null && (
        <div className="sd-actions">
          <button type="button" className="btn btn-sm btn-primary" disabled={missing || busy} onClick={() => (r.conflict && !r.review ? open('confirm') : submit('confirm', null, ''))} title={missing ? B(REVIEW_ERROR.nothing_to_confirm) : undefined}>{L('Confirm', 'اعتماد')}</button>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => open('correct')}>{L('Correct', 'تصحيح')}</button>
          <button type="button" className="btn btn-sm" disabled={missing || busy} onClick={() => open('reject')}>{L('Reject', 'رفض')}</button>
        </div>
      )}
      {canReview && mode && (
        <form className="sd-editor" onSubmit={(e) => { e.preventDefault(); submit(mode); }}>
          {mode === 'correct' && (
            <label>{L('Corrected value', 'القيمة المصحّحة')}
              <input className="input" dir={dirText} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
            </label>
          )}
          {mode === 'correct' && r.structured != null && <div><button type="button" className="sd-linkbtn" onClick={() => setValue(displayValue(r.def.kind, r.structured))}>{L('Use the structured Sanad value', 'استخدام القيمة المهيكلة من سند')}</button></div>}
          <label>{mode === 'correct' ? L('Reason (optional)', 'السبب (اختياري)') : L('Reason (required)', 'السبب (مطلوب)')}
            <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {err && <div role="alert" className="rp-bad" style={{ fontSize: 12 }}>{B(REVIEW_ERROR[err]) || err}</div>}
          <div className="sd-actions">
            <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>{mode === 'confirm' ? L('Confirm the document value', 'اعتماد قيمة المستند') : mode === 'correct' ? L('Save the correction', 'حفظ التصحيح') : L('Reject the value', 'رفض القيمة')}</button>
            <button type="button" className="btn btn-sm" onClick={() => setMode(null)}>{L('Cancel', 'إلغاء')}</button>
          </div>
        </form>
      )}
      {(r.history.length > 0 || r.original) && (
        <details className="sd-history">
          <summary>{L(`History (${r.history.length})`, `السجل (${r.history.length})`)}</summary>
          <div>{L('Original extracted value (never changed)', 'القيمة الأصلية المستخرجة (لا تتغيّر)')}: <b dir={dirText}>{r.original?.value != null ? displayValue(r.def.kind, r.original.value) : B(MISSING_IN_DOC)}</b></div>
          <ol>{r.history.map((h) => <li key={h.n}><span dir="ltr">{fmtRiyadh(h.at)}</span> — {shownActor(h.by)} — <b>{B(ACTION_TEXT[h.action])}</b>{h.value != null ? <> → <span dir={dirText}>{displayValue(r.def.kind, h.value)}</span></> : null}{h.note ? <> — {h.note}</> : null}</li>)}</ol>
        </details>
      )}
    </div>
  );
}
