import { localize } from '../utils/zh';
import { localizedObject } from '../utils/zh';
// «غرفة القرارات» — what needs a decision, an action or follow-up now; each item has an owner, a due date, a status and a history.
// Items come from the platform's own figures for the SELECTED scope (period · Amanah · source) — see src/data/decisionRoom.js. One page: a row opens in place.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useDecisions } from '../data/useDecisions';
import { useAr } from '../utils/useAr';
import FilterChips from '../components/strategic/FilterChips';
import { DataStatus, MetricTile } from '../components/revenue/RevenueUI';
import { AsyncBlock } from '../components/strategic/AsyncState';
import { ItemRow } from '../components/decisions/DecisionParts';
import { CATEGORIES, LANES, ROLES } from '../data/decisionRoom';
import { STATUSES } from '../data/decisionStore';
import useTabs from '../utils/useTabs';

export default function DecisionRoom() {
  const rev = useRevenue(); const D = useDecisions(); const { L, ar, short, count , lang } = useAr();
  const B = (o) => (localizedObject(o, lang));
  const [lane, setLane] = useState('decision'); const [cat, setCat] = useState('all'); const [owner, setOwner] = useState('all'); const [status, setStatus] = useState('open'); const [am, setAm] = useState('all'); const [src, setSrc] = useState('all');
  const [openKey, setOpenKey] = useState(null);
  const tabs = useTabs({ keys: Object.keys(LANES), value: lane, onChange: (key) => { setLane(key); setOpenKey(null); } });
  const laneCount = useMemo(() => Object.fromEntries(Object.keys(LANES).map((k) => [k, D.items.filter((i) => i.lane === k && (status === 'open' ? ['new', 'in_progress'].includes(i.status) : true)).length])), [D.items, status]);
  const rows = useMemo(() => D.items.filter((i) => i.lane === lane
    && (cat === 'all' || i.category === cat) && (owner === 'all' || i.state?.owner === owner || (owner === 'none' && !i.state?.owner)) && (am === 'all' || i.amanah === am) && (src === 'all' || i.source === src)
    && (status === 'all' || (status === 'open' ? ['new', 'in_progress'].includes(i.status) : i.status === status))), [D.items, lane, cat, owner, status, am, src]);
  const amOptions = useMemo(() => [...new Set(D.items.map((i) => i.amanah).filter(Boolean))], [D.items]);
  const srcOptions = useMemo(() => [...new Set(D.items.map((i) => i.source).filter(Boolean))], [D.items]);
  const S = D.summary; const state = { data: D.ready ? true : null, loading: D.loading, error: D.error };

  return (
    <div className="st-page" dir={ar ? 'rtl' : 'ltr'}>
      <header className="st-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{L('غرفة القرارات', 'Decision room')}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{L('ما يحتاج قراراً أو إجراءً الآن، بمسؤول وموعد وحالة وسجل. البنود محسوبة من أرقام المنصة للتصفية المختارة.', 'What needs a decision or an action now, with an owner, a due date, a status and a history. Items are calculated from the platform’s figures for the selected filter.')}</div>
        </div>
      </header>
      {rev.ready ? <FilterChips /> : null}
      <DataStatus />
      <div className="rv-callout" role="note" style={{ fontSize: 12.5 }}>{L('العمل على البنود (الإسناد والقرار والملاحظات) محفوظ على هذا الجهاز في العرض التجريبي. المبالغ لا تُجمع عبر أساسين مختلفين؛ كل بند يذكر أساس قياسه.', 'Work on the items (assignment, decisions, notes) is kept on this device in the demo. Amounts are never added across different bases; each item states its own.')}</div>
      <AsyncBlock state={state} onRetry={() => window.location.reload()} height={200}>
        {S && (
          <>
            <div className="rv-tiles dr-tiles">
              <MetricTile label={L('يتطلب قراراً', 'Needs a decision')} value={count(S.decisions)} sub={L('بنود مفتوحة', 'open items')} />
              <MetricTile label={L('إجراءات متأخرة عن موعدها', 'Actions past their due date')} value={count(S.overdueActions)} tone={S.overdueActions > 0 ? 'warn' : undefined} sub={L('بحسب الاستحقاق المُسند', 'by the assigned due date')} />
              <MetricTile label={L('المتأخر القابل للمتابعة', 'Overdue to follow up')} value={short(S.collectible)} sub={L(`لم يحن بعد ${short(S.notDue)} (غير محسوب)؛ المجموع = غير المحصّل ${short(S.uncollected)}`, `${short(S.notDue)} not yet due (not counted); together = uncollected ${short(S.uncollected)}`)} />
              <MetricTile label={L('أكبر مبلغ بند', 'Largest item amount')} value={S.largest ? short(S.largest.amount) : '—'} sub={S.largest ? B(S.largest.title) : L('لا بنود بمبلغ', 'no item with an amount')} />
            </div>

            <div className="sr-tabs" role="tablist" aria-label={L('المسارات', 'Lanes')}>
              {Object.keys(LANES).map((k) => <button key={k} {...tabs.getTabProps(k)} className={`sr-tab ${lane === k ? 'is-active' : ''}`}><b>{B(LANES[k])}</b> <span className="muted">({laneCount[k]})</span></button>)}
            </div>

            <div {...tabs.getPanelProps(lane)} className="ui-section-stack">
            <div className="dr-filters" role="search" aria-label={L('تصفية البنود', 'Filter the items')}>
              <label className="cg-field" htmlFor="dr-cat">{L('الفئة', 'Category')}<select id="dr-cat" className="input" value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">{L('كل الفئات', 'All categories')}</option>{Object.keys(CATEGORIES).map((k) => <option key={k} value={k}>{B(CATEGORIES[k])}</option>)}</select></label>
              <label className="cg-field" htmlFor="dr-am">{L('الأمانة / الجهة', 'Amanah / entity')}<select id="dr-am" className="input" value={am} onChange={(e) => setAm(e.target.value)}><option value="all">{L('الكل', 'All')}</option>{amOptions.map((k) => <option key={k} value={k}>{localize(D.labels.amanah(k)[ar ? 'ar' : 'en'], lang)}</option>)}</select></label>
              <label className="cg-field" htmlFor="dr-src">{L('المصدر', 'Source')}<select id="dr-src" className="input" value={src} onChange={(e) => setSrc(e.target.value)}><option value="all">{L('الكل', 'All')}</option>{srcOptions.map((k) => <option key={k} value={k}>{localize(D.labels.source(k)[ar ? 'ar' : 'en'], lang)}</option>)}</select></label>
              <label className="cg-field" htmlFor="dr-owner">{L('المسؤول', 'Owner')}<select id="dr-owner" className="input" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="all">{L('الكل', 'All')}</option><option value="none">{L('بلا مسؤول', 'No owner')}</option>{Object.keys(ROLES).map((k) => <option key={k} value={k}>{B(ROLES[k])}</option>)}</select></label>
              <label className="cg-field" htmlFor="dr-status">{L('الحالة', 'Status')}<select id="dr-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">{L('المفتوحة (جديد + قيد التنفيذ)', 'Open (new + in progress)')}</option><option value="all">{L('كل الحالات', 'All statuses')}</option>{Object.keys(STATUSES).map((k) => <option key={k} value={k}>{B(STATUSES[k])}</option>)}</select></label>
            </div>

            <div className="dr-list" role="list">
              {rows.map((it) => <div role="listitem" key={it.key}><ItemRow it={it} D={D} open={openKey === it.key} onToggle={() => setOpenKey((k) => (k === it.key ? null : it.key))} /></div>)}
              {!rows.length && <div className="rv-empty">{L('لا بنود في هذا المسار بهذه التصفية. الفئات التي لا تدعمها البيانات لا تُولَّد بنودها.', 'No items in this lane with this filter. Categories the data does not support generate no items.')}</div>}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>{L('الترتيب: 0.4 × المبلغ + 0.25 × العمر/الاستعجال + 0.25 × قابلية الإجراء + 0.1 × جودة الدليل (معادلة المنصة القائمة). ', 'Ranking: 0.4 × amount + 0.25 × aging/urgency + 0.25 × actionability + 0.1 × evidence quality (the platform’s existing formula). ')}<Link to="/insights">{L('العودة إلى لوحة المعلومات', 'Back to the dashboard')}</Link></div>
            </div>
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
