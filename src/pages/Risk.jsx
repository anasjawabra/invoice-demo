import React, { useMemo, useState } from 'react';
import { useAsync } from '../utils/useAsync';
import { Link } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { ScopeBar, MetricTile, ProvenanceBadge } from '../components/revenue/RevenueUI';
import { anomalyRows, anomalyReasonText } from '../data/revenueInsights';
import { CATEGORY_LABELS as RISK_LABELS, RISK_CATEGORIES } from '../data/riskAnalysis';
import { REVENUE_SOURCES } from '../data/revenueLedger';

const CODE_LABEL = {
  amount_conflict: { en: 'Amount conflict', ar: 'تعارض مبلغ' },
  exclusion_pending: { en: 'Exclusion pending review', ar: 'استبعاد بانتظار المراجعة' },
  missing_fields: { en: 'Missing mandatory field', ar: 'حقل إلزامي ناقص' },
  contract_unlinked: { en: 'Contract not linked', ar: 'عقد غير مرتبط' },
  contract_unmatched: { en: 'Contract not matched', ar: 'عقد غير مطابق' },
  enforcement_candidate: { en: 'Enforcement link pending', ar: 'رابط إنفاذ معلّق' },
  receipts_on_excluded: { en: 'Payment on excluded invoice', ar: 'دفعة على فاتورة مستبعدة' },
  source_cancelled: { en: 'Source says cancelled', ar: 'المصدر يفيد بالإلغاء' },
  risk_duplicate: { en: 'Possible duplicate', ar: 'تكرار محتمل' },
  risk_struck_off_registry: { en: 'Struck-off registry flag', ar: 'تنبيه سجل مشطوب' },
  risk_deceased_person: { en: 'Deceased-debtor flag', ar: 'تنبيه مدين متوفى' },
  risk_value_anomaly: { en: 'Value anomaly vs Amanah baseline', ar: 'انحراف القيمة عن معدل الأمانة' }
};

// Data-quality / anomaly worklist — deliberately separate from the collection
// worklist. Collected invoices MAY appear here when a data issue justifies it,
// but they are labelled and never become unpaid-collection priorities.
export default function Risk() {
  const rev = useRevenue();
  const { snapshot } = rev;
  const { L, B, ar, lang, short, count, sar } = useL();
  const [code, setCode] = useState('all');
  const scopeReq = useMemo(() => ({ from: rev.scopeEff.from, to: rev.scopeEff.to, amanah: rev.scopeEff.amanah, source: rev.scopeEff.source, scopeType: rev.scopeEff.scopeType, muni: rev.scopeEff.muni, status: rev.scopeEff.status }), [rev.scopeEff]);

  // data-quality worklist and rule-based risk flags are computed by the data service over the whole scope; only the top rows travel
  const { data: all } = useAsync(() => rev.data.anomalies(scopeReq, 100), [rev.data, scopeReq]);
  const { data: radar } = useAsync(() => rev.data.risk(scopeReq, { limit: 60 }), [rev.data, scopeReq]);
  const isRisk = code.startsWith('risk_');
  const { data: byCode } = useAsync(() => (code === 'all' || isRisk ? Promise.resolve(null) : rev.data.anomalies(scopeReq, 100, { code })), [rev.data, scopeReq, code]);

  const riskItems = useMemo(() => {
    if (!radar || !isRisk) return [];
    const cat = code.replace('risk_', '');
    return (radar.categories[cat]?.rows || []).map((r) => ({ id: r.id, row: r, collected: r.outstanding <= 0 && r.collected > 0, excluded: r.cls === 'excluded', outstanding: r.outstanding, severity: 3, reasons: [{ code, severity: 3, text: { en: `${RISK_LABELS[cat].en} (score ${r.score})`, ar: `${RISK_LABELS[cat].ar} (الدرجة ${r.score})` } }] }));
  }, [radar, code, isRisk]);
  const items = useMemo(() => (isRisk ? riskItems : anomalyRows(code === 'all' ? all : byCode)), [isRisk, riskItems, all, byCode, code]);
  const filtered = items;
  const counts = all?.counts || {};
  const radarCounts = radar ? Object.fromEntries(RISK_CATEGORIES.map((c) => [`risk_${c}`, radar.categories[c]?.count || 0])) : {};
  const codes = [...Object.keys(counts), ...Object.keys(radarCounts).filter((k) => radarCounts[k] > 0)].sort((a, b) => ((counts[b] ?? radarCounts[b]) || 0) - ((counts[a] ?? radarCounts[a]) || 0));
  const flagsTotal = Object.values(radarCounts).reduce((s, v) => s + v, 0);
  const collectedFlagged = (all ? anomalyRows(all) : []).filter((i) => i.collected).length;

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Data quality & risk', 'جودة البيانات والمخاطر')}</h1>
          <div className="page-sub">{L('Invoices whose data needs review before figures or actions rely on them — amount conflicts, missing fields, unlinked contracts, pending links and rule-based risk flags. Not a collection list: collected invoices may appear here but are labelled.', 'فواتير تحتاج بياناتها إلى مراجعة قبل الاعتماد عليها في الأرقام أو الإجراءات — تعارض المبالغ والحقول الناقصة والعقود غير المرتبطة والروابط المعلقة وتنبيهات المخاطر القائمة على قواعد. ليست قائمة تحصيل: قد تظهر فواتير محصّلة لكنها موسومة.')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ProvenanceBadge kind="demo" />
          <Link className="btn btn-sm" to="/collection">{L('Collection worklist', 'قائمة التحصيل')}</Link>
        </div>
      </div>

      <ScopeBar />

      <div className="rv-tiles">
        <MetricTile label={L('Invoices needing data review', 'فواتير تحتاج مراجعة بيانات')} value={count(all?.total ?? 0)} sub={L(`of ${count(snapshot.totals.count)} issued in scope`, `من ${count(snapshot.totals.count)} صادرة في النطاق`)} />
        <MetricTile label={L('Amount conflicts', 'تعارضات المبالغ')} value={count(counts.amount_conflict || 0)} tone={counts.amount_conflict ? 'bad' : undefined} sub={L('Header vs line items; never silently corrected', 'الرأس مقابل البنود؛ لا تُصحَّح بصمت')} />
        <MetricTile label={L('Risk-radar flags', 'تنبيهات رادار المخاطر')} value={count(flagsTotal)} sub={RISK_CATEGORIES.map((c) => `${ar ? RISK_LABELS[c].ar : RISK_LABELS[c].en}: ${count(radarCounts[`risk_${c}`] || 0)}`).join(' · ')} />
        <MetricTile label={L('Collected but flagged', 'محصّلة لكن موسومة')} value={count(collectedFlagged)} sub={L('Data-quality review only — not unpaid priorities', 'مراجعة جودة بيانات فقط — وليست أولويات تحصيل')} />
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }} role="group" aria-label={L('Filter by issue', 'تصفية حسب المشكلة')}>
          <button type="button" className={`btn btn-sm ${code === 'all' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={code === 'all'} onClick={() => setCode('all')}>{L('All', 'الكل')} · {count(all?.total ?? 0)}</button>
          {codes.map((c) => <button key={c} type="button" className={`btn btn-sm ${code === c ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={code === c} onClick={() => setCode(c)}>{B(CODE_LABEL[c] || (c.startsWith('risk_') ? RISK_LABELS[c.replace('risk_', '')] : null) || { en: c, ar: c })} · {count(counts[c] ?? radarCounts[c])}</button>)}
        </div>
        <div className="rv-table-wrap">
          <table className="rv-table" style={{ minWidth: 820 }}>
            <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Amanah · source', 'الأمانة · المصدر')}</th><th className="num">{L('Billed (SAR)', 'المفوتر (SAR)')}</th><th>{L('Collection', 'التحصيل')}</th><th>{L('Issues', 'المشكلات')}</th><th /></tr></thead>
            <tbody>
              {filtered.length ? filtered.map((it) => (
                <tr key={it.id}>
                  <td><Link to={`/invoices?id=${it.id}`} dir="ltr">{it.id}</Link></td>
                  <td>{ar ? it.row.amanahAr : it.row.amanahEn} · {ar ? REVENUE_SOURCES[it.row.source].ar : REVENUE_SOURCES[it.row.source].en}</td>
                  <td className="num" dir="ltr">{sar(it.row.gross)}</td>
                  <td>{it.excluded ? <span className="rv-cat rv-cat--excluded">{L('Excluded', 'مستبعدة')}</span> : it.collected ? <span className="rv-cat rv-cat--collected">{L('Collected — data review only', 'محصّلة — مراجعة بيانات فقط')}</span> : <span className="rv-cat rv-cat--overdue">{L(`Outstanding ${short(it.outstanding)}`, `متبقٍ ${short(it.outstanding)}`)}</span>}</td>
                  <td style={{ fontSize: 12 }}>
                    {it.reasons.map((r, i) => <div key={i} style={{ marginBottom: 3 }} dir="auto"><span className={`rv-tag ${r.severity >= 3 ? 'rv-tag--bad' : 'rv-tag--warn'}`}>{B(CODE_LABEL[r.code] || { en: r.code, ar: r.code })}</span>{B(r.text)}</div>)}
                  </td>
                  <td><button type="button" className="btn btn-sm" onClick={() => rev.startAnalysis('invoice', { invoiceId: it.id }, { origin: 'risk' })}>{L('Analyze invoice', 'تحليل الفاتورة')}</button></td>
                </tr>
              )) : <tr><td colSpan={6}><div className="rv-empty">{L('No data-quality issues in this scope.', 'لا توجد مشكلات جودة بيانات في هذا النطاق.')}</div></td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>{L('Risk-radar flags are rule-based signals (duplicate match, registry/debtor status, value versus the Amanah baseline). A flag is a reason to look, not a conclusion about the payer; an approved exclusion is a separate human decision made on the Noncollection screen.', 'تنبيهات رادار المخاطر إشارات قائمة على قواعد (تطابق تكرار، حالة السجل/المدين، القيمة مقابل معدل الأمانة). التنبيه سبب للمراجعة وليس حكماً على الدافع؛ والاستبعاد المعتمد قرار بشري منفصل يُتخذ في شاشة عدم التحصيل.')}</p>
      </div>
    </div>
  );
}
