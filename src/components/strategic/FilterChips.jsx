// The ONE compact, expandable filter context shared by the dashboard, the fixed reports and the planning baseline.
import React, { useCallback, useMemo, useState } from 'react';
import { useRevenue } from '../../context/RevenueContext';
import { useAr } from '../../utils/useAr';
import { ScopeBar } from '../revenue/RevenueUI';
import { municipalitiesOf } from '../../data/catalog';
import { amanahOptionsOf } from '../../data/revenueLedger';
import { sourceAr, sourceEn } from '../../data/insightsEngine';

export default function FilterChips() {
  const rev = useRevenue(); const { L, ar } = useAr(); const s = rev.scopeEff; const [open, setOpen] = useState(false);
  const labelOfAmanah = useCallback((k) => { const a = amanahOptionsOf().find((x) => x.key === k); return a ? (ar ? a.ar : a.en) : k; }, [ar]);
  const chips = useMemo(() => {
    const am = s.amanah === 'all' ? L('كل الأمانات', 'All Amanahs') : [].concat(s.amanah).map(labelOfAmanah).join('، ');
    const mu = s.muni === 'all' ? L('كل البلديات', 'All municipalities') : (municipalitiesOf(String(s.muni).split('|')[0]).find((m) => m && m.key === s.muni)?.[ar ? 'ar' : 'en'] || s.muni);
    const st = { all: null, collected: L('محصّلة', 'Collected'), open: L('قائمة', 'Open'), overdue: L('متأخرة', 'Overdue'), partial: L('جزئية', 'Partial'), not_due: L('لم تستحق', 'Not due'), cancelled: L('ملغاة', 'Cancelled'), excluded: L('مستبعدة', 'Excluded') }[s.status || 'all'];
    return [[L('الفترة', 'Period'), `${s.from} → ${s.to}`], [L('الأمانة', 'Amanah'), am], [L('البلدية', 'Municipality'), mu], [L('المصدر', 'Source'), s.source === 'all' ? L('كل المصادر', 'All sources') : (ar ? sourceAr(s.source) : sourceEn(s.source))], ...(st ? [[L('الحالة', 'Status'), st]] : []), ...(s.scopeType !== 'all' ? [[L('النطاق', 'Scope'), s.scopeType === 'internal' ? L('داخلي', 'Internal') : L('مركزي', 'Central')]] : [])];
  }, [s, ar, L, labelOfAmanah]);
  return (
    <>
      <div className="sr-context" role="region" aria-label={L('المرشحات المشتركة', 'Shared filters')}>
        <div className="sr-chips">{chips.map(([k, v]) => <span key={k} className="sr-chip"><em>{k}</em> <bdi>{v}</bdi></span>)}</div>
        <button type="button" className="btn btn-sm btn-ghost" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? L('إخفاء المرشحات', 'Hide filters') : L('المرشحات', 'Filters')}</button>
      </div>
      {open && <ScopeBar compact />}
    </>
  );
}
