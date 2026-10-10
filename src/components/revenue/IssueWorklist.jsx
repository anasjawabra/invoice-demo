import React, { useMemo, useState } from 'react';
import { useAsync } from '../../utils/useAsync';
import { RecordLink as Link, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../../utils/returnContext';
import { invoicePath } from '../../utils/paths';
import { useRevenue } from '../../context/RevenueContext';
import { useL } from '../../utils/bi';
import { MetricTile } from './RevenueUI';
import { anomalyRows } from '../../data/revenueInsights';
import { CATEGORY_LABELS as RISK_LABELS } from '../../data/riskAnalysis';
import { REVENUE_SOURCES } from '../../data/revenueLedger';

export const CODE_LABEL = {
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

// One worklist of invoices with findings, used by two pages that differ only in WHICH findings they own (src/data/issueGroups.js):
// «المخاطر والانحرافات» (business review) and «جودة البيانات» (record completeness and matching, under system settings).
// It is deliberately separate from the collection worklist: collected invoices may appear here when a finding justifies it, but they are labelled and never become unpaid-collection priorities.
export default function IssueWorklist({ memKey, anomalyCodes = [], riskCats = [], tiles, emptyText, footer = null }) {
  const rev = useRevenue();
  const { L, B, ar, short, count, sar } = useL();
  const restore = useShouldRestore(); const mem = useMemo(() => readListMemory(memKey, restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [code, setCode] = useState(mem.code ?? 'all');
  React.useEffect(() => { writeListMemory(memKey, { code }); }, [memKey, code]);
  const scopeReq = useMemo(() => ({ from: rev.scopeEff.from, to: rev.scopeEff.to, amanah: rev.scopeEff.amanah, source: rev.scopeEff.source, scopeType: rev.scopeEff.scopeType, muni: rev.scopeEff.muni, status: rev.scopeEff.status }), [rev.scopeEff]);

  // the findings are computed by the data service over the whole scope; only the top rows travel
  const { data: all } = useAsync(() => (anomalyCodes.length ? rev.data.anomalies(scopeReq, 100, { codes: anomalyCodes }) : Promise.resolve(null)), [rev.data, scopeReq, anomalyCodes.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data: radar } = useAsync(() => (riskCats.length ? rev.data.risk(scopeReq, { limit: 60 }) : Promise.resolve(null)), [rev.data, scopeReq, riskCats.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const isRisk = code.startsWith('risk_');
  const { data: byCode } = useAsync(() => (code === 'all' || isRisk || !anomalyCodes.length ? Promise.resolve(null) : rev.data.anomalies(scopeReq, 100, { codes: anomalyCodes, code })), [rev.data, scopeReq, code, anomalyCodes.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const radarRows = (cat) => (radar?.categories[cat]?.rows || []).map((r) => ({ id: r.id, row: r, collected: r.outstanding <= 0 && r.collected > 0, excluded: r.cls === 'excluded', outstanding: r.outstanding, severity: 3, reasons: [{ code: `risk_${cat}`, severity: 3, text: { en: `${RISK_LABELS[cat].en} (score ${r.score})`, ar: `${RISK_LABELS[cat].ar} (الدرجة ${r.score})` } }] }));
  const inGroup = (it) => ({ ...it, reasons: it.reasons.filter((r) => anomalyCodes.includes(r.code)) });
  // every finding of the group, merged per invoice (the «All» view and the «collected but flagged» count)
  const allItems = useMemo(() => {
    const merged = new Map();
    for (const it of anomalyRows(all).map(inGroup)) merged.set(it.id, it);
    for (const cat of riskCats) for (const it of radarRows(cat)) { const have = merged.get(it.id); merged.set(it.id, have ? { ...have, severity: Math.max(have.severity, it.severity), reasons: [...have.reasons, ...it.reasons] } : it); }
    return [...merged.values()].sort((a, b) => b.severity - a.severity || b.row.gross - a.row.gross).slice(0, 100);
  }, [all, radar]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => (isRisk ? radarRows(code.replace('risk_', '')) : code === 'all' ? allItems : anomalyRows(byCode).map(inGroup)), [isRisk, code, allItems, byCode, radar]); // eslint-disable-line react-hooks/exhaustive-deps
  useRestoreScroll(items.length > 0);

  const counts = all?.counts || {};
  const radarCounts = radar ? Object.fromEntries(riskCats.map((c) => [`risk_${c}`, radar.categories[c]?.count || 0])) : {};
  const codes = [...anomalyCodes.filter((c) => counts[c] > 0), ...Object.keys(radarCounts).filter((k) => radarCounts[k] > 0)].sort((a, b) => ((counts[b] ?? radarCounts[b]) || 0) - ((counts[a] ?? radarCounts[a]) || 0));
  const collectedFlagged = allItems.filter((i) => i.collected).length;

  return (
    <>
      <div className="rv-tiles">{tiles({ counts, radarCounts, all, radar, collectedFlagged, count, MetricTile })}</div>
      <div className="card card-pad">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }} role="group" aria-label={L('Filter by finding', 'تصفية حسب النتيجة')}>
          <button type="button" className={`btn btn-sm ${code === 'all' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={code === 'all'} onClick={() => setCode('all')}>{L('All', 'الكل')}{!riskCats.length ? ` · ${count(all?.total ?? 0)}` : ''}</button>
          {codes.map((c) => <button key={c} type="button" className={`btn btn-sm ${code === c ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={code === c} onClick={() => setCode(c)}>{B(CODE_LABEL[c] || { en: c, ar: c })} · {count(counts[c] ?? radarCounts[c])}</button>)}
        </div>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table" style={{ minWidth: 820 }}>
            <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Amanah · source', 'الأمانة · المصدر')}</th><th className="num">{L('Billed (SAR)', 'المفوتر (ريال)')}</th><th>{L('Collection', 'التحصيل')}</th><th>{L('Findings', 'النتائج')}</th><th><span className="sr-only">{L('Action', 'إجراء')}</span></th></tr></thead>
            <tbody>
              {items.length ? items.map((it) => (
                <tr key={it.id}>
                  <td><Link to={invoicePath(it.id)} dir="ltr">{it.id}</Link></td>
                  <td>{ar ? it.row.amanahAr : it.row.amanahEn} · {ar ? REVENUE_SOURCES[it.row.source].ar : REVENUE_SOURCES[it.row.source].en}</td>
                  <td className="num" dir="ltr">{sar(it.row.gross)}</td>
                  <td>{it.excluded ? <span className="rv-cat rv-cat--excluded">{L('Excluded', 'مستبعدة')}</span> : it.collected ? <span className="rv-cat rv-cat--collected">{L('Collected — review only', 'محصّلة — للمراجعة فقط')}</span> : <span className="rv-cat rv-cat--overdue">{L(`Outstanding ${short(it.outstanding)}`, `متبقٍ ${short(it.outstanding)}`)}</span>}</td>
                  <td style={{ fontSize: 12 }}>
                    {it.reasons.map((r, i) => <div key={i} style={{ marginBottom: 3 }} dir="auto"><span className={`rv-tag ${r.severity >= 3 ? 'rv-tag--bad' : 'rv-tag--warn'}`}>{B(CODE_LABEL[r.code] || { en: r.code, ar: r.code })}</span>{B(r.text)}</div>)}
                  </td>
                  <td><Link className="btn btn-sm" to={invoicePath(it.id)}>{L('Analyze and review', 'تحليل ومراجعة')}</Link></td>
                </tr>
              )) : <tr><td colSpan={6}><div className="rv-empty">{B(emptyText)}</div></td></tr>}
            </tbody>
          </table>
        </div>
        {footer}
      </div>
    </>
  );
}
