import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue } from '../../context/RevenueContext';
import { useL, ratioText } from '../../utils/bi';
import { useAsync } from '../../utils/useAsync';
import { ASSUMPTIONS } from '../../data/sourceAssumptions';

// Revenue-source coverage: which files/sheets feed each source, at what record level, the join keys, the supplying system, and the live
// counts (invoices, item rows, payment rows) and amounts from the same metric layer as every other screen.
export default function SourceCoverage() {
  const rev = useRevenue();
  const { L, B, ar, short, count, sar } = useL();
  const [showAssume, setShowAssume] = useState(false);
  const { data, error } = useAsync(() => rev.data.sources ? rev.data.sources() : Promise.resolve(null), [rev.data, rev.dataVersion]);
  if (error) return <div className="rv-callout rv-callout--bad" role="alert">{String(error.message || error)}</div>;
  if (!data) return <div className="card card-pad muted" role="status">{L('Loading source coverage…', 'جارٍ تحميل تغطية المصادر…')}</div>;
  const tot = data.totals.ytd;
  const ok = Object.values(data.reconcile).every(Boolean) && data.checks.idsStrictlyIncreasing && data.checks.duplicateIds === 0;
  return (
    <section className="card card-pad" aria-label={L('Revenue-source coverage', 'تغطية مصادر الإيراد')}>
      <div className="rv-card__head">
        <div>
          <h3 className="rv-sec-title">{L('Revenue sources: files, record level, keys and live counts', 'مصادر الإيراد: الملفات ومستوى السجل والمفاتيح والأعداد الحية')}</h3>
          <p className="rv-sec-sub">{L(`Period ${data.period.from} → ${data.period.to} (Asia/Riyadh) versus ${data.period.priorFrom} → ${data.period.priorTo}. Invoices, item rows and payment rows are three different counts; each amount carries one appropriate unit (SAR · thousand · million · billion).`, `الفترة ${data.period.from} ← ${data.period.to} (الرياض) مقابل ${data.period.priorFrom} ← ${data.period.priorTo}. الفواتير وصفوف البنود وصفوف السداد ثلاثة أعداد مختلفة؛ وكل مبلغ بوحدة واحدة مناسبة (SAR · ألف · مليون · مليار).`)}</p>
        </div>
        <span className={`rv-badge rv-badge--sm ${ok ? 'rv-badge--good' : 'rv-badge--bad'}`}>{ok ? L('Integrity checks pass', 'فحوص السلامة سليمة') : L('Integrity check failed', 'فشل فحص سلامة')}</span>
      </div>
      <div className="rv-table-wrap">
        <table className="rv-table" style={{ minWidth: 980 }}>
          <thead><tr>
            <th>{L('Source', 'المصدر')}</th><th>{L('Files · sheets', 'الملفات · الأوراق')}</th><th>{L('Record level', 'مستوى السجل')}</th><th>{L('Link keys', 'مفاتيح الربط')}</th><th>{L('Supplying system', 'النظام المورّد')}</th>
            <th className="num">{L('Invoices', 'فواتير')}</th><th className="num">{L('Item rows', 'صفوف البنود')}</th><th className="num">{L('Payment rows', 'صفوف السداد')}</th><th className="num">{L('Billed', 'المفوتر')}</th><th className="num">{L('Collected', 'المحصّل')}</th><th className="num">{L('÷ net', '÷ الصافي')}</th><th className="num">{L('Prior-year invoices', 'فواتير العام السابق')}</th>
          </tr></thead>
          <tbody>
            {data.sources.map((s) => {
              const f = s.ytd.financial || { gross: 0, collected: 0, rate: { calculable: false } };
              return (
                <tr key={s.key}>
                  <td><Link to={`/invoices?src=${s.key}`}><b>{s.profile ? B(s.profile.label) : s.key}</b></Link><div className="muted" style={{ fontSize: 11 }} dir="ltr">{s.key}</div></td>
                  <td style={{ fontSize: 11.5 }} dir="ltr">{(s.profile?.files || []).join(' · ')}<div className="muted">{(s.profile?.sheets || []).join(', ')}</div></td>
                  <td style={{ fontSize: 11.5, maxWidth: 220 }} dir="auto">{s.profile ? B(s.profile.level) : '—'}</td>
                  <td style={{ fontSize: 11.5 }} dir="ltr">{(s.profile?.keys || []).join(' · ')}</td>
                  <td style={{ fontSize: 11.5, maxWidth: 200 }} dir="auto">{s.profile ? B(s.profile.supplier) : '—'}</td>
                  <td className="num" dir="ltr">{count(s.ytd.invoices)}</td><td className="num" dir="ltr">{count(s.ytd.lines)}</td><td className="num" dir="ltr">{count(s.ytd.payments)}</td>
                  <td className="num" dir="ltr" title={sar(f.gross)}>{short(f.gross)}</td><td className="num" dir="ltr" title={sar(f.collected)}>{short(f.collected)}</td><td className="num">{ratioText(f.rate, ar, 0)}</td>
                  <td className="num" dir="ltr">{count(s.prior.invoices)}</td>
                </tr>
              );
            })}
            <tr style={{ fontWeight: 800 }}>
              <td>{L('Total', 'الإجمالي')}</td><td /><td /><td /><td />
              <td className="num" dir="ltr">{count(tot.count)}</td><td className="num" dir="ltr">{count(data.sources.reduce((t, s) => t + s.ytd.lines, 0))}</td><td className="num" dir="ltr">{count(data.sources.reduce((t, s) => t + s.ytd.payments, 0))}</td>
              <td className="num" dir="ltr" title={sar(tot.gross)}>{short(tot.gross)}</td><td className="num" dir="ltr" title={sar(tot.collected)}>{short(tot.collected)}</td><td className="num">{ratioText(tot.collectedOverNet, ar, 0)}</td><td className="num" dir="ltr">{count(data.totals.prior.count)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="rv-callout" style={{ marginTop: 8 }}>{L('The same invoice can appear in several systems (Tahseel, Incorta, Makeen, the activity platform, SADAD). It is ONE unified invoice with links to its source records; the amount is taken once.', 'قد تظهر الفاتورة نفسها في أكثر من نظام (تحصيل وإنكورتا ومكين ومنصة النشاط وسداد). هي فاتورة موحدة واحدة بروابط إلى سجلاتها المصدرية، والمبلغ يُحتسب مرة.')}</div>
      <div style={{ marginTop: 8 }}>
        <button type="button" className="btn btn-sm btn-ghost" aria-expanded={showAssume} onClick={() => setShowAssume((v) => !v)}>{showAssume ? L('Hide the demo assumptions', 'إخفاء الافتراضات التجريبية') : L(`Show the demo assumptions (${ASSUMPTIONS.length})`, `عرض الافتراضات التجريبية (${ASSUMPTIONS.length})`)}</button>
        {showAssume && (
          <ul className="rv-list" style={{ fontSize: 12, marginTop: 6 }}>{ASSUMPTIONS.map((a) => <li key={a.id}><b dir="ltr">{a.id}</b> <span className="muted" dir="ltr">[{a.sources.join(', ')}]</span> — <span dir="auto">{B(a.text)}</span></li>)}</ul>
        )}
      </div>
    </section>
  );
}
