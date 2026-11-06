import React, { useEffect, useMemo, useState } from 'react';
import Pager from '../components/Pager';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { orderCompleteness, orderExceptions } from '../data/orderMatching';
import { reviewStatusOf, orderAlerts, orderSearchBlob, normalizeSearch } from '../data/orderSummary';
import { SOURCE_STATUSES, DEBTOR_TYPES } from '../data/sanadSource';
import { RecordLink, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { orderPath } from '../utils/paths';
import { amanahName } from '../data/catalog';
import { loadDocsIndex, documentState } from '../data/sanadDocs/service';
import { DocChip, ReviewChip, ListToolbar, useListFilters, OpenRow, OpenCell, OpenTh, InfoTh, EmptyRow, when } from '../components/revenue/EnforcementSources';
import { METHODS, SOURCES } from '../data/ingestion/reports';
import { enforcementFields, sanadMatches, sortOptions } from '../components/filters/localPages';
import '../styles/enforcement-lists.css';

const PAGE = 25;

// The ORDERS list of «إدارة أوامر التنفيذ» — the main working area: one row per Sanad ENFORCEMENT REQUEST, the original source status, linked invoices and ONE matching-review status (with small alerts).
// Toolbar: Amanah / entity · Sanad request status · matching review (ONE control: «needs action» is one of its options) · search; «المزيد من الفلاتر»: debtor type, review reason, document,
// reconciliation, referral date (from / to). The filters live in the URL, so opening a request and coming back keeps them.
export default function OrdersView() {
  const { cases } = useRevenue();
  const { L, B, sar, ar } = useL();
  const restore = useShouldRestore();
  const mem = useMemo(() => readListMemory('orders', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [page, setPage] = useState(mem.page ?? 0);
  useEffect(() => { writeListMemory('orders', { page }); }, [page]);

  const [docsIdx, setDocsIdx] = useState(null);
  useEffect(() => { let off = false; loadDocsIndex().then((m) => { if (!off) setDocsIdx(m); }).catch(() => { if (!off) setDocsIdx(new Map()); }); return () => { off = true; }; }, []);
  const rows = useMemo(() => cases.map((c) => {
    const comp = orderCompleteness(c); const ex = orderExceptions(c);
    return { c, comp, ex, review: reviewStatusOf(comp, c, ex), alerts: orderAlerts(comp, ex), blob: orderSearchBlob(c) };
  }), [cases]);
  const amanahs = useMemo(() => [...new Set(cases.map((c) => c.amanahEn))].sort(), [cases]);
  const usedStatuses = useMemo(() => SOURCE_STATUSES.filter((x) => rows.some((r) => r.c.source?.statusId === x.id)), [rows]);
  const fields = useMemo(() => enforcementFields('sanad', {
    entities: amanahs.map((x) => ({ value: x, label: amanahName(x, ar) })), statuses: usedStatuses.map((x) => ({ value: String(x.id), label: x.text })), debtorTypes: DEBTOR_TYPES.map((x) => ({ value: String(x.id), label: x.text }))
  }), [amanahs, usedStatuses, ar]);
  const F = useListFilters('sanad', fields, () => setPage(0)); const v = F.values;
  const shown = useMemo(() => {
    const out = rows.filter((r) => sanadMatches(r, v, normalizeSearch));
    const key = { recent: (r) => -(Date.parse(String(r.c.source?.raiseAt || r.c.openedDate).replace(' ', 'T')) || 0), amount: (r) => -(r.c.amount || 0), request: (r) => Number(r.c.source?.requestNo) || 0 }[v.sort] || ((r) => 0);
    return out.sort((a, b) => key(a) - key(b));
  }, [rows, v]);
  const view = shown.slice(page * PAGE, (page + 1) * PAGE);
  useRestoreScroll(view.length > 0);

  return (
    <section className="rp-section" aria-label={L('Enforcement requests', 'طلبات التنفيذ')}>
      <ListToolbar fields={fields} values={v} onChange={F.set} onClear={F.clear} onQ={(x) => F.set({ q: x })} qPlaceholder={L('Request, claim or invoice number', 'رقم الطلب أو المطالبة أو الفاتورة')}
        count={<><b>{shown.length}</b> {L('requests', 'طلب')}</>} sort={{ value: v.sort, set: (x) => F.set({ sort: x }), options: sortOptions('sanad').map((o) => ({ value: o.value, label: B(o.label) })) }} />
      <div className="rp-tablewrap" tabIndex={0}>
        <table className="ef-table" aria-label={L('Enforcement requests', 'طلبات التنفيذ')}>
          <thead><tr><th>{L('Request no.', 'رقم الطلب')}</th><th>{L('Amanah · municipality', 'الأمانة · البلدية')}</th><th>{L('Source status', 'حالة الطلب في سند')}</th><InfoTh num label={L('Amount', 'المبلغ')} def={L('The claim amount stated in the Sanad request (not an outstanding balance, not an invoice amount).', 'مبلغ المطالبة المذكور في طلب سند (ليس رصيداً مستحقاً ولا مبلغ فاتورة).')} /><th className="num">{L('Linked invoices', 'الفواتير المربوطة')}</th><th>{L('Sanad document', 'مستند سند')}</th><th>{L('Matching review', 'مراجعة المطابقة')}</th><OpenTh /></tr></thead>
          <tbody>
            {view.map(({ c, comp, review, alerts }) => { const sc = c.source || {}; const no = sc.requestNo || c.enforceNum; const to = orderPath(c.enforceNum); return (
              <OpenRow key={c.enforceNum} to={to}>
                <td title={`${L('Ingestion · last import', 'طريقة الاستيراد · آخر استيراد')}: ${c.ingestion ? `${B(SOURCES.sanad)} / ${B(METHODS[c.ingestion.method])} · ${when(c.ingestion.importedAt)}` : L('Synthetic demo feed (generated)', 'تغذية تجريبية (مولّدة)')}`}><div className="ef-id"><RecordLink to={to} dir="ltr"><b>{no}</b></RecordLink>{sc.claimNo && <span className="ef-sub">{L('Claim no.', 'رقم المطالبة')} <span dir="ltr">{sc.claimNo}</span></span>}</div></td>
                <td>{amanahName(c.amanahEn, ar)}{sc.municipality ? <span className="muted"> · {sc.municipality}</span> : null}</td>
                <td className="ef-status">{sc.statusText || '—'}</td>
                <td className="num" dir="ltr">{sar(c.amount)}</td>
                <td className="num">{comp.references.confirmedLinks || <span className="muted">—</span>}</td>
                <td><DocChip state={docsIdx ? documentState(c, docsIdx) : 'missing'} /></td>
                <td><ReviewChip review={review} />{alerts.length > 0 && <div className="oj-alerts">{alerts.map((a) => <span key={a.key} className="oj-alert" title={B(a.why)}>⚠ {B(a)}</span>)}</div>}</td>
                <OpenCell to={to} id={no} />
              </OpenRow>); })}
            {!view.length && <EmptyRow cols={8}>{L('No requests match these filters.', 'لا توجد طلبات مطابقة.')} {rows.length > 0 && <button type="button" className="rv-link" onClick={F.clear}>{L('Clear filters', 'مسح الفلاتر')}</button>}</EmptyRow>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={shown.length} size={PAGE} onPage={setPage} />
    </section>
  );
}
