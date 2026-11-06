// Tab 1 · نظرة عامة — what is unpaid, how it reconciles, and how much of it is overdue, with the evidence coverage kept apart from the money.
import React, { useMemo } from 'react';
import { useL } from '../../../utils/bi';
import { BRIDGE_LABELS } from '../../../data/bridgeLabels';
import { useNc, FactTag, ChartCard, LimitNote, Money } from './NcBits';
import { buildCharts, summaryLines, kpiTiles, evidenceCoverage, iso } from './ncModel';

export function Summary() {
  const { a, ar, f } = useNc(); const { L } = useL();
  const lines = useMemo(() => summaryLines(a, ar, f), [a, ar, f.money, f.count]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="nc-card nc-summary" aria-labelledby="nc-sum-h">
      <h2 id="nc-sum-h" className="nc-h">{L('Executive summary', 'الملخص التنفيذي')}</h2>
      <ul className="nc-sumlist">
        {lines.map((l, i) => <li key={i} className={l.outside ? 'nc-sumlist__out' : ''}><FactTag kind={l.kind} /><span dir="auto">{l.text}</span></li>)}
      </ul>
    </section>
  );
}

export function Kpis() {
  const { a, ar, f, openDrill } = useNc(); const { L, invoices } = useL();
  const tiles = useMemo(() => kpiTiles(a, ar), [a, ar]); const cov = evidenceCoverage(a, ar, f);
  return (
    <section aria-labelledby="nc-kpi-h" className="nc-kpiwrap">
      <h2 id="nc-kpi-h" className="nc-h nc-h--sm">{L('Amounts (SAR)', 'المبالغ (ريال)')}</h2>
      <div className="nc-kpis">
        {tiles.map((t) => (
          <button key={t.key} type="button" className={`nc-kpi${t.tone ? ` nc-kpi--${t.tone}` : ''}`} onClick={() => openDrill(t.drill)} title={`${L('Show the invoices', 'عرض الفواتير')} — ${f.exact(t.amount)}`}>
            <span className="nc-kpi__l">{t.label}</span>
            <b className="nc-kpi__v" dir="ltr">{f.money(t.amount)}</b>
            <span className="nc-kpi__s">{invoices(t.count)}</span>
          </button>
        ))}
      </div>
      <div className="nc-cov" role="group" aria-label={L('Evidence coverage (not amounts)', 'تغطية الأدلة (ليست مبالغ)')}>
        <span className="nc-cov__h">{L('Evidence coverage — not amounts', 'تغطية الأدلة — ليست مبالغ')}</span>
        {cov.map((c) => <span key={c.key} className="nc-cov__i">{c.text}</span>)}
      </div>
    </section>
  );
}

function PopulationTable() {
  const { a, ar, f } = useNc(); const { L, unitFor, uLabel } = useL();
  const P = a.populations; const S = a.standingBalance; const U = a.unmatched;
  const rows = [
    { k: 'issued', name: L('Invoices issued in the period', 'الفواتير الصادرة في الفترة'), def: L('Every invoice issued between the two dates, paid or not (the base of the analysis).', 'كل فاتورة صدرت بين التاريخين مسددة أو لا (أساس التحليل).'), n: P.issued.count, v: P.issued.gross, inc: 'base', incT: L('Base population — not an unpaid amount', 'أساس المجتمع — ليس مبلغاً غير مسدد') },
    { k: 'gross', name: L('Gross unpaid', 'إجمالي غير المسدد'), def: L('The unpaid part of those invoices, excluded ones included.', 'الجزء غير المسدد من هذه الفواتير شاملاً المستبعد.'), n: P.unpaidGross.count, v: P.unpaidGross.amount, inc: 'yes', incT: L('Yes — start of the bridge', 'نعم — بداية الجسر') },
    { k: 'excl', name: L('Excluded unpaid', 'المستبعد غير المسدد'), def: L('The unpaid part covered by an approved exclusion rule.', 'الجزء غير المسدد المشمول بقاعدة استبعاد معتمدة.'), n: P.excludedUnpaid.count, v: P.excludedUnpaid.amount, inc: 'minus', incT: L('Deducted from the gross', 'يُخصم من الإجمالي') },
    { k: 'net', name: L('Net unpaid', 'صافي غير المسدد'), def: L('Gross unpaid minus excluded. The total used throughout this report.', 'إجمالي غير المسدد ناقص المستبعد. الإجمالي المعتمد في هذا التقرير.'), n: P.netUnpaid.count, v: P.netUnpaid.amount, inc: 'yes', incT: L('Yes — this is the total', 'نعم — هو الإجمالي') },
    { k: 'stand', name: L('Standing balance at the reference date', 'الرصيد القائم عند تاريخ المرجع'), def: L('Every invoice issued up to the reference date, not only the period’s invoices.', 'كل فاتورة صدرت حتى تاريخ المرجع وليس فواتير الفترة فقط.'), n: S.count, v: S.amount, inc: 'apart', incT: L('Different population — shown apart, never added or compared', 'مجتمع مختلف — يُعرض منفصلاً ولا يُجمع ولا يُقارن') },
    { k: 'um', name: L('Report-only records (no match)', 'سجلات التقرير فقط (بلا مطابقة)'), def: L('Records of the unpaid report with no match in the invoice-details report.', 'سجلات في تقرير غير المسدد بلا مقابل في بيان التفاصيل.'), n: U.count, v: U.amount, inc: 'no', incT: U.scopedOut ? L('No — not attributed to a narrower scope', 'لا — لا تُنسب لنطاق أضيق') : L('No — outside every total', 'لا — خارج كل الإجماليات') }
  ];
  const unit = unitFor(rows.map((r) => r.v));
  return (
    <section className="nc-card" aria-labelledby="nc-pop-h">
      <h2 id="nc-pop-h" className="nc-h">{L('Reconciliation of populations', 'مطابقة المجتمعات')}</h2>
      <div className="rv-table-wrap" tabIndex={0}>
        <table className="rv-table nc-table" aria-label={L('Reconciliation of populations', 'مطابقة المجتمعات')}>
          <thead><tr><th>{L('Population', 'المجتمع')}</th><th>{L('Definition', 'التعريف')}</th><th className="num">{L('Invoices', 'الفواتير')}</th><th className="num">{L('Amount', 'المبلغ')} ({uLabel(unit)})</th><th>{L('In the totals?', 'ضمن الإجماليات؟')}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k} className={r.k === 'net' ? 'nc-row--key' : ''}>
                <th scope="row" className="nc-rowh">{r.name}</th><td>{r.def}</td>
                <td className="num" dir="ltr">{f.count(r.n)}</td><td className="num" dir="ltr" title={f.exact(r.v)}>{f.num(r.v, unit)}</td>
                <td><span className={`nc-inc nc-inc--${r.inc}`}>{r.incT}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="nc-fold">
        <summary>{L('How the standing balance reaches its figure (its own bridge)', 'كيف يصل الرصيد القائم إلى رقمه (جسره الخاص)')}</summary>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table nc-table" aria-label={L('Standing balance bridge', 'جسر الرصيد القائم')}>
            <thead><tr><th>{L('Step', 'الخطوة')}</th><th className="num">{L('Invoices', 'الفواتير')}</th><th className="num">{L('Amount (SAR)', 'المبلغ (ريال)')}</th></tr></thead>
            <tbody>
              {S.bridge.steps.map((s) => <tr key={s.key}><td>{BRIDGE_LABELS[s.key] ? (ar ? BRIDGE_LABELS[s.key].ar : BRIDGE_LABELS[s.key].en) : s.key}</td><td className="num" dir="ltr">{s.count != null ? f.count(s.count) : '—'}</td><td className="num" dir="ltr">{s.amount < 0 ? '−' : s.kind === 'plus' && s.amount > 0 ? '+' : ''}{f.count(Math.abs(Math.round(s.amount)))}</td></tr>)}
              <tr className="nc-row--key"><td>{L('Standing balance', 'الرصيد القائم')}</td><td className="num" dir="ltr">{f.count(S.count)}</td><td className="num" dir="ltr">{f.count(Math.round(S.bridge.net))}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="nc-fine">{L(`Report date ${S.bridge.reportDate}; invoice-details date ${S.bridge.detailsDate}. Its overdue part ${f.exact(S.overdue)} and not-yet-due part ${f.exact(S.notYetDue)} belong to this population, not to the period’s net unpaid.`, `تاريخ التقرير ${iso(S.bridge.reportDate)}؛ تاريخ بيان التفاصيل ${iso(S.bridge.detailsDate)}. جزؤه المتأخر ${f.exact(S.overdue)} وغير المستحق ${f.exact(S.notYetDue)} يخصّان هذا المجتمع وليس صافي غير المسدد للفترة.`)}</p>
      </details>
    </section>
  );
}

export default function NcOverview() {
  const { a, ar } = useNc(); const { L } = useL();
  const ch = useMemo(() => buildCharts(a, ar), [a, ar]);
  return (
    <div className="nc-stack">
      <Summary />
      <Kpis />
      <div className="nc-grid2">
        <section className="nc-card"><ChartCard chart={ch.waterfall} name="waterfall" note={L('Gross unpaid − excluded = net unpaid. Click a bar to see its invoices.', 'إجمالي غير المسدد − المستبعد = صافي غير المسدد. انقر على عمود لعرض فواتيره.')} /></section>
        <section className="nc-card"><ChartCard chart={ch.due} name="due" note={L('Overdue + not yet due (+ no due date) = net unpaid.', 'متأخر + لم يحن استحقاقه (+ بلا تاريخ استحقاق) = صافي غير المسدد.')} /></section>
      </div>
      <LimitNote>{L('Part-payments stay collected: only the unpaid remainder is counted here. Nothing on this page estimates what can be recovered.', 'السداد الجزئي يبقى محصّلاً: يُحتسب هنا المتبقي غير المسدد فقط. ولا يقدّر أي شيء في هذه الصفحة ما يمكن استرداده.')}</LimitNote>
      <PopulationTable />
    </div>
  );
}
