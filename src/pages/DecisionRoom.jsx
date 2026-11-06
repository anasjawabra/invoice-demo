// «غرفة القرارات» — the findings a reviewer should look at, derived from the platform's own figures for the SELECTED scope (src/data/decisionRoom.js). No assignment: a reviewer can only flag an
// item for follow-up (وضع علامة للمتابعة), mark it followed up, or remove the flag; the financial condition of the issue is read from the data and is separate from the flag.
// Order: title + purpose → ONE shared filter toolbar → a small summary strip → 2–3 focused charts (a bar filters the list) → the ranked items → the expandable analysis.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useDecisions } from '../data/useDecisions';
import { summaryOf } from '../data/decisionRoom';
import { useAr } from '../utils/useAr';
import ScopeFilters from '../components/filters/ScopeFilters';
import useUrlFilters from '../components/filters/useUrlFilters';
import NoResults from '../components/filters/NoResults';
import { FILTER_PAGES } from '../components/filters/filterConfig';
import { decisionsLocal, scopeIsDefault, DECISION_PAGE_KEYS, DECISION_PAGE_DEFAULTS } from '../components/filters/pageFilters';
import { DataStatus } from '../components/revenue/RevenueUI';
import { AsyncBlock } from '../components/strategic/AsyncState';
import { ItemRow } from '../components/decisions/DecisionParts';
import DecisionCharts from '../components/decisions/DecisionCharts';
import DecisionStrip from '../components/decisions/DecisionStrip';
import DecisionPlanNote from '../components/decisions/DecisionPlanNote';
import { DATE_BASIS_NOTE, markChip, toggleMark, viewIsNarrowed, viewItems } from '../components/decisions/decisionUi';

const URL_KEYS = [...DECISION_PAGE_KEYS, 'item'];
const URL_DEFAULTS = { ...DECISION_PAGE_DEFAULTS, item: '' };

export default function DecisionRoom() {
  const rev = useRevenue(); const D = useDecisions(); const { L, ar, lang, B, count } = useAr();
  const { values, setValues } = useUrlFilters({ keys: URL_KEYS, defaults: URL_DEFAULTS });
  const [mark, setMark] = useState(null); // the chart bar chosen: { chart, i, label, filter }
  const local = useMemo(() => decisionsLocal(), []);
  const pageValues = useMemo(() => ({ category: values.category, priority: values.priority, flag: values.flag }), [values.category, values.priority, values.flag]);
  const view = useMemo(() => viewItems(D.items, pageValues, mark), [D.items, pageValues, mark]);
  const summary = useMemo(() => (D.ready ? summaryOf(view, D.context) : null), [D.ready, view, D.context]); // the strip follows the filtered list, so its counts reconcile with it
  const titleOf = useMemo(() => { const m = new Map(D.items.map((i) => [i.key, i.title])); return (k) => m.get(k) || null; }, [D.items]);
  const openKey = values.item || '';
  const setOpen = (k) => setValues({ item: openKey === k ? '' : k });

  const resetLocal = () => { setValues({ category: 'all', priority: 'all', flag: 'all', item: '' }); setMark(null); };
  const resetAll = () => { rev.resetScope(); resetLocal(); };
  const narrowed = viewIsNarrowed(pageValues, mark) || !scopeIsDefault(rev.scope, rev.cfg.cutoff);
  const chip = markChip(mark, lang);
  const extraChips = chip ? [{ ...chip, onRemove: () => setMark(null) }] : [];

  // a deep link (?item=…) opens that item and brings it into view once
  const scrolled = useRef('');
  useEffect(() => {
    if (!D.ready || !openKey || scrolled.current === openKey) return;
    if (!view.some((i) => i.key === openKey)) return;
    scrolled.current = openKey;
    const el = document.getElementById(`dr-${openKey.replace(/[^a-z0-9]/gi, '_')}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
  }, [D.ready, openKey, view]);
  const hiddenOpen = D.ready && openKey && !view.some((i) => i.key === openKey);
  const openExists = D.items.some((i) => i.key === openKey);

  const state = { data: D.ready ? true : null, loading: D.loading, error: D.error };
  const resultCount = D.ready ? <span className="muted" role="status">{L(`${count(view.length)} من ${count(D.items.length)} بنداً`, `${count(view.length)} of ${count(D.items.length)} items`)}</span> : null;

  return (
    <div className="st-page dr-page" dir={ar ? 'rtl' : 'ltr'}>
      <header className="st-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{L('غرفة القرارات', 'Decision room')}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{L('ما يستحق المراجعة الآن في أرقام الإيرادات للتصفية المختارة، مع الدليل والمقارنة. كل بند مقترح للمراجعة وليس قراراً معتمداً.', 'What deserves review now in the revenue figures for the selected filters, with the evidence and the comparison. Every item is proposed for review, not an approved decision.')}</div>
        </div>
        <Link className="btn btn-sm" to="/collection?analysis=noncollection" title={L('يفتح قائمة الفواتير غير المحصّلة حيث يبدأ تحليل أسباب عدم التحصيل', 'Opens the uncollected-invoices list, where the non-collection analysis starts')}>{L('تحليل أسباب عدم التحصيل', 'Non-collection analysis')} {ar ? '←' : '→'}</Link>
      </header>

      {rev.ready ? <ScopeFilters {...FILTER_PAGES.decisions} local={{ ...local, values: pageValues, onChange: (patch) => setValues({ ...patch, item: '' }) }} onClearLocal={resetLocal} extraChips={extraChips} resultCount={resultCount} /> : null}
      <p className="muted dr-basisnote">{B(DATE_BASIS_NOTE)}</p>
      <DataStatus />

      <AsyncBlock state={state} onRetry={() => window.location.reload()} height={200}>
        {D.ready && (
          <>
            <DecisionStrip summary={summary} />
            <DecisionPlanNote plan={D.context?.plan} />
            <DecisionCharts charts={D.charts} mark={mark} onMark={(m) => setMark((cur) => toggleMark(cur, m))} />

            {hiddenOpen && (
              <div className="rv-callout" role="status">
                {openExists ? L('البند المطلوب غير ظاهر بالتصفية الحالية.', 'The requested item is not visible with the current filters.') : L('لا يوجد هذا البند في النطاق الحالي (قد يكون الشرط لم يعد قائماً).', 'This item does not exist in the current scope (the condition may no longer hold).')}{' '}
                {openExists && <button type="button" className="btn btn-sm" onClick={resetLocal}>{L('مسح تصفيات الصفحة', 'Clear the page filters')}</button>}
              </div>
            )}

            <section className="dr-list" aria-label={L('البنود مرتبة بالأولوية', 'Items ranked by priority')}>
              <h2 className="dr-list__h">{L('البنود مرتبة بالأولوية', 'Items ranked by priority')} <span className="muted">({count(view.length)})</span></h2>
              {view.map((it) => <ItemRow key={it.key} it={it} D={D} open={openKey === it.key} onToggle={() => setOpen(it.key)} titleOf={titleOf} />)}
              {!view.length && (narrowed
                ? <NoResults lang={lang} title={L('لا بنود مطابقة لهذه التصفية', 'No items match these filters')} hint={L('لم يُوسَّع الاختيار. امسح الفلاتر لعرض كل بنود الفترة الافتراضية.', 'The selection was not widened. Clear the filters to see every item of the default period.')} onReset={resetAll} />
                : <div className="rv-empty">{L('لا بنود في هذا النطاق: لا تُولَّد بنود للفئات التي لا تدعمها البيانات.', 'No items in this scope: categories the data does not support generate no items.')}</div>)}
            </section>
            <div className="muted dr-foot"><Link to="/insights">{L('العودة إلى لوحة المعلومات', 'Back to the dashboard')}</Link></div>
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
