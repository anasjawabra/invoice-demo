// «تغيير الرسم» — the chart-type picker (docs/chart-library.md, «Picker and Smart Reports integration»).
// A popover on desktop, a bottom sheet on a phone (≤ 640 px). Options are grouped by purpose; each is a card with a small drawing of the person's OWN data in that type (a grey generic
// shape + the reason when the data cannot carry it). Choosing a card only PREVIEWS it in the larger pane; «تطبيق» applies it. Before applying, «ما سيتغيّر» states every change in how the
// figures are presented (aggregation, percentage basis, grouping, Top N + «Other», monthly ↔ cumulative) or says the numbers are the same. Pure decisions live in chartPickerLogic.js.
import React, { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChartSvg, ChartTable } from '../smart/ReportChart';
import { pickerModel, displayFor, recommendedConfig, changeLines, SAME_NUMBERS, pptxLine, pickText, nextIndexByRects, KEY_DIR, sameEffective, typeName } from './chartPickerLogic';
import { chartPreview, typeIdOf } from '../../data/chartCatalog';

const T = (lang, ar, en) => (lang === 'ar' ? ar : en);
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// the small drawing: the user's own data when the type fits, otherwise the generic shape, greyed
const Thumb = memo(function Thumb({ item, lang }) {
  const own = item.available && item.block;
  const block = useMemo(() => ({ ...(own ? item.block : item.previewSpec), title: '' }), [item, own]);
  return <div className={`cp-thumb${own ? '' : ' is-off'}`} aria-hidden="true"><ChartSvg block={block} lang={lang} w={own ? 360 : 280} /></div>;
});

function Card({ item, lang, selected, currentId, tabbable, onChoose, onKey, setRef }) {
  const off = !item.available; const isCurrent = item.id === currentId;
  return (
    <button type="button" role="radio" aria-checked={selected} aria-disabled={off || undefined} tabIndex={tabbable ? 0 : -1} data-opt={item.id} ref={setRef}
      className={`cp-card${selected ? ' is-sel' : ''}${off ? ' is-off' : ''}`} onClick={() => onChoose(item)} onKeyDown={(e) => onKey(e, item)}
      aria-describedby={off ? `cp-why-${item.id}` : undefined}>
      <Thumb item={item} lang={lang} />
      <span className="cp-card__txt">
        <span className="cp-card__name">{pickText(item.name, lang)}
          {item.recommended && <em className="cp-badge cp-badge--rec">{T(lang, 'موصى به', 'Recommended')}</em>}
          {isCurrent && <em className="cp-badge cp-badge--cur">{T(lang, 'الحالي', 'Current')}</em>}
        </span>
        <span className="cp-card__use">{pickText(item.use, lang)}</span>
        {off && <span className="cp-card__why" id={`cp-why-${item.id}`}><b>{T(lang, 'غير متاح: ', 'Not available: ')}</b>{pickText(item.reason, lang)}</span>}
      </span>
    </button>
  );
}

// props: { block (the block the config is applied to), cfg (the saved config or null), lang, anchorRef, onApply(cfg, { from, to, changes }), onReset(), onClose() }
export default function ChartPicker({ block, cfg, lang, anchorRef, onApply, onReset, onClose }) {
  const uid = useId(); const rtl = lang === 'ar';
  const panelRef = useRef(null); const optRefs = useRef({});
  const [base, setBase] = useState(cfg || {}); // the config the options are built from (changed by «reset to recommended»)
  const model = useMemo(() => pickerModel(block, base, lang), [block, base, lang]);
  const currentId = useMemo(() => typeIdOf(displayFor(block, cfg, lang) || block), [block, cfg, lang]);
  const [selId, setSelId] = useState(currentId);
  const sel = model.byId[selId] || model.byId[currentId]; const [table, setTable] = useState(false);
  const previewBlock = useMemo(() => (sel && sel.available && sel.block ? { ...sel.block, title: '' } : null), [sel]);
  const ghostBlock = useMemo(() => ({ ...(sel ? sel.previewSpec : chartPreview('bar')), title: '' }), [sel]);
  const moreIds = useMemo(() => new Set(model.more.flatMap((g) => g.items.map((i) => i.id))), [model]);
  const [showMore, setShowMore] = useState(() => moreIds.has(currentId) || moreIds.has(model.recommended));
  const [live, setLive] = useState('');
  const [pos, setPos] = useState(null);

  // placement: anchored under the toolbar button on desktop (clamped to the viewport), bottom sheet on a phone (CSS)
  const place = useCallback(() => {
    const a = anchorRef && anchorRef.current; const vw = window.innerWidth; const vh = window.innerHeight;
    if (!a || vw <= 640) { setPos(null); return; }
    const r = a.getBoundingClientRect(); const width = Math.min(900, vw - 32);
    let left = rtl ? r.left : r.right - width; left = Math.max(16, Math.min(left, vw - width - 16));
    const want = Math.min(vh - 32, 700); let top = r.bottom + 6; if (top + want > vh - 16) top = Math.max(16, vh - 16 - want); // as tall as the viewport allows, under the button when it fits
    setPos({ left, top, width, maxHeight: Math.max(320, vh - top - 16) });
  }, [anchorRef, rtl]);
  useLayoutEffect(() => { place(); }, [place]);
  useEffect(() => { window.addEventListener('resize', place); window.addEventListener('scroll', place, true); return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); }; }, [place]);

  // focus: into the dialog on open (the selected option); returned to the opener on close; focus is trapped while open
  useEffect(() => {
    const prev = document.activeElement; const el = optRefs.current[currentId] || panelRef.current; if (el && el.focus) el.focus({ preventScroll: true });
    document.body.classList.add('cp-open');
    return () => { document.body.classList.remove('cp-open'); const back = (anchorRef && anchorRef.current) || prev; if (back && back.focus) back.focus({ preventScroll: true }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onPanelKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const list = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null); if (!list.length) return;
    const first = list[0]; const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const ordered = useMemo(() => [...model.groups.flatMap((g) => g.items), ...(showMore ? model.more.flatMap((g) => g.items) : [])], [model, showMore]);
  const choose = (item) => {
    if (!item.available) { setLive(`${pickText(item.name, lang)}: ${T(lang, 'غير متاح', 'not available')} — ${pickText(item.reason, lang)}`); return; }
    setSelId(item.id); setLive(`${T(lang, 'معاينة', 'Preview')}: ${pickText(item.name, lang)}`);
  };
  const onKey = (e, item) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); choose(item); return; }
    const dir = KEY_DIR[e.key]; if (!dir) return; e.preventDefault();
    const els = ordered.map((i) => optRefs.current[i.id]).filter(Boolean); const idx = els.indexOf(e.currentTarget);
    const j = nextIndexByRects(els.map((n) => n.getBoundingClientRect()), idx < 0 ? 0 : idx, dir);
    if (els[j]) { els[j].focus(); els[j].scrollIntoView({ block: 'nearest' }); }
  };
  const tabbableId = ordered.some((i) => i.id === selId) ? selId : ordered[0] && ordered[0].id;

  const apply = () => { if (!sel || !sel.available) return; onApply(sel.cfg, { from: currentId, to: sel.id, changes: sel.changes }); };
  const unchanged = !!sel && sel.available && sel.id === currentId && sameEffective(block, sel.cfg, cfg || {});
  const reset = () => { const rc = recommendedConfig(block, lang); const next = rc.kind ? rc : {}; setBase(next); setSelId(model.recommended); setLive(T(lang, 'تمت إعادة الاختيار إلى الموصى به (معاينة)', 'Selection set back to the recommended chart (preview)')); };
  const lines = sel ? changeLines(sel.changes, lang) : [];
  const title = T(lang, 'تغيير الرسم', 'Change chart');

  const renderGroups = (groups) => groups.map((g) => (
    <section key={g.purpose} className="cp-group" role="group" aria-label={pickText(g.name, lang)}>
      <h4 className="cp-group__h">{pickText(g.name, lang)}</h4>
      <div className="cp-grid">
        {g.items.map((it) => <Card key={it.id} item={it} lang={lang} selected={it.id === selId} currentId={currentId} tabbable={it.id === tabbableId} onChoose={choose} onKey={onKey} setRef={(n) => { if (n) optRefs.current[it.id] = n; else delete optRefs.current[it.id]; }} />)}
      </div>
    </section>
  ));

  return createPortal(
    <>
      <div className="cp-scrim" onMouseDown={onClose} />
      <div ref={panelRef} className="cp" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} dir={rtl ? 'rtl' : 'ltr'} lang={lang} onKeyDown={onPanelKey} style={pos ? { left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight } : undefined} tabIndex={-1}>
        <header className="cp__head">
          <div><h3 id={`${uid}-t`} className="cp__title">{title}</h3>{block.title && <div className="cp__sub" dir="auto">{block.title}</div>}</div>
          <button type="button" className="cp__x" aria-label={T(lang, 'إغلاق', 'Close')} onClick={onClose}>✕</button>
        </header>
        <div className="cp__body">
          <div className="cp__list" role="radiogroup" aria-label={T(lang, 'نوع الرسم', 'Chart type')}>
            {renderGroups(model.groups)}
            {model.more.length > 0 && (
              <div className="cp-more">
                <button type="button" className="cp-morebtn" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
                  <span aria-hidden="true">{showMore ? '▾' : '▸'}</span> {T(lang, 'مخططات أخرى', 'More charts')} <small>({model.more.reduce((n, g) => n + g.items.length, 0)})</small>
                </button>
                {showMore && renderGroups(model.more)}
              </div>
            )}
          </div>
          <aside className="cp__pane" aria-label={T(lang, 'معاينة', 'Preview')}>
            <div className="cp-pane__head"><b>{T(lang, 'معاينة', 'Preview')}</b>{sel && <span> — {pickText(sel.name, lang)}</span>}{sel && sel.id === currentId && <em className="cp-badge cp-badge--cur">{T(lang, 'الحالي', 'Current')}</em>}</div>
            <div className="cp-pane__chart">
              {previewBlock
                ? (table ? <ChartTable block={sel.block} lang={lang} /> : <ChartSvg key={sel.id} block={previewBlock} lang={lang} label={`${T(lang, 'معاينة', 'Preview')}: ${pickText(sel.name, lang)}`} />)
                : <div className="cp-thumb is-off"><ChartSvg block={ghostBlock} lang={lang} w={300} /></div>}
            </div>
            <div className="cp-change" role="group" aria-label={T(lang, 'ما سيتغيّر', 'What will change')}>
              <b>{T(lang, 'ما سيتغيّر', 'What will change')}</b>
              {sel && sel.id === currentId && unchanged ? <p>{T(lang, 'هذا هو الرسم الحالي — لا تغيير.', 'This is the current chart — no change.')}</p>
                : lines.length ? <ul>{lines.map((l, i) => <li key={`${l.key}${i}`}>{l.text}</li>)}</ul>
                  : <p>{pickText(SAME_NUMBERS, lang)}</p>}
              {sel && sel.available && <small className="muted cp-change__exp">{pptxLine(sel.export, lang)}</small>}
              {sel && sel.available && lines.length > 0 && <small className="muted">{T(lang, 'مجاميع الأرقام لا تتغيّر؛ يتغيّر عرضها فقط.', 'The totals do not change; only how they are presented.')}</small>}
            </div>
          </aside>
        </div>
        <footer className="cp__foot">
          <button type="button" className="btn btn-sm btn-primary" disabled={!sel || !sel.available || unchanged} onClick={apply}>{T(lang, 'تطبيق', 'Apply')}</button>
          <button type="button" className="btn btn-sm" onClick={onClose}>{T(lang, 'إلغاء', 'Cancel')}</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={reset} title={T(lang, `الموصى به: ${typeName(model.recommended, lang)}`, `Recommended: ${typeName(model.recommended, lang)}`)}>{T(lang, 'إعادة إلى الموصى به', 'Reset to recommended')}</button>
          <button type="button" className="btn btn-sm btn-ghost cp__tbl" aria-pressed={table} onClick={() => setTable((v) => !v)}>{T(lang, 'عرض جدول البيانات', 'View data table')}</button>
        </footer>
        <div className="cp-live" role="status" aria-live="polite">{live}</div>
      </div>
    </>,
    document.body
  );
}
