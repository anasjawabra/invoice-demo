// «التقارير الذكية» — the ONE reporting experience (it replaces the former report centre and the former smart-reports page).
// A conversation: the user asks for a report or asks a question, or attaches files; the assistant answers from the shared data layer and the files.
// Follow-ups act on the latest result («change the chart», «show the tables only», «turn it into a presentation»); see src/data/chatIntents.js.
// Interpretation is rule-based (it is NOT a language model) and the page says so. Each report is a MODEL (src/data/reportModel.js)
// that is both rendered here and exported, so the file always contains what is on screen.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { municipalitiesOf } from '../data/catalog';
import { amanahFilterOptions, REVENUE_SOURCE_KEYS } from '../data/revenueLedger';
import { previousScope } from '../data/revenueMetrics';
import { startOfYear, startOfMonth } from '../data/clock';
import { interpret, defaultSpec, describeChange, previousMonthScope, SUPPORTED_HELP } from '../data/reportIntents';
import { buildReportModel, SECTION_META, SECTION_ORDER } from '../data/reportModel';
import { sourceAr, sourceEn } from '../data/insightsEngine';
import ReportView from '../components/smart/ReportView';
import { exportModel, reportFileName, EXPORT_FORMATS } from '../utils/exportReportModel';
import { interpretChat, CHART_NAME } from '../data/chatIntents';
import { applyView, mergeView, emptyView, hasCharts, hasTables } from '../data/reportView';
import { readAttachment, previewOf, kindLabel, noteText, sizeText, ACCEPT, MAX_FILES } from '../data/chatFiles';
import { buildAttachmentModel, refsOfAttachments } from '../data/chatAnalysis';
import { fmtRiyadh, fmtRangeText, fmtDateText } from '../data/clock';
import { DateRangeFields } from '../components/revenue/RevenueUI';
import { measure, headlineCfg } from '../data/measure';
import { usePersistOnChange } from '../utils/usePersistOnChange';
import LocalDataPanel from '../components/LocalDataPanel';
import { PRESETS, detectPreset } from '../data/periodPresets';

const STORE_KEY = 'ib_smart_convs_v1';
const loadConvs = () => { try { const v = JSON.parse(window.localStorage.getItem(STORE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
// a regenerated system report is never stored; the answer built from attached files (`amodel` — the files themselves are never stored) is kept so it survives a reload, unless storage is short
const slimConv = (x, keep) => ({ ...x, messages: x.messages.map(({ model, progress, amodel, ...m }) => (keep && amodel ? { ...m, amodel } : m)) });
const saveConvs = (c) => { const list = c.slice(0, 30); try { const full = JSON.stringify(list.map((x) => slimConv(x, true))); window.localStorage.setItem(STORE_KEY, full.length < 2500000 ? full : JSON.stringify(list.map((x) => slimConv(x, false)))); } catch { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(list.map((x) => slimConv(x, false)))); } catch { /* storage unavailable: history stays in memory */ } } };
// unsent text of the request box, kept per conversation for this browser session (written only when the user types; cleared on send)
const DRAFT_KEY = 'ib_smart_drafts_v1';
const readDrafts = () => { try { const v = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const writeDraft = (id, text) => { try { const d = readDrafts(); if (text) d[id || 'new'] = text; else delete d[id || 'new']; if (Object.keys(d).length) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else window.sessionStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable: the draft stays in the box only */ } };
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const SUGGESTIONS = [
  { ar: 'أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم', en: 'Create the revenue report for this month to date' },
  { ar: 'قارن أداء التحصيل بين الأمانات', en: 'Compare collection performance between Amanahs' },
  { ar: 'حلّل المتأخرات حسب مصدر الإيراد', en: 'Analyse overdue balances by revenue source' },
  { ar: 'جهّز تقريراً شهرياً بالمقارنة مع العام الماضي', en: 'Prepare a monthly report compared with last year' }
];
const FOLLOW_UPS = [
  { ar: 'قارن بالشهر الماضي', en: 'Compare with last month' },
  { ar: 'اعرض أمانة الرياض فقط', en: 'Show Riyadh Amanah only' },
  { ar: 'أضف تحليل الاستبعادات', en: 'Add the exclusions analysis' },
  { ar: 'حوّله إلى ملخص تنفيذي', en: 'Turn it into an executive summary' }
];
const STEPS = { scope: ['أحدد النطاق والتصفية', 'Setting the scope and filters'], read: ['أقرأ بيانات الفواتير والتحصيل', 'Reading invoice and collection data'], compare: ['أحسب المقارنة بالفترة المكافئة', 'Computing the equivalent-period comparison'], build: ['أُعدّ الجداول والرسوم والنتائج', 'Preparing tables, charts and findings'], check: ['أراجع المطابقة المالية', 'Checking the financial reconciliation'] };

function FilterPanel({ spec, today, ar, L, sourceName, onApply }) {
  const sp = spec || defaultSpec(today); const sc = sp.scope;
  const [d, setD] = useState({ from: sc.from, to: sc.to, amanah: Array.isArray(sc.amanah) ? '__multi' : sc.amanah, muni: sc.muni, source: sc.source, status: sc.status || 'all', scopeType: sc.scopeType || 'all', compare: sp.compare });
  const munis = d.amanah !== 'all' && d.amanah !== '__multi' ? municipalitiesOf(d.amanah).filter(Boolean) : [];
  const [badRange, setBadRange] = useState(false); const [rk, setRk] = useState(0);
  const preset = (from, to) => { setBadRange(false); setRk((n) => n + 1); setD((x) => ({ ...x, from, to })); };
  const ams = amanahFilterOptions();
  return (
    <div className="sr-filters card" role="region" aria-label={L('التصفية', 'Filters')}>
      <div className="sr-filters__row">
        <span className="rv-scope__lbl">{L('الفترة', 'Period')}</span>
        {PRESETS.map((p) => <button key={p.key} type="button" className="btn btn-sm btn-ghost" onClick={() => { const r = p.range(today); preset(r.from, r.to); }}>{ar ? p.ar : p.en}</button>)}
        <DateRangeFields key={rk} from={d.from} to={d.to} today={today} lang={ar ? 'ar' : 'en'} idPrefix="sr" onChange={(r) => { setBadRange(!r); if (r) setD((x) => ({ ...x, from: r.from, to: r.to })); }} />
      </div>
      <div className="sr-filters__row">
        <label className="rv-scope__lbl" htmlFor="sr-am">{L('الأمانة / الجهة', 'Amanah')}</label>
        <select id="sr-am" className="select" value={d.amanah} onChange={(e) => setD({ ...d, amanah: e.target.value, muni: 'all' })}><option value="all">{L('كل الأمانات والجهات', 'All Amanahs')}</option>{Array.isArray(sc.amanah) && <option value="__multi">{sc.amanah.map((k) => { const x = ams.find((y) => y.key === k); return x ? (ar ? x.ar : x.en) : k; }).join(L('، ', ', '))}</option>}{ams.map((a) => <option key={a.key} value={a.key}>{ar ? a.ar : a.en}</option>)}</select>
        {munis.length > 0 && <><label className="rv-scope__lbl" htmlFor="sr-mu">{L('البلدية', 'Municipality')}</label><select id="sr-mu" className="select" value={d.muni} onChange={(e) => setD({ ...d, muni: e.target.value })}><option value="all">{L('كل البلديات', 'All municipalities')}</option>{munis.map((m) => <option key={m.key} value={m.key}>{ar ? m.ar : m.en}</option>)}</select></>}
        <label className="rv-scope__lbl" htmlFor="sr-src">{L('المصدر', 'Source')}</label>
        <select id="sr-src" className="select" value={d.source} onChange={(e) => setD({ ...d, source: e.target.value })}><option value="all">{L('كل المصادر', 'All sources')}</option>{REVENUE_SOURCE_KEYS.map((k) => <option key={k} value={k}>{sourceName(k)}</option>)}</select>
      </div>
      <div className="sr-filters__row">
        <label className="rv-scope__lbl" htmlFor="sr-st">{L('حالة الفاتورة', 'Invoice status')}</label>
        <select id="sr-st" className="select" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}>{[['all', 'كل الحالات', 'All statuses'], ['collected', 'محصّلة', 'Collected'], ['open', 'قائمة', 'Open'], ['overdue', 'متأخرة', 'Overdue'], ['partial', 'جزئية', 'Partial'], ['not_due', 'لم تستحق', 'Not yet due'], ['cancelled', 'ملغاة', 'Cancelled'], ['excluded', 'مستبعدة', 'Excluded']].map(([k, a, e]) => <option key={k} value={k}>{L(a, e)}</option>)}</select>
        <label className="rv-scope__lbl" htmlFor="sr-cm">{L('المقارنة', 'Comparison')}</label>
        <select id="sr-cm" className="select" value={d.compare} onChange={(e) => setD({ ...d, compare: e.target.value })}><option value="none">{L('بدون', 'None')}</option><option value="prev_year">{L('نفس الفترة من العام السابق', 'Same period last year')}</option><option value="prev_month">{L('الشهر الماضي (المدة المنقضية نفسها)', 'Last month (same elapsed days)')}</option></select>
      </div>
      <div className="sr-filters__row"><button type="button" className="btn btn-primary btn-sm" disabled={badRange} onClick={() => { onApply({ compare: d.compare, scope: { from: d.from, to: d.to, amanah: d.amanah === '__multi' ? sc.amanah : d.amanah, muni: d.muni, source: d.source, status: d.status, scopeType: d.scopeType } }); }}>{L('تطبيق وتحديث التقرير', 'Apply and update the report')}</button><span className="muted" style={{ fontSize: 12 }}>{L('التقارير الجديدة تستخدم هذه التصفية حتى تغيّرها.', 'New reports keep using these filters until you change them.')}</span></div>
    </div>
  );
}

// «How I understood your request»: the six things that decide what the report says, each tagged with where it came from.
// It states what WAS applied (never that the request was applied in full); the latest report can be edited with the filter panel.
const FIELD_GROUPS = [['period', ['period']], ['amanah', ['amanah', 'muni']], ['source', ['source']], ['status', ['status', 'st']], ['cmp', ['cmp']], ['basis', ['basis']]];
function InterpretationSummary({ msg, chips, L, editable, editing, onEdit, panel, pending = false }) {
  const by = Object.fromEntries(chips.map((c) => [c.k, c]));
  const changed = new Set(msg.changeKeys || []); const keyOf = { period: ['period'], amanah: ['amanah', 'muni'], source: ['source'], status: ['status', 'scopeType'], cmp: ['compare'], basis: [] };
  const rows = [
    [L('الفترة', 'Reporting period'), by.period?.value, 'period'],
    [L('الأمانة / البلدية', 'Amanah / municipality'), [by.amanah?.value, by.muni?.value && by.muni.value !== L('كل البلديات', 'All municipalities') ? by.muni.value : null].filter(Boolean).join(' · '), 'amanah'],
    [L('مصدر الإيراد', 'Revenue source'), by.source?.value, 'source'],
    [L('حالة الفاتورة', 'Invoice status'), [by.status?.value, by.st?.value].filter(Boolean).join(' · '), 'status'],
    [L('فترة المقارنة', 'Comparison'), by.cmp?.value || L('بدون مقارنة', 'No comparison'), 'cmp'],
    [L('أساس القياس', 'Reporting basis'), by.basis?.value, 'basis']
  ];
  const tag = (g) => (keyOf[g].some((k) => changed.has(k)) ? L('من طلبك', 'from your request') : msg.changeKeys ? (msg.firstReport ? L('الافتراضي', 'default') : L('كما كان', 'unchanged')) : null);
  return (
    <div className="sr-interp" role="group" aria-label={L('كيف فهمتُ طلبك', 'How I read your request')}>
      <div className="sr-interp__head"><b>{L('كيف فهمتُ طلبك', 'How I read your request')}</b>{editable && <button type="button" className="btn btn-sm btn-ghost" aria-expanded={!!editing} onClick={onEdit}>{editing ? L('إغلاق التعديل', 'Close editing') : L('تعديل', 'Edit')}</button>}</div>
      <dl className="sr-interp__grid">{rows.map(([k, v, g]) => <div key={g} className="sr-interp__item"><dt>{k}</dt><dd><bdi>{v}</bdi>{tag(g) && <small className={`sr-interp__tag${keyOf[g].some((x) => changed.has(x)) ? ' is-req' : ''}`}>{tag(g)}</small>}</dd></div>)}</dl>
      <div className="muted sr-interp__note">{pending ? L('هذا ما سأطبّقه إن أكّدت. عدّله إن لم يطابق ما قصدته.', 'This is what I will apply if you confirm. Edit it if it is not what you meant.') : L('هذا ما طُبّق على التقرير. إن لم يطابق ما قصدته فعدّله هنا أو أعد صياغة الطلب؛ وما لا أستطيع تطبيقه أسألك عنه قبل الإعداد.', 'This is what was applied to the report. If it is not what you meant, edit it here or rephrase; anything I cannot apply I ask about before generating.')}</div>
      {editing && panel}
    </div>
  );
}

/* ---------------- attachments in the composer ---------------- */
const ICON = { pdf: 'PDF', docx: 'DOC', sheet: 'XLS', csv: 'CSV', pptx: 'PPT', image: 'IMG', doc: 'DOC', ppt: 'PPT', unknown: '?' };
function FilePreview({ f, ar, L }) {
  const pv = previewOf(f);
  return (
    <div className="sr-filepv" role="region" aria-label={`${L('معاينة', 'Preview')} ${f.name}`}>
      {pv.type === 'image' && pv.src && <img src={pv.src} alt={f.name} className="sr-filepv__img" />}
      {pv.type === 'table' && (
        <div className="table-wrap" tabIndex={0}>
          <table className="table"><caption className="muted" style={{ textAlign: 'start', fontSize: 12 }}>{pv.sheet}{pv.sheets > 1 ? ` · ${L(`${pv.sheets} أوراق`, `${pv.sheets} sheets`)}` : ''} · {pv.totalRows.toLocaleString('en-US')} {L('صف', 'rows')}</caption>
            <thead><tr>{pv.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{pv.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} dir="auto">{String(c)}</td>)}</tr>)}</tbody></table>
        </div>
      )}
      {pv.type === 'text' && <ol className="sr-filepv__lines">{pv.lines.map((l, i) => <li key={i} dir="auto">{l.length > 200 ? `${l.slice(0, 199)}…` : l}</li>)}</ol>}
      {pv.type === 'none' && <div className="muted">{L('لا معاينة متاحة لهذا الملف.', 'No preview is available for this file.')}</div>}
      {f.note && <div className="sr-filepv__note" role="note">{noteText(f.note, ar)}</div>}
    </div>
  );
}
function FileChip({ f, ar, L, open, onToggle, onRemove }) {
  const state = f.reading ? L('جارٍ القراءة…', 'Reading…') : f.status === 'ready' ? L('جاهز', 'Ready') : f.status === 'partial' ? L('قُرئ جزئياً', 'Partly read') : f.kind === 'image' ? L('معاينة فقط', 'Preview only') : L('لم يُقرأ', 'Not read');
  return (
    <div className={`sr-file sr-file--${f.reading ? 'busy' : f.status}`} role="listitem">
      <span className="sr-file__ico" aria-hidden="true">{f.kind === 'image' && f.preview ? <img src={f.preview} alt="" /> : ICON[f.kind] || '?'}</span>
      <button type="button" className="sr-file__main" aria-expanded={!!open} disabled={!!f.reading} onClick={onToggle} title={L('معاينة', 'Preview')}>
        <b dir="auto">{f.name}</b>
        <small>{kindLabel(f.kind, ar)} · {sizeText(f.size)} · {f.reading ? <><span className="sr-spin" aria-hidden="true" /> {state}</> : state}</small>
      </button>
      <button type="button" className="sr-file__x" aria-label={`${L('إزالة', 'Remove')} ${f.name}`} onClick={onRemove}>×</button>
    </div>
  );
}
/* ---------------- the assistant "at work": typing dots, a step list, text that is written out ---------------- */
// Presentation only: the steps shown are the real stages of the work (each is paced a little so they can be followed); the dots show the reply is being prepared.
const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
function TypingDots({ label }) { return <span className="sr-dots" role="status" aria-label={label}><i /><i /><i /></span>; }
function AgentSteps({ order, current, textOf, L, onStop }) {
  const idx = Math.max(0, order.indexOf(current));
  return (
    <div className="sr-steps" role="status" aria-live="polite">
      <div className="sr-steps__head"><TypingDots label={L('المساعد يعمل', 'The assistant is working')} /><b>{L('المساعد يعمل على طلبك…', 'The assistant is working on your request…')}</b>{onStop && <button type="button" className="btn btn-sm btn-ghost" onClick={onStop}>{L('إيقاف', 'Stop')}</button>}</div>
      <ol className="sr-steps__list">{order.map((k, i) => <li key={k} className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''}><span className="sr-steps__mark" aria-hidden="true">{i < idx ? '✓' : i === idx ? <span className="sr-spin" /> : '○'}</span>{textOf(k)}</li>)}</ol>
    </div>
  );
}
function Typewriter({ text, animate, onTick }) {
  const full = String(text ?? ''); const [n, setN] = useState(animate && !reducedMotion() ? 0 : full.length);
  useEffect(() => { if (n >= full.length) return undefined; const t = window.setTimeout(() => { setN((x) => Math.min(full.length, x + Math.max(2, Math.ceil(full.length / 80)))); onTick?.(); }, 20); return () => window.clearTimeout(t); }, [n, full]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{full.slice(0, n)}{n < full.length && <span className="sr-caret" aria-hidden="true" />}</>;
}
const SYS_ORDER = ['scope', 'read', 'compare', 'build', 'check']; const ATT_ORDER = ['files', 'refs', 'match', 'analyze'];
const PACE = 380;
const CHAT_STEPS = { files: ['أقرأ الملفات المرفقة', 'Reading the attached files'], refs: ['أستخرج أرقام الفواتير منها', 'Extracting invoice numbers from them'], match: ['أطابقها مع بيانات النظام', 'Matching them with the system data'], analyze: ['أحلل الجداول وأقارنها بالنظام', 'Analysing the tables and comparing with the system'] };
const summarize = (model) => { const k = model.headline.find((b) => b.type === 'kpis'); const items = (k?.items || []).slice(0, 5).map((i) => `${i.label}: ${i.value}`).join(' · '); return [model.summaryText, items].filter(Boolean).join('\n'); };

export default function SmartReports({ embedded = false, initialQuery = null, onQueryConsumed = null }) {
  const rev = useRevenue();
  const { lang, ar } = useL();
  const L = useCallback((a, e) => (ar ? a : e), [ar]); // Arabic first, English second (the shared useL().L is English first)
  const today = rev.cfg.cutoff;
  const [convs, setConvs] = useState(loadConvs);
  const [activeId, setActiveId] = useState(() => loadConvs()[0]?.id || null);
  const [input, setInput] = useState(() => readDrafts()[loadConvs()[0]?.id || 'new'] || '');
  const [busy, setBusy] = useState(null); // { msgId, step, token }
  const [showHistory, setShowHistory] = useState(false);
  const [editOpen, setEditOpen] = useState(false); const [editPendingId, setEditPendingId] = useState(null);
  const [exporting, setExporting] = useState('');
  const [models, setModels] = useState({}); // msgId -> model (in memory; a system report is regenerated from its spec when a stored conversation is reopened)
  const [collapsed, setCollapsed] = useState({});
  const [files, setFiles] = useState([]); // attachments waiting in the composer: { id, name, size, kind, status, note, reading, … }
  const [fileNote, setFileNote] = useState('');
  const [previewId, setPreviewId] = useState(null);
  const [drag, setDrag] = useState(false);
  const [typing, setTyping] = useState({}); // msgId -> the reply is being prepared (typing dots)
  const animated = useRef(new Set()); const thinkTimers = useRef({}); // ids of messages written in this session (they are written out); pending 'thinking' timers
  const attData = useRef({}); // msgId -> what the analysis was built from (kept in this browser tab only; the files themselves are never stored)
  const endRef = useRef(null); const taRef = useRef(null); const fileRef = useRef(null);

  // a new conversation starts from the SHARED filters of the management area, so dashboard, fixed reports and smart reports speak about the same scope
  const sharedSpec = useMemo(() => { const e = rev.scopeEff; return { ...defaultSpec(today), preset: rev.scope.preset, scope: { from: e.from, to: e.to, amanah: e.amanah, source: e.source, scopeType: e.scopeType || 'all', muni: e.muni || 'all', status: e.status || 'all', product: e.product, mainClass: e.mainClass } }; }, [rev.scopeEff, rev.scope.preset, today]);
  const conv = convs.find((c) => c.id === activeId) || null;
  const spec = conv?.spec || null;
  const labelOfAmanah = useCallback((k) => { const a = amanahFilterOptions().find((x) => x.key === k); return a ? (ar ? a.ar : a.en) : k; }, [ar]);

  usePersistOnChange(convs, saveConvs); // written only after a user action, never when the page loads or a stored conversation is reopened
  // follow the conversation only when it GROWS while it is open (never on arrival or when reopening — F-16a)
  const seenLen = useRef({ id: null, n: 0 });
  useEffect(() => { const n = conv?.messages.length || 0; const grew = seenLen.current.id === conv?.id && n > seenLen.current.n; seenLen.current = { id: conv?.id, n }; if (grew) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [conv?.id, conv?.messages.length]);
  useEffect(() => { const el = taRef.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; } }, [input]);

  // switching conversation brings back that conversation's unsent text (and keeps the one just left)
  const draftFor = useRef(activeId || 'new');
  useEffect(() => { const key = activeId || 'new'; if (draftFor.current === key) return; draftFor.current = key; setInput(readDrafts()[key] || ''); }, [activeId]);
  const onInput = (v) => { setInput(v); writeDraft(draftFor.current, v); };
  const patchConv = useCallback((id, fn) => setConvs((cs) => { let changed = false; const n = cs.map((c) => { if (c.id !== id) return c; const r = fn(c); if (r !== c) changed = true; return r; }); return changed ? n : cs; }), []);
  const patchMsg = useCallback((convId, msgId, patch) => patchConv(convId, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) })), [patchConv]);

  /* ---------------- results: what the conversation has produced, and how it is shown now ---------------- */
  const modelOf = useCallback((m) => models[m.id] || m.amodel || null, [models]);
  const resultOf = useCallback((m, list) => { // → { model (with its view applied), view, rootId, rootKind } | null
    if (m.role !== 'assistant') return null;
    if (m.kind === 'view' || m.kind === 'export') { const root = list.find((x) => x.id === m.baseId); const base = root && modelOf(root); if (!base) return null; return { model: applyView(base, m.view).model, view: m.view, rootId: m.baseId, rootKind: root.kind === 'attachments' ? 'attachments' : 'report' }; }
    if (m.kind === 'attachments' || m.spec) { const base = modelOf(m); if (!base) return null; const view = m.view || emptyView(); return { model: applyView(base, view).model, view, rootId: m.id, rootKind: m.kind === 'attachments' ? 'attachments' : 'report' }; } // a result rebuilt from a follow-up keeps the view already agreed (chart type, parts shown)
    return null;
  }, [modelOf]);
  const latest = useMemo(() => { if (!conv) return null; for (let i = conv.messages.length - 1; i >= 0; i -= 1) { const r = resultOf(conv.messages[i], conv.messages); if (r) return { ...r, msgId: conv.messages[i].id }; } return null; }, [conv, resultOf]);

  /* ---------------- generation of a system report ---------------- */
  const generate = useCallback(async (sp, token, setStep) => {
    const sc = sp.scope; const cutoff = rev.cfg.cutoff;
    const step = async (k) => { if (token.cancelled) throw Object.assign(new Error('stopped'), { stopped: true }); setStep(k); if (token.pace) await sleep(token.pace); };
    await step('scope');
    const scope = { ...sc };
    const prevSc = sp.compare === 'prev_month' ? previousMonthScope(sc, today) : sp.compare === 'prev_year' ? (({ from, to }) => ({ from, to }))(previousScope({ from: sc.from, to: sc.to })) : null;
    const atEnd = { cfg: headlineCfg(rev.cfg) }; // the SAME measurement rule as every other view (src/data/measure.js)
    await step('read');
    const task = rev.startAnalysis('report', { focus: sp.sections.includes('exclusions') ? 'noncollection' : sp.sections.includes('amanah') ? 'amanah' : 'revenue', nonce: uid() }, { scope, background: true, inline: true, paceMs: 0, followsGlobal: false, origin: 'smart-reports' });
    token.taskId = task.id;
    const final = await task.promise;
    await step('compare');
    if (!['completed', 'completed_with_limitations'].includes(final.status) || !final.out?.snapshot) { if (token.cancelled) throw Object.assign(new Error('stopped'), { stopped: true }); throw Object.assign(new Error('analysis_failed'), { status: final.status, reason: final.error || final.errors || final.message || null }); }
    const out = { ...final.out, snapshot: await measure(rev.data, scope, rev.cfg) };
    const scopeKeys = { amanah: sc.amanah, source: sc.source, scopeType: sc.scopeType, muni: sc.muni, status: sc.status, product: sc.product, mainClass: sc.mainClass };
    const [prev, cash, bridge] = await Promise.all([
      prevSc ? rev.data.snapshot({ ...prevSc, ...scopeKeys }, atEnd) : Promise.resolve(null),
      sp.sections.includes('trends') ? rev.data.series({ ...scope }, { asOf: sc.to < cutoff ? sc.to : cutoff }) : Promise.resolve(null),
      sp.sections.includes('quality') ? rev.data.bridge({ ...scopeKeys, from: '2000-01-01', to: cutoff }) : Promise.resolve(null)
    ]);
    await step('build');
    const model = buildReportModel({ spec: sp, lang, out, prev, compare: sp.compare, prevScope: prevSc, cash, bridge, targets: rev.targets, cases: rev.cases, meta: rev.meta });
    await step('check');
    if (!model.equationOk) model.sections.unshift({ key: 'warn', title: L('تنبيه', 'Warning'), purpose: '', blocks: [{ type: 'callout', tone: 'warn', text: L('تعذّر تحقق إحدى علاقات المطابقة المالية لهذا الاختيار؛ راجع قسم اكتمال البيانات والمطابقة.', 'One financial reconciliation identity did not hold for this selection; see the completeness and reconciliation section.') }] });
    return model;
  }, [rev, lang, today, L]);

  const run = useCallback(async (convId, msgId, sp, { pace = 0 } = {}) => {
    const token = { cancelled: false, taskId: null, pace };
    setBusy({ msgId, step: 'scope', token });
    try {
      const model = await generate(sp, token, (k) => setBusy((b) => (b && b.msgId === msgId ? { ...b, step: k } : b)));
      setModels((m) => ({ ...m, [msgId]: model }));
      // the conversation is named after its FIRST report (what it is about), unless the person renamed it
      const firstId = (c) => c.messages.find((m) => m.role === 'assistant' && m.spec)?.id;
      const nameOf = () => { const sc = sp.scope; const am = sc.amanah === 'all' ? null : [].concat(sc.amanah).map(labelOfAmanah).join('، '); return [model.title, fmtRangeText(sc.from, sc.to, ar ? 'ar' : 'en'), am, sc.source !== 'all' ? (ar ? sourceAr(sc.source) : sourceEn(sc.source)) : null].filter(Boolean).join(' · ').slice(0, 80); };
      patchConv(convId, (c) => { const t = c.titleSource !== 'user' && firstId(c) === msgId ? nameOf() : c.title; return c.messages.some((m) => m.id === msgId && m.status === 'done' && m.title === model.title) && t === c.title ? c : { ...c, title: t, messages: c.messages.map((m) => (m.id === msgId ? { ...m, status: 'done', title: model.title } : m)) }; });
    } catch (e) {
      const stopped = token.cancelled || e.stopped;
      if (!stopped) console.error('[smart-reports] the report could not be prepared:', e);
      patchConv(convId, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, status: stopped ? 'stopped' : 'error' } : m)) }));
    } finally { setBusy((b) => (b && b.msgId === msgId ? null : b)); }
  }, [generate, patchConv, labelOfAmanah, ar]);

  const stop = () => { if (!busy) return; if (busy.step === 'think') { busy.token.finish?.(); return; } busy.token.cancelled = true; if (busy.token.taskId) rev.cancelTask(busy.token.taskId); };

  // reopen a stored conversation: rebuild the last system report from its spec
  useEffect(() => {
    if (!conv || busy) return;
    const last = [...conv.messages].reverse().find((m) => m.role === 'assistant' && m.spec && m.status === 'done');
    if (last && !models[last.id]) run(conv.id, last.id, last.spec);
  }, [conv?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- attached files: read, match with the system data, answer ---------------- */
  const scopeTextOf = useCallback((sp) => { const sc = sp.scope; const am = sc.amanah === 'all' ? L('كل الأمانات والجهات', 'All Amanahs') : [].concat(sc.amanah).map(labelOfAmanah).join('، '); return [fmtRangeText(sc.from, sc.to, ar ? 'ar' : 'en'), am, sc.source !== 'all' ? (ar ? sourceAr(sc.source) : sourceEn(sc.source)) : null].filter(Boolean).join(' · '); }, [L, ar, labelOfAmanah]);
  const buildAttModel = useCallback((data, { groupTerm = null, question = '' } = {}) => buildAttachmentModel({ atts: data.recs, refs: data.refs, resolved: data.resolved, snapshot: data.snapshot, scopeText: data.scopeText, lang, groupTerm, cutoff: today, question }), [lang, today]);

  const runAttach = useCallback(async (convId, msgId, recs, { groupTerm = null, question = '', sp }) => {
    const token = { cancelled: false, taskId: null };
    setBusy({ msgId, step: 'files', token });
    const step = async (k) => { if (token.cancelled) throw Object.assign(new Error('stopped'), { stopped: true }); setBusy((b) => (b && b.msgId === msgId ? { ...b, step: k } : b)); await sleep(PACE); };
    try {
      await step('files'); // the files were read when they were added
      await step('refs'); const refs = refsOfAttachments(recs);
      let resolved = null;
      if (refs.unique.length) { await step('match'); resolved = await rev.enforcement.resolve(refs.unique.map((r) => ({ kind: r.kind, value: r.value }))); }
      await step('analyze');
      const anyTables = recs.some((a) => a.tables?.length);
      const scopeText = scopeTextOf(sp);
      const snapshot = anyTables ? await measure(rev.data, { ...sp.scope }, rev.cfg) : null;
      const data = { recs, refs, resolved, snapshot, scopeText };
      const model = buildAttModel(data, { groupTerm, question });
      attData.current[msgId] = data;
      setModels((m) => ({ ...m, [msgId]: model }));
      patchConv(convId, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, status: 'done', title: model.title, amodel: model } : m)) }));
    } catch (e) {
      const stopped = token.cancelled || e.stopped;
      if (!stopped) console.error('[smart-reports] the attachments could not be analysed:', e);
      patchMsg(convId, msgId, { status: stopped ? 'stopped' : 'error' });
    } finally { setBusy((b) => (b && b.msgId === msgId ? null : b)); }
  }, [rev, scopeTextOf, buildAttModel, patchConv, patchMsg]);

  const readingAny = files.some((f) => f.reading);
  const addFiles = useCallback((list) => {
    const incoming = [...(list || [])]; if (!incoming.length) return;
    setFileNote('');
    setFiles((cur) => {
      const room = MAX_FILES - cur.length; const take = []; const notes = [];
      for (const f of incoming) {
        if (cur.some((x) => x.name === f.name && x.size === f.size) || take.some((x) => x.name === f.name && x.size === f.size)) { notes.push(L(`«${f.name}» مُرفق بالفعل.`, `“${f.name}” is already attached.`)); continue; }
        if (take.length >= room) { notes.push(L(`الحد الأقصى ${MAX_FILES} ملفات في الرسالة الواحدة.`, `At most ${MAX_FILES} files per message.`)); break; }
        take.push(f);
      }
      if (notes.length) setFileNote([...new Set(notes)].join(' '));
      const placeholders = take.map((f) => ({ id: uid(), name: f.name, size: f.size, kind: 'unknown', status: 'unread', reading: true, note: null, _file: f }));
      placeholders.forEach((p) => { readAttachment(p._file).then((rec) => setFiles((fs) => fs.map((x) => (x.id === p.id ? { ...rec, id: p.id, reading: false } : x)))).catch(() => setFiles((fs) => fs.map((x) => (x.id === p.id ? { ...x, reading: false, note: { ar: 'تعذّرت قراءة الملف.', en: 'The file could not be read.' } } : x)))); });
      return [...cur, ...placeholders];
    });
  }, [L]);
  const removeFile = (id) => { setFiles((fs) => fs.filter((f) => f.id !== id)); setPreviewId((p) => (p === id ? null : p)); setFileNote(''); };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); };

  /* ---------------- exporting the latest result ---------------- */
  const runExport = useCallback(async (convId, msgId, format, model) => {
    setExporting(format);
    try { await exportModel(format, model); patchMsg(convId, msgId, { status: 'done', fileName: reportFileName(model, EXPORT_FORMATS.find((f) => f.key === format)?.ext || format) }); }
    catch (e) { console.error('[smart-reports] export failed:', e); patchMsg(convId, msgId, { status: 'error' }); }
    finally { setExporting(''); }
  }, [patchMsg]);

  /* ---------------- sending ---------------- */
  const send = useCallback((text, override = null, { fresh = false } = {}) => {
    const q0 = (text || '').trim();
    const sendFiles = fresh || override ? [] : files.filter((f) => !f.reading);
    if ((!q0 && !sendFiles.length) || busy || (!fresh && !override && readingAny)) return;
    const q = q0 || L('حلّل الملفات المرفقة مع بيانات النظام', 'Analyse the attached files together with the system data');
    let c = fresh ? null : conv; // a request that arrives through a link starts its own conversation
    if (!c) { c = { id: uid(), title: q.slice(0, 48), createdAt: Date.now(), updatedAt: Date.now(), spec: sharedSpec, messages: [] }; }
    const lr = fresh ? null : latest;
    const userMsg = { id: uid(), role: 'user', text: q, ...(sendFiles.length ? { attachments: sendFiles.map(({ id, name, size, kind, status, note }) => ({ id, name, size, kind, status, note })) } : {}) };
    const asId = uid();
    const chat = override ? null : interpretChat(q, { hasResult: !!lr, resultKind: lr?.rootKind || null, hasCharts: lr ? hasCharts(lr.model) : false, hasTables: lr ? hasTables(lr.model) : false, pendingFiles: sendFiles.length });
    let aMsg = null; let after = null; let interpretText = q;
    const say = (ar_, en_) => ({ id: asId, role: 'assistant', kind: 'text', plain: L(ar_, en_), status: 'done' });
    if (chat) {
      if (chat.type === 'attach') { aMsg = { id: asId, role: 'assistant', kind: 'attachments', status: 'working', groupTerm: chat.groupTerm || null }; after = () => runAttach(c.id, asId, sendFiles, { groupTerm: chat.groupTerm || null, question: q0, sp: c.spec || sharedSpec }); }
      else if (chat.type === 'need') aMsg = { id: asId, role: 'assistant', kind: 'clarify', question: chat.question, options: chat.options, status: 'done' };
      else if (chat.type === 'chart') {
        const r = applyView(lr.model, { chartKind: chat.kind }); const nm = CHART_NAME[chat.kind][ar ? 'ar' : 'en'];
        if (r.changed) aMsg = { id: asId, role: 'assistant', kind: 'view', baseId: lr.rootId, view: mergeView(lr.view, { chartKind: chat.kind }), note: L(`غيّرتُ ${r.changed === 1 ? 'الرسم' : `${r.changed} رسوم`} إلى ${nm}${r.skipped ? `؛ و${r.skipped} رسماً فيه أكثر من سلسلة لا يصلح دائرياً فبقي كما هو` : ''}.`, `Changed ${r.changed === 1 ? 'the chart' : `${r.changed} charts`} to ${nm}${r.skipped ? `; ${r.skipped} multi-series chart(s) cannot be a pie and stay as they were` : ''}.`), status: 'done' };
        else aMsg = r.skipped ? say('الرسم الدائري يعرض سلسلة واحدة، والرسوم الحالية فيها أكثر من سلسلة فلم أغيّرها. جرّب «خطي» أو «أعمدة».', 'A pie chart shows one series and the current charts have several, so I left them. Try “line” or “bars”.') : say(`الرسم ${nm} بالفعل.`, `The chart is already a ${nm} chart.`);
      } else if (chat.type === 'only') {
        const want = chat.only; const none = (want === 'tables' && !hasTables(lr.model)) || (want === 'charts' && !hasCharts(lr.model));
        if (none) aMsg = say(`لا ${want === 'tables' ? 'جداول' : 'رسوم'} في هذه النتيجة لأعرضها.`, `There are no ${want === 'tables' ? 'tables' : 'charts'} in this result to show.`);
        else aMsg = { id: asId, role: 'assistant', kind: 'view', baseId: lr.rootId, view: mergeView(lr.view, { only: want === 'all' ? null : want }), note: want === 'all' ? L('أعدتُ عرض كل أقسام النتيجة.', 'Showing every part of the result again.') : L(`عرضتُ ${want === 'tables' ? 'الجداول' : want === 'charts' ? 'الرسوم' : 'المؤشرات'} فقط. اكتب «اعرض الكل» للعودة.`, `Showing the ${want === 'tables' ? 'tables' : want === 'charts' ? 'charts' : 'indicators'} only. Say “show everything” to go back.`), status: 'done' };
      } else if (chat.type === 'export') {
        if (lr.model.empty) aMsg = say('النتيجة الحالية لا تحتوي بيانات لأضعها في ملف.', 'The current result holds no data to put in a file.');
        else { aMsg = { id: asId, role: 'assistant', kind: 'export', baseId: lr.rootId, view: lr.view, format: chat.format, status: 'working' }; after = () => runExport(c.id, asId, chat.format, lr.model); }
      } else if (chat.type === 'summary') aMsg = { id: asId, role: 'assistant', kind: 'text', plain: summarize(lr.model), status: 'done' };
      else if (chat.type === 'regroup') {
        const data = attData.current[lr.rootId];
        if (!data) aMsg = say('لإعادة التجميع أحتاج الملف نفسه، ولم يعد محتواه محفوظاً بعد إعادة فتح المحادثة. أرفقه من جديد.', 'To regroup I need the file itself, and its content is not kept after the conversation is reopened. Attach it again.');
        else {
          const model = buildAttModel(data, { groupTerm: chat.term, question: q }); attData.current[asId] = data;
          setModels((m) => ({ ...m, [asId]: model }));
          aMsg = { id: asId, role: 'assistant', kind: 'attachments', status: 'done', title: model.title, amodel: model, groupTerm: chat.term, regroup: true, view: lr.view };
        }
      } else if (chat.type === 'section') interpretText = chat.text;
    }
    if (!aMsg) {
      const res = override ? { kind: 'report', spec: override.spec, changes: override.changes || [] } : interpret(interpretText, c.messages.some((m) => m.spec) ? c.spec : null, today, { base: sharedSpec });
      const lbl = (ch) => describeChange(ch, lang, { amanahLabel: labelOfAmanah, spec: res.spec });
      if (res.kind === 'unsupported' || res.kind === 'empty') aMsg = { id: asId, role: 'assistant', kind: 'unsupported', question: res.question || null, status: 'done' };
      else if (res.kind === 'clarify') aMsg = { id: asId, role: 'assistant', kind: 'clarify', question: res.question, options: res.options, status: 'done' };
      else if (res.confirm?.length && !override) aMsg = { id: asId, role: 'assistant', kind: 'confirm', status: 'pending', confirm: res.confirm, pending: { kind: res.kind, spec: res.spec, changes: res.changes.map(lbl), changeKeys: res.changes.map((x) => x.key), firstReport: !c.messages.some((m) => m.spec) } };
      else { aMsg = { id: asId, role: 'assistant', kind: res.kind, spec: res.spec, changes: res.changes.map(lbl), changeKeys: res.changes.map((x) => x.key), firstReport: !c.messages.some((m) => m.spec), status: 'working', ...(chat?.type === 'section' && lr ? { view: lr.view } : {}) }; after = () => run(c.id, asId, aMsg.spec, { pace: PACE }); }
    }
    const next = { ...c, title: c.messages.length ? c.title : q.slice(0, 48), updatedAt: Date.now(), spec: aMsg.spec || c.spec, messages: [...c.messages.map((m) => (m.kind === 'confirm' && m.status === 'pending' ? { ...m, status: 'superseded' } : m)), userMsg, aMsg] };
    setConvs((cs) => (cs.some((x) => x.id === c.id) ? cs.map((x) => (x.id === c.id ? next : x)) : [next, ...cs]));
    setActiveId(c.id); setInput(''); writeDraft(c.id, ''); writeDraft(draftFor.current, '');
    if (sendFiles.length) { setFiles([]); setPreviewId(null); setFileNote(''); }
    animated.current.add(userMsg.id); animated.current.add(asId);
    if (after) after();
    else { // a quick answer still shows the assistant preparing it
      const token = { cancelled: false, taskId: null };
      setTyping((t) => ({ ...t, [asId]: true })); setBusy({ msgId: asId, step: 'think', token });
      const done = () => { window.clearTimeout(thinkTimers.current[asId]); delete thinkTimers.current[asId]; setTyping((t) => { const { [asId]: _x, ...rest } = t; return rest; }); setBusy((b) => (b && b.msgId === asId ? null : b)); };
      thinkTimers.current[asId] = window.setTimeout(done, 750 + Math.min(600, q.length * 8)); token.finish = done;
    }
  }, [busy, conv, today, lang, labelOfAmanah, run, runAttach, runExport, sharedSpec, files, readingAny, latest, buildAttModel, L, ar]);

  // the demo asks the user to confirm the interpreted scope in the risky categories BEFORE anything is generated
  const confirmPending = (msg) => {
    const pd = msg.pending; if (busy || !pd) return;
    patchConv(conv.id, (c) => ({ ...c, spec: pd.spec, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === msg.id ? { id: m.id, role: 'assistant', kind: pd.kind, spec: pd.spec, changes: pd.changes, changeKeys: pd.changeKeys, firstReport: pd.firstReport, confirmedByUser: true, status: 'working' } : m)) }));
    run(conv.id, msg.id, pd.spec, { pace: PACE });
  };
  const cancelPending = (msg) => patchConv(conv.id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msg.id ? { ...m, status: 'cancelled' } : m)) }));
  const retry = (msg) => { if (busy) return; patchConv(conv.id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msg.id ? { ...m, status: 'working' } : m)) })); run(conv.id, msg.id, msg.spec, { pace: PACE }); };
  const newConv = () => { if (busy) return; setActiveId(null); setInput(''); setShowHistory(false); setFiles([]); setFileNote(''); setPreviewId(null); taRef.current?.focus(); };
  const [renaming, setRenaming] = useState(null); // { id, text }
  const renameConv = (id, text) => { const t = text.trim().slice(0, 80); if (t) patchConv(id, (c) => ({ ...c, title: t, titleSource: 'user' })); setRenaming(null); window.setTimeout(() => document.getElementById(`sr-rn-${id}`)?.focus(), 0); };
  const removeConv = (id) => { setConvs((cs) => cs.filter((c) => c.id !== id)); if (id === activeId) setActiveId(null); };

  const applyFilters = (patch, baseSpec = null) => {
    const base = baseSpec ? JSON.parse(JSON.stringify(baseSpec)) : spec ? JSON.parse(JSON.stringify(spec)) : JSON.parse(JSON.stringify(sharedSpec));
    const next = { ...base, ...patch, scope: { ...base.scope, ...(patch.scope || {}) } };
    next.preset = detectPreset(next.scope.from, next.scope.to, today); // the label of the period follows the dates that were actually chosen
    const changes = [];
    for (const k of ['from', 'to']) if (patch.scope && patch.scope[k] && patch.scope[k] !== base.scope[k]) { if (!changes.some((x) => x.key === 'period')) changes.push({ key: 'period', value: `${next.scope.from} → ${next.scope.to}` }); }
    for (const k of ['amanah', 'muni', 'source', 'status', 'scopeType']) if (patch.scope && JSON.stringify(patch.scope[k]) !== undefined && JSON.stringify(patch.scope[k]) !== JSON.stringify(base.scope[k])) changes.push({ key: k, value: patch.scope[k] });
    if (patch.compare && patch.compare !== base.compare) changes.push({ key: 'compare', value: patch.compare });
    if (!changes.length) return;
    send(L('طبّق التصفية: ', 'Apply filters: ') + changes.map((c) => describeChange(c, lang, { amanahLabel: labelOfAmanah })).join('، '), { spec: next, changes });
  };

  // download the file of a result: the SAME model and view the conversation shows
  async function doExport(kind, model) {
    if (exporting) return;
    setExporting(kind);
    try { await exportModel(kind, model); } catch (e) { console.error('[smart-reports] export failed:', e); } finally { setExporting(''); }
  }

  // deep links: /smart-reports?r=<standard report key> opens that report; ?q=<request> sends a request (old /reports links land here too)
  const deepRef = useRef(false);
  useEffect(() => {
    if (deepRef.current) return; deepRef.current = true;
    const sp = new URLSearchParams(window.location.search); const q = sp.get('q');
    const link = q || initialQuery;
    if (link) { send(link, null, { fresh: true }); onQueryConsumed?.(); } // consumed once: reloading the page does not send it again (F-16b)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canSend = (input.trim() || files.some((f) => !f.reading)) && !readingAny;
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend) send(input); } };

  /* ---------------- pieces ---------------- */
  const sourceName = (k) => (k === 'all' ? L('كل المصادر', 'All sources') : ar ? sourceAr(k) : sourceEn(k));
  const specChips = useCallback((sp) => {
    const sc = sp.scope;
    const amLabel = sc.amanah === 'all' ? L('كل الأمانات والجهات', 'All Amanahs') : [].concat(sc.amanah).map(labelOfAmanah).join('، ');
    const mu = sc.muni === 'all' ? L('كل البلديات', 'All municipalities') : (municipalitiesOf(String(sc.muni).split('|')[0]).find((m) => m && m.key === sc.muni)?.[ar ? 'ar' : 'en'] || sc.muni);
    const st = { all: L('كل الحالات', 'All statuses'), collected: L('محصّلة', 'Collected'), open: L('قائمة', 'Open'), overdue: L('متأخرة', 'Overdue'), partial: L('جزئية', 'Partial'), not_due: L('لم تستحق', 'Not due'), cancelled: L('ملغاة', 'Cancelled'), excluded: L('مستبعدة', 'Excluded') }[sc.status || 'all'];
    const cmp = { none: null, prev_month: L('مقارنة بالشهر الماضي', 'vs last month'), prev_year: L('مقارنة بالعام الماضي', 'vs last year') }[sp.compare];
    return [
      { k: 'period', label: L('الفترة', 'Period'), value: fmtRangeText(sc.from, sc.to, ar ? 'ar' : 'en') }, { k: 'amanah', label: L('الأمانة / الجهة', 'Amanah'), value: amLabel }, { k: 'muni', label: L('البلدية', 'Municipality'), value: mu },
      { k: 'source', label: L('المصدر', 'Source'), value: sourceName(sc.source) }, { k: 'status', label: L('الحالة', 'Status'), value: st },
      ...(sc.scopeType && sc.scopeType !== 'all' ? [{ k: 'st', label: L('النطاق', 'Scope'), value: sc.scopeType === 'internal' ? L('داخلي', 'Internal') : L('مركزي', 'Central') }] : []),
      { k: 'basis', label: L('الأساس', 'Basis'), value: L(`فواتير الفترة · التحصيل حتى ${fmtDateText(sc.to < today ? sc.to : today, 'ar')}`, `Period invoices · collections to ${fmtDateText(sc.to < today ? sc.to : today, 'en')}`) }, ...(cmp ? [{ k: 'cmp', label: L('المقارنة', 'Comparison'), value: cmp }] : [])
    ];
  }, [today, ar, L, labelOfAmanah]); // eslint-disable-line react-hooks/exhaustive-deps
  const chips = useMemo(() => specChips(spec || sharedSpec), [specChips, spec, sharedSpec]);

  const scopeDiffers = !!spec && ['from', 'to', 'amanah', 'source', 'scopeType', 'muni', 'status'].some((k) => JSON.stringify(spec.scope[k] ?? 'all') !== JSON.stringify(sharedSpec.scope[k] ?? 'all'));
  const stepText = (k) => (STEPS[k] || CHAT_STEPS[k])?.[ar ? 0 : 1] || '';
  const empty = !conv || conv.messages.length === 0;
  const followUps = useMemo(() => {
    if (!latest) return [];
    const out = [];
    const chartChip = latest.view?.chartKind === 'line' ? { ar: 'غيّر الرسم إلى أعمدة', en: 'Change the chart to a bar chart' } : { ar: 'غيّر الرسم إلى خطي', en: 'Change the chart to a line chart' };
    if (latest.rootKind === 'attachments') {
      if (hasCharts(latest.model)) out.push(chartChip);
      out.push({ ar: 'لخّص النتيجة', en: 'Summarise the result' });
      if (hasTables(latest.model)) out.push({ ar: 'اعرض الجداول فقط', en: 'Show the tables only' });
      out.push({ ar: 'حوّله إلى عرض تقديمي', en: 'Turn it into a presentation' }, { ar: 'حوّله إلى Excel', en: 'Export it to Excel' });
    } else {
      out.push(...FOLLOW_UPS.slice(0, 3), { ar: 'قارن حسب البلدية', en: 'Compare by municipality' });
      if (hasCharts(latest.model)) out.push(chartChip);
      out.push({ ar: 'حوّله إلى عرض تقديمي', en: 'Turn it into a presentation' });
    }
    return out;
  }, [latest]);

  const exportButtons = (model) => (
    <div className="sr-card__actions" role="group" aria-label={L('تنزيل النتيجة', 'Download the result')}>
      {EXPORT_FORMATS.map(({ key, name }) => <button key={key} type="button" className="btn btn-sm" disabled={model.empty || !!exporting} title={key === 'pdf' ? L('يفتح مربع الطباعة: اختر «حفظ بصيغة PDF»', 'Opens the print dialog: choose “Save as PDF”') : undefined} onClick={() => doExport(key, model)}>{exporting === key ? L('جارٍ التصدير…', 'Exporting…') : `${name}`}</button>)}
    </div>
  );

  return (
    <div className={`sr-page${drag ? ' is-drag' : ''}`} dir={ar ? 'rtl' : 'ltr'} onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDrag(true); } }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false); }} onDrop={onDrop}>
      <div className="sr-top">
        {!embedded && <div><h1 className="page-title" style={{ margin: 0 }}>{L('التقارير الذكية', 'Smart reports')}</h1></div>}
        <div className="sr-top__actions">
          <button type="button" className="btn btn-sm" onClick={newConv} disabled={!!busy}>＋ {L('محادثة جديدة', 'New conversation')}</button>
          <button type="button" className="btn btn-sm btn-ghost" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>{L('السجل', 'History')} ({convs.length})</button>
          <Link className="btn btn-sm btn-ghost" to="/insights?view=reports">{L('التقارير الثابتة', 'Fixed reports')}</Link>
        </div>
      </div>
      {drag && <div className="sr-dropzone" role="status">{L('أفلت الملفات هنا لإرفاقها', 'Drop the files here to attach them')}</div>}

      {showHistory && (
        <div className="sr-history card" role="region" aria-label={L('سجل المحادثات', 'Conversation history')}>
          {!convs.length && <div className="muted">{L('لا محادثات بعد.', 'No conversations yet.')}</div>}
          {convs.map((c) => (
            <div key={c.id} className={`sr-history__item ${c.id === activeId ? 'is-active' : ''}`}>
              {renaming?.id === c.id
                ? <input id={`sr-rni-${c.id}`} className="input" autoFocus maxLength={80} aria-label={L('اسم المحادثة', 'Conversation name')} value={renaming.text} onChange={(e) => setRenaming({ id: c.id, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); renameConv(c.id, renaming.text); } if (e.key === 'Escape') { setRenaming(null); window.setTimeout(() => document.getElementById(`sr-rn-${c.id}`)?.focus(), 0); } }} onBlur={() => renaming && renameConv(c.id, renaming.text)} />
                : <button type="button" onClick={() => { if (!busy) { setActiveId(c.id); setShowHistory(false); } }}><b>{c.title}</b><small>{fmtRiyadh(c.updatedAt)} · {c.messages.filter((m) => m.role === 'user').length} {L('طلب', 'requests')}</small></button>}
              <button type="button" id={`sr-rn-${c.id}`} className="btn btn-sm btn-ghost" aria-label={L('إعادة تسمية المحادثة', 'Rename the conversation')} onClick={() => setRenaming({ id: c.id, text: c.title })}>✎</button>
              <button type="button" className="btn btn-sm btn-ghost" aria-label={L('حذف', 'Delete')} onClick={() => removeConv(c.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className="sr-context" role="region" aria-label={L('سياق التقرير', 'Report context')}>
        <div className="sr-chips">{chips.map((c) => <span key={c.k} className="sr-chip"><em>{c.label}</em> <bdi>{c.value}</bdi></span>)}</div>
      </div>
      {spec && scopeDiffers && <div className="sr-note" role="note">{L('لهذه المحادثة نطاقها الخاص، وهو يختلف عن مرشحات لوحة المعلومات الحالية؛ لن يتغير نطاقها تلقائياً.', 'This conversation keeps its own scope, which differs from the current dashboard filters; it never changes automatically.')} <button type="button" className="sr-link" onClick={() => applyFilters({ scope: sharedSpec.scope })}>{L('مزامنة نطاق المحادثة مع لوحة المعلومات', 'Sync the conversation scope with the dashboard')}</button></div>}

      <div className="sr-note" role="note">
        <b>{L('المساعد يعمل بقواعد محددة وليس بنموذج لغوي: راجع «كيف فهمتُ طلبك» قبل الاعتماد على أي نتيجة. الملفات المرفقة تُقرأ داخل متصفحك ولا تُرفع إلى أي خادم؛ وحدها أرقام الفواتير المستخرجة منها تُطابَق مع بيانات النظام.', 'The assistant works with fixed rules, not a language model: check «How I read your request» before relying on any result. Attached files are read inside your browser and are never uploaded; only the invoice numbers found in them are matched with the system data.')}</b>
        <details className="rv-more"><summary>{L('أمثلة، وعن المساعد، وأين تُحفظ بياناتي', 'Examples, about the assistant, where my data is kept')}</summary>
          <ul className="sr-help">{SUPPORTED_HELP[ar ? 'ar' : 'en'].map((h, k) => <li key={k}>{h}</li>)}
            <li>{L('المرفقات: PDF رقمي، Word (.docx)، Excel وCSV، PowerPoint (.pptx) تُقرأ فعلاً؛ والصور تُعرض معاينةً فقط لأن النظام لا يجري OCR.', 'Attachments: digital PDF, Word (.docx), Excel and CSV, PowerPoint (.pptx) are really read; images are shown as a preview only because the system performs no OCR.')}</li>
            <li>{L('بعد أي نتيجة: «غيّر الرسم إلى خطي»، «اعرض الجداول فقط»، «قارن حسب البلدية»، «لخّص النتيجة»، «حوّله إلى عرض تقديمي / Word / PDF / Excel / CSV».', 'After any result: “change the chart to a line chart”, “show the tables only”, “compare by municipality”, “summarise”, “turn it into a presentation / Word / PDF / Excel / CSV”.')}</li>
          </ul>
          <div>{L('تُبنى التقارير من بيانات النظام التجريبية.', 'Reports are built from the system’s demo data.')}</div>
          <LocalDataPanel />
        </details>
      </div>

      <div className="sr-thread" aria-live="polite">
        {empty && (
          <div className="sr-welcome">
            <h2>{L('ماذا تريد أن تعرف؟', 'What would you like to see?')}</h2>
            <p className="muted sr-welcome__sub">{L('اسأل عن الإيرادات والتحصيل، أو أرفق ملفات (PDF، Word، Excel، CSV، PowerPoint) لأحللها مع بيانات النظام.', 'Ask about revenue and collection, or attach files (PDF, Word, Excel, CSV, PowerPoint) and I will analyse them together with the system data.')}</p>
            <div className="sr-suggest">{SUGGESTIONS.map((s) => <button key={s.ar} type="button" className="sr-suggest__btn" onClick={() => send(s[ar ? 'ar' : 'en'])}>{s[ar ? 'ar' : 'en']}</button>)}<button type="button" className="sr-suggest__btn" onClick={() => fileRef.current?.click()}>📎 {L('إرفاق ملفات للتحليل', 'Attach files to analyse')}</button></div>
          </div>
        )}
        {conv?.messages.map((m) => {
          if (m.role === 'user') return (
            <div key={m.id} className={`sr-msg sr-msg--user${animated.current.has(m.id) ? ' sr-msg--new' : ''}`}><div className="sr-bubble">{m.text}{m.attachments?.length > 0 && <div className="sr-bubble__files">{m.attachments.map((a) => <span key={a.id} className="sr-chip sr-chip--file" title={noteText(a.note, ar)}><em>{ICON[a.kind] || '?'}</em> <bdi>{a.name}</bdi></span>)}</div>}</div></div>
          );
          const model = modelOf(m); const isBusy = busy?.msgId === m.id; const res = resultOf(m, conv.messages); const isLast = !!latest && m.id === latest.msgId;
          const shown = res?.model || null; const isFileResult = m.kind === 'attachments'; const showCard = !!shown && m.kind !== 'export';
          const fresh = animated.current.has(m.id); const tick = () => endRef.current?.scrollIntoView({ block: 'end' });
          if (typing[m.id]) return <div key={m.id} className="sr-msg sr-msg--ai sr-msg--new"><div className="sr-avatar" aria-hidden="true">ذ</div><div className="sr-ai"><div className="sr-bubble sr-bubble--ai"><TypingDots label={L('المساعد يكتب', 'The assistant is typing')} /></div></div></div>;
          return (
            <div key={m.id} className={`sr-msg sr-msg--ai${fresh ? ' sr-msg--new' : ''}`}>
              <div className="sr-avatar" aria-hidden="true">ذ</div>
              <div className="sr-ai">
                {m.kind === 'clarify' && <div className="sr-bubble sr-bubble--ai"><b><Typewriter text={m.question[ar ? 'ar' : 'en']} animate={fresh} onTick={tick} /></b><div className="sr-suggest sr-suggest--inline">{(m.options || []).map((o) => <button key={o.text} type="button" className="sr-suggest__btn" disabled={!!busy} onClick={() => send(o.text)}>{o.label[ar ? 'ar' : 'en']}</button>)}</div></div>}
                {m.kind === 'unsupported' && <div className="sr-bubble sr-bubble--ai"><b><Typewriter text={m.question ? m.question[ar ? 'ar' : 'en'] : L('لم أفهم الطلب. جرّب مثلاً:', 'I did not understand the request. Try for example:')} animate={fresh} onTick={tick} /></b><div className="sr-suggest sr-suggest--inline">{SUGGESTIONS.slice(0, 3).map((x) => <button key={x.ar} type="button" className="sr-suggest__btn" disabled={!!busy} onClick={() => send(x[ar ? 'ar' : 'en'])}>{x[ar ? 'ar' : 'en']}</button>)}</div></div>}
                {m.kind === 'text' && <div className="sr-bubble sr-bubble--ai" style={{ whiteSpace: 'pre-line' }}><Typewriter text={m.plain} animate={fresh} onTick={tick} /></div>}
                {m.kind === 'confirm' && (
                  <div className="sr-bubble sr-bubble--ai" role="group" aria-label={L('تأكيد فهم الطلب', 'Confirm how the request was read')}>
                    <b>{L('قبل أن أُعدّ التقرير: هل هذا ما قصدته؟', 'Before I build the report: is this what you meant?')}</b>
                    <div className="muted" style={{ fontSize: 13 }}>{L('يستدعي التأكيد: ', 'Needs confirmation: ')}{m.confirm.map((c) => (ar ? c.ar : c.en)).join(L('؛ ', '; '))}.</div>
                    <InterpretationSummary pending msg={{ changeKeys: m.pending.changeKeys, firstReport: m.pending.firstReport }} chips={specChips(m.pending.spec)} L={L} editable={m.status === 'pending' && !busy} editing={m.status === 'pending' && editPendingId === m.id} onEdit={() => setEditPendingId((v) => (v === m.id ? null : m.id))} panel={<FilterPanel key={`${m.id}${JSON.stringify(m.pending.spec.scope)}`} spec={m.pending.spec} today={today} ar={ar} L={L} sourceName={sourceName} onApply={(p) => { setEditPendingId(null); applyFilters(p, m.pending.spec); }} />} />
                    {m.status === 'pending' && <div className="sr-suggest sr-suggest--inline"><button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => confirmPending(m)}>{L('تأكيد وإعداد التقرير', 'Confirm and build the report')}</button><button type="button" className="btn btn-sm btn-ghost" onClick={() => cancelPending(m)}>{L('إلغاء', 'Cancel')}</button></div>}
                    {m.status === 'cancelled' && <div className="muted">{L('أُلغي الطلب ولم يُعدّ تقرير.', 'Cancelled — no report was built.')}</div>}
                    {m.status === 'superseded' && <div className="muted">{L('حلّ محلّه طلب أحدث.', 'Replaced by a newer request.')}</div>}
                  </div>
                )}
                {m.kind === 'view' && <div className="sr-bubble sr-bubble--ai"><Typewriter text={m.note} animate={fresh} onTick={tick} /></div>}
                {m.kind === 'export' && (
                  <div className="sr-bubble sr-bubble--ai sr-filecard" role="group" aria-label={L('ملف النتيجة', 'The result file')}>
                    {m.status === 'working' && <div className="sr-progress" role="status"><TypingDots label={L('أُجهّز الملف', 'Preparing the file')} /> {L('أُجهّز الملف…', 'Preparing the file…')}</div>}
                    {m.status === 'done' && res && <>
                      <div><b>{m.format === 'pdf' ? L('جاهز للطباعة / الحفظ PDF', 'Ready to print / save as PDF') : L('أنشأتُ الملف ونزّلته', 'The file was created and downloaded')}</b></div>
                      <div className="sr-filecard__row"><span className="sr-file__ico" aria-hidden="true">{m.format.toUpperCase()}</span><bdi>{m.fileName || reportFileName(res.model, m.format)}</bdi>
                        <button type="button" className="btn btn-sm" disabled={!!exporting} onClick={() => doExport(m.format, res.model)}>{L('تنزيل مرة أخرى', 'Download again')}</button></div>
                      <div className="muted" style={{ fontSize: 12 }}>{m.format === 'pdf' ? L('فُتح مربع الطباعة: اختر «حفظ بصيغة PDF». ', 'The print dialog opened: choose “Save as PDF”. ') : ''}{L('يحتوي الملف النتيجة المعروضة الآن كما هي (بما فيها نوع الرسم والأجزاء المعروضة).', 'The file holds the result exactly as it is shown now (including the chart type and the parts shown).')}</div>
                    </>}
                    {m.status === 'error' && <div className="sr-warn" role="alert">{L('تعذّر إنشاء الملف.', 'The file could not be created.')} {res && <button type="button" className="btn btn-sm" disabled={!!exporting} onClick={() => { patchMsg(conv.id, m.id, { status: 'working' }); runExport(conv.id, m.id, m.format, res.model); }}>{L('إعادة المحاولة', 'Retry')}</button>}</div>}
                    {!res && m.status !== 'working' && m.status !== 'error' && <div className="muted">{L('النتيجة التي بُني منها هذا الملف لم تعد محملة؛ اطلب التقرير من جديد.', 'The result this file was built from is no longer loaded; ask for the report again.')}</div>}
                  </div>
                )}
                {m.kind === 'attachments' && (
                  <div className="sr-bubble sr-bubble--ai">
                    {m.regroup ? <b>{L('أعدتُ تجميع النتيجة:', 'Regrouped the result:')}</b> : <b>{L('حلّلتُ المرفقات مع بيانات النظام:', 'Analysed the attachments together with the system data:')}</b>}
                    {shown?.summaryText && <div style={{ lineHeight: 1.9 }}><Typewriter text={shown.summaryText} animate={fresh} onTick={tick} /></div>}
                    {isBusy && <AgentSteps order={ATT_ORDER} current={busy.step} textOf={stepText} L={L} onStop={stop} />}
                    {m.status === 'stopped' && <div className="sr-warn">{L('أُوقف التحليل. أرفق الملفات من جديد للمحاولة.', 'The analysis was stopped. Attach the files again to retry.')}</div>}
                    {(m.status === 'error' || (m.status === 'working' && !isBusy && !model)) && <div className="sr-warn" role="alert">{L('تعذّر تحليل المرفقات أو انقطع قبل اكتماله. أرفق الملفات من جديد.', 'The attachments could not be analysed, or the analysis was interrupted. Attach the files again.')}</div>}
                  </div>
                )}
                {(m.kind === 'report' || m.kind === 'question') && m.kind !== 'attachments' && (
                  <div className="sr-bubble sr-bubble--ai">
                    {m.kind === 'question' ? L('الإجابة:', 'Answer:') : (m.changes?.length > 0 ? L('فهمتُ الطلب:', 'Understood:') : L('التقرير بالنطاق الحالي.', 'Report for the current scope.'))}
                    {m.changes?.length > 0 && <div className="sr-changes">{m.changes.map((c, i) => <span key={i} className="sr-chip sr-chip--changed">{c}</span>)}</div>}
                    {m.spec && <InterpretationSummary msg={m} chips={specChips(m.spec)} L={L} editable={isLast && !busy} editing={isLast && editOpen} onEdit={() => setEditOpen((v) => !v)} panel={<FilterPanel key={JSON.stringify(m.spec.scope) + m.spec.compare} spec={m.spec} today={today} ar={ar} L={L} sourceName={sourceName} onApply={(p) => { setEditOpen(false); applyFilters(p); }} />} />}
                    {isBusy && <AgentSteps order={SYS_ORDER} current={busy.step} textOf={stepText} L={L} onStop={stop} />}
                    {m.status === 'stopped' && <div className="sr-warn">{L('أُوقف الإعداد.', 'Generation was stopped.')} <button type="button" className="btn btn-sm" onClick={() => retry(m)}>{L('إعادة المحاولة', 'Retry')}</button></div>}
                    {m.status === 'error' && <div className="sr-warn" role="alert">{L('تعذّر إعداد التقرير. تحقق من اتصال خدمة البيانات ثم أعد المحاولة.', 'The report could not be prepared. Check the data service and try again.')} <button type="button" className="btn btn-sm" onClick={() => retry(m)}>{L('إعادة المحاولة', 'Retry')}</button></div>}
                  </div>
                )}
                {showCard && (
                  <div className={`sr-card card${fresh ? ' sr-reveal' : ''}`}>
                    <div className="sr-card__bar">
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCollapsed((c) => ({ ...c, [m.id]: !(c[m.id] ?? !isLast) }))}>{(collapsed[m.id] ?? !isLast) ? `▸ ${L('عرض', 'Show')} — ${shown.title}` : `▾ ${L('طيّ', 'Collapse')}`}</button>
                      {isLast && <>
                        {exportButtons(shown)}
                        {!isFileResult && m.spec && m.kind !== 'view' && <button type="button" className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => retry(m)}>↻ {L('إعادة', 'Regenerate')}</button>}
                      </>}
                    </div>
                    {!(collapsed[m.id] ?? !isLast) && (shown.empty ? <div className="rv-empty">{isFileResult ? L('لم يمكن قراءة أي ملف من المرفقات؛ راجع الملاحظات أعلاه.', 'None of the attached files could be read; see the notes above.') : L('لا فواتير في هذا الاختيار؛ البيانات غير متاحة وليست صفراً. وسّع الفترة أو التصفية.', 'No invoices in this selection; the data is unavailable, not zero. Widen the period or filters.')}</div> : <ReportView model={shown} />)}
                  </div>
                )}
                {m.status === 'done' && m.spec && !model && !isBusy && <button type="button" className="btn btn-sm" onClick={() => run(conv.id, m.id, m.spec)} disabled={!!busy}>{L('عرض هذا التقرير', 'Show this report')}</button>}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="sr-dock">
        {!empty && followUps.length > 0 && <div className="sr-suggest sr-suggest--inline" aria-label={L('طلبات متابعة', 'Follow-ups')}>{followUps.map((s) => <button key={s.ar} type="button" className="sr-suggest__btn sr-suggest__btn--sm" disabled={!!busy} onClick={() => send(s[ar ? 'ar' : 'en'])}>{s[ar ? 'ar' : 'en']}</button>)}</div>}
        {files.length > 0 && <div className="sr-files" role="list" aria-label={L('المرفقات', 'Attachments')}>{files.map((f) => <FileChip key={f.id} f={f} ar={ar} L={L} open={previewId === f.id} onToggle={() => setPreviewId((p) => (p === f.id ? null : f.id))} onRemove={() => removeFile(f.id)} />)}</div>}
        {previewId && files.find((f) => f.id === previewId && !f.reading) && <FilePreview f={files.find((f) => f.id === previewId)} ar={ar} L={L} />}
        {fileNote && <div className="sr-warn" role="status">{fileNote}</div>}
        <div className="sr-composer">
          <input ref={fileRef} id="sr-file" type="file" multiple accept={ACCEPT} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <button type="button" className="sr-composer__attach" onClick={() => fileRef.current?.click()} disabled={!!busy || files.length >= MAX_FILES} aria-label={L('إرفاق ملفات', 'Attach files')} title={L('إرفاق PDF أو Word أو Excel أو CSV أو PowerPoint أو صور', 'Attach PDF, Word, Excel, CSV, PowerPoint or images')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
          </button>
          <textarea ref={taRef} id="sr-input" rows={1} className="sr-composer__input" value={input} onChange={(e) => onInput(e.target.value)} onKeyDown={onKey} aria-label={L('طلب تقرير أو سؤال', 'Report request or question')} placeholder={files.length ? L('ماذا تريد من الملفات؟ أو أرسل للتحليل', 'What do you want from the files? Or just send') : L('اطلب تقريرًا أو اسأل، أو أرفق ملفات…', 'Ask for a report or a question, or attach files…')} />
          {busy ? <button type="button" className="sr-composer__btn sr-composer__btn--stop" onClick={stop} aria-label={L('إيقاف الإعداد', 'Stop generation')}>■</button>
            : <button type="button" className="sr-composer__btn" onClick={() => send(input)} disabled={!canSend} aria-label={L('إرسال', 'Send')}>{ar ? '↰' : '➤'}</button>}
        </div>
        <div className="muted sr-hint">{L('Enter للإرسال · Shift+Enter لسطر جديد · اسحب الملفات إلى هنا لإرفاقها', 'Enter to send · Shift+Enter for a new line · drag files here to attach them')}</div>
      </div>
    </div>
  );
}
