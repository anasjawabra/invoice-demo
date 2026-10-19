import React, { useEffect, useMemo, useState } from 'react';
import { useAsync } from '../utils/useAsync';
import Pager from '../components/Pager';
import { Navigate, useSearchParams } from 'react-router-dom';
import { RecordLink, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { contractPath } from '../utils/paths';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { ProvenanceBadge } from '../components/revenue/RevenueUI';
import { PctBadge } from '../components/strategic/EntityMap';
import { INSTALLMENT_STATES } from '../data/contracts';
import { AMANAH_CATALOG, ENTITIES, ITEMS } from '../data/catalog';

export const amanahName = (en, ar) => { const a = (ENTITIES || AMANAH_CATALOG).find((x) => x.en === en); return a ? (ar ? a.ar : a.en) : en; };
export const itemName = (key, ar) => { const i = ITEMS.find((x) => x.key === key); return i ? (ar ? i.ar : i.en) : key; };

export default function Contracts() {
  const rev = useRevenue();
  const { L, B, ar, short, money, count, sar } = useL();
  const [sp] = useSearchParams();
  const restore = useShouldRestore();
  const mem = useMemo(() => readListMemory('contracts', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [filter, setFilter] = useState(mem.filter ?? 'all');
  const [q, setQ] = useState(mem.q ?? '');
  const [page, setPage] = useState(mem.page ?? 0);
  useEffect(() => { writeListMemory('contracts', { filter, q, page }); }, [filter, q, page]);
  const PS = 25;
  const scopeReq = useMemo(() => ({ amanah: rev.scopeEff.amanah, source: 'investment', from: '2000-01-01', to: rev.cfg.cutoff }), [rev.scopeEff.amanah, rev.cfg.cutoff]);
  // contract cards (aggregates per contract; the payment schedule is loaded only for the contract opened)
  const { data: cd } = useAsync(() => rev.data.contracts(scopeReq), [rev.data, scopeReq]);
  const visible = cd?.cards || [];
  const roll = cd?.rollup || { contracts: 0, multiPayment: 0 };
  const list = useMemo(() => visible.filter((c) => {
    if (q && !`${c.contractNo} ${c.tenantAr} ${c.tenantEn}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'arrears') return c.totals.arrears > 0;
    if (filter === 'future') return c.totals.futureInstallments > 0;
    return true;
  }).sort((a, b) => b.totals.arrears - a.totals.arrears), [visible, q, filter]);
  const firstRun = React.useRef(true);
  useEffect(() => { if (firstRun.current) { firstRun.current = false; return; } setPage(0); }, [q, filter]);
  useRestoreScroll(visible.length > 0);

  if (sp.get('no')) return <Navigate to={contractPath(sp.get('no'))} replace />; // the old «?no=» address of the former inline panel

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Investment contracts', 'العقود الاستثمارية')}</h1>
          <div className="page-sub">{L('Investment contracts and the payments linked to them only: how much was paid, what is overdue, what is invoiced but not yet due, and what is still to come.', 'العقود الاستثمارية والدفعات المرتبطة بها فقط: كم دُفع، وما المتأخر، وما فُوتر ولم يحن استحقاقه، وما هو قادم.')}</div>
        </div>
      </div>

      <div className="rv-tiles">
        <div className="rv-tile"><div className="rv-tile__label">{L('Contracts', 'العقود')}</div><div className="rv-tile__value">{count(visible.length)}</div><div className="rv-tile__sub">{roll.multiPayment} {L('with several payments', 'متعددة الدفعات')}</div></div>
        <div className="rv-tile"><div className="rv-tile__label">{L('Collected on the payments', 'المحصّل من الدفعات')}</div><div className="rv-tile__value">{short(visible.reduce((s, c) => s + c.totals.collected, 0))}</div><div className="rv-tile__sub">{L('of the contracts’ payments up to today', 'من دفعات العقود حتى اليوم')}</div></div>
        <div className="rv-tile rv-tile--bad"><div className="rv-tile__label">{L('Overdue installments', 'دفعات متأخرة')}</div><div className="rv-tile__value">{short(visible.reduce((s, c) => s + c.totals.arrears, 0))}</div></div>
        <div className="rv-tile"><div className="rv-tile__label">{L('Invoiced, not yet due', 'مفوترة لم يحن استحقاقها')}</div><div className="rv-tile__value">{short(visible.reduce((s, c) => s + c.totals.notDue, 0))}</div></div>
        <div className="rv-tile"><div className="rv-tile__label">{L('Future installments (not arrears)', 'دفعات مستقبلية (ليست متأخرات)')}</div><div className="rv-tile__value">{short(visible.reduce((s, c) => s + c.totals.futureNotInvoiced, 0))}</div><div className="rv-tile__sub">{L('not invoiced yet', 'لم تُفوتر بعد')}</div></div>
      </div>

      <div className="card card-pad">
        <div className="rv-form">
          <label>{L('Search', 'بحث')}<input id="ct_q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Contract number or tenant', 'رقم العقد أو المستأجر')} /></label>
          <label>{L('Show', 'عرض')}
            <select id="ct_f" className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">{L('All contracts', 'كل العقود')}</option>
              <option value="arrears">{L('With overdue installments', 'بدفعات متأخرة')}</option>
              <option value="future">{L('With future installments', 'بدفعات مستقبلية')}</option>
            </select>
          </label>
        </div>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table">
            <thead><tr><th>{L('Contract', 'العقد')}</th><th>{L('Tenant', 'المستأجر')}</th><th>{L('Amanah', 'الأمانة / الجهة')}</th><th className="num">{L('Value', 'القيمة')}</th><th className="num">{L('Collected', 'المحصل')}</th><th className="num">{L('Collected of what is due', 'المحصّل من المستحق')}</th><th className="num">{L('Overdue', 'المتأخر')}</th><th>{L('Payments', 'الدفعات')}</th></tr></thead>
            <tbody>
              {list.slice(page * PS, (page + 1) * PS).map((c) => (
                <tr key={c.contractNo}>
                  <td><RecordLink to={contractPath(c.contractNo)} dir="ltr">{c.contractNo}</RecordLink></td>
                  <td dir="auto">{ar ? c.tenantAr : c.tenantEn}</td>
                  <td>{amanahName(c.amanahEn, ar)}</td>
                  <td className="num">{short(c.totals.contractValue)}</td>
                  <td className="num">{short(c.totals.collected)}</td>
                  <td className="num">{c.totals.dueToDate > 0 ? <PctBadge v={c.totals.collected / c.totals.dueToDate} text={`${(Math.round((c.totals.collected / c.totals.dueToDate) * 1000) / 10).toFixed(1)}%`} /> : '—'}</td>
                  <td className="num">{c.totals.arrears ? <b className="rv-neg">{short(c.totals.arrears)}</b> : '—'}</td>
                  <td>{L(`${c.totals.installments} in all · ${c.totals.overdueInstallments} overdue · ${c.totals.futureInstallments} to come`, `${c.totals.installments} دفعة · ${c.totals.overdueInstallments} متأخرة · ${c.totals.futureInstallments} قادمة`)}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={8}><div className="rv-empty">{L('No contract matches.', 'لا عقد مطابق.')}</div></td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={list.length} size={PS} onPage={setPage} />
      </div>

    </div>
  );
}
