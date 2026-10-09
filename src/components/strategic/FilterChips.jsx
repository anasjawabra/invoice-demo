// The ONE compact, expandable filter context shared by the dashboard, the fixed reports and the planning baseline.
import React, { useCallback, useMemo, useState } from 'react';
import { useRevenue } from '../../context/RevenueContext';
import { useAr } from '../../utils/useAr';
import { ScopeBar } from '../revenue/RevenueUI';
import { municipalitiesOf } from '../../data/catalog';
import { amanahOptionsOf } from '../../data/revenueLedger';
import { sourceAr, sourceEn } from '../../data/insightsEngine';
import { fmtRangeText } from '../../data/clock';

export default function FilterChips() {
  const rev = useRevenue(); const { L, ar } = useAr(); const s = rev.scopeEff; const [open, setOpen] = useState(false);
  const labelOfAmanah = useCallback((k) => { const a = amanahOptionsOf().find((x) => x.key === k); return a ? (ar ? a.ar : a.en) : k; }, [ar]);
  const chips = useMemo(() => {
    const am = s.amanah === 'all' ? L('كل الأمانات', 'All Amanahs') : [].concat(s.amanah).map(labelOfAmanah).join('، ');
    const mu = s.muni === 'all' ? L('كل البلديات', 'All municipalities') : (municipalitiesOf(String(s.muni).split('|')[0]).find((m) => m && m.key === s.muni)?.[ar ? 'ar' : 'en'] || s.muni);
    const st = { all: null, collected: L('محصّلة', 'Collected'), open: L('قائمة', 'Open'), overdue: L('متأخرة', 'Overdue'), partial: L('جزئية', 'Partial'), not_due: L('لم تستحق', 'Not due'), cancelled: L('ملغاة', 'Cancelled'), excluded: L('مستبعدة', 'Excluded') }[s.status || 'all'];
    return [[L('الفترة', 'Period'), fmtRangeText(s.from, s.to, ar ? 'ar' : 'en')], [L('الأمانة', 'Amanah'), am], [L('البلدية', 'Municipality'), mu], [L('المصدر', 'Source'), s.source === 'all' ? L('كل المصادر', 'All sources') : (ar ? sourceAr(s.source) : sourceEn(s.source))], ...(st ? [[L('الحالة', 'Status'), st]] : []), ...(s.scopeType !== 'all' ? [[L('النطاق', 'Scope'), s.scopeType === 'internal' ? L('داخلي', 'Internal') : L('مركزي', 'Central')]] : [])];
  }, [s, ar, L, labelOfAmanah]);
  // how many filters differ from the defaults (year to date · everything) — and one click to go back
  const active = [rev.scope.preset !== 'ytd', s.amanah !== 'all', s.muni !== 'all', s.source !== 'all', (s.scopeType || 'all') !== 'all', (s.status || 'all') !== 'all'].filter(Boolean).length;
  return (
    <>
      <div className="sr-context" role="region" aria-label={L('المرشحات المشتركة', 'Shared filters')}>
        <div className="sr-chips">{chips.map(([k, v]) => <span key={k} className="sr-chip"><em>{k}</em> <bdi>{v}</bdi></span>)}</div>
        {active > 0 && <><span className="st-tag st-tag--warn">{L(`مرشحات مفعّلة (${active})`, `Active filters (${active})`)}</span><button type="button" className="btn btn-sm btn-ghost" onClick={rev.resetScope}>{L('إعادة الضبط', 'Reset')}</button></>}
        <button type="button" className="btn btn-sm btn-ghost" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? L('إخفاء المرشحات', 'Hide filters') : L('المرشحات', 'Filters')}</button>
      </div>
      {open && <ScopeBar compact />}
      {open && <div className="muted" style={{ fontSize: 11.5 }}>{L('تُحفظ المرشحات لهذه الجلسة وتُشارك بين لوحة المعلومات والتقارير الثابتة والصفحات التشغيلية. للتخطيط نطاقه الخاص، ولكل محادثة في التقارير الذكية نطاقها.', 'Filters are kept for this session and shared by the dashboard, fixed reports and operational pages. Planning has its own scope, and each Smart-report conversation has its own.')}</div>}
    </>
  );
}
