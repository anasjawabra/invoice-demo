import React, { useMemo, useState } from 'react';
import Pager from '../components/Pager';
import { Link, useNavigate } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { MetricTile } from '../components/revenue/RevenueUI';
import { caseSummary } from '../data/enforcementMatching';
import { SUMMARY_TO_MATCH, MatchStateBadge, OrderStatusChip, REASON_LABEL, IntegrationNotice } from '../components/revenue/EnforcementUI';
import { orderStatusOf } from '../data/orderMatching';

const PAGE = 25;

// Enforcement orders (Sanad is the source). An order can cover ONE OR MANY invoices of ANY revenue type; its state is matched only when every
// reference is accounted for AND the amounts reconcile — anything less is shown as partial.
export default function SanadOrders() {
  const { cases } = useRevenue();
  const { L, B, short, sar, count: fmt } = useL();
  const nav = useNavigate();
  const [page, setPage] = useState(0);
  const [fState, setFState] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [q, setQ] = useState('');

  const rows = useMemo(() => cases.map((c) => { const s = caseSummary(c); return { c, s, match: SUMMARY_TO_MATCH[s.state], status: orderStatusOf(c) }; }), [cases]);
  const count = (m) => rows.filter((r) => r.match === m).length;
  const notCovered = rows.reduce((a, r) => a + (r.match === 'matched' ? 0 : r.s.unallocated), 0);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (fState === 'all' || r.match === fState) && (fStatus === 'all' || r.status === fStatus) && (!t || r.c.enforceNum.toLowerCase().includes(t) || `${r.c.debtorName?.ar || ''} ${r.c.debtorName?.en || r.c.debtorName || ''}`.toLowerCase().includes(t) || (r.c.debtorId || '').includes(t)));
  }, [rows, fState, fStatus, q]);
  const view = shown.slice(page * PAGE, (page + 1) * PAGE);

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Enforcement orders — matching to invoices', 'أوامر الإنفاذ — مطابقتها مع الفواتير')}</h1>
          <div className="page-sub">{L('An enforcement order from Sanad can cover one or several invoices of any revenue type (not only contracts). Invoice references come from Sanad and from the order document; an amount alone never creates a match. Nothing counts on an invoice until a person confirms the link, and a partial match is always shown as partial.', 'قد يشمل أمر الإنفاذ الصادر من سند فاتورة واحدة أو عدة فواتير من أي نوع إيراد (وليس العقود فقط). تأتي مراجع الفواتير من سند ومن مستند الأمر؛ والمبلغ وحده لا يُنشئ مطابقة. ولا يُحتسب شيء على الفاتورة قبل أن يؤكد شخص الربط، ويُعرض التطابق الجزئي دائماً كجزئي.')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/noncollection')}>{L('Noncollection & exclusions', 'عدم التحصيل والاستبعادات')}</button>
        </div>
      </div>

      <IntegrationNotice />

      <div className="rv-tiles">
        <MetricTile label={L('Orders', 'الأوامر')} value={fmt(rows.length)} />
        <MetricTile label={L('Fully matched', 'مطابقة بالكامل')} value={fmt(count('matched'))} sub={L('every reference accounted for and amounts reconcile', 'كل المراجع محسومة والمبالغ متطابقة')} />
        <MetricTile label={L('Partially matched', 'مطابقة جزئياً')} value={fmt(count('partial'))} tone={count('partial') ? 'warn' : undefined} sub={L('something is confirmed but the order is not complete', 'يوجد ما هو مؤكد لكن الأمر غير مكتمل')} />
        <MetricTile label={L('Awaiting review', 'بانتظار المراجعة')} value={fmt(count('awaiting_review'))} tone={count('awaiting_review') ? 'warn' : undefined} />
        <MetricTile label={L('Not matched', 'غير مطابقة')} value={fmt(count('unmatched'))} />
        <MetricTile label={L('Order amount not covered by a confirmed invoice', 'مبلغ الأوامر غير المغطى بفاتورة مؤكدة')} value={short(notCovered)} sub={L('reported separately — never added to the debt and never spread across invoices', 'يُعرض منفصلاً — لا يُضاف إلى المديونية ولا يُوزَّع على الفواتير')} />
      </div>

      <div className="card card-pad">
        <div className="rv-form" style={{ marginBottom: 10 }}>
          <label>{L('Match state', 'حالة المطابقة')}
            <select className="input" value={fState} onChange={(e) => { setFState(e.target.value); setPage(0); }}>
              <option value="all">{L('All', 'الكل')}</option>
              {['matched', 'partial', 'awaiting_review', 'unmatched'].map((k) => <option key={k} value={k}>{L({ matched: 'Fully matched', partial: 'Partially matched', awaiting_review: 'Awaiting review', unmatched: 'Not matched' }[k], { matched: 'مطابق بالكامل', partial: 'مطابق جزئياً', awaiting_review: 'بانتظار المراجعة', unmatched: 'غير مطابق' }[k])}</option>)}
            </select>
          </label>
          <label>{L('Order status (Sanad)', 'حالة الأمر (سند)')}
            <select className="input" value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(0); }}>
              <option value="all">{L('All', 'الكل')}</option>
              <option value="open">{L('In execution', 'قيد التنفيذ')}</option>
              <option value="suspended">{L('Suspended', 'موقوف')}</option>
              <option value="closed">{L('Closed', 'مغلق')}</option>
            </select>
          </label>
          <label style={{ flex: 1, minWidth: 220 }}>{L('Search order number or debtor', 'بحث برقم الأمر أو المدين')}
            <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="EN-5013" dir="auto" />
          </label>
        </div>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table">
            <thead><tr><th>{L('Order', 'الأمر')}</th><th>{L('Amanah', 'الأمانة')}</th><th>{L('Debtor', 'المدين')}</th><th className="num">{L('Order amount', 'مبلغ الأمر')}</th><th>{L('Order status (Sanad)', 'حالة الأمر (سند)')}</th><th>{L('Match state', 'حالة المطابقة')}</th><th className="num">{L('Invoices confirmed / proposed', 'فواتير مؤكدة / مقترحة')}</th><th className="num">{L('Difference', 'الفرق')}</th><th><span className="sr-only">{L('Action', 'إجراء')}</span></th></tr></thead>
            <tbody>
              {view.map(({ c, s, match, status }) => (
                <tr key={c.enforceNum}>
                  <td dir="ltr"><b>{c.enforceNum}</b><div className="muted" style={{ fontSize: 11 }}>{c.system === 'sanad' ? 'Sanad' : c.system === 'white_lands' ? L('White-lands file', 'ملف الأراضي البيضاء') : 'Efaa'}{c.contractNo ? ` · ${c.contractNo}` : ''}</div></td>
                  <td>{c.amanahEn}</td>
                  <td dir="auto">{B(c.debtorName) || '—'}</td>
                  <td className="num" dir="ltr">{sar(c.amount)}</td>
                  <td><OrderStatusChip status={status} /></td>
                  <td>
                    <MatchStateBadge state={match} />
                    {s.reasons.length > 0 && match !== 'unmatched' && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{s.reasons.map((r) => B(REASON_LABEL[r])).join(' · ')}</div>}
                    {match === 'unmatched' && c.contractNo && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{L('contract level — invoices not identified', 'على مستوى العقد — الفواتير غير محددة')}</div>}
                  </td>
                  <td className="num">{s.confirmed} / {s.candidates}</td>
                  <td className="num" dir="ltr">{s.difference == null ? '—' : s.confirmed || s.candidates ? sar(s.difference) : '—'}</td>
                  <td><Link className="btn btn-sm btn-primary" to={`/sanad-orders/${encodeURIComponent(c.enforceNum)}`}>{L('Open', 'فتح')}</Link></td>
                </tr>
              ))}
              {!view.length && <tr><td colSpan={9} className="rv-empty">{L('No orders match this filter.', 'لا توجد أوامر مطابقة لهذا المرشح.')}</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={shown.length} size={PAGE} onPage={setPage} />
      </div>
    </div>
  );
}
