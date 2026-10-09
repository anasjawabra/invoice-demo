import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useL, ratioText } from '../../utils/bi';
import { BRIDGE_LABELS } from '../../data/bridgeLabels';
import { explainChange } from '../../data/changeExplanation';
import { useRevenue } from '../../context/RevenueContext';
import { useAsync } from '../../utils/useAsync';
import { pickBi } from '../../data/revenueInsights';
import { RULE_APPROVAL_LABEL } from '../../data/ruleRegistry';

/* ------------------------------------------------------------------ Bridge
   Unpaid-report figure → reconciliation differences → cancelled → excluded →
   net uncollected. Unmatched report rows are listed APART (never in the net). */
export function UncollectedBridge({ bridge, stock }) {
  const { L, B, short, money, ar, count } = useL();
  const max = Math.max(...bridge.steps.map((s) => Math.abs(s.amount)), bridge.net, 1);
  let running = 0;
  const rows = bridge.steps.map((s) => {
    const start = s.kind === 'start' ? 0 : running;
    running = s.kind === 'start' ? s.amount : running + s.amount;
    return { ...s, start, end: running };
  });
  const exc = bridge.steps.find((s) => s.key === 'excluded');
  const canc = bridge.steps.find((s) => s.key === 'cancelled');
  const ok = Math.abs(bridge.check) < 0.5;
  return (
    <div className="card card-pad rv-bridge" aria-label={L('Net uncollected bridge', 'جسر الرصيد القائم')}>
      <div className="rv-card__head">
        <div>
          <h3 className="rv-sec-title">{L('Net-uncollected bridge', 'جسر الرصيد القائم')}</h3>
          <p className="rv-sec-sub">{L(`From the unpaid report (${bridge.reportDate}) to the details report (${bridge.detailsDate}). The report repeats the invoice value on every line, so lines are collapsed to one row per invoice first.`, `من تقرير غير المسدد (${bridge.reportDate}) إلى بيان التفاصيل (${bridge.detailsDate}). يكرر التقرير قيمة الفاتورة في كل بند لذا تُجمع البنود أولاً في صف واحد لكل فاتورة.`)}</p>
        </div>
        <span className={`rv-badge rv-badge--sm ${ok ? 'rv-badge--good' : 'rv-badge--bad'}`}>{ok ? L('Reconciled', 'مطابق حسابياً') : L('Does not reconcile', 'غير مطابق')}</span>
      </div>
      <div className="rv-bridge__rows" role="table">
        <div className="rv-bridge__row rv-bridge__row--ref" role="row">
          <span role="cell">{L('Report lines (as printed, value repeated)', 'بنود التقرير (كما طُبعت، القيمة مكررة)')}</span>
          <span className="rv-bridge__track" aria-hidden="true"><i style={{ width: `${Math.min(100, (bridge.naiveSum / (bridge.naiveSum || 1)) * 100)}%`, opacity: 0.35 }} /></span>
          <span role="cell" className="rv-bridge__val" dir="ltr">{short(bridge.naiveSum)}</span>
          <small className="muted" role="cell">{L(`${count(bridge.lineCount)} lines — NOT a debt figure`, `${count(bridge.lineCount)} بنداً — ليس رقم مديونية`)}</small>
        </div>
        {rows.map((s) => {
          const left = (Math.min(s.start, s.end) / max) * 100;
          const width = (Math.abs(s.end - s.start) / max) * 100;
          const sub = s.key === 'excluded' && s.detail
            ? L(`approved rules ${short(s.detail.approvedRules)} · UNAPPROVED rules ${short(s.detail.unapprovedRules)}`, `قواعد معتمدة ${short(s.detail.approvedRules)} · قواعد غير معتمدة ${short(s.detail.unapprovedRules)}`)
            : s.key === 'cancelled' && s.detail?.overlapCount
              ? L(`${s.detail.overlapCount} also carry an exclusion reason (${short(s.detail.overlapNotDeductedAgain)}) — deducted once, here`, `${s.detail.overlapCount} لها سبب استبعاد أيضاً (${short(s.detail.overlapNotDeductedAgain)}) — تُخصم مرة واحدة هنا`)
              : s.key === 'reconciliation' && s.detail
                ? L(`payments ${short(s.detail.payments)} · credit notes ${short(s.detail.creditNotes)}`, `سداد ${short(s.detail.payments)} · إشعارات ${short(s.detail.creditNotes)}`)
                : s.count != null ? L(`${count(s.count)} invoice(s)`, `${count(s.count)} فاتورة`) : '';
          return (
            <div key={s.key} className={`rv-bridge__row rv-bridge__row--${s.kind}`} role="row">
              <span role="cell"><b>{B(BRIDGE_LABELS[s.key])}</b></span>
              <span className="rv-bridge__track" aria-hidden="true"><i style={{ insetInlineStart: `${left}%`, width: `${Math.max(0.8, width)}%` }} /></span>
              <span role="cell" className="rv-bridge__val" dir="ltr">{s.amount >= 0 && s.kind !== 'start' ? '+' : ''}{short(s.amount)}</span>
              <small className="muted" role="cell" dir="auto">{sub}</small>
            </div>
          );
        })}
        <div className="rv-bridge__row rv-bridge__row--net" role="row">
          <span role="cell"><b>{L('Net uncollected', 'الرصيد القائم')}</b></span>
          <span className="rv-bridge__track" aria-hidden="true"><i style={{ insetInlineStart: 0, width: `${(bridge.net / max) * 100}%` }} /></span>
          <span role="cell" className="rv-bridge__val" dir="ltr"><b>{short(bridge.net)}</b></span>
          <small className="muted" role="cell">{L(`overdue ${short(stock.overdue)} · not yet due ${short(stock.notYetDue)}`, `متأخر ${short(stock.overdue)} · لم يحن ${short(stock.notYetDue)}`)}</small>
        </div>
      </div>
      {bridge.unmatched.count > 0 ? (
        <div className="rv-callout rv-callout--warn" style={{ marginTop: 10 }}>
          <b>{L('Not matched — shown apart', 'غير مطابق — يُعرض منفصلاً')}</b>
          <div>{L(`${count(bridge.unmatched.count)} report invoice(s) worth ${money(bridge.unmatched.amount)} could not be matched to the details report. They are neither deducted nor added to the net; resolve them in Data → matching.`, `${count(bridge.unmatched.count)} فاتورة في التقرير بقيمة ${money(bridge.unmatched.amount)} تعذّرت مطابقتها مع بيان التفاصيل. لا تُخصم ولا تُضاف إلى الصافي؛ تُعالج من البيانات ← المطابقة.`)}</div>
          <div className="muted" dir="ltr" style={{ fontSize: 12 }}>{bridge.unmatched.rows.map((r) => r.invoiceNo).join(' · ')}</div>
        </div>
      ) : bridge.unmatched.scopedOut ? (
        <div className="rv-callout" style={{ marginTop: 10 }}>{L(`Report-only invoices carry no Amanah, so the ${bridge.unmatched.nationalCount} unmatched rows (${money(bridge.unmatched.nationalAmount)}) appear in the national view only.`, `فواتير التقرير غير المطابقة لا تحمل أمانة لذا تظهر ${bridge.unmatched.nationalCount} صفوف (${money(bridge.unmatched.nationalAmount)}) في العرض الوطني فقط.`)}</div>
      ) : null}
      <p className="rv-sec-sub" style={{ marginTop: 8 }}>{L('Net billed (a period flow) is not net uncollected (a standing balance). Cancelled and excluded amounts are deducted once; an amount already removed as cancelled is never removed again as excluded.', 'صافي المفوتر (تدفق لفترة) ليس الرصيد القائم (رصيد قائم). تُخصم الملغاة والمستبعدة مرة واحدة؛ والمبلغ المخصوم كملغى لا يُخصم ثانية كمستبعد.')}</p>
      {(exc?.detail?.unapprovedRules > 0) && <span className="rv-badge rv-badge--sm rv-badge--warn">{L('Includes exclusions under unapproved rules', 'يتضمن استبعادات وفق قواعد غير معتمدة')}</span>}
    </div>
  );
}

/* ---------------------------------------------------------- Change explanation */
export function ChangeExplanation() {
  const { L, B, ar } = useL();
  const rev = useRevenue();
  const { data: ex } = useAsync(() => explainChange(rev.data, rev.scopeEff, rev.cfg, { curr: rev.snapshot, prev: rev.prevSnapshot }), [rev.data, rev.snapshot, rev.prevSnapshot]);
  if (!ex) return <div className="card card-pad"><h3 className="rv-sec-title">{L('What explains the change?', 'ما الذي يفسّر التغير؟')}</h3><div className="rv-empty">{L('Calculating…', 'جارٍ الاحتساب…')}</div></div>;
  return (
    <div className="card card-pad">
      <h3 className="rv-sec-title">{L('What explains the change?', 'ما الذي يفسّر التغير؟')}</h3>
      {!ex.comparable ? (
        <div className="rv-empty">{B(ex.needsVerification[0])}</div>
      ) : (
        <>
          <p className="rv-sec-sub">{L(`Collected ÷ net billed vs ${ex.scopePrev.basis === 'same_period_last_year' ? 'the same period last year' : 'the previous period of equal length'} (${ex.scopePrev.from} → ${ex.scopePrev.to}): `, `المحصّل ÷ صافي المفوتر مقابل ${ex.scopePrev.basis === 'same_period_last_year' ? 'نفس الفترة من العام السابق' : 'الفترة السابقة المماثلة'} (${ex.scopePrev.from} ← ${ex.scopePrev.to}): `)}<b dir="ltr">{ex.deltaPp == null ? L('not calculable', 'غير قابل للاحتساب') : `${ex.deltaPp >= 0 ? '+' : ''}${ex.deltaPp.toFixed(1)} pp`}</b></p>
          <ul className="res__list res__list--plain">
            {ex.factors.map((f) => <li key={f.key} dir="auto"><span className="rv-tag">{L('measured', 'مقاس')}</span> {B(f.text)}</li>)}
          </ul>
          {ex.byAmanah && (
            <div className="rv-table-wrap">
              <table className="rv-table" style={{ minWidth: 0 }}>
                <thead><tr><th>{L('Amanah', 'الأمانة')}</th><th className="num">{L('Mix effect (pp)', 'أثر المزيج (نقطة)')}</th><th className="num">{L('Rate effect (pp)', 'أثر المعدل (نقطة)')}</th><th className="num">{L('Total (pp)', 'المجموع (نقطة)')}</th></tr></thead>
                <tbody>{ex.byAmanah.rows.slice(0, 5).map((r) => <tr key={r.key}><td>{r.label ? pickBi(r.label, ar ? 'ar' : 'en') : r.key}</td><td className="num" dir="ltr">{r.mixPp.toFixed(2)}</td><td className="num" dir="ltr">{r.ratePp.toFixed(2)}</td><td className="num" dir="ltr"><b>{r.totalPp.toFixed(2)}</b></td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="rv-callout rv-callout--warn" style={{ marginTop: 8 }}>
            <b>{L('Needs verification', 'يحتاج تحققاً')}</b>
            <div dir="auto">{ex.needsVerification.map((n) => B(n)).join(' ')} {B(ex.maturityCaveat)}</div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Amanah map */
export function AmanahMap({ snapshot, prevSnapshot, comparable, onPick }) {
  const { L, B, ar, short, count } = useL();
  const [sort, setSort] = useState('attention');
  const total = snapshot.byAmanah.reduce((s, g) => s + g.outstanding, 0);
  const prev = new Map((prevSnapshot?.byAmanah || []).map((g) => [g.key, g]));
  const rows = snapshot.byAmanah.map((g) => {
    const p = prev.get(g.key);
    const rate = g.collectedOverNet;
    const pRate = p?.collectedOverNet;
    const trend = comparable && rate?.calculable && pRate?.calculable ? Math.round((rate.value - pRate.value) * 1000) / 10 : null;
    const ownShare = g.net > 0 ? g.outstanding / g.net : null;
    return { g, rate, trend, ownShare, share: total > 0 ? g.outstanding / total : 0, small: g.count < 8 };
  });
  const sorted = [...rows].sort((a, b) => {
    if (sort === 'rate') return (a.rate.value ?? 2) - (b.rate.value ?? 2);
    if (sort === 'amount') return b.g.outstanding - a.g.outstanding;
    if (sort === 'trend') return (a.trend ?? 99) - (b.trend ?? 99);
    // attention: share of its OWN net billed still outstanding, then amount (size-aware, not amount alone)
    return (b.ownShare ?? -1) - (a.ownShare ?? -1) || b.g.outstanding - a.g.outstanding;
  });
  const maxNet = Math.max(...rows.map((r) => r.g.net), 1);
  return (
    <div className="card card-pad">
      <div className="rv-card__head">
        <div>
          <h3 className="rv-sec-title">{L('Amanah map', 'خريطة الأمانات')}</h3>

        </div>
        <label className="rv-inline">{L('Sort', 'الترتيب')}
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={L('Sort Amanahs', 'ترتيب الأمانات')}>
            <option value="attention">{L('Needs attention (uncollected ÷ own net)', 'الأحوج للانتباه (غير المحصّل ÷ صافيها)')}</option>
            <option value="amount">{L('Outstanding amount', 'مبلغ غير المحصّل')}</option>
            <option value="rate">{L('Lowest rate', 'أدنى نسبة')}</option>
            <option value="trend">{L('Largest decline', 'أكبر تراجع')}</option>
          </select>
        </label>
      </div>
      <div className="rv-table-wrap">
        <table className="rv-table">
          <thead><tr>
            <th>{L('Amanah', 'الأمانة')}</th>
            <th>{L('Size (net billed)', 'الحجم (صافي المفوتر)')}</th>
            <th className="num">{L('Collected ÷ net', 'المحصّل ÷ الصافي')}</th>
            <th className="num">{L('Change vs last year (pp)', 'التغير عن العام الماضي (نقطة)')}</th>
            <th className="num">{L('Uncollected', 'غير المحصّل')}</th>
            <th className="num">{L('Uncollected share of its net', 'نسبة غير المحصّل من صافيها')}</th>
            <th className="num">{L('Share of all uncollected', 'حصتها من غير المحصّل')}</th>
          </tr></thead>
          <tbody>
            {sorted.map(({ g, rate, trend, ownShare, share, small }) => (
              <tr key={g.key}>
                <td><button type="button" className="rv-link" onClick={() => onPick?.(g.key)}>{pickBi(g.label, ar ? 'ar' : 'en')}</button>{small && <span className="rv-tag" style={{ marginInlineStart: 6 }} title={L('Fewer than 8 invoices: the rate is volatile', 'أقل من 8 فواتير: النسبة متقلبة')}>{L('under 8 invoices', 'أقل من 8 فواتير')}</span>}</td>
                <td><span className="rv-sizebar" aria-label={short(g.net)}><i style={{ width: `${Math.max(3, (g.net / maxNet) * 100)}%` }} /></span> <small className="muted" dir="ltr">{short(g.net)} · {count(g.count)}</small></td>
                <td className="num">{ratioText(rate, ar, 0)}</td>
                <td className="num" dir="ltr">{trend == null ? '—' : <span className={trend < 0 ? 'rv-neg' : 'rv-pos'}>{trend > 0 ? '+' : ''}{trend}</span>}</td>
                <td className="num">{short(g.outstanding)}</td>
                <td className="num">{ownShare == null ? '—' : `${Math.round(ownShare * 100)}%`}</td>
                <td className="num">{Math.round(share * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!comparable && <small className="muted">{L('Trend needs a like-for-like previous period inside the data coverage.', 'الاتجاه يحتاج فترة سابقة مماثلة ضمن تغطية البيانات.')}</small>}
    </div>
  );
}

/* ------------------------------------------------------------- Priority debt */
export function PriorityDebt({ snapshot, contracts, overdueRows, bridge }) {
  const { L, ar, short, money, sar, count } = useL();
  const q = snapshot.quality;
  const contractRows = contracts.filter((c) => c.totals.arrears > 0).sort((a, b) => b.totals.arrears - a.totals.arrears).slice(0, 5);
  const execRows = contracts.filter((c) => c.requests.length).sort((a, b) => b.execution.amount - a.execution.amount).slice(0, 4);
  const gaps = [
    bridge.unmatched.count > 0 && { k: 'unmatched', text: L(`${count(bridge.unmatched.count)} unpaid-report invoices not matched to the details (${money(bridge.unmatched.amount)})`, `${count(bridge.unmatched.count)} فاتورة في تقرير غير المسدد لم تُطابق مع التفاصيل (${money(bridge.unmatched.amount)})`), to: '/data-sources' },
    q.amountConflictCount > 0 && { k: 'conflicts', text: L(`${count(q.amountConflictCount)} invoices whose amount differs from the line items (${money(q.conflictAmountAtStake)})`, `${count(q.amountConflictCount)} فاتورة يختلف مبلغها عن بنودها (${money(q.conflictAmountAtStake)})`), to: '/risk' },
    q.contractIssueCount > 0 && { k: 'contracts', text: L(`${count(q.contractIssueCount)} investment invoices whose contract was not matched (kept in the base)`, `${count(q.contractIssueCount)} فاتورة استثمار لم تتم مطابقة عقدها (تبقى في الأساس)`), to: '/contracts' },
    q.pendingExclusionCount > 0 && { k: 'pending', text: L(`${count(q.pendingExclusionCount)} exclusion candidates awaiting review`, `${count(q.pendingExclusionCount)} مرشح استبعاد بانتظار المراجعة`), to: '/noncollection' }
  ].filter(Boolean);
  return (
    <div className="rv-three">
      <div className="card card-pad">
        <h3 className="rv-sec-title">{L('Large overdue invoices', 'فواتير متأخرة كبيرة')}</h3>
        {overdueRows.length ? <ul className="rv-list">{overdueRows.map((d) => <li key={d.id}><Link to={`/invoices?id=${d.id}`} dir="ltr">{d.id}</Link> <span className="muted">{ar ? d.amanahAr : d.amanahEn}</span> <b dir="ltr">{sar(d.outstanding)}</b> <small className="muted">{d.daysOverdue} {L('days', 'يوماً')}</small></li>)}</ul> : <div className="rv-empty">{L('None in this scope.', 'لا شيء في هذا النطاق.')}</div>}
      </div>
      <div className="card card-pad">
        <h3 className="rv-sec-title">{L('Contracts with overdue installments', 'عقود بدفعات متأخرة')}</h3>
        {contractRows.length ? <ul className="rv-list">{contractRows.map((c) => <li key={c.contractNo}><Link to={`/contracts?no=${c.contractNo}`} dir="ltr">{c.contractNo}</Link> <span className="muted">{ar ? c.tenantAr : c.tenantEn}</span> <b>{short(c.totals.arrears)}</b> <small className="muted">{c.totals.overdueInstallments} {L('overdue', 'متأخرة')} · {c.totals.futureInstallments} {L('future', 'مستقبلية')}</small></li>)}</ul> : <div className="rv-empty">{L('None.', 'لا شيء.')}</div>}
        <h4 className="rv-sec-title" style={{ fontSize: 13, marginTop: 12 }}>{L('Enforcement to follow up', 'تنفيذ يحتاج متابعة')}</h4>
        {execRows.length ? <ul className="rv-list">{execRows.map((c) => <li key={c.contractNo}><Link to={`/contracts?no=${c.contractNo}`} dir="ltr">{c.requests[0].enforceNum}</Link> <b>{short(c.execution.amount)}</b> <small className="muted">{c.execution.invoicesIdentified ? L('invoices identified', 'فواتير محددة') : L('invoices not identified — not added to the debt', 'فواتير غير محددة — لا تُضاف للمديونية')}</small></li>)}</ul> : <div className="rv-empty">{L('None.', 'لا شيء.')}</div>}
      </div>
      <div className="card card-pad">
        <h3 className="rv-sec-title">{L('Data gaps that move the numbers', 'فجوات بيانات تؤثر في الأرقام')}</h3>
        {gaps.length ? <ul className="rv-list">{gaps.map((g) => <li key={g.k}><Link to={g.to}>{g.text}</Link></li>)}</ul> : <div className="rv-empty">{L('No material gaps.', 'لا فجوات مؤثرة.')}</div>}
      </div>
    </div>
  );
}

export { RULE_APPROVAL_LABEL };
