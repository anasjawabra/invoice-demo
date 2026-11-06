// ChartFrame — a report chart WITH its toolbar: «تغيير الرسم» (the picker), «تخصيص» (the customize panel), the current type, and a quiet «معدّل / Modified» marker with «إعادة إلى الموصى به».
// Self-contained and reusable: any page that holds a chart block can wrap it.  Props:
//   block        the block the saved config is applied to (the report's block, after the legacy global command if any)
//   displayBlock optional: the block already derived for display (the parent ran applyView); otherwise it is derived from `view`
//   chartId      the key of the chart's config in view.charts (default block.id)
//   view         { chartKind, only, charts } (src/data/reportView.js)
//   onViewChange(newView, meta)  called with a NEW view when the person applies a change; meta = { chartId, note, from, to, kind:'picker'|'customize'|'reset' }. The parent keeps the view
//                (Smart Reports appends a view message). The figures never change and the data service is never called.
//   picker       'full' (labelled buttons) | 'compact' (icon-only buttons) | false (no toolbar: the plain ReportChart)
//   onSelect, table, lang   as ReportChart
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useL } from '../../utils/bi';
import ReportChart from '../smart/ReportChart';
import ChartPicker from './ChartPicker';
import ChartCustomize from './ChartCustomize';
import { chartConfigOf, setChartConfig } from '../../data/reportView';
import { typeIdOf } from '../../data/chartCatalog';
import { customizeModel, displayFor, hasCfg, sameEffective, typeName, recommendedConfig, changeNote, customizeNote, resetNote } from './chartPickerLogic';

const T = (lang, ar, en) => (lang === 'ar' ? ar : en);
const IconSwap = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 13V8M6 13V3M10 13V6M14 13V9" /></svg>;
const IconTune = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M2 4h7M13 4h1M2 12h1M7 12h7" /><circle cx="11" cy="4" r="1.7" /><circle cx="5" cy="12" r="1.7" /></svg>;

export default function ChartFrame({ block, displayBlock = null, chartId: chartIdProp, view, onViewChange, lang: langProp, picker = 'full', onSelect = null, table = true, selected = null, className = '' }) {
  const { lang: ctxLang } = useL(); const lang = langProp || ctxLang; const chartId = chartIdProp || block.id;
  const uid = useId(); const btnRef = useRef(null);
  const saved = chartConfigOf(view, chartId); const modified = hasCfg(saved);
  const [open, setOpen] = useState(false); const [cust, setCust] = useState(false); const [draft, setDraft] = useState(null);
  const editable = !!picker && typeof onViewChange === 'function' && !!chartId;
  const dirty = cust && draft !== null && !sameEffective(block, draft, saved || {});
  // what is drawn: the draft while customizing, otherwise the block the parent derived (or derived here from the saved config)
  const shown = useMemo(() => { const b = cust && draft !== null ? displayFor(block, draft, lang) : displayBlock || displayFor(block, saved, lang); return chartId && b.id !== chartId ? { ...b, id: chartId } : b; }, [cust, draft, block, displayBlock, saved, lang, chartId]);
  useEffect(() => { setDraft(null); setCust(false); }, [JSON.stringify(saved || {}), chartId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!editable) return <ReportChart block={shown} lang={lang} table={table} onSelect={onSelect} selected={selected} className={className} />;

  const both = (fn) => ({ ar: fn('ar'), en: fn('en') }); // the message that records the change reads right whichever language the page is later shown in
  const emit = (cfg, note, meta) => onViewChange(setChartConfig(view, chartId, cfg, block), { chartId, note, ...meta });
  const resetRecommended = () => { const rc = recommendedConfig(block, lang); emit(rc, both((l) => resetNote(block.title, l)), { kind: 'reset', from: typeIdOf(shown), to: typeIdOf(block) }); setOpen(false); setCust(false); };
  const compact = picker === 'compact';
  const startCust = () => { if (cust) { setCust(false); setDraft(null); } else { setDraft(saved ? { ...saved } : {}); setCust(true); } };

  const head = (
    <div className={`cf-bar${compact ? ' cf-bar--compact' : ''}`} role="group" aria-label={T(lang, 'أدوات الرسم', 'Chart tools')}>
      <span className="cf-chip" title={T(lang, 'نوع الرسم الحالي', 'Current chart type')}>{typeName(typeIdOf(shown), lang)}</span>
      {modified && <span className="cf-mod"><span className="cf-mod__t">{T(lang, 'معدّل', 'Modified')}</span><button type="button" className="cf-link" onClick={resetRecommended}>{T(lang, 'إعادة إلى الموصى به', 'Reset to recommended')}</button></span>}
      <button type="button" ref={btnRef} className="cf-btn" aria-haspopup="dialog" aria-expanded={open} aria-label={compact ? T(lang, 'تغيير الرسم', 'Change chart') : undefined} title={T(lang, 'تغيير نوع الرسم', 'Change the chart type')} onClick={() => setOpen(true)}><IconSwap />{!compact && <span>{T(lang, 'تغيير الرسم', 'Change chart')}</span>}</button>
      <button type="button" className={`cf-btn${cust ? ' is-on' : ''}`} aria-expanded={cust} aria-controls={`${uid}-cust`} aria-label={compact ? T(lang, 'تخصيص', 'Customize') : undefined} title={T(lang, 'تخصيص الرسم', 'Customize the chart')} onClick={startCust}><IconTune />{!compact && <span>{T(lang, 'تخصيص', 'Customize')}</span>}</button>
    </div>
  );
  const extra = cust ? (
    <ChartCustomize id={`${uid}-cust`} block={block} cfg={draft || {}} lang={lang} dirty={dirty} onDraft={setDraft}
      onApply={() => { const to = typeIdOf(shown); emit(draft || {}, both((l) => customizeNote(block.title, l, customizeModel(block, draft || {}, l).changes)), { kind: 'customize', from: typeIdOf(displayBlock || displayFor(block, saved, lang)), to }); }}
      onCancel={() => { setCust(false); setDraft(null); }} onReset={() => setDraft(recommendedConfig(block, lang))} />
  ) : null;

  return (
    <>
      <ReportChart block={shown} lang={lang} table={table} onSelect={onSelect} selected={selected} className={`cf ${className}`} head={head} extra={extra} />
      {open && <ChartPicker block={block} cfg={saved} lang={lang} anchorRef={btnRef} onClose={() => setOpen(false)}
        onReset={resetRecommended}
        onApply={(cfg, meta) => { setOpen(false); emit(cfg, both((l) => changeNote(block.title, meta.from, meta.to, l, meta.changes)), { kind: 'picker', from: meta.from, to: meta.to, changes: meta.changes }); }} />}
    </>
  );
}
