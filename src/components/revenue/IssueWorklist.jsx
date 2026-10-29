import { localize } from '../../utils/zh';
import React, { useMemo, useState } from 'react';
import { useAsync } from '../../utils/useAsync';
import { AsyncBlock } from '../strategic/AsyncState';
import Pager from '../Pager';
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
  investment_no_contract: { en: 'Investment invoice not linked to a contract', ar: 'فاتورة استثمار غير مرتبطة بعقد' },
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
  const { L, B, ar, short, count, sar , lang } = useL();
  const restore = useShouldRestore(); const mem = useMemo(() => readListMemory(memKey, restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [code, setCode] = useState(mem.code ?? 'all');
  const [page, setPage] = useState(mem.page ?? 0); const [retry, setRetry] = useState(0); const pageSize = 50;
  React.useEffect(() => { writeListMemory(memKey, { code, page }); }, [memKey, code, page]);
  const scopeReq = useMemo(() => ({ from: rev.scopeEff.from, to: rev.scopeEff.to, amanah: rev.scopeEff.amanah, source: rev.scopeEff.source, scopeType: rev.scopeEff.scopeType, muni: rev.scopeEff.muni, status: rev.scopeEff.status, product: rev.scopeEff.product, mainClass: rev.scopeEff.mainClass }), [rev.scopeEff]);

  // One server-ranked, deduplicated page across findings and risk categories.
  const groupCodes = [...anomalyCodes, ...riskCats.map((c) => `risk_${c}`)];
  const filterKey = JSON.stringify([scopeReq, code, groupCodes]); const lastFilter = React.useRef(filterKey);
  const effectivePage = lastFilter.current === filterKey ? page : 0;
  React.useEffect(() => { if (lastFilter.current !== filterKey) { lastFilter.current = filterKey; setPage(0); } }, [filterKey]);
  const state = useAsync(() => rev.data.anomalies(scopeReq, pageSize, { codes: groupCodes, riskCats, code, page: effectivePage }), [rev.data, filterKey, effectivePage, retry]);
  const all = state.data;
  const items = useMemo(() => anomalyRows(all).map((it) => ({ ...it, reasons: [
    ...it.reasons.filter((r) => anomalyCodes.includes(r.code)),
    ...(it.row.tags || []).filter((c) => c.startsWith('risk_') && groupCodes.includes(c)).map((c) => ({ code: c, severity: 3, text: RISK_LABELS[c.slice(5)] }))
  ] })), [all, anomalyCodes.join(','), riskCats.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  useRestoreScroll(items.length > 0);

  const counts = all?.counts || {};
  const radarCounts = Object.fromEntries(riskCats.map((c) => [`risk_${c}`, counts[`risk_${c}`] || 0]));
  const codes = [...anomalyCodes.filter((c) => counts[c] > 0), ...Object.keys(radarCounts).filter((k) => radarCounts[k] > 0)].sort((a, b) => ((counts[b] ?? radarCounts[b]) || 0) - ((counts[a] ?? radarCounts[a]) || 0));
  const collectedFlagged = all?.collectedFlagged ?? 0;

  return (
    <AsyncBlock state={state} onRetry={() => setRetry((v) => v + 1)}>
      <div className="rv-tiles">{tiles({ counts, radarCounts, all: all ? { ...all, total: all.groupTotal } : null, collectedFlagged, count, MetricTile })}</div>
      <div className="card card-pad">
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginBottom: 'var(--spacing-lg)' }} role="group" aria-label={L('Filter by finding', 'تصفية حسب النتيجة')}>
          <button type="button" className={`btn btn-sm ${code === 'all' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={code === 'all'} onClick={() => setCode('all')}>{L('All', 'الكل')} · {count(all?.groupTotal ?? 0)}</button>
          {codes.map((c) => <button key={c} type="button" className={`btn btn-sm ${code === c ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={code === c} onClick={() => setCode(c)}>{B(CODE_LABEL[c] || { en: c, ar: c })} · {count(counts[c] ?? radarCounts[c])}</button>)}
        </div>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table">
            <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Amanah · source', 'الأمانة · المصدر')}</th><th className="num">{L('Billed (SAR)', 'المفوتر (ريال)')}</th><th>{L('Collection', 'التحصيل')}</th><th>{L('Findings', 'النتائج')}</th><th><span className="sr-only">{L('Action', 'إجراء')}</span></th></tr></thead>
            <tbody>
              {items.length ? items.map((it) => (
                <tr key={it.id}>
                  <td><Link to={invoicePath(it.id)} dir="ltr">{it.id}</Link></td>
                  <td>{ar ? it.row.amanahAr : localize(it.row.amanahEn, lang)} · {ar ? REVENUE_SOURCES[it.row.source].ar : localize(REVENUE_SOURCES[it.row.source].en, lang)}</td>
                  <td className="num" dir="ltr">{sar(it.row.gross)}</td>
                  <td>{it.excluded ? <span className="rv-cat rv-cat--excluded">{L('Excluded', 'مستبعدة')}</span> : it.collected ? <span className="rv-cat rv-cat--collected">{L('Collected — review only', 'محصّلة — للمراجعة فقط')}</span> : <span className="rv-cat rv-cat--overdue">{L(`Outstanding ${short(it.outstanding)}`, `متبقٍ ${short(it.outstanding)}`)}</span>}</td>
                  <td style={{ fontSize: 'var(--text-xs)' }}>
                    {it.reasons.map((r, i) => <div key={i} style={{ marginBottom: 'var(--spacing-xs)' }} dir="auto"><span className={`rv-tag ${r.severity >= 3 ? 'rv-tag--bad' : 'rv-tag--warn'}`}>{B(CODE_LABEL[r.code] || { en: r.code, ar: r.code })}</span>{B(r.text)}</div>)}
                  </td>
                  <td><Link className="btn btn-sm" to={invoicePath(it.id)}>{L('Analyze and review', 'تحليل ومراجعة')}</Link></td>
                </tr>
              )) : <tr><td colSpan={6}><div className="rv-empty">{B(emptyText)}</div></td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={effectivePage} total={all?.total ?? 0} size={pageSize} onPage={setPage} />
        {footer}
      </div>
    </AsyncBlock>
  );
}
