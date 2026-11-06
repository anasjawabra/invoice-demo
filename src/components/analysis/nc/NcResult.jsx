// «تحليل أسباب عدم التحصيل» — the result as a decision-ready report: a header block (scope · period · cut-off · generation time · version), four tabs and, behind every chart mark and card,
// the supporting invoices. The tab, the drill-down filter, the search, the sort and the page live in the ADDRESS (search parameters), so a return from an invoice page restores exactly this view.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useL } from '../../../utils/bi';
import { ENTITIES } from '../../../data/catalog';
import { REVENUE_SOURCES } from '../../../data/revenueLedger';
import { fmtRiyadh } from '../../../data/clock';
import { NcCtx } from './NcBits';
import { useRevenue } from '../../../context/RevenueContext';
import { useAsync } from '../../../utils/useAsync';
import { headlineCfg } from '../../../data/measure';
import { ncChartEnrichment } from './ncCharts';
import { emptyView } from '../../../data/reportView';
import NcOverview from './NcOverview';
import NcReasons from './NcReasons';
import NcPriorities from './NcPriorities';
import NcQuality from './NcQuality';
import { TABS, TAB_LABEL, PROVENANCE, encodeDrill, decodeDrill, iso } from './ncModel';

const entName = (k, ar) => { const e = ENTITIES.find((x) => x.en === k || x.key === k); return e ? (ar ? e.ar : e.en) : String(k); };
export function scopeText(scope, ar) {
  const s = scope || {}; const L = (a, e) => (ar ? a : e);
  const am = s.amanah == null || s.amanah === 'all' ? L('جميع الأمانات والجهات', 'All Amanahs') : [].concat(s.amanah).map((k) => entName(k, ar)).join(L('، ', ', '));
  const src = s.source == null || s.source === 'all' ? L('جميع مصادر الإيراد', 'All revenue sources') : (REVENUE_SOURCES[s.source] ? (ar ? REVENUE_SOURCES[s.source].ar : REVENUE_SOURCES[s.source].en) : s.source);
  const extra = [];
  if (s.scopeType && s.scopeType !== 'all') extra.push(s.scopeType === 'internal' ? L('داخلي', 'Internal') : L('مركزي', 'Central'));
  if (s.muni && s.muni !== 'all') extra.push(String(s.muni).split('|').pop());
  return { period: ar ? `من ${iso(s.from)} إلى ${iso(s.to)}` : `${s.from} → ${s.to}`, line: [am, src, ...extra].join(' · ') };
}
const SORT_KEYS = ['amount', 'daysOverdue', 'issue', 'id'];

export default function NcResult({ analysis, version, versions, onSelectVersion, onRefresh, refreshing, onExport, exportDenied = null, saveState, stale, newerVersion, onOpenNewer, chartView = null, onChartView = null }) {
  const rev = useRevenue();
  const { L, ar, money, count, sar, num, unitFor, uLabel } = useL();
  const [sp, setSp] = useSearchParams();
  const tabRaw = sp.get('tab'); const tab = TABS.includes(tabRaw) ? tabRaw : 'overview';
  const drill = useMemo(() => decodeDrill(sp.get('d')), [sp.get('d')]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = sp.get('q') || ''; const page = Math.max(0, Number(sp.get('p')) || 0);
  const sort = { key: SORT_KEYS.includes(sp.get('sk')) ? sp.get('sk') : 'amount', dir: sp.get('sd') === 'asc' ? 'asc' : 'desc' };
  const f = useMemo(() => ({ money, count, num, exact: sar, full: (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }), unitFor, uLabel }), [money, count, num, sar, unitFor, uLabel]);

  const update = useCallback((patch) => setSp((p) => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) { if (v == null || v === '' || (k === 'p' && Number(v) === 0)) n.delete(k); else n.set(k, String(v)); } return n; }, { replace: true }), [setSp]);
  const scrollPending = useRef(false);
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return undefined; const h = setTimeout(() => setToast(''), 6000); return () => clearTimeout(h); }, [toast]);

  const base = useMemo(() => { // the analysis scope the lists are asked with (the stored task scope also carries the product filters)
    const s = analysis.scope || {}; const t = version.taskScope || {};
    return { from: s.from, to: s.to, amanah: s.amanah ?? 'all', source: s.source ?? 'all', scopeType: s.scopeType ?? 'all', muni: s.muni ?? 'all', status: s.status ?? 'all', product: t.product || [], mainClass: t.mainClass || 'all' };
  }, [analysis, version]);

  // chart presentation: persisted with the saved version when the page passes `onChartView`; otherwise (a result that is not saved) it lasts for the session only
  const [localView, setLocalView] = useState(emptyView);
  const view = onChartView ? chartView || emptyView() : localView; const setView = onChartView || setLocalView;
  // invoice-level distributions (bins · quartiles) of THIS analysis' scope, only while the data is the data the analysis was made on: they make the histogram / box types available
  const distOk = !stale && (!version.cutoff || version.cutoff === rev.cfg.cutoff) && !!rev.data?.distributions;
  const { data: dist } = useAsync(() => (distOk ? rev.data.distributions({ from: base.from, to: base.to, amanah: base.amanah, source: base.source, scopeType: base.scopeType, muni: base.muni, status: base.status, product: base.product, mainClass: base.mainClass }, { cfg: headlineCfg(rev.cfg) }).catch(() => null) : null), [distOk, rev.data, base, rev.cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const enrich = useMemo(() => ncChartEnrichment(dist ? { ...analysis, distributions: dist } : analysis, ar ? 'ar' : 'en'), [analysis, dist, ar]);
  const ctx = useMemo(() => ({
    a: analysis, ar, f, version, base, drill, q, page, sort, scrollPending, enrich, chartView: view, onChartView: setView,
    openDrill: (d, src = 'card') => { scrollPending.current = true; update({ tab: 'priorities', d: encodeDrill({ ...d, src }), q: '', p: 0 }); },
    clearDrill: () => update({ d: null, p: 0 }),
    goTab: (t) => { update({ tab: t }); const el = document.getElementById('nc-tabs'); if (el) el.scrollIntoView({ block: 'start' }); },
    setView: (patch) => update({ ...('q' in patch ? { q: patch.q } : {}), ...('page' in patch ? { p: patch.page } : {}), ...(patch.sort ? { sk: patch.sort.key, sd: patch.sort.dir } : {}) }),
    notify: setToast
  }), [analysis, ar, f, version, base, drill, q, page, sort.key, sort.dir, update, enrich, view, setView]); // eslint-disable-line react-hooks/exhaustive-deps

  // tab list: arrow keys (mirrored in Arabic), Home / End; the focus follows the selection
  const onKey = (e) => {
    const i = TABS.indexOf(tab); const rtl = document.documentElement.dir === 'rtl';
    let next = null;
    if (e.key === 'ArrowRight') next = TABS[(i + (rtl ? -1 : 1) + TABS.length) % TABS.length]; else if (e.key === 'ArrowLeft') next = TABS[(i + (rtl ? 1 : -1) + TABS.length) % TABS.length];
    else if (e.key === 'Home') next = TABS[0]; else if (e.key === 'End') next = TABS[TABS.length - 1];
    if (next) { e.preventDefault(); update({ tab: next }); requestAnimationFrame(() => document.getElementById(`nc-tab-${next}`)?.focus()); }
  };

  const sc = scopeText(analysis.scope, ar);
  const when = fmtRiyadh(version.generatedAt);
  const Panel = { overview: NcOverview, reasons: NcReasons, priorities: NcPriorities, quality: NcQuality }[tab];
  const latestN = versions[versions.length - 1].n;

  return (
    <NcCtx.Provider value={ctx}>
      <div className="nc">
        <section className="nc-head" aria-label={L('Analysis details', 'بيانات التحليل')}>
          <div className="nc-head__scope"><b dir="auto">{sc.line}</b><span className="nc-head__period">{sc.period}</span></div>
          <p className={`nc-saved${saveState?.saved ? '' : ' nc-saved--warn'}`} role="status">
            {saveState?.saved
              ? L(`Saved result · generated ${when} (Riyadh) · data to ${version.cutoff} · version ${version.n}`, `نتيجة محفوظة · أُنشئت ${iso(when)} (توقيت الرياض) · بيانات حتى ${iso(version.cutoff)} · الإصدار ${version.n}`)
              : L(`Not saved — this result is available in this session only${saveState?.reason ? ` (${saveState.reason.en})` : ''} · generated ${when} · data to ${version.cutoff}`, `غير محفوظة — النتيجة متاحة في هذه الجلسة فقط${saveState?.reason ? ` (${saveState.reason.ar})` : ''} · أُنشئت ${iso(when)} · بيانات حتى ${iso(version.cutoff)}`)}
          </p>
          <div className="nc-head__acts">
            {versions.length > 1 && onSelectVersion && (
              <label className="nc-verpick">{L('Version', 'الإصدار')}
                <select className="select" value={version.n} onChange={(e) => onSelectVersion(Number(e.target.value))}>
                  {[...versions].reverse().map((v) => <option key={v.n} value={v.n}>{L(`v${v.n}${v.n === latestN ? ' (latest)' : ''} — ${fmtRiyadh(v.generatedAt)} · data to ${v.cutoff}`, `الإصدار ${v.n}${v.n === latestN ? ' (الأحدث)' : ''} — ${iso(fmtRiyadh(v.generatedAt))} · بيانات حتى ${iso(v.cutoff)}`)}</option>)}
                </select>
              </label>
            )}
            {onRefresh && <button type="button" className="btn btn-sm" onClick={onRefresh} disabled={refreshing}>{refreshing ? L('Refreshing…', 'جارٍ التحديث…') : L('Refresh analysis', 'تحديث التحليل')}</button>}
            {onExport && !exportDenied && <button type="button" className="btn btn-sm btn-primary" onClick={onExport}>{L('Export report', 'تصدير التقرير')}</button>}
            {onExport && exportDenied && <button type="button" className="btn btn-sm btn-primary" disabled title={exportDenied} data-reason={exportDenied}>{L('Export report', 'تصدير التقرير')}</button>}
          </div>
          <p className="nc-prov">{ar ? PROVENANCE.ar : PROVENANCE.en}</p>
        </section>

        {newerVersion && <div className="nc-banner" role="status">{L(`A newer version (${newerVersion}) was just created. `, `أُنشئ إصدار أحدث (${newerVersion}) للتو. `)}<button type="button" className="nc-linkbtn" onClick={onOpenNewer}>{L('Open it', 'فتحه')}</button></div>}
        {stale && <div className="nc-banner nc-banner--warn" role="status">{L('Exclusion settings, review decisions or data changed after this version was generated. The figures shown are the saved ones; refresh the analysis to recalculate.', 'تغيّرت إعدادات الاستبعاد أو قرارات المراجعة أو البيانات بعد إنشاء هذا الإصدار. الأرقام المعروضة هي المحفوظة؛ حدّث التحليل لإعادة الحساب.')}</div>}
        {toast && <div className="nc-banner nc-banner--warn" role="status">{toast}</div>}

        <div id="nc-tabs" className="nc-tabs" role="tablist" aria-label={L('Report sections', 'أقسام التقرير')} onKeyDown={onKey}>
          {TABS.map((k) => (
            <button key={k} id={`nc-tab-${k}`} type="button" role="tab" aria-selected={tab === k} aria-controls={`nc-panel-${k}`} tabIndex={tab === k ? 0 : -1} className={`nc-tab${tab === k ? ' is-active' : ''}`} onClick={() => update({ tab: k })}>{ar ? TAB_LABEL[k].ar : TAB_LABEL[k].en}</button>
          ))}
        </div>
        <div id={`nc-panel-${tab}`} role="tabpanel" aria-labelledby={`nc-tab-${tab}`} className="nc-panel"><Panel /></div>
      </div>
    </NcCtx.Provider>
  );
}
