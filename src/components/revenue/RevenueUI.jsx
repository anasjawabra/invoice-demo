import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue, SCOPE_PRESETS } from '../../context/RevenueContext';
import { useL, ratioText } from '../../utils/bi';
import { amanahOptionsOf, REVENUE_SOURCES, REVENUE_SOURCE_KEYS, UNAVAILABLE_REVENUE_SOURCES } from '../../data/revenueLedger';
import { METRIC_DEFINITIONS } from '../../data/revenueMetrics';
import { metricDictionary } from '../../data/metricDictionary';
import { municipalitiesOf } from '../../data/catalog';
import { DATA_START } from '../../data/revenueLedger';
import { fmtMoney } from '../../utils/money';
import { measure, basisLabel, hasToDateVariant, BASIS } from '../../data/measure';
import { checkRange, rangeMessage, coverageLine } from '../../data/dateRange';

/* ---------- Provenance / status badges ---------- */
export function ProvenanceBadge({ kind = 'demo', size = 'md' }) {
  const { L } = useL();
  const map = {
    demo: { cls: 'rv-badge--demo', t: L('Illustrative demo data', 'بيانات توضيحية') },
    uploaded: { cls: 'rv-badge--up', t: L('Uploaded data', 'بيانات مرفوعة') },
    connected: { cls: 'rv-badge--ok', t: L('Connected data', 'بيانات متصلة') },
    unavailable: { cls: 'rv-badge--na', t: L('Unavailable source', 'مصدر غير متاح') },
    awaiting: { cls: 'rv-badge--wait', t: L('Awaiting verification', 'بانتظار التحقق') }
  };
  const m = map[kind] || map.demo;
  return <span className={`rv-badge ${m.cls}${size === 'sm' ? ' rv-badge--sm' : ''}`}>{m.t}</span>;
}

/* ---------- Metric definition popover ---------- */
export function DefinitionButton({ metric }) {
  const { B, L, ar } = useL();
  const rev = useRevenue();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const entry = useMemo(() => metricDictionary(rev.snapshot).find((e) => e.key === metric), [rev.snapshot, metric]);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  if (!entry) return null;
  const popId = `def-${metric}`;
  const comp = entry.completeness;
  return (
    <span className="rv-def" ref={ref}>
      <button type="button" className="rv-def__btn" aria-expanded={open} aria-controls={popId} aria-label={L('How is this calculated?', 'كيف يُحتسب هذا؟')} onClick={() => setOpen((o) => !o)}>?</button>
      {open && (
        <div id={popId} role="dialog" className="rv-def__pop">
          <b>{B(entry.label)}</b>
          <dl>
            <dt>{L('Definition', 'التعريف')}</dt><dd>{B(entry.definition)}</dd>
            <dt>{L('Formula', 'المعادلة')}</dt><dd>{B(entry.formula)}</dd>
            <dt>{L('Period', 'الفترة')}</dt><dd>{B(entry.period)}</dd>
            <dt>{L('Date basis', 'أساس التاريخ')}</dt><dd>{B(entry.dateBasis)}</dd>
            <dt>{L('Scope', 'النطاق')}</dt><dd dir="auto">{B(entry.scope)}</dd>
            <dt>{L('Sources', 'المصادر')}</dt><dd>{entry.sourceLabels.map((x) => B(x)).join(ar ? '، ' : ', ')}</dd>
            <dt>{L('Updated', 'آخر تحديث')}</dt><dd dir="ltr">{entry.updatedAt}</dd>
            <dt>{L('Rule version', 'إصدار القاعدة')}</dt><dd dir="ltr">{entry.ruleVersion}</dd>
            <dt>{L('Data completeness', 'اكتمال البيانات')}</dt><dd>{comp.calculable ? `${Math.round(comp.value * 100)}%` : L('Not calculable', 'غير قابل للاحتساب')}</dd>
            {entry.caveat && (<><dt>{L('Caution', 'تنبيه')}</dt><dd>{B(entry.caveat)}</dd></>)}
          </dl>
          <small><Link to="/metrics">{L('Open the metric dictionary', 'فتح قاموس المقاييس')}</Link></small>
        </div>
      )}
    </span>
  );
}

/* ---------- Metric tile ---------- */
export function MetricTile({ label, value, sub, metric, tone, delta, children, wide, to }) {
  const { L } = useL();
  return (
    <div className={`rv-tile${tone ? ` rv-tile--${tone}` : ''}${wide ? ' rv-tile--wide' : ''}`}>
      <div className="rv-tile__label"><span>{label}</span>{metric && <DefinitionButton metric={metric} />}</div>
      <div className="rv-tile__value" dir="ltr">{value}</div>
      {delta}
      {sub && <div className="rv-tile__sub">{sub}</div>}
      {children}
      {to && <Link className="rv-tile__more" to={to}>{L('Drill down: invoices and evidence', 'التفاصيل: الفواتير والأدلة')} ←</Link>}
    </div>
  );
}

export function PpDelta({ change, comparable = true, label }) {
  const { L } = useL();
  if (!change) return null;
  if (!comparable) return <div className="rv-delta rv-delta--na">{L('No comparison: the previous period is outside the data coverage', 'لا توجد مقارنة: الفترة السابقة خارج نطاق تغطية البيانات')}</div>;
  if (!change.calculable) return <div className="rv-delta rv-delta--na">{L('Change vs previous period: not calculable', 'التغير عن الفترة السابقة: غير قابل للاحتساب')}</div>;
  const v = change.value;
  const dir = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  return (
    <div className={`rv-delta rv-delta--${dir}`} dir="ltr" title={L('Each period is measured at its own end date (same age), so the comparison is like for like.', 'تُقاس كل فترة عند نهايتها (العمر نفسه) فالمقارنة مماثلة.')}>
      {v > 0 ? '▲' : v < 0 ? '▼' : '■'} {v > 0 ? '+' : ''}{v.toFixed(1)} pp {label ? <span className="rv-delta__lbl">{label}</span> : null}
    </div>
  );
}

/* ---------- Date range fields (shared validation: inverted ranges never run, out-of-coverage dates are adjusted AND explained) ---------- */
// `onChange({from,to})` is called only with a valid range; `onChange(null)` when the typed range is invalid.
export function DateRangeFields({ from, to, onChange, today, lang, idPrefix = 'rv', planMax = null, hint = null }) {
  const [draft, setDraft] = useState({ from, to }); const [msg, setMsg] = useState(null);
  const applied = useRef(null); // the range this control itself just applied: its own note must survive the prop update that follows
  useEffect(() => { if (applied.current && applied.current.from === from && applied.current.to === to) return; setDraft({ from, to }); setMsg(null); }, [from, to]);
  const ar = lang === 'ar'; const hintId = `${idPrefix}-date-hint`;
  const apply = (next) => {
    setDraft(next);
    const r = checkRange(next, { today });
    if (!r.ok) { setMsg({ code: r.code, bad: true }); onChange(null); return; }
    if (r.adjusted.length) { setDraft({ from: r.from, to: r.to }); setMsg({ code: r.adjusted[0], bad: false }); } else setMsg(null);
    applied.current = { from: r.from, to: r.to };
    onChange({ from: r.from, to: r.to });
  };
  return (
    <span className="rv-scope__dates">
      <input className="input rv-scope__date" type="date" aria-label={ar ? 'من' : 'From'} value={draft.from} min={DATA_START} max={today} aria-invalid={msg?.bad ? 'true' : undefined} aria-describedby={hintId} onChange={(e) => apply({ ...draft, from: e.target.value })} />
      <span className="muted">→</span>
      <input className="input rv-scope__date" type="date" aria-label={ar ? 'إلى' : 'To'} value={draft.to} min={DATA_START} max={today} aria-invalid={msg?.bad ? 'true' : undefined} aria-describedby={hintId} onChange={(e) => apply({ ...draft, to: e.target.value })} />
      <span id={hintId} className={`rv-scope__hint ${msg ? (msg.bad ? 'rv-scope__hint--bad' : 'rv-scope__hint--note') : ''}`} role={msg ? 'alert' : undefined}>{msg ? rangeMessage(msg.code, lang, { today, planMax }) : (hint || coverageLine(lang, { today }))}</span>
    </span>
  );
}

/* ---------- Collections up to TODAY for a closed period: a separate, labelled figure shown on request (EQ1) ---------- */
export function ToDateFigure({ snapshot }) {
  const rev = useRevenue(); const { L, lang } = useL();
  const scope = { from: rev.scopeEff.from, to: rev.scopeEff.to, amanah: rev.scopeEff.amanah, source: rev.scopeEff.source, scopeType: rev.scopeEff.scopeType, muni: rev.scopeEff.muni, status: rev.scopeEff.status };
  const [on, setOn] = useState(false); const [res, setRes] = useState(null); const [err, setErr] = useState(false);
  const closed = hasToDateVariant(scope, rev.cfg.cutoff);
  useEffect(() => {
    if (!on || !closed) return undefined; let live = true; setRes(null); setErr(false);
    measure(rev.data, scope, rev.cfg, BASIS.TO_DATE).then((r) => { if (live) setRes(r); }).catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [on, closed, JSON.stringify(scope), rev.cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!closed) return null;
  const fmt = (t) => `${money(t.collected)} · ${ratioText(t.collectedOverNet, lang === 'ar')}`;
  const money = (v) => fmtMoney(v, { lang });
  return (
    <div className="rv-todate">
      <button type="button" className="btn btn-sm btn-ghost" aria-expanded={on} onClick={() => setOn((v) => !v)}>{on ? L('Hide collections up to today', 'إخفاء التحصيل حتى اليوم') : L('Also show collections up to today', 'إظهار التحصيل حتى اليوم أيضاً')}</button>
      {on && (err ? <span className="muted">{L('Could not load.', 'تعذّر التحميل.')}</span> : !res ? <span className="muted">{L('Loading…', 'جارٍ التحميل…')}</span> : (
        <div className="rv-callout" role="note"><b>{basisLabel(scope, BASIS.TO_DATE, rev.cfg.cutoff, lang)}:</b> <bdi dir="ltr">{fmt(res.totals)}</bdi> — {L('for the same invoices; the headline above is', 'للفواتير نفسها؛ والرقم الرئيسي أعلاه هو')} {basisLabel(scope, BASIS.PERIOD_END, rev.cfg.cutoff, lang)}: <bdi dir="ltr">{fmt(snapshot.totals)}</bdi></div>
      ))}
    </div>
  );
}

/* ---------- Data status: the figures on screen are being refreshed, or the refresh failed and they belong to the PREVIOUS selection ---------- */
export function DataStatus() {
  const { loading, loadError, retryLoad } = useRevenue();
  const { L } = useL();
  if (loadError) return <div className="rv-callout rv-callout--bad" role="alert">{L('The figures could not be refreshed for this selection; what is shown belongs to the previous selection.', 'تعذّر تحديث الأرقام لهذا الاختيار؛ المعروض يخص الاختيار السابق.')} <button type="button" className="btn btn-sm" onClick={retryLoad}>{L('Retry', 'إعادة المحاولة')}</button></div>;
  if (loading) return <div className="rv-callout" role="status">{L('Updating the figures for this selection…', 'جارٍ تحديث الأرقام لهذا الاختيار…')}</div>;
  return null;
}

/* ---------- Scope bar (shared by every revenue screen) ---------- */
export function ScopeBar({ compact = false }) {
  const { scope, setPreset, setCustomRange, setAmanah, setSource, setScopeType, setMuni, setStatus, org, snapshot, cfg, meta } = useRevenue();
  const { L, B, lang, T, count } = useL();
  const amanahs = useMemo(() => amanahOptionsOf().filter((a) => !org.amanahKeys || org.amanahKeys.includes(a.key)), [org]);
  const label = (o) => (lang === 'ar' ? o.ar : lang === 'zh' ? o.zh : o.en);
  const munis = useMemo(() => (scope.amanah === 'all' || Array.isArray(scope.amanah) ? [] : municipalitiesOf(scope.amanah).filter(Boolean)), [scope.amanah]);
  const presets = [
    ['ytd', L('Year to date', 'السنة حتى اليوم')],
    ['month', L('This month', 'هذا الشهر')],
    ['lastMonth', L('Last month', 'الشهر الماضي')],
    ['last3', L('Last 3 complete months', 'آخر 3 أشهر مكتملة')],
    ['all', L('All data', 'كل البيانات')]
  ];
  return (
    <div className="rv-scope card" role="region" aria-label={L('Analysis scope', 'نطاق التحليل')}>
      <div className="rv-scope__row">
        <div className="rv-scope__group" role="group" aria-label={L('Period', 'الفترة')}>
          <span className="rv-scope__lbl">{L('Period', 'الفترة')}</span>
          {presets.map(([k, text]) => (
            <button key={k} type="button" className={`btn btn-sm ${scope.preset === k ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={scope.preset === k} onClick={() => setPreset(k)}>{text}</button>
          ))}
          <DateRangeFields from={scope.from} to={scope.to} today={cfg.cutoff} lang={lang} idPrefix="rv" onChange={(r) => { if (r) setCustomRange(r.from, r.to); }} /></div>
        <div className="rv-scope__group">
          <label className="rv-scope__lbl" htmlFor="rv-amanah">{L('Amanah', 'الأمانة')}</label>
          <select id="rv-amanah" className="select" value={Array.isArray(scope.amanah) ? 'all' : scope.amanah} onChange={(e) => setAmanah(e.target.value)}>
            <option value="all">{L('All Amanahs', 'جميع الأمانات')}{org.amanahKeys ? ` (${L('your access', 'ضمن صلاحيتك')})` : ''}</option>
            {amanahs.map((a) => <option key={a.key} value={a.key}>{label(a)}</option>)}
          </select>
          <label className="rv-scope__lbl" htmlFor="rv-source">{L('Revenue source', 'مصدر الإيراد')}</label>
          <select id="rv-source" className="select" value={scope.source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">{L('All revenue sources', 'جميع مصادر الإيراد')}</option>
            {REVENUE_SOURCE_KEYS.map((k) => <option key={k} value={k}>{lang === 'ar' ? REVENUE_SOURCES[k].ar : REVENUE_SOURCES[k].en}</option>)}
            {UNAVAILABLE_REVENUE_SOURCES.map((s) => <option key={s.id} value="__na" disabled>{(lang === 'ar' ? s.ar : s.en)} — {L('no records', 'لا سجلات')}</option>)}
          </select>
          <label className="rv-scope__lbl" htmlFor="rv-scopetype">{L('Central / internal', 'مركزي / داخلي')}</label>
          <select id="rv-scopetype" className="select" value={scope.scopeType || 'all'} onChange={(e) => setScopeType(e.target.value)}>
            <option value="all">{L('All', 'الكل')}</option>
            <option value="central">{L('Central', 'مركزي')}</option>
            <option value="internal">{L('Internal', 'داخلي')}</option>
          </select>
          <label className="rv-scope__lbl" htmlFor="rv-status">{L('Invoice status', 'حالة الفاتورة')}</label>
          <select id="rv-status" className="select" value={scope.status || 'all'} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{L('All statuses', 'كل الحالات')}</option>
            <option value="collected">{L('Collected in full', 'محصّلة بالكامل')}</option>
            <option value="open">{L('Still owing (open)', 'قائمة (غير مسددة)')}</option>
            <option value="overdue">{L('Overdue', 'متأخرة')}</option>
            <option value="partial">{L('Partially collected', 'محصّلة جزئياً')}</option>
            <option value="not_due">{L('Not yet due', 'لم يحن استحقاقها')}</option>
            <option value="cancelled">{L('Cancelled', 'ملغاة')}</option>
            <option value="excluded">{L('Excluded', 'مستبعدة')}</option>
          </select>
          {munis.length > 0 && (<>
            <label className="rv-scope__lbl" htmlFor="rv-muni">{L('Municipality', 'البلدية')}</label>
            <select id="rv-muni" className="select" value={scope.muni || 'all'} onChange={(e) => setMuni(e.target.value)}>
              <option value="all">{L('All municipalities', 'كل البلديات')}</option>
              {munis.map((m) => <option key={m.key} value={m.key}>{lang === 'ar' ? m.ar : m.en}</option>)}
            </select>
          </>)}
        </div>
      </div>
      {!compact && (
        <div className="rv-scope__meta">
          <span className="rv-badge rv-badge--sm rv-badge--demo" title={B(meta?.labelDetail)}>{B(meta?.label) || L('Demo data', 'بيانات تجريبية')}</span>
          {snapshot.quality.kinds.uploaded ? <ProvenanceBadge kind="uploaded" size="sm" /> : null}
          <span className="rv-chip">{L('Today (Riyadh)', 'اليوم (الرياض)')}: <b dir="ltr">{snapshot.cutoff}</b></span>
          <span className="rv-chip">{L(`${count(snapshot.population.issuedInPeriod)} invoices issued in period`, `${count(snapshot.population.issuedInPeriod)} فاتورة صادرة في الفترة`)}</span>
          {snapshot.basis && <span className="rv-chip" title={L('Invoices are selected by issue date; collections count only payments dated up to the reference date and are measured within net billed. Receipts by payment date are a separate indicator.', 'تُختار الفواتير بتاريخ الإصدار؛ ويُحتسب التحصيل بالمدفوعات المؤرخة حتى التاريخ المرجعي ضمن صافي المفوتر. المقبوض حسب تاريخ الدفع مؤشر مستقل.')}>{L('Date basis', 'أساس التاريخ')}: {L('invoice issue date', 'تاريخ إصدار الفاتورة')} · {L('collections up to', 'التحصيل حتى')} <b dir="ltr">{snapshot.basis.collectionsAsOf}</b></span>}
          {snapshot.equation && <span className={`rv-chip ${snapshot.equation.ok ? '' : 'rv-chip--bad'}`} title={L('gross = exclusions + net; net = collected + uncollected; gross ≥ net ≥ collected ≥ 0', 'الإجمالي = الاستبعادات + الصافي؛ الصافي = المحصّل + غير المحصّل؛ الإجمالي ≥ الصافي ≥ المحصّل ≥ 0')}>{snapshot.equation.ok ? '✓' : '✗'} {L('identities verified', 'المعادلات متحققة')}</span>}
          <span className="rv-chip">{L('Exclusion rules', 'قواعد الاستبعاد')}: <span dir="ltr">v2</span> · <Link to="/noncollection">{L('review', 'مراجعة')}</Link></span>
          <span className="rv-chip">{L('Grace days', 'أيام السماح')}: {cfg.graceDays} <em>({L('unresolved', 'غير محسوم')})</em></span>
        </div>
      )}
    </div>
  );
}

/* ---------- Data freshness & completeness ---------- */
export function DataStatusStrip() {
  const { snapshot } = useRevenue();
  const { L, B } = useL();
  const q = snapshot.quality;
  const { count } = useL();
  const items = [
    { k: 'conflicts', n: q.amountConflictCount, tone: q.amountConflictCount ? 'warn' : 'ok', text: L('amount conflicts', 'تعارضات في المبالغ'), to: '/risk' },
    { k: 'pending', n: q.pendingExclusionCount, tone: q.pendingExclusionCount ? 'warn' : 'ok', text: L('exclusions awaiting review', 'استبعادات بانتظار المراجعة'), to: '/noncollection' },
    { k: 'missing', n: q.missingFieldCount, tone: q.missingFieldCount ? 'warn' : 'ok', text: L('records with missing mandatory fields', 'سجلات بحقول إلزامية ناقصة'), to: '/risk' },
    { k: 'contract', n: q.contractIssueCount, tone: q.contractIssueCount ? 'warn' : 'ok', text: L('investment invoices without a linked contract', 'فواتير استثمار بلا عقد مرتبط'), to: '/risk' }
  ];
  return (
    <div className="rv-status card" role="region" aria-label={L('Data freshness and completeness', 'حداثة البيانات واكتمالها')}>
      <div className="rv-status__head">
        <b>{L('Data freshness & completeness', 'حداثة البيانات واكتمالها')}</b>
        <Link to="/data-sources" className="rv-link">{L('Source status', 'حالة المصادر')} →</Link>
      </div>
      <div className="rv-status__grid">
        <div className="rv-status__cell">
          <span>{L('Freshness', 'الحداثة')}</span>
          <b dir="ltr">{snapshot.cutoff}</b>
          <small>{L('Reference date of the loaded reports. A refresh adds a version; see Data sources for each source.', 'التاريخ المرجعي للتقارير المحمّلة. والتحديث يضيف إصداراً؛ راجع مصادر البيانات لكل مصدر.')}</small>
        </div>
        <div className="rv-status__cell">
          <span>{L('Source of figures', 'مصدر الأرقام')}</span>
          <b>{L('Demo data (periodic upload stand-in)', 'بيانات تجريبية (تحل محل الرفع الدوري)')}</b>
          <small>{L(`${count(q.records)} records · labelled demo — not the Ministry\'s figures`, `${count(q.records)} سجلاً · موسومة تجريبية — وليست أرقام الوزارة`)}</small>
        </div>
        {items.map((i) => (
          <Link key={i.k} to={i.to} className={`rv-status__cell rv-status__cell--${i.tone}`}>
            <span>{i.text}</span><b dir="ltr">{count(i.n)}</b>
          </Link>
        ))}
      </div>
      <div className="rv-status__note">{B(q.completenessNote)}</div>
    </div>
  );
}

export { ratioText };
