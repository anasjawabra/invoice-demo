import React, { useEffect, useMemo, useState } from 'react';
import Pager from '../Pager';
import { useRevenue } from '../../context/RevenueContext';
import { useSourceRecords } from '../../context/SourceRecordsContext';
import { useAsync } from '../../utils/useAsync';
import { useL } from '../../utils/bi';
import { RecordLink, useOpenRecord, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../../utils/returnContext';
import { orderPath, violationPath, invoicePath } from '../../utils/paths';
import { REPORTS, METHODS, SOURCES, reportById } from '../../data/ingestion/reports';
import { EXECUTION_BASIS, AMOUNT_DEFINITION, sourceStatuses } from '../../data/ingestion/eefaa';
import { RELATION_STATUS, latestDecisions } from '../../data/ingestion/relations';
import { buildIndex } from '../../data/relations';
import { reviewStatusOf, REVIEW_LABEL } from '../../data/orderSummary';
import { orderCompleteness, orderExceptions } from '../../data/orderMatching';
import { loadDocsIndex, documentState } from '../../data/sanadDocs/service';
import { amanahName } from '../../data/catalog';
import { api } from '../../api/client';
import { LocalFilterToolbar, useUrlFilters } from '../filters';
import { ENF_KEYS, enfDefaults, sanitizeValues, enforcementFields, sortOptions, allMatches, eefaaMatches } from '../filters/localPages';
import '../../styles/enforcement-lists.css';

const PAGE = 25;
export const when = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '—');
export const maskId = (v) => (v ? `••••${String(v).slice(-3)}` : '—');
const TONE = { ok: 'rv-tag--ok', warn: 'rv-tag--warn', muted: '', bad: 'rv-tag--bad' };

// ONE chip vocabulary for the lists and the details pages. Colour rule: red = conflict / failure ONLY; amber = needs attention; green = done / confirmed; grey = neutral.
// The text is always there and a glyph repeats the tone, so colour is never the only carrier of the meaning.
export function Chip({ tone = 'muted', title, children }) { return <span className={`rv-tag ef-chip ef-chip--${tone} ${TONE[tone] || ''}`} title={title}>{children}</span>; }

export function SourceTag({ source }) { const { B } = useL(); const cls = source === 'sanad' ? 'rv-cat--enforcement' : source === 'eefaa' ? 'rv-cat--partial' : 'rv-cat--objection'; return <span className={`rv-cat ${cls}`}>{B(SOURCES[source])}</span>; }
export function RelationChip({ status, conflicting }) {
  const { B } = useL(); const d = RELATION_STATUS[status];
  return <><Chip tone={d.tone}>{B(d)}</Chip>{conflicting && <> <Chip tone="bad">{B({ ar: 'قيم متعارضة', en: 'Conflicting values' })}</Chip></>}</>;
}
export const ExecChip = ({ basis }) => { const { B } = useL(); return <Chip tone={basis === 'evidence' ? 'ok' : 'muted'}>{B(EXECUTION_BASIS[basis])}</Chip>; };

// the amount line of an Eefaa violation: the value the reports state, and a conflict marker when reports disagree (nothing is picked or averaged)
export function EefaaAmount({ g }) {
  const { sar, L } = useL(); const a = g.fields.amount; if (!a || a.value == null) return <span className="muted">—</span>;
  return <span dir="ltr">{sar(a.value)}{a.conflict && <> <span dir="auto"><Chip tone="bad" title={a.values.map((v) => sar(v)).join(' · ')}>{L('reports differ', 'التقارير تختلف')}</Chip></span></>}</span>;
}
const entityOf = (g) => g.fields.amanah?.value || g.fields.entity?.value || '';
const cityOf = (g) => g.fields.city?.value || '';
// an Eefaa violation needs review when several Mumtathil records carry its number, Mumtathil's values conflict with Eefaa's, its values differ between reports, or its identifier is damaged (there is no confirm / reject step: Mumtathil is shown where found)
export const eefaaNeedsReview = (g, r) => !!((r && (r.status === 'ambiguous' || r.conflicting)) || g.conflicts.length || g.flags.some((f) => f.startsWith('damaged_identifier')));

/* ------------------------------------------------------------------------------------------------ shared data hooks */
function useDocsIndex() { const [idx, setIdx] = useState(null); useEffect(() => { let off = false; loadDocsIndex().then((m) => { if (!off) setIdx(m); }).catch(() => { if (!off) setIdx(new Map()); }); return () => { off = true; }; }, []); return idx; }
// a missing Sanad document is «needs attention» (amber), not an error: the generated demo feed has none, so red would stop meaning «failure»
export const DOC_STATE_LABEL = {
  missing: { ar: 'مستند سند غير متوفر', en: 'Sanad document not available', tone: 'warn' }, attached: { ar: 'مستند مرفق — لم يُستخرج', en: 'Attached — not extracted', tone: 'warn' }, extracted: { ar: 'استُخرج — بانتظار المراجعة', en: 'Extracted — awaiting review', tone: 'warn' },
  under_review: { ar: 'قيد المراجعة', en: 'Under review', tone: 'warn' }, reviewed: { ar: 'تمت المراجعة', en: 'Reviewed', tone: 'ok' }, failed: { ar: 'فشل الاستخراج', en: 'Extraction failed', tone: 'bad' }
};
export const DocChip = ({ state }) => { const { B } = useL(); const d = DOC_STATE_LABEL[state] || DOC_STATE_LABEL.missing; return <Chip tone={d.tone}>{B(d)}</Chip>; };
// the matching-review status of a Sanad request as ONE chip (green = complete, amber = needs a person)
export const ReviewChip = ({ review }) => { const { B } = useL(); const lab = REVIEW_LABEL[review]; return <Chip tone={lab.tone === 'ok' ? 'ok' : 'warn'}>{B(lab)}</Chip>; };

// confirmed Eefaa→invoice links (reviewer decisions) as a set of invoice ids
export function eefaaLinkedInvoices(reviews) { const out = new Set(); for (const [k, r] of latestDecisions(reviews)) if (r.kind === 'invoice_link' && r.decision === 'confirmed') out.add(String(r.subject).split('|').pop()); return out; }

/* ------------------------------------------------------------------------------------------------ shared list pieces */
// a table row that opens its record when clicked anywhere; the real links / buttons inside keep working for keyboard and assistive technology
export function OpenRow({ to, children }) {
  const open = useOpenRecord();
  const onClick = (e) => { if (e.defaultPrevented || e.target.closest('a,button,input,select,textarea,summary,label')) return; if (String(window.getSelection?.() || '')) return; open(to); };
  return <tr className="ef-row" onClick={onClick}>{children}</tr>;
}
export function OpenCell({ to, id }) {
  const { L } = useL();
  return <td className="ef-open-cell"><RecordLink className="ef-open" to={to} aria-label={`${L('Open', 'فتح')} ${id}`}>{L('Open', 'فتح')} <span className="ef-open__chev" aria-hidden="true">›</span></RecordLink></td>;
}
export const OpenTh = () => { const { L } = useL(); return <th><span className="sr-only">{L('Open', 'فتح')}</span></th>; };
// a column header whose definition is one hover / long-press away (and in the details page)
export const InfoTh = ({ label, def, num }) => <th className={`ef-th--info${num ? ' num' : ''}`} aria-label={label} title={def} aria-description={def}>{label}</th>;
export const EmptyRow = ({ cols, children }) => <tr><td colSpan={cols} className="muted ef-empty" data-span-all="">{children}</td></tr>;

// ONE toolbar for every list of «إدارة أوامر التنفيذ» — the shared compact filter toolbar (labels above, «المزيد من الفلاتر», chips only for selections, «مسح الفلاتر» only when something is set,
// result count near the table). The source switch and the related-view tabs are navigation, not filters. State lives in the URL (Back / return restores it).
//   fields: from localPages.js · values / onChange(patch) / onClear from useListFilters · sort: { value, set, options:[{value,label}] }
export function useListFilters(view, fields, onChange) {
  const keys = ENF_KEYS[view]; const defaults = useMemo(() => enfDefaults(view), [view]);
  const url = useUrlFilters({ keys, defaults });
  const values = useMemo(() => sanitizeValues(fields, url.values), [fields, url.values]);
  const set = (patch) => { url.setValues(patch); if (onChange) onChange(patch); };
  const clear = () => { url.setValues({ ...defaults, ...(values.sort !== undefined ? { sort: values.sort } : {}) }); if (onChange) onChange({}); }; // the sort is a view option, not a filter: it stays
  return { values, set, clear };
}
export function ListToolbar({ fields, values, onChange, onClear, onQ, qPlaceholder, sort, count }) {
  const { L, ar } = useL();
  const q = values.q || '';
  const chips = q.trim() ? [{ key: 'q', label: L('Search', 'بحث'), value: q.trim(), onRemove: () => onQ('') }] : [];
  return (
    <LocalFilterToolbar fields={fields} values={values} onChange={onChange} onClear={onClear} extraChips={chips} label={L('Filters', 'التصفية')}
      search={{ value: q, onChange: onQ, label: L('Search', 'بحث'), placeholder: qPlaceholder }}
      resultCount={<div className="ef-countline"><span>{count}</span>{sort && <label className="ef-sortline">{L('Sort', 'الترتيب')}<select id="ef-sort" className="ft-ctl ft-ctl--select" value={sort.value} onChange={(e) => sort.set(e.target.value)}>{sort.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>}</div>} />
  );
}

/* ------------------------------------------------------------------------------------------------ KPI region: three labelled clusters (units stated, never added across sources) */
export function SourceKpis({ onGo }) {
  const rev = useRevenue(); const sr = useSourceRecords(); const { L, count: fmt, parts } = useL();
  const idx = useMemo(() => buildIndex(rev.cases), [rev.cases]);
  const needSanad = useMemo(() => rev.cases.filter((c) => { const comp = orderCompleteness(c); return reviewStatusOf(comp, c, orderExceptions(c)) !== 'complete'; }).length, [rev.cases]);
  const rel = sr.relations; const needEefaa = sr.groups.filter((g) => eefaaNeedsReview(g, rel.byGroup.get(g.key))).length;
  const [openCol, setOpenCol] = useState(false); const [pFrom, setPFrom] = useState(''); const [pTo, setPTo] = useState(''); const [defs, setDefs] = useState({});
  const confirmedIds = useMemo(() => [...idx.entries()].filter(([, e]) => e.referredEver).map(([id]) => id), [idx]);
  const colReq = useMemo(() => ({ ids: confirmedIds, from: pFrom || undefined, to: pTo || undefined }), [confirmedIds, pFrom, pTo]);
  const { data: col } = useAsync(() => (confirmedIds.length ? api.enforcementCollections(rev.requestFor({ amanah: rev.scopeEff.amanah, source: 'all' }, colReq)) : Promise.resolve({ available: true, total: 0, count: 0, invoices: 0, rows: [], notCounted: { count: 0, amount: 0, items: [] }, linkedInvoices: 0 })), [rev.requestFor, rev.scopeEff.amanah, colReq, rev.dataVersion]);
  const p = col?.available ? parts(col.total) : null;
  // a card: label · value · ONE short unit caption; the long definition is behind the «i» button; a clickable card shows a chevron
  const card = (key, label, caption, def, o = {}) => {
    const value = o.valueNode ?? (typeof o.n === 'number' ? fmt(o.n) : o.n);
    const body = <>
      <span className="ef-kcard__l">{label}</span>
      <span className={`ef-kcard__n${o.warn && o.n ? ' ef-kcard__n--warn' : ''}${o.text ? ' ef-kcard__n--text' : ''}`} dir={o.text ? undefined : 'ltr'}>{value}</span>
      <span className="ef-kcard__u">{caption}</span>
    </>;
    return (
      <div className="ef-kcard" key={key}>
        {o.onClick
          ? <button type="button" className="ef-kcard__main" onClick={o.onClick} aria-expanded={o.expanded} title={def}>{body}<span className={`ef-kcard__chev${o.expanded ? ' ef-kcard__chev--open' : ''}`} aria-hidden="true">›</span></button>
          : <div className="ef-kcard__main">{body}</div>}
        <button type="button" className="ef-kcard__i" aria-expanded={!!defs[key]} aria-label={`${L('Definition', 'التعريف')}: ${label}`} title={L('Definition', 'التعريف')} onClick={() => setDefs((d) => ({ ...d, [key]: !d[key] }))}>ⓘ</button>
        {defs[key] && <p className="ef-kcard__def" role="note">{def}</p>}
      </div>
    );
  };
  const group = (key, title, cards) => <div className="ef-kgroup" role="group" aria-labelledby={`ef_kg_${key}`} key={key}><h2 className="ef-kgroup__t" id={`ef_kg_${key}`}>{title}</h2><div className="ef-kgroup__cards">{cards}</div></div>;
  const colCaption = col?.available ? L(`${col.count} payment(s) · ${col.invoices} invoice(s)`, `${col.count} دفعة · ${col.invoices} فاتورة`) : L('SAR · payments on linked invoices', 'ريال · دفعات على فواتير مربوطة');
  return (
    <section className="ef-kpis" aria-label={L('Summary', 'الملخص')}>
      <div className="ef-kgroups">
        {group('sanad', L('Sanad', 'سند'), [
          card('s1', L('Sanad requests', 'طلبات سند'), L('requests', 'طلب تنفيذ'), L('Unit: Sanad enforcement requests.', 'الوحدة: طلبات تنفيذ في سند.'), { n: rev.cases.length, onClick: () => onGo('sanad') }),
          card('s2', L('Needing action', 'تحتاج إجراء'), L('requests', 'طلب'), L('Unit: Sanad requests whose matching review is not complete.', 'الوحدة: طلبات سند لم تكتمل مراجعة مطابقتها.'), { n: needSanad, warn: true, onClick: () => onGo('sanad', { review: 'open' }) })
        ])}
        {group('eefaa', L('Eefaa', 'إيفاء'), [
          card('e1', L('Eefaa violations', 'مخالفات إيفاء'), L('violations', 'مخالفة'), L('Unit: Eefaa violations (Mumtathil records are not counted).', 'الوحدة: مخالفات إيفاء (سجلات ممتثل لا تُعدّ).'), { n: sr.groups.length, onClick: () => onGo('eefaa') }),
          card('e2', L('Needing review', 'تحتاج مراجعة'), L('violations', 'مخالفة'), L('Unit: Eefaa violations with several Mumtathil records, conflicting or differing values, or a damaged identifier.', 'الوحدة: مخالفات إيفاء بعدة سجلات في ممتثل، أو قيم متعارضة أو مختلفة، أو معرّف تالف.'), { n: needEefaa, warn: true, onClick: () => onGo('eefaa', { review: 'open' }) })
        ])}
        {group('collect', L('Collection', 'التحصيل'), [
          card('c1', L('Total collected through enforcement orders', 'إجمالي المحصل من أوامر التنفيذ'), colCaption,
            L('Unit: SAR · payments (Tahseel) on invoices with a confirmed order link, by payment date · synthetic demo records.', 'الوحدة: ريال · دفعات (تحصيل) على فواتير ذات ربط مؤكد بأمر، بتاريخ السداد · سجلات تجريبية.'),
            { valueNode: !col ? '…' : col.available ? <>{p.num} <span className="ef-kcard__unit">{p.label}</span></> : L('Not available from the source', 'غير متوفر من المصدر'), text: !!col && !col.available, onClick: () => setOpenCol((v) => !v), expanded: openCol })
        ])}
      </div>
      {openCol && <CollectedPanel col={col} cases={rev.cases} idx={idx} pFrom={pFrom} pTo={pTo} setPFrom={setPFrom} setPTo={setPTo} />}
      <details className="ef-note">
        <summary>{L('Counts use different units and are not added.', 'الأعداد بوحدات مختلفة ولا تُجمع.')} <b>{L('Details', 'تفاصيل')}</b></summary>
        <div className="ef-note__body">
          <p>{L('Sanad requests, Eefaa violations, linked invoices and the amounts shown are different units and are never added together. Whether a Sanad request and an Eefaa violation concern the same case is NOT established (the shared execution number is not confirmed), so no total is shown across the two sources.', 'طلبات سند ومخالفات إيفاء والفواتير المربوطة وحدات عدّ مختلفة ولا تُجمع. وتداخل طلب سند ومخالفة إيفاء في الحالة نفسها غير محدد (رقم التنفيذ المشترك لم يُعتمد)، فلا يُعرض إجمالي يجمع المصدرين.')}</p>
          <p>{L('Each source keeps its own identifiers, statuses and counts.', 'ولكل مصدر معرّفاته وحالاته وأعداده.')}</p>
        </div>
      </details>
    </section>
  );
}


// the drill-down of «إجمالي المحصل من أوامر التنفيذ»: every contributing payment with its orders, invoice, payment date and amount; the total is the sum of the payments, each counted once
function CollectedPanel({ col, cases, idx, pFrom, pTo, setPFrom, setPTo }) {
  const { L, B, sar, ar } = useL();
  const reqNo = useMemo(() => new Map(cases.map((c) => [c.enforceNum, c.source?.requestNo || c.enforceNum])), [cases]);
  if (!col) return <div className="rp-limit" role="status">{L('Loading the payment records…', 'جارٍ تحميل سجلات السداد…')}</div>;
  const ordersOf = (id) => (idx.get(id)?.confirmed || []).map((o) => o.enforceNum);
  return (
    <section className="rp-section" aria-label={L('Collected through enforcement orders', 'إجمالي المحصل من أوامر التنفيذ')} style={{ marginBlockStart: 8 }}>
      <div className="rp-limit rp-limit--warn" role="note"><span className="rv-tag rv-tag--warn">{L('Synthetic demo payment records', 'سجلات سداد تجريبية اصطناعية')}</span> {L('Payments are the demo ledger’s plus a small labelled synthetic set added only for this card. The synthetic payments are not part of the ledger, so no dashboard, invoice page or exclusion amount reads them.', 'الدفعات من السجل التجريبي مع مجموعة اصطناعية صغيرة موسومة أُضيفت لهذه البطاقة فقط. والدفعات الاصطناعية ليست جزءاً من السجل، فلا تقرؤها أي لوحة أو صفحة فاتورة أو مبلغ استبعاد.')}</div>
      <div className="rv-form" style={{ marginBlock: 8 }}>
        <label>{L('Payment date from', 'تاريخ السداد من')}<input id="col_from" className="input" type="date" value={pFrom} max={pTo || undefined} onChange={(e) => setPFrom(e.target.value)} /></label>
        <label>{L('Payment date to', 'تاريخ السداد إلى')}<input id="col_to" className="input" type="date" value={pTo} min={pFrom || undefined} onChange={(e) => setPTo(e.target.value)} /></label>
        {(pFrom || pTo) && <button type="button" className="rv-link" onClick={() => { setPFrom(''); setPTo(''); }}>{L('All payment dates', 'كل تواريخ السداد')}</button>}
      </div>
      {!col.available
        ? <div className="rp-limit rp-limit--warn" role="status"><b>{L('Not available from the source', 'غير متوفر من المصدر')}</b> — {L('the linked invoices carry payments, but none of them has evidence that it was collected through enforcement, so no amount is assumed (and zero is not assumed either).', 'على الفواتير المربوطة دفعات، لكن لا دليل في أي منها على أنها حُصّلت عبر التنفيذ، فلا يُفترض مبلغ (ولا يُفترض صفر).')}</div>
        : <>
          <div className="oj-bar" role="status"><b dir="ltr">{sar(col.total)}</b> · {L(`${col.count} payment(s) · ${col.invoices} invoice(s) · ${new Set(col.rows.flatMap((r) => ordersOf(r.invoiceId))).size} order(s)`, `${col.count} دفعة · ${col.invoices} فاتورة · ${new Set(col.rows.flatMap((r) => ordersOf(r.invoiceId))).size} أمر`)}</div>
          <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Contributing payments', 'الدفعات المساهمة')}>
            <thead><tr><th>{L('Order(s)', 'أمر التنفيذ')}</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Amanah', 'الأمانة')}</th><th>{L('Payment date', 'تاريخ السداد')}</th><th className="num">{L('Collected (SAR)', 'المحصل (ريال)')}</th><th>{L('Payment record', 'سجل الدفعة')}</th></tr></thead>
            <tbody>{col.rows.map((r) => (
              <tr key={r.paymentId}>
                <td dir="ltr">{ordersOf(r.invoiceId).map((o, i) => <span key={o}>{i > 0 && ' · '}<RecordLink to={orderPath(o)} dir="ltr">{reqNo.get(o)}</RecordLink></span>)}</td>
                <td><RecordLink to={invoicePath(r.invoiceId)} dir="ltr">{r.invoiceId}</RecordLink></td>
                <td>{ar ? r.amanahAr : r.amanahEn}</td><td dir="ltr">{r.date}</td><td className="num" dir="ltr">{sar(r.amount)}</td>
                <td style={{ fontSize: 12 }}><span dir="ltr">{r.paymentId}</span> {r.source === 'synthetic' ? <span className="rv-tag rv-tag--warn">{L('synthetic', 'اصطناعية')}</span> : <span className="rv-tag">{L('demo ledger', 'السجل التجريبي')}</span>}</td>
              </tr>))}
              {!col.rows.length && <tr><td colSpan={6} className="muted">{col.linkedInvoices ? L('No payment through enforcement is recorded for the linked invoices in this period.', 'لا دفعة عبر التنفيذ مسجلة للفواتير المربوطة في هذه الفترة.') : L('No invoice has a confirmed enforcement-order link yet.', 'لا فاتورة لها ربط مؤكد بأمر تنفيذ بعد.')}</td></tr>}
              {col.rows.length > 0 && <tr style={{ fontWeight: 700 }}><td colSpan={4}>{L('Total (each payment counted once, even when the invoice is linked to several orders)', 'الإجمالي (كل دفعة تُحتسب مرة واحدة ولو ربطت الفاتورة بعدة أوامر)')}</td><td className="num" dir="ltr">{sar(col.total)}</td><td /></tr>}</tbody>
          </table></div>
        </>}
      {col.notCounted?.count > 0 && <p className="muted" style={{ fontSize: 12 }}>{L(`Not counted: ${col.notCounted.count} payment(s) on the linked invoices (${sar(col.notCounted.amount)}) whose record does not show collection through enforcement (another channel, or no channel).`, `غير محتسبة: ${col.notCounted.count} دفعة على الفواتير المربوطة (${sar(col.notCounted.amount)}) لا يُظهر سجلها أنها حُصّلت عبر التنفيذ (قناة أخرى، أو بلا قناة).`)}</p>}
      <p className="muted" style={{ fontSize: 12 }}>{L('Definition: payment records (collection platform) whose channel is «enforcement», on invoices with a CONFIRMED order link; period = payment date. Order closure, invoice exclusion and the order amount are never used to infer collection. Attribution evidence in the real Tahseel feed is To Be Confirmed.', 'التعريف: سجلات سداد (منصة تحصيل) قناتها «تنفيذ»، على فواتير ذات ربط مؤكد بأمر؛ والفترة بتاريخ السداد. ولا يُستدل على التحصيل من إغلاق الأمر ولا من استبعاد الفاتورة ولا من مبلغ الأمر. ودليل الإسناد في تغذية تحصيل الفعلية بانتظار التأكيد.')}</p>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ «الكل»: one table, two record types (their counts are shown side by side, never summed) */
export function AllView() {
  const rev = useRevenue(); const sr = useSourceRecords(); const { L, B, sar, ar } = useL();
  const restore = useShouldRestore(); const mem = useMemo(() => readListMemory('enf-all', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [page, setPage] = useState(mem.page ?? 0);
  useEffect(() => { writeListMemory('enf-all', { page }); }, [page]);
  const sanadRows = useMemo(() => rev.cases.map((c) => { const comp = orderCompleteness(c); const review = reviewStatusOf(comp, c, orderExceptions(c)); return { type: 'sanad', key: c.enforceNum, id: c.source?.requestNo || c.enforceNum, sub: c.source?.claimNo ? `${L('Claim no.', 'رقم المطالبة')} ${c.source.claimNo}` : '', c, review, need: review !== 'complete', statuses: c.source?.statusText ? [c.source.statusText] : [], entity: c.amanahEn, muni: c.source?.municipality || '', amount: c.amount, blob: [c.enforceNum, c.source?.requestNo, ...(c.refs || []).map((x) => x.value), c.source?.invoiceNo].filter(Boolean).join(' ').toLowerCase() }; }), [rev.cases, ar]); // eslint-disable-line react-hooks/exhaustive-deps
  const eefaaRows = useMemo(() => sr.groups.map((g) => { const rel = sr.relations.byGroup.get(g.key); const serial = g.fields.serialNo?.value; return { type: 'eefaa', key: g.key, id: g.violationNo || g.records[0].keyValue, sub: serial ? `${L('Serial no.', 'الرقم التسلسلي')} ${serial}` : '', g, rel, need: eefaaNeedsReview(g, rel), statuses: sourceStatuses(g).map((s) => s.value), entity: entityOf(g), muni: cityOf(g), amount: g.fields.amount?.value ?? null, blob: [g.violationNo, g.records[0].keyValue, g.key, ...g.sadadNumbers].filter(Boolean).join(' ').toLowerCase() }; }), [sr.groups, sr.relations, ar]); // eslint-disable-line react-hooks/exhaustive-deps
  const everything = useMemo(() => [...sanadRows, ...eefaaRows], [sanadRows, eefaaRows]);
  const entities = useMemo(() => [...new Set(everything.map((r) => r.entity).filter(Boolean))].sort(), [everything]);
  const statuses = useMemo(() => [...new Set(everything.flatMap((r) => r.statuses))].sort(), [everything]);
  const fields = useMemo(() => enforcementFields('all', { entities: entities.map((x) => ({ value: x, label: amanahName(x, ar) })), statuses: statuses.map((x) => ({ value: x, label: x })) }), [entities, statuses, ar]);
  const F = useListFilters('all', fields, () => setPage(0)); const v = F.values;
  const all = useMemo(() => {
    const out = everything.filter((r) => allMatches(r, v));
    return v.sort === 'amount' ? [...out].sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1)) : out;
  }, [everything, v]);
  const view = all.slice(page * PAGE, (page + 1) * PAGE);
  useRestoreScroll(view.length > 0);
  const amountDef = `${L('Sanad: the claim amount of the request.', 'سند: مبلغ المطالبة في الطلب.')} ${L('Eefaa:', 'إيفاء:')} ${B(AMOUNT_DEFINITION)}`;
  return (
    <section className="rp-section" aria-label={L('All records', 'كل السجلات')}>
      <ListToolbar fields={fields} values={v} onChange={F.set} onClear={F.clear} onQ={(x) => F.set({ q: x })} qPlaceholder={L('Request, violation, Sadad or invoice number', 'رقم الطلب أو المخالفة أو السداد أو الفاتورة')}
        count={<><b>{all.filter((r) => r.type === 'sanad').length}</b> {L('Sanad requests', 'طلب سند')} · <b>{all.filter((r) => r.type === 'eefaa').length}</b> {L('Eefaa violations', 'مخالفة إيفاء')}</>}
        sort={{ value: v.sort, set: (x) => F.set({ sort: x }), options: sortOptions('all').map((o) => ({ value: o.value, label: B(o.label) })) }} />
      <div className="rp-tablewrap" tabIndex={0}><table className="ef-table" aria-label={L('All records', 'كل السجلات')}>
        <thead><tr><th>{L('Source', 'المصدر')}</th><th>{L('Identifier', 'المعرّف')}</th><th>{L('Source status (as written)', 'حالة المصدر (كما وردت)')}</th><th>{L('Amanah / municipality', 'الأمانة / البلدية')}</th><InfoTh num label={L('Amount', 'المبلغ')} def={amountDef} /><th>{L('Review', 'المراجعة')}</th><OpenTh /></tr></thead>
        <tbody>{view.map((r) => { const to = r.type === 'sanad' ? orderPath(r.key) : violationPath(r.key); return (
          <OpenRow key={`${r.type}-${r.key}`} to={to}>
            <td><SourceTag source={r.type} /></td>
            <td><div className="ef-id"><RecordLink to={to} dir="ltr"><b>{r.id}</b></RecordLink>{r.sub && <span className="ef-sub">{r.sub}</span>}</div></td>
            <td className="ef-status">{r.statuses.length ? r.statuses[0] : <span className="muted">—</span>}{r.statuses.length > 1 && <span className="ef-plus" title={r.statuses.join(' · ')} dir="ltr">+{r.statuses.length - 1}</span>}</td>
            <td>{amanahName(r.entity, ar)}{r.muni ? <span className="muted"> · {r.muni}</span> : null}</td>
            <td className="num" dir="ltr">{r.type === 'sanad' ? (r.amount != null ? sar(r.amount) : '—') : <EefaaAmount g={r.g} />}</td>
            <td>{r.type === 'sanad' ? <ReviewChip review={r.review} /> : <div className="ef-chips"><RelationChip status={r.rel?.status || 'unmatched'} conflicting={r.rel?.conflicting} /></div>}</td>
            <OpenCell to={to} id={r.id} />
          </OpenRow>); })}
          {!view.length && <EmptyRow cols={7}>{L('No record matches the filters.', 'لا سجل يطابق التصفية.')} <button type="button" className="rv-link" onClick={F.clear}>{L('Clear filters', 'مسح الفلاتر')}</button></EmptyRow>}</tbody>
      </table></div>
      <Pager page={page} total={all.length} size={PAGE} onPage={setPage} />
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ «إيفاء»: the Eefaa violations list */
export function EefaaView() {
  const rev = useRevenue(); const sr = useSourceRecords(); const { L, B, sar, ar } = useL();
  const restore = useShouldRestore(); const mem = useMemo(() => readListMemory('enf-eefaa', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [page, setPage] = useState(mem.page ?? 0);
  useEffect(() => { writeListMemory('enf-eefaa', { page }); }, [page]);
  const rel = sr.relations.byGroup;
  const rows = useMemo(() => sr.groups.map((g) => { const r = rel.get(g.key); return { g, r, st: sourceStatuses(g), ent: entityOf(g), need: eefaaNeedsReview(g, r), basis: g.execution.basis, relStatus: r?.status, conflicting: !!r?.conflicting, reports: g.reports, hasConflicts: g.conflicts.length > 0, damaged: g.flags.some((f) => f.startsWith('damaged_identifier') || f === 'key_from_alternate'), amount: g.fields.amount?.value ?? null,
    blob: [g.violationNo, g.fields.serialNo?.value, g.fields.businessRef?.value, ...g.sadadNumbers, ...g.records.map((x) => x.keyValue)].filter(Boolean).join(' ').toLowerCase() }; }), [sr.groups, rel]);
  const statuses = useMemo(() => [...new Set(rows.flatMap((x) => x.st.map((s) => s.value)))].sort(), [rows]);
  const ents = useMemo(() => [...new Set(rows.map((x) => x.ent).filter(Boolean))].sort(), [rows]);
  const fields = useMemo(() => enforcementFields('eefaa', {
    entities: ents.map((x) => ({ value: x, label: x })), statuses: statuses.map((x) => ({ value: x, label: x })),
    executionBases: Object.entries(EXECUTION_BASIS).map(([k, x]) => ({ value: k, label: x })),
    mumtathil: [['linked', RELATION_STATUS.proposed], ['ambiguous', RELATION_STATUS.ambiguous], ['unmatched', RELATION_STATUS.unmatched], ['conflicting', { ar: 'قيم متعارضة', en: 'Conflicting values' }]].map(([value, label]) => ({ value, label })),
    reports: REPORTS.filter((x) => x.source === 'eefaa').map((x) => ({ value: x.id, label: x.label }))
  }), [ents, statuses]);
  const F = useListFilters('eefaa', fields, () => setPage(0)); const v = F.values;
  const shown = useMemo(() => {
    const out = rows.filter((r) => eefaaMatches(r, v));
    return v.sort === 'amount' ? [...out].sort((a, b) => (b.g.fields.amount?.value ?? -1) - (a.g.fields.amount?.value ?? -1)) : out;
  }, [rows, v]);
  useRestoreScroll(shown.length > 0);
  const view = shown.slice(page * PAGE, (page + 1) * PAGE);
  // invoice candidates by Sadad number (exact), for the rows on screen: shown as CANDIDATES with their evidence — a link is only made by a reviewer on the details page
  const asked = useMemo(() => [...new Set(view.flatMap((x) => x.g.sadadNumbers))].map((v) => ({ kind: 'sadad_no', value: String(v) })), [view]);
  const askKey = asked.map((x) => x.value).join('|');
  const { data: resolved } = useAsync(() => (asked.length ? rev.enforcement.resolve(asked) : Promise.resolve({ results: [] })), [askKey, rev.dataVersion]);
  const byValue = useMemo(() => new Map((resolved?.results || []).map((x) => [x.ref?.value || x.value, x])), [resolved]);
  const COLS = 8;
  return (
    <section className="rp-section" aria-label={L('Eefaa violations', 'مخالفات إيفاء')}>
      <details className="ef-note" style={{ marginBlockEnd: 8 }}>
        <summary>{L('An Eefaa violation is a violation record, not an enforcement order.', 'مخالفة إيفاء سجل مخالفة وليست أمر تنفيذ.')} <b>{L('Details', 'تفاصيل')}</b></summary>
        <div className="ef-note__body"><p>{L('An Eefaa violation is a violation record — not an enforcement order. Execution evidence is shown only where a source report states it; nothing here declares a violation eligible for execution. Rows from different reports are grouped only by an EQUAL candidate violation number, which is not a confirmed identity.', 'مخالفة إيفاء سجل مخالفة وليست أمر تنفيذ. ويُعرض دليل التنفيذ فقط حيث يذكره تقرير مصدري؛ ولا يُعلن هنا أن أي مخالفة قابلة للتنفيذ. وتُجمَّع صفوف التقارير المختلفة فقط عند تساوي رقم المخالفة المرشّح، وهو ليس هوية مؤكدة.')}</p></div>
      </details>
      <ListToolbar fields={fields} values={v} onChange={F.set} onClear={F.clear} onQ={(x) => F.set({ q: x })} qPlaceholder={L('Violation, serial, reference or Sadad number', 'رقم المخالفة أو التسلسلي أو المرجع أو السداد')}
        count={<><b>{shown.length}</b> {L('violations', 'مخالفة')}</>} sort={{ value: v.sort, set: (x) => F.set({ sort: x }), options: sortOptions('eefaa').map((o) => ({ value: o.value, label: B(o.label) })) }} />
      <div className="rp-tablewrap" tabIndex={0}><table className="ef-table" aria-label={L('Eefaa violations', 'مخالفات إيفاء')}>
        <thead><tr><th>{L('Violation no.', 'رقم المخالفة')}</th><th>{L('Source status (as written)', 'حالة المصدر (كما وردت)')}</th><th>{L('Entity · city', 'الجهة · المدينة')}</th><InfoTh num label={L('Violation amount', 'قيمة المخالفة')} def={B(AMOUNT_DEFINITION)} /><th>{L('Execution', 'التنفيذ')}</th><th>{L('Mumtathil', 'ممتثل')}</th><InfoTh label={L('Candidate invoices', 'الفواتير المرشحة')} def={L('Invoices matched by an exact Sadad number. They are candidates only: a link is made by a reviewer on the details page.', 'فواتير مطابقة برقم سداد مطابق تماماً. وهي مرشحة فقط: يُنشأ الربط بيد مراجع في صفحة التفاصيل.')} /><OpenTh /></tr></thead>
        <tbody>{view.map(({ g, r, st: sts, ent }) => { const to = violationPath(g.key); const no = g.violationNo || g.records[0].keyValue; const serial = g.fields.serialNo?.value; return (
          <OpenRow key={g.key} to={to}>
            <td title={`${L('Reports', 'التقارير')}: ${g.reports.map((id) => B(reportById(id).label)).join(' · ')} — ${g.methods.map((m) => B(METHODS[m])).join(' + ')} · ${when(g.lastImportedAt)}`}><div className="ef-id"><RecordLink to={to} dir="ltr"><b>{no}</b></RecordLink>
              <span className="ef-sub">{serial ? `${L('Serial no.', 'الرقم التسلسلي')} ${serial}` : (g.violationNo ? g.records[0].fields.violationNo.label : g.records[0].keyLabel)}{g.flags.includes('key_from_alternate') ? ` · ${L('alternate key', 'مفتاح بديل')}` : ''}</span>
              {g.flags.some((f) => f.startsWith('damaged_identifier')) && <span><Chip tone="bad">{L('damaged identifier', 'معرّف تالف')}</Chip></span>}</div></td>
            <td className="ef-status">{sts.length ? <><span>{sts[0].value}</span>{sts.length > 1 && <span className="ef-plus" dir="ltr" title={sts.map((s) => `${s.value} · ${s.label}`).join('\n')}>+{sts.length - 1}</span>}</> : <span className="muted">—</span>}</td>
            <td>{ent || '—'}{cityOf(g) ? <span className="muted"> · {cityOf(g)}</span> : null}</td>
            <td className="num"><EefaaAmount g={g} /></td>
            <td><div className="ef-chips"><ExecChip basis={g.execution.basis} />{g.referableListed && <Chip tone="muted">{L('listed as referable by the source', 'مدرجة كقابلة للتنفيذ في المصدر')}</Chip>}</div></td>
            <td><div className="ef-chips"><RelationChip status={r?.status || 'unmatched'} conflicting={r?.conflicting} /></div></td>
            <td style={{ fontSize: 12 }}>{g.sadadNumbers.length ? g.sadadNumbers.map((sd) => { const hit = byValue.get(String(sd)); const c = hit?.candidates || []; return <div key={sd} dir="ltr">{c.length === 1 ? <RecordLink to={invoicePath(c[0].invoiceId)}>{c[0].invoiceId}</RecordLink> : c.length > 1 ? <span>{c.length} {L('candidates', 'مرشحة')}</span> : <span className="muted">{sd} · {L('no demo invoice', 'لا فاتورة')}</span>}</div>; }) : <span className="muted">{L('no Sadad number in the imported reports', 'لا رقم سداد في التقارير المستوردة')}</span>}</td>
            <OpenCell to={to} id={no} />
          </OpenRow>); })}
          {!view.length && <EmptyRow cols={COLS}>{sr.groups.length ? <>{L('No violation matches the filters.', 'لا مخالفة تطابق التصفية.')} <button type="button" className="rv-link" onClick={F.clear}>{L('Clear filters', 'مسح الفلاتر')}</button></> : L('No Eefaa records imported yet. Open «Data import» to load the synthetic demo data or import an Excel file.', 'لا سجلات إيفاء مستوردة بعد. افتح «استيراد البيانات» لتحميل البيانات التجريبية أو استيراد ملف إكسل.')}</EmptyRow>}</tbody>
      </table></div>
      <Pager page={page} total={shown.length} size={PAGE} onPage={setPage} />
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ where the data comes from */
// The records are read directly from the Data Bank (no file upload). In the demo synthetic records stand in for that read; the last read time is the latest batch.
export function DataSourceNote() {
  const sr = useSourceRecords(); const { L, B } = useL();
  const last = sr.batches[0]?.at;
  return (
    <details className="ef-note">
      <summary><Chip tone="muted">{B(METHODS.data_bank)}</Chip> <span className="muted">{last ? `${L('Last read', 'آخر قراءة')}: ${when(last)}` : L('Reading…', 'جارٍ القراءة…')}</span> <b>{L('Details', 'تفاصيل')}</b></summary>
      <p>{L('Sanad requests, Eefaa violations and Mumtathil records are read directly from the Data Bank; nothing is uploaded or edited by hand. In this demo, synthetic records stand in for that read (labelled «Synthetic demo data»). Until the Data Bank field names are confirmed, the mapping follows the report layouts already analysed (To Be Confirmed).', 'تُقرأ طلبات سند ومخالفات إيفاء وسجلات ممتثل مباشرةً من بنك البيانات؛ ولا يُرفع ملف ولا تُعدَّل يدوياً. وفي هذا العرض التجريبي تحلّ سجلات اصطناعية محل هذه القراءة (موسومة «بيانات تجريبية اصطناعية»). وإلى حين تأكيد أسماء حقول بنك البيانات يتبع الربط تخطيطات التقارير التي حُلِّلت (بانتظار التأكيد).')}</p>
    </details>
  );
}
