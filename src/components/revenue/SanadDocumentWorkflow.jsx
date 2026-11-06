import React, { useEffect, useMemo, useState } from 'react';
import { useL } from '../../utils/bi';
import { shownActor } from '../../utils/actor';
import { RecordLink } from '../../utils/returnContext';
import { invoicePath } from '../../utils/paths';
import { useRevenue } from '../../context/RevenueContext';
import { PayStatusChip } from './EnforcementUI';
import { Info } from './SectionNav';
import { AMOUNT_BASIS, SOURCES_NOTE, BANNER, outcomeOf, OUTCOME_REASON, manualReferencesFrom, resultOf, originKinds } from '../../data/sanadWorkflow';
import { ENTITIES } from '../../data/catalog';
import { fmtRiyadh } from '../../data/clock';
import '../../styles/sanad-docs.css';

const amanahLabel = (en, ar) => { const e = ENTITIES.find((x) => x.en === en); return e ? (ar ? e.ar : e.en) : (en || '—'); };
const ORIGIN_TEXT = {
  structured: { ar: 'حقل سند المهيكل', en: 'Sanad structured field' }, document: { ar: 'مستند (محاكاة OCR)', en: 'Document (OCR simulation)' }, manual_search: { ar: 'بحث يدوي', en: 'Manual search' },
  manual_entry: { ar: 'إدخال يدوي', en: 'Manual entry' }, description: { ar: 'وصف سند', en: 'Sanad description' }, other: { ar: 'أخرى', en: 'Other' }
};
export const originText = (kinds, B) => kinds.map((k) => B(ORIGIN_TEXT[k] || ORIGIN_TEXT.other)).join(' + ');

/* ------------------------------------------------------------------ the status banner («من المستند إلى الربط») */
export function WorkflowBanner({ assess }) {
  const { L, B, sar } = useL();
  const { banner, structured: S, current: C } = assess; const tone = banner.tone === 'ok' ? 'ok' : 'warn';
  const showAmounts = assess.orderAmount != null && (S.matched.length > 0 || assess.scenario === 'amount_diff');
  const changed = assess.scenario !== 'match' && (C.matched.length > 0 || C.unresolved.length !== S.unresolved.length) && C.refs > 0 && (C.refs !== S.refs || C.matched.length !== S.matched.length);
  const guide = {
    match: L('No document reading is needed: check the summary below and press the confirmation button.', 'لا حاجة إلى قراءة المستند: راجع الملخص أدناه ثم اضغط زر التأكيد.'),
    not_found: L('This does not mean the number is wrong: the available sources may be incomplete. Extract the numbers from the document or search for the invoice by hand.', 'هذا لا يعني أن الرقم خاطئ: قد تكون المصادر المتاحة غير مكتملة. استخرج الأرقام من المستند أو ابحث عن الفاتورة يدوياً.'),
    amount_diff: L('Extract from the document, or review by hand, to find missing invoices or wrong references.', 'استخرج من المستند أو راجع يدوياً لإيجاد فواتير ناقصة أو مراجع خاطئة.'),
    no_numbers: L('Read the document to identify one or more invoice numbers; manual entry and search are available.', 'اقرأ المستند لتحديد رقم فاتورة أو أكثر؛ والإدخال والبحث اليدوي متاحان.'),
    ambiguous: L('The candidates are shown in the review table; none is chosen for you.', 'تظهر المرشحة في جدول المراجعة ولا تُختار نيابةً عنك.'),
    corrupted: L('The digits cannot be recovered: use the document or search by hand.', 'لا يمكن استعادة الأرقام: استخدم المستند أو ابحث يدوياً.'),
    manual: L('Use the manual search below and record why the invoice is the right one.', 'استخدم البحث اليدوي أدناه وسجّل لماذا هذه هي الفاتورة الصحيحة.')
  }[banner.key];
  return (
    <div className={`wf-banner wf-banner--${tone}`} role="status" aria-live="polite" id="wf-banner">
      <div className="wf-banner__head"><span className="wf-banner__icon" aria-hidden="true">{tone === 'ok' ? '✓' : '!'}</span><b>{B(banner)}</b>
        <span className="rv-tag rv-tag--warn">{L('Validation of the Sanad reference — before any document', 'التحقق من مرجع سند — قبل أي مستند')}</span></div>
      {showAmounts && (
        <div className="wf-banner__nums" role="group" aria-label={L('Amounts', 'المبالغ')}>
          <span>{L('Order amount (Sanad)', 'مبلغ الأمر (سند)')}: <b dir="ltr">{sar(assess.orderAmount)}</b></span>
          <span>{L('Matched invoices (billed value)', 'الفواتير المطابقة (القيمة المفوترة)')}: <b dir="ltr">{sar(S.total)}</b> · {L(`${S.matched.length} invoice(s)`, `${S.matched.length} فاتورة`)}</span>
          <span className={assess.scenario === 'match' ? 'rp-ok' : 'rp-warn'}>{L('Difference', 'الفرق')}: <b dir="ltr">{S.difference == null ? '—' : sar(S.difference)}</b></span>
          {S.outstanding !== S.total && <span className="muted">{L('Outstanding (information only)', 'المتبقي (للاطلاع فقط)')}: <span dir="ltr">{sar(S.outstanding)}</span></span>}
        </div>
      )}
      <div className="wf-banner__guide">{guide}</div>
      {assess.scenario === 'match' && <div><a className="btn btn-primary btn-sm" href="#confirm">{L('Go to the confirmation', 'الانتقال إلى التأكيد')}</a></div>}
      {changed && (
        <div className={`wf-banner__now ${assess.reconciledNow ? 'rp-ok' : 'rp-warn'}`}>
          <b>{L('Now, with the references added from the document or by hand', 'الآن، مع المراجع المضافة من المستند أو يدوياً')}:</b>{' '}
          {L(`${C.matched.length} invoice(s) · total`, `${C.matched.length} فاتورة · المجموع`)} <b dir="ltr">{sar(C.total)}</b> · {L('difference', 'الفرق')} <b dir="ltr">{C.difference == null ? '—' : sar(C.difference)}</b>
          {C.unresolved.length > 0 ? ` · ${L(`${C.unresolved.length} reference(s) unresolved`, `${C.unresolved.length} مرجع غير محسوم`)}` : ''}{assess.reconciledNow ? ` — ${L('the amounts agree', 'المبالغ متطابقة')}` : ''}
        </div>
      )}
      <Info summary={L('How the amounts are compared', 'كيف تُقارن المبالغ')}><div>{B(AMOUNT_BASIS)}</div><div className="muted">{B(SOURCES_NOTE)}</div></Info>
    </div>
  );
}

/* ------------------------------------------------------------------ manual search + manual entry (a reason is REQUIRED) */
export function ManualSearch({ c, rev, onMessage, setTick, recommended = false, linkedIds = new Set() }) {
  const { L, B, ar, sar } = useL();
  const [q, setQ] = useState(''); const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [pick, setPick] = useState({}); const [why, setWhy] = useState('');
  const canReview = rev.canDo.enforcementReview; /* adding references to an order = enforcement.review */ const picked = Object.keys(pick).filter((k) => pick[k]);
  const scope = useMemo(() => ({ ...rev.scopeEff, from: '2000-01-01', to: rev.cfg.cutoff }), [rev.scopeEff, rev.cfg.cutoff]);
  const search = async (e) => {
    e?.preventDefault?.(); const s = q.trim(); if (!s) return; setBusy(true); setErr(null); setPick({});
    try { const r = await rev.data.list(scope, { filters: { search: s, allPeriods: true }, page: 0, pageSize: 25 }); setRes({ total: r.total, rows: (r.rows || []).map(resultOf), q: s }); }
    catch (x) { setErr(String(x?.message || x)); setRes(null); } finally { setBusy(false); }
  };
  const add = (origin, text) => {
    if (!why.trim()) { setErr(L('A recorded explanation is required.', 'يلزم تسجيل شرح.')); return; }
    const ex = manualReferencesFrom(text, { origin, reason: why, orderNo: c.enforceNum });
    if (!ex.refs.length) { setErr(L('No invoice number was recognised. Use a full number such as 177-407580123348 or a 12-digit Sadad number.', 'لم يُتعرَّف على رقم فاتورة. استخدم رقماً كاملاً مثل 177-407580123348 أو رقم سداد من 12 رقماً.')); return; }
    const r = rev.enforcement.addManual(c.enforceNum, ex);
    if (!r.ok) { setErr(L('Could not record the references.', 'تعذّر تسجيل المراجع.')); return; }
    onMessage?.({ ok: true, text: L(`${ex.refs.length} reference(s) added as «${origin === 'manual_search' ? 'manual search' : 'manual entry'}» with your explanation. They go through the same checks as every other reference and change nothing until you confirm.`, `أُضيف ${ex.refs.length} مرجع على أنه «${origin === 'manual_search' ? 'بحث يدوي' : 'إدخال يدوي'}» مع شرحك. تمر بالفحوص نفسها كأي مرجع ولا تغيّر شيئاً حتى تؤكد.`) });
    setPick({}); setWhy(''); setErr(null); setTick?.((x) => x + 1);
  };
  const looksLikeNumber = /\d{6,}/.test(q);
  return (
    <details className={`ed-more wf-manual${recommended ? ' wf-manual--rec' : ''}`} open={recommended || undefined} id="manual-search">
      <summary>{recommended ? L('Search for the invoice by hand (recommended here)', 'البحث اليدوي عن الفاتورة (موصى به هنا)') : L('Search for an invoice by hand', 'البحث اليدوي عن فاتورة')}</summary>
      <div className="ed-more__body" style={{ display: 'grid', gap: 10 }}>
        <div className="muted" style={{ fontSize: 13 }}>{L('Search the invoices by invoice number, Sadad number or payer. The numbers you add go through the same checks as every other reference; nothing is linked or excluded until you confirm.', 'ابحث في الفواتير برقم الفاتورة أو رقم السداد أو الدافع. الأرقام التي تضيفها تمر بالفحوص نفسها كأي مرجع، ولا يُربط شيء ولا يُستبعد حتى تؤكد.')}</div>
        <form className="oj-row" onSubmit={search} role="search">
          <label style={{ flex: '1 1 280px', display: 'grid', gap: 3, fontSize: 13 }}>{L('Invoice number, Sadad number or payer', 'رقم الفاتورة أو رقم السداد أو الدافع')}
            <input className="input" dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="177-407580123348" disabled={!canReview} aria-label={L('Search the invoices', 'البحث في الفواتير')} /></label>
          <button type="submit" className="btn btn-sm" disabled={!canReview || busy || !q.trim()}>{busy ? L('Searching…', 'جارٍ البحث…') : L('Search', 'بحث')}</button>
        </form>
        {res && (
          <div className="wf-results" aria-live="polite">
            <div className="muted" style={{ fontSize: 12 }}>{res.total === 0 ? L('No invoice matches this search.', 'لا فاتورة تطابق هذا البحث.') : L(`${res.total} invoice(s) found${res.total > res.rows.length ? ` — showing ${res.rows.length}` : ''}`, `وُجدت ${res.total} فاتورة${res.total > res.rows.length ? ` — عرض ${res.rows.length}` : ''}`)}</div>
            {res.rows.length > 0 && (
              <div className="rp-tablewrap" tabIndex={0}><table className="oj-table" aria-label={L('Search results', 'نتائج البحث')}>
                <thead><tr><th>{L('Select', 'تحديد')}</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Entity', 'الجهة')}</th><th className="num">{L('Billed value', 'القيمة المفوترة')}</th><th>{L('Status', 'الحالة')}</th></tr></thead>
                <tbody>{res.rows.map((r) => { const already = linkedIds.has(r.invoiceId); return (
                  <tr key={r.invoiceId}>
                    <td><label className="ed-hit"><input type="checkbox" className="oj-check" checked={!!pick[r.invoiceId]} disabled={!canReview || already} aria-label={`${L('Select', 'تحديد')} ${r.invoiceId}`} onChange={(e) => setPick((m) => ({ ...m, [r.invoiceId]: e.target.checked }))} /></label></td>
                    <td><RecordLink to={invoicePath(r.invoiceId)} dir="ltr"><b>{r.invoiceId}</b></RecordLink><div className="muted" style={{ fontSize: 12 }} dir="ltr">{r.issueDate}</div></td>
                    <td>{amanahLabel(r.amanahEn, ar)}<div className="muted" style={{ fontSize: 12 }} dir="auto">{ar ? r.payerAr : r.payerEn}</div></td>
                    <td className="num" dir="ltr">{sar(r.gross)}{r.outstanding != null && Math.abs(r.outstanding - r.gross) > 0.5 && <div className="muted" style={{ fontSize: 12 }}>{L('outstanding', 'المتبقي')} {sar(r.outstanding)}</div>}</td>
                    <td>{r.paymentStatus && <PayStatusChip status={r.paymentStatus} />}{already && <div><span className="rv-tag">{L('already a reference of this order', 'مرجع في هذا الأمر أصلاً')}</span></div>}</td>
                  </tr>); })}</tbody>
              </table></div>
            )}
          </div>
        )}
        <label style={{ display: 'grid', gap: 3, fontSize: 13 }}>{L('Explanation (required): why is this the right invoice / number?', 'الشرح (مطلوب): لماذا هذه هي الفاتورة / الرقم الصحيح؟')}
          <textarea className="input" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} disabled={!canReview} aria-required="true" /></label>
        {err && <div role="alert" className="rp-bad" style={{ fontSize: 13 }}>{err}</div>}
        <div className="oj-row">
          <button type="button" className="btn btn-primary btn-sm" disabled={!canReview || !picked.length} onClick={() => add('manual_search', picked.join('\n'))}>{L(`Add the selected invoices as references (${picked.length})`, `إضافة الفواتير المحددة كمراجع (${picked.length})`)}</button>
          <button type="button" className="btn btn-sm" disabled={!canReview || !looksLikeNumber} onClick={() => add('manual_entry', q)} title={L('Adds the typed number as written, even if no invoice was found', 'تضيف الرقم المكتوب كما هو حتى لو لم تُوجد فاتورة')}>{L('Add the typed number as written (manual entry)', 'إضافة الرقم المكتوب كما هو (إدخال يدوي)')}</button>
        </div>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ the confirmation summary */
export function ConfirmSummary({ summary, rows, pendingN, confirmedN, ack, setAck }) {
  const { L, B, sar } = useL();
  return (
    <div className="wf-sum" role="group" aria-label={L('Summary before confirmation', 'ملخص قبل التأكيد')}>
      <h4>{L('Summary before confirmation', 'ملخص قبل التأكيد')}</h4>
      {summary.items.length === 0 && <div className="muted">{L('No invoice is selected.', 'لا فاتورة محددة.')}</div>}
      {summary.items.length > 0 && (
        <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Invoices to confirm', 'الفواتير المراد تأكيدها')}>
          <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Source of the number', 'مصدر الرقم')}</th><th className="num">{L('Billed value', 'القيمة المفوترة')}</th><th>{L('Warnings', 'تنبيهات')}</th></tr></thead>
          <tbody>{summary.items.map((x) => (
            <tr key={x.invoiceId}>
              <td dir="ltr"><b>{x.invoiceId}</b></td>
              <td>{originText(x.origins, B)}{x.doc && <div className="muted" style={{ fontSize: 12 }}><span dir="ltr">{x.doc.name}</span>{x.doc.pages.length ? ` · ${L('p.', 'ص')} ${x.doc.pages.join(',')}` : ''}{x.doc.snippet && <> — <q dir="rtl">{x.doc.snippet}</q></>}</div>}
                {x.reason && <div className="muted" style={{ fontSize: 12 }}>{L('Explanation', 'الشرح')}: {x.reason}</div>}</td>
              <td className="num" dir="ltr">{sar(x.gross)}{x.outstanding != null && Math.abs(x.outstanding - x.gross) > 0.5 && <div className="muted" style={{ fontSize: 12 }}>{L('outstanding', 'المتبقي')} {sar(x.outstanding)}</div>}</td>
              <td>{x.paymentStatus && <PayStatusChip status={x.paymentStatus} />}{x.sourceCancelled && <div><span className="rv-tag rv-tag--bad">{L('cancelled in the source', 'ملغاة في المصدر')}</span></div>}{x.excludedAlready && !x.sourceCancelled && <div><span className="rv-tag">{L('already excluded', 'مستبعدة أصلاً')}</span></div>}</td>
            </tr>))}</tbody>
        </table></div>
      )}
      <div className="oj-total" role="group" aria-label={L('Totals', 'الإجماليات')}>
        <span>{L('Selected now', 'المحدد الآن')}: <b dir="ltr">{sar(summary.selectedTotal)}</b></span>
        <span>{L('Already confirmed', 'المؤكد سابقاً')}: <b dir="ltr">{summary.confirmedTotal == null ? '—' : sar(summary.confirmedTotal)}</b></span>
        <span>{L('Invoices total', 'مجموع الفواتير')}: <b dir="ltr">{summary.total == null ? '—' : sar(summary.total)}</b></span>
        <span>{L('Order amount', 'مبلغ الأمر')}: <b dir="ltr">{summary.orderAmount == null ? '—' : sar(summary.orderAmount)}</b></span>
        <span className={summary.requiresAck ? 'rp-warn' : 'rp-ok'}>{L('Difference', 'الفرق')}: <b dir="ltr">{summary.difference == null ? '—' : sar(summary.difference)}</b></span>
      </div>
      {pendingN > 0 && <div className="rp-limit rp-limit--warn" role="status"><b>{L('Partial confirmation', 'تأكيد جزئي')}:</b> {L(`${pendingN} reference(s) stay unresolved and are NOT confirmed.`, `يبقى ${pendingN} مرجع غير محسوم ولن يُؤكَّد.`)}</div>}
      {summary.requiresAck && summary.items.length > 0 && (
        <div className="wf-ack" role="group" aria-label={L('Acknowledge the difference', 'الإقرار بالفرق')}>
          <label className="wf-ack__check"><input type="checkbox" checked={!!ack.acknowledged} onChange={(e) => setAck({ ...ack, acknowledged: e.target.checked })} />
            <span>{L(`I acknowledge a difference of ${sar(Math.abs(summary.difference))} between the invoices' value and the enforcement order amount.`, `أُقرّ بوجود فرق قدره ${sar(Math.abs(summary.difference))} بين قيمة الفواتير وقيمة أمر التنفيذ.`)}</span></label>
          <label style={{ display: 'grid', gap: 3, fontSize: 13 }}>{L('Reason for confirming despite the difference (required)', 'سبب التأكيد رغم الفرق (مطلوب)')}
            <textarea className="input" rows={2} value={ack.reason || ''} onChange={(e) => setAck({ ...ack, reason: e.target.value })} aria-required="true" /></label>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ the outcome after confirmation: what the engine did, read fresh */
export function OutcomePanel({ links }) {
  const { L, B, sar } = useL();
  const rev = useRevenue();
  const confirmed = links.filter((l) => l.status === 'confirmed'); const key = confirmed.map((l) => l.invoiceId).join('|');
  const [out, setOut] = useState({}); const [state, setState] = useState('idle');
  useEffect(() => {
    if (!confirmed.length) { setOut({}); setState('idle'); return undefined; }
    let off = false; setState('loading');
    (async () => {
      try { const m = {}; for (const l of confirmed) { const d = await rev.data.invoice(l.invoiceId); m[l.invoiceId] = outcomeOf(d); } if (!off) { setOut(m); setState('ready'); } } catch { if (!off) setState('error'); }
    })();
    return () => { off = true; };
  }, [key, rev.data, rev.dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps -- a fresh read of each confirmed invoice after the link exists
  if (!confirmed.length) return null;
  return (
    <div className="wf-outcome" role="region" aria-label={L('Result of the confirmation', 'نتيجة التأكيد')} aria-live="polite">
      <h4>{L('Result of the confirmation — read from the data service after the link', 'نتيجة التأكيد — قراءة جديدة من خدمة البيانات بعد الربط')}</h4>
      {state === 'loading' && <div className="muted" role="status">{L('Reading the invoices…', 'جارٍ قراءة الفواتير…')}</div>}
      {state === 'error' && <div className="rp-limit rp-limit--warn" role="alert">{L('The data service could not be read. The links are saved; reload to see the result.', 'تعذّرت قراءة خدمة البيانات. الروابط محفوظة؛ أعد تحميل الصفحة لرؤية النتيجة.')}</div>}
      <ul className="wf-outcome__list">{confirmed.map((l) => { const o = out[l.invoiceId]; return (
        <li key={l.invoiceId}>
          <RecordLink to={invoicePath(l.invoiceId)} dir="ltr"><b>{l.invoiceId}</b></RecordLink>{' '}
          {!o ? <span className="muted">…</span> : o.state === 'excluded'
            ? <><span className="rv-tag rv-tag--ok">{L('Excluded', 'مستبعدة')}</span> <span>{L('excluded value', 'القيمة المستبعدة')}: <b dir="ltr">{sar(o.value)}</b></span>{o.byLink ? <span className="muted"> · {L('reason: linked to a confirmed enforcement order', 'السبب: مرتبطة بأمر تنفيذ مؤكد')}</span> : <span className="muted"> · {L('other reasons apply too', 'وتنطبق أسباب أخرى')}</span>}</>
            : <><span className="rv-tag rv-tag--warn">{L('Not excluded', 'لم تُستبعد')}</span> <span>{B(OUTCOME_REASON[o.reason] || OUTCOME_REASON.no_rule)}</span></>}
          {o && o.sourceConflict && <div><span className="rv-tag rv-tag--bad">{L('Source / enforcement conflict — review required', 'تعارض بين المصدر والتنفيذ — يحتاج مراجعة')}</span></div>}
          {o && <div className="muted" style={{ fontSize: 12 }}>{o.state === 'excluded' && o.received > 0 ? `${L('The collected part', 'الجزء المحصَّل')} (${sar(o.received)}) ${L('stays collected — only the uncollected remainder is excluded. ', 'يبقى محصَّلاً — يُستبعد المتبقي غير المحصَّل فقط. ')}` : ''}{L('Payments and the source status are untouched.', 'لا تتغير المدفوعات ولا حالة المصدر.')}</div>}
        </li>); })}</ul>
    </div>
  );
}

/* ------------------------------------------------------------------ one place that says a reference was corrected (the original stays) */
export function CorrectionNote({ corr }) {
  const { L } = useL();
  if (!corr) return null;
  return (
    <div className="wf-corr" style={{ fontSize: 12 }}>
      <b>{L('Corrected', 'صُحِّح')}</b>: <span dir="ltr">{corr.from}</span> → <span dir="ltr"><b>{corr.to}</b></span> <span className="muted">({corr.origin})</span>
      <div className="muted">{L('Reason', 'السبب')}: {corr.reason} — {shownActor(corr.by)} · <span dir="ltr">{fmtRiyadh(corr.at)}</span></div>
      <div className="muted">{L('The original reference is kept unchanged.', 'يبقى المرجع الأصلي دون تغيير.')}</div>
    </div>
  );
}
export { BANNER, originKinds };
