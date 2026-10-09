// «التقارير الذكية» — the ONE reporting experience (it replaces the former report centre and the former smart-reports page).
// A conversation: the user asks for a report or asks a question; the assistant builds the report from the shared data layer.
// Interpretation is rule-based (it is NOT a language model) and the page says so. Each report is a MODEL (src/data/reportModel.js)
// that is both rendered here and exported, so the file always contains what is on screen.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { municipalitiesOf } from '../data/catalog';
import { amanahOptionsOf, REVENUE_SOURCE_KEYS } from '../data/revenueLedger';
import { previousScope } from '../data/revenueMetrics';
import { startOfYear, startOfMonth } from '../data/clock';
import { interpret, defaultSpec, describeChange, previousMonthScope, SUPPORTED_HELP } from '../data/reportIntents';
import { buildReportModel, SECTION_META, SECTION_ORDER } from '../data/reportModel';
import { sourceAr, sourceEn } from '../data/insightsEngine';
import ReportView from '../components/smart/ReportView';
import { exportModelToDocx, exportModelToXlsx, exportModelToPptx } from '../utils/exportReportModel';
import { fmtRiyadh, fmtRangeText, fmtDateText } from '../data/clock';
import { DateRangeFields } from '../components/revenue/RevenueUI';
import { measure, headlineCfg } from '../data/measure';
import { usePersistOnChange } from '../utils/usePersistOnChange';
import LocalDataPanel from '../components/LocalDataPanel';
import { PRESETS, detectPreset } from '../data/periodPresets';

const STORE_KEY = 'ib_smart_convs_v1';
const loadConvs = () => { try { const v = JSON.parse(window.localStorage.getItem(STORE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const saveConvs = (c) => { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(c.slice(0, 30).map((x) => ({ ...x, messages: x.messages.map(({ model, progress, ...m }) => m) })))); } catch { /* storage unavailable: history stays in memory */ } };
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
const STEPS = { scope: ['أحدد النطاق والمرشحات', 'Setting the scope and filters'], read: ['أقرأ بيانات الفواتير والتحصيل', 'Reading invoice and collection data'], compare: ['أحسب المقارنة بالفترة المكافئة', 'Computing the equivalent-period comparison'], build: ['أُعدّ الجداول والرسوم والنتائج', 'Preparing tables, charts and findings'], check: ['أراجع المطابقة المالية', 'Checking the financial reconciliation'] };

function FilterPanel({ spec, today, ar, L, sourceName, onApply }) {
  const sp = spec || defaultSpec(today); const sc = sp.scope;
  const [d, setD] = useState({ from: sc.from, to: sc.to, amanah: Array.isArray(sc.amanah) ? '__multi' : sc.amanah, muni: sc.muni, source: sc.source, status: sc.status || 'all', scopeType: sc.scopeType || 'all', compare: sp.compare });
  const munis = d.amanah !== 'all' && d.amanah !== '__multi' ? municipalitiesOf(d.amanah).filter(Boolean) : [];
  const [badRange, setBadRange] = useState(false); const [rk, setRk] = useState(0);
  const preset = (from, to) => { setBadRange(false); setRk((n) => n + 1); setD((x) => ({ ...x, from, to })); };
  const ams = amanahOptionsOf();
  return (
    <div className="sr-filters card" role="region" aria-label={L('المرشحات', 'Filters')}>
      <div className="sr-filters__row">
        <span className="rv-scope__lbl">{L('الفترة', 'Period')}</span>
        {PRESETS.map((p) => <button key={p.key} type="button" className="btn btn-sm btn-ghost" onClick={() => { const r = p.range(today); preset(r.from, r.to); }}>{ar ? p.ar : p.en}</button>)}
        <DateRangeFields key={rk} from={d.from} to={d.to} today={today} lang={ar ? 'ar' : 'en'} idPrefix="sr" onChange={(r) => { setBadRange(!r); if (r) setD((x) => ({ ...x, from: r.from, to: r.to })); }} />
      </div>
      <div className="sr-filters__row">
        <label className="rv-scope__lbl" htmlFor="sr-am">{L('الأمانة', 'Amanah')}</label>
        <select id="sr-am" className="select" value={d.amanah} onChange={(e) => setD({ ...d, amanah: e.target.value, muni: 'all' })}><option value="all">{L('كل الأمانات', 'All Amanahs')}</option>{Array.isArray(sc.amanah) && <option value="__multi">{sc.amanah.map((k) => { const x = ams.find((y) => y.key === k); return x ? (ar ? x.ar : x.en) : k; }).join(L('، ', ', '))}</option>}{ams.map((a) => <option key={a.key} value={a.key}>{ar ? a.ar : a.en}</option>)}</select>
        {munis.length > 0 && <><label className="rv-scope__lbl" htmlFor="sr-mu">{L('البلدية', 'Municipality')}</label><select id="sr-mu" className="select" value={d.muni} onChange={(e) => setD({ ...d, muni: e.target.value })}><option value="all">{L('كل البلديات', 'All municipalities')}</option>{munis.map((m) => <option key={m.key} value={m.key}>{ar ? m.ar : m.en}</option>)}</select></>}
        <label className="rv-scope__lbl" htmlFor="sr-src">{L('المصدر', 'Source')}</label>
        <select id="sr-src" className="select" value={d.source} onChange={(e) => setD({ ...d, source: e.target.value })}><option value="all">{L('كل المصادر', 'All sources')}</option>{REVENUE_SOURCE_KEYS.map((k) => <option key={k} value={k}>{sourceName(k)}</option>)}</select>
      </div>
      <div className="sr-filters__row">
        <label className="rv-scope__lbl" htmlFor="sr-st">{L('حالة الفاتورة', 'Invoice status')}</label>
        <select id="sr-st" className="select" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}>{[['all', 'كل الحالات', 'All statuses'], ['collected', 'محصّلة', 'Collected'], ['open', 'قائمة', 'Open'], ['overdue', 'متأخرة', 'Overdue'], ['partial', 'جزئية', 'Partial'], ['not_due', 'لم تستحق', 'Not yet due'], ['cancelled', 'ملغاة', 'Cancelled'], ['excluded', 'مستبعدة', 'Excluded']].map(([k, a, e]) => <option key={k} value={k}>{L(a, e)}</option>)}</select>
        <label className="rv-scope__lbl" htmlFor="sr-sc">{L('مركزي / داخلي', 'Central / internal')}</label>
        <select id="sr-sc" className="select" value={d.scopeType} onChange={(e) => setD({ ...d, scopeType: e.target.value })}><option value="all">{L('الكل', 'All')}</option><option value="central">{L('مركزي', 'Central')}</option><option value="internal">{L('داخلي', 'Internal')}</option></select>
        <label className="rv-scope__lbl" htmlFor="sr-cm">{L('المقارنة', 'Comparison')}</label>
        <select id="sr-cm" className="select" value={d.compare} onChange={(e) => setD({ ...d, compare: e.target.value })}><option value="none">{L('بدون', 'None')}</option><option value="prev_year">{L('نفس الفترة من العام السابق', 'Same period last year')}</option><option value="prev_month">{L('الشهر الماضي (المدة المنقضية نفسها)', 'Last month (same elapsed days)')}</option></select>
      </div>
      <div className="sr-filters__row"><button type="button" className="btn btn-primary btn-sm" disabled={badRange} onClick={() => { onApply({ compare: d.compare, scope: { from: d.from, to: d.to, amanah: d.amanah === '__multi' ? sc.amanah : d.amanah, muni: d.muni, source: d.source, status: d.status, scopeType: d.scopeType } }); }}>{L('تطبيق وتحديث التقرير', 'Apply and update the report')}</button><span className="muted" style={{ fontSize: 12 }}>{L('التقارير الجديدة تستخدم هذه المرشحات حتى تغيّرها.', 'New reports keep using these filters until you change them.')}</span></div>
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

export default function SmartReports({ embedded = false, initialQuery = null, onQueryConsumed = null }) {
  const rev = useRevenue();
  const { lang, ar } = useL();
  const L = useCallback((a, e) => (ar ? a : e), [ar]); // Arabic first, English second (the shared useL().L is English first)
  const today = rev.cfg.cutoff;
  const [convs, setConvs] = useState(loadConvs);
  const [activeId, setActiveId] = useState(() => loadConvs()[0]?.id || null);
  const [input, setInput] = useState(() => readDrafts()[loadConvs()[0]?.id || 'new'] || '');
  const [busy, setBusy] = useState(null); // { msgId, step, token }
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [editOpen, setEditOpen] = useState(false); const [editPendingId, setEditPendingId] = useState(null);
  const [exporting, setExporting] = useState('');
  const [models, setModels] = useState({}); // msgId -> model (in memory; regenerated from the spec when a stored conversation is reopened)
  const [collapsed, setCollapsed] = useState({});
  const endRef = useRef(null); const taRef = useRef(null);

  // a new conversation starts from the SHARED filters of the management area, so dashboard, fixed reports and smart reports speak about the same scope
  const sharedSpec = useMemo(() => { const e = rev.scopeEff; return { ...defaultSpec(today), preset: rev.scope.preset, scope: { from: e.from, to: e.to, amanah: e.amanah, source: e.source, scopeType: e.scopeType || 'all', muni: e.muni || 'all', status: e.status || 'all' } }; }, [rev.scopeEff, rev.scope.preset, today]);
  const conv = convs.find((c) => c.id === activeId) || null;
  const spec = conv?.spec || null;
  const labelOfAmanah = useCallback((k) => { const a = amanahOptionsOf().find((x) => x.key === k); return a ? (ar ? a.ar : a.en) : k; }, [ar]);

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

  /* ---------------- generation ---------------- */
  const generate = useCallback(async (sp, token, setStep) => {
    const sc = sp.scope; const cutoff = rev.cfg.cutoff;
    const step = (k) => { if (token.cancelled) throw Object.assign(new Error('stopped'), { stopped: true }); setStep(k); };
    step('scope');
    const scope = { ...sc };
    const prevSc = sp.compare === 'prev_month' ? previousMonthScope(sc, today) : sp.compare === 'prev_year' ? (({ from, to }) => ({ from, to }))(previousScope({ from: sc.from, to: sc.to })) : null;
    const atEnd = { cfg: headlineCfg(rev.cfg) }; // the SAME measurement rule as every other view (src/data/measure.js)
    step('read');
    const task = rev.startAnalysis('report', { focus: sp.sections.includes('exclusions') ? 'noncollection' : sp.sections.includes('amanah') ? 'amanah' : 'revenue', nonce: uid() }, { scope, background: true, inline: true, paceMs: 0, followsGlobal: false, origin: 'smart-reports' });
    token.taskId = task.id;
    const final = await task.promise;
    step('compare');
    if (!['completed', 'completed_with_limitations'].includes(final.status) || !final.out?.snapshot) { if (token.cancelled) throw Object.assign(new Error('stopped'), { stopped: true }); throw Object.assign(new Error('analysis_failed'), { status: final.status, reason: final.error || final.errors || final.message || null }); }
    const out = { ...final.out, snapshot: await measure(rev.data, scope, rev.cfg) };
    const scopeKeys = { amanah: sc.amanah, source: sc.source, scopeType: sc.scopeType, muni: sc.muni, status: sc.status };
    const [prev, cash, bridge] = await Promise.all([
      prevSc ? rev.data.snapshot({ ...prevSc, ...scopeKeys }, atEnd) : Promise.resolve(null),
      sp.sections.includes('trends') ? rev.data.series({ ...scope }, { asOf: sc.to < cutoff ? sc.to : cutoff }) : Promise.resolve(null),
      sp.sections.includes('quality') ? rev.data.bridge({ ...scopeKeys, from: '2000-01-01', to: cutoff }) : Promise.resolve(null)
    ]);
    step('build');
    const model = buildReportModel({ spec: sp, lang, out, prev, compare: sp.compare, prevScope: prevSc, cash, bridge, targets: rev.targets, cases: rev.cases, meta: rev.meta });
    step('check');
    if (!model.equationOk) model.sections.unshift({ key: 'warn', title: L('تنبيه', 'Warning'), purpose: '', blocks: [{ type: 'callout', tone: 'warn', text: L('تعذّر تحقق إحدى علاقات المطابقة المالية لهذا الاختيار؛ راجع قسم اكتمال البيانات والمطابقة.', 'One financial reconciliation identity did not hold for this selection; see the completeness and reconciliation section.') }] });
    return model;
  }, [rev, lang, today, L]);

  const run = useCallback(async (convId, msgId, sp) => {
    const token = { cancelled: false, taskId: null };
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

  const stop = () => { if (!busy) return; busy.token.cancelled = true; if (busy.token.taskId) rev.cancelTask(busy.token.taskId); };

  // reopen a stored conversation: rebuild the last report from its spec
  useEffect(() => {
    if (!conv || busy) return;
    const last = [...conv.messages].reverse().find((m) => m.role === 'assistant' && m.spec && m.status === 'done');
    if (last && !models[last.id]) run(conv.id, last.id, last.spec);
  }, [conv?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- sending ---------------- */
  const send = useCallback((text, override = null, { fresh = false } = {}) => {
    const q = (text || '').trim();
    if (!q || busy) return;
    let c = fresh ? null : conv; // a request that arrives through a link starts its own conversation
    if (!c) { c = { id: uid(), title: q.slice(0, 48), createdAt: Date.now(), updatedAt: Date.now(), spec: sharedSpec, messages: [] }; }
    const userMsg = { id: uid(), role: 'user', text: q };
    const res = override ? { kind: 'report', spec: override.spec, changes: override.changes || [] } : interpret(q, c.messages.some((m) => m.spec) ? c.spec : null, today, { base: sharedSpec });
    const asId = uid();
    const lbl = (ch) => describeChange(ch, lang, { amanahLabel: labelOfAmanah, spec: res.spec });
    let aMsg;
    if (res.kind === 'unsupported' || res.kind === 'empty') aMsg = { id: asId, role: 'assistant', kind: 'unsupported', question: res.question || null, status: 'done' };
    else if (res.kind === 'clarify') aMsg = { id: asId, role: 'assistant', kind: 'clarify', question: res.question, options: res.options, status: 'done' };
    else if (res.confirm?.length && !override) aMsg = { id: asId, role: 'assistant', kind: 'confirm', status: 'pending', confirm: res.confirm, pending: { kind: res.kind, spec: res.spec, changes: res.changes.map(lbl), changeKeys: res.changes.map((x) => x.key), firstReport: !c.messages.some((m) => m.spec) } };
    else aMsg = { id: asId, role: 'assistant', kind: res.kind, spec: res.spec, changes: res.changes.map(lbl), changeKeys: res.changes.map((x) => x.key), firstReport: !c.messages.some((m) => m.spec), status: 'working' };
    const next = { ...c, title: c.messages.length ? c.title : q.slice(0, 48), updatedAt: Date.now(), spec: aMsg.spec || c.spec, messages: [...c.messages.map((m) => (m.kind === 'confirm' && m.status === 'pending' ? { ...m, status: 'superseded' } : m)), userMsg, aMsg] };
    setConvs((cs) => (cs.some((x) => x.id === c.id) ? cs.map((x) => (x.id === c.id ? next : x)) : [next, ...cs]));
    setActiveId(c.id); setInput(''); writeDraft(c.id, ''); writeDraft(draftFor.current, '');
    if (aMsg.spec) run(c.id, asId, aMsg.spec);
  }, [busy, conv, today, lang, labelOfAmanah, run, sharedSpec]);

  // the demo asks the user to confirm the interpreted scope in the risky categories BEFORE anything is generated
  const confirmPending = (msg) => {
    const pd = msg.pending; if (busy || !pd) return;
    patchConv(conv.id, (c) => ({ ...c, spec: pd.spec, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === msg.id ? { id: m.id, role: 'assistant', kind: pd.kind, spec: pd.spec, changes: pd.changes, changeKeys: pd.changeKeys, firstReport: pd.firstReport, confirmedByUser: true, status: 'working' } : m)) }));
    run(conv.id, msg.id, pd.spec);
  };
  const cancelPending = (msg) => patchConv(conv.id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msg.id ? { ...m, status: 'cancelled' } : m)) }));
  const retry = (msg) => { if (busy) return; patchConv(conv.id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msg.id ? { ...m, status: 'working' } : m)) })); run(conv.id, msg.id, msg.spec); };
  const newConv = () => { if (busy) return; setActiveId(null); setInput(''); setShowFilters(false); setShowHistory(false); taRef.current?.focus(); };
  const [renaming, setRenaming] = useState(null); // { id, text }
  const renameConv = (id, text) => { const t = text.trim().slice(0, 80); if (t) patchConv(id, (c) => ({ ...c, title: t, titleSource: 'user' })); setRenaming(null); window.setTimeout(() => document.getElementById(`sr-rn-${id}`)?.focus(), 0); };
  const removeConv = (id) => { setConvs((cs) => cs.filter((c) => c.id !== id)); if (id === activeId) setActiveId(null); };

  const applyFilters = (patch, baseSpec = null) => {
    setShowFilters(false);
    const base = baseSpec ? JSON.parse(JSON.stringify(baseSpec)) : spec ? JSON.parse(JSON.stringify(spec)) : JSON.parse(JSON.stringify(sharedSpec));
    const next = { ...base, ...patch, scope: { ...base.scope, ...(patch.scope || {}) } };
    next.preset = detectPreset(next.scope.from, next.scope.to, today); // the label of the period follows the dates that were actually chosen
    const changes = [];
    for (const k of ['from', 'to']) if (patch.scope && patch.scope[k] && patch.scope[k] !== base.scope[k]) { if (!changes.some((x) => x.key === 'period')) changes.push({ key: 'period', value: `${next.scope.from} → ${next.scope.to}` }); }
    for (const k of ['amanah', 'muni', 'source', 'status', 'scopeType']) if (patch.scope && JSON.stringify(patch.scope[k]) !== undefined && JSON.stringify(patch.scope[k]) !== JSON.stringify(base.scope[k])) changes.push({ key: k, value: patch.scope[k] });
    if (patch.compare && patch.compare !== base.compare) changes.push({ key: 'compare', value: patch.compare });
    if (!changes.length) return;
    send(L('طبّق المرشحات: ', 'Apply filters: ') + changes.map((c) => describeChange(c, lang, { amanahLabel: labelOfAmanah })).join('، '), { spec: next, changes });
  };

  async function doExport(kind, model) {
    if (exporting) return;
    setExporting(kind);
    try { if (kind === 'docx') await exportModelToDocx(model); if (kind === 'xlsx') exportModelToXlsx(model); if (kind === 'pptx') await exportModelToPptx(model); } finally { setExporting(''); }
  }

  // deep links: /smart-reports?r=<standard report key> opens that report; ?q=<request> sends a request (old /reports links land here too)
  const deepRef = useRef(false);
  useEffect(() => {
    if (deepRef.current) return; deepRef.current = true;
    const sp = new URLSearchParams(window.location.search); const r = sp.get('r'); const q = sp.get('q');
    const link = q || initialQuery;
    if (link) { send(link, null, { fresh: true }); onQueryConsumed?.(); } // consumed once: reloading the page does not send it again (F-16b)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } };

  /* ---------------- pieces ---------------- */
  const sourceName = (k) => (k === 'all' ? L('كل المصادر', 'All sources') : ar ? sourceAr(k) : sourceEn(k));
  const specChips = useCallback((sp) => {
    const sc = sp.scope;
    const amLabel = sc.amanah === 'all' ? L('كل الأمانات', 'All Amanahs') : [].concat(sc.amanah).map(labelOfAmanah).join('، ');
    const mu = sc.muni === 'all' ? L('كل البلديات', 'All municipalities') : (municipalitiesOf(String(sc.muni).split('|')[0]).find((m) => m && m.key === sc.muni)?.[ar ? 'ar' : 'en'] || sc.muni);
    const st = { all: L('كل الحالات', 'All statuses'), collected: L('محصّلة', 'Collected'), open: L('قائمة', 'Open'), overdue: L('متأخرة', 'Overdue'), partial: L('جزئية', 'Partial'), not_due: L('لم تستحق', 'Not due'), cancelled: L('ملغاة', 'Cancelled'), excluded: L('مستبعدة', 'Excluded') }[sc.status || 'all'];
    const cmp = { none: null, prev_month: L('مقارنة بالشهر الماضي', 'vs last month'), prev_year: L('مقارنة بالعام الماضي', 'vs last year') }[sp.compare];
    return [
      { k: 'period', label: L('الفترة', 'Period'), value: fmtRangeText(sc.from, sc.to, ar ? 'ar' : 'en') }, { k: 'amanah', label: L('الأمانة', 'Amanah'), value: amLabel }, { k: 'muni', label: L('البلدية', 'Municipality'), value: mu },
      { k: 'source', label: L('المصدر', 'Source'), value: sourceName(sc.source) }, { k: 'status', label: L('الحالة', 'Status'), value: st },
      ...(sc.scopeType && sc.scopeType !== 'all' ? [{ k: 'st', label: L('النطاق', 'Scope'), value: sc.scopeType === 'internal' ? L('داخلي', 'Internal') : L('مركزي', 'Central') }] : []),
      { k: 'basis', label: L('الأساس', 'Basis'), value: L(`فواتير الفترة · التحصيل حتى ${fmtDateText(sc.to < today ? sc.to : today, 'ar')}`, `Period invoices · collections to ${fmtDateText(sc.to < today ? sc.to : today, 'en')}`) }, ...(cmp ? [{ k: 'cmp', label: L('المقارنة', 'Comparison'), value: cmp }] : [])
    ];
  }, [today, ar, L, labelOfAmanah]); // eslint-disable-line react-hooks/exhaustive-deps
  const chips = useMemo(() => specChips(spec || sharedSpec), [specChips, spec, sharedSpec]);

  const scopeDiffers = !!spec && ['from', 'to', 'amanah', 'source', 'scopeType', 'muni', 'status'].some((k) => JSON.stringify(spec.scope[k] ?? 'all') !== JSON.stringify(sharedSpec.scope[k] ?? 'all'));
  const lastReportId = conv ? [...conv.messages].reverse().find((m) => m.role === 'assistant' && m.spec)?.id : null;
  const stepText = (k) => STEPS[k]?.[ar ? 0 : 1] || '';
  const empty = !conv || conv.messages.length === 0;

  return (
    <div className="sr-page" dir={ar ? 'rtl' : 'ltr'}>
      <div className="sr-top">
        {!embedded && <div><h1 className="page-title" style={{ margin: 0 }}>{L('التقارير الذكية', 'Smart reports')}</h1></div>}
        <div className="sr-top__actions">
          <button type="button" className="btn btn-sm" onClick={newConv} disabled={!!busy}>＋ {L('محادثة جديدة', 'New conversation')}</button>
          <button type="button" className="btn btn-sm btn-ghost" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>{L('السجل', 'History')} ({convs.length})</button>
          <Link className="btn btn-sm btn-ghost" to="/insights?view=reports">{L('التقارير الثابتة', 'Fixed reports')}</Link>
        </div>
      </div>

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
        <button type="button" className="btn btn-sm btn-ghost" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>{showFilters ? L('إخفاء المرشحات', 'Hide filters') : L('المرشحات', 'Filters')}</button>
      </div>
      {spec && scopeDiffers && <div className="sr-note" role="note">{L('لهذه المحادثة نطاقها الخاص، وهو يختلف عن مرشحات لوحة المعلومات الحالية؛ لن يتغير نطاقها تلقائياً.', 'This conversation keeps its own scope, which differs from the current dashboard filters; it never changes automatically.')} <button type="button" className="sr-link" onClick={() => applyFilters({ scope: sharedSpec.scope })}>{L('مزامنة نطاق المحادثة مع لوحة المعلومات', 'Sync the conversation scope with the dashboard')}</button></div>}
      {showFilters && <FilterPanel key={`${spec ? JSON.stringify(spec.scope) + spec.compare : JSON.stringify(sharedSpec.scope)}`} spec={spec || sharedSpec} today={today} ar={ar} L={L} sourceName={sourceName} onApply={applyFilters} />}

      <div className="sr-note" role="note">
        {L('اكتب طلبك: الفترة أو الأمانة أو المصدر أو المقارنة.', 'Write your request: period, Amanah, source or comparison.')} <b>{L('المساعد يعمل بقواعد محددة وليس بنموذج لغوي: راجع «كيف فهمتُ طلبك» قبل الاعتماد على أي نتيجة.', 'The assistant works with fixed rules, not a language model: check «How I read your request» before relying on any result.')}</b>
        <details className="rv-more"><summary>{L('أمثلة لما يمكنك طلبه', 'Examples of what you can ask')}</summary><ul className="sr-help">{SUPPORTED_HELP[ar ? 'ar' : 'en'].map((h, k) => <li key={k}>{h}</li>)}</ul></details>
        <details className="rv-more"><summary>{L('عن المساعد', 'About the assistant')}</summary><div>{L('يفهم المساعد صيغاً محددة بقواعد حسابية وليس بنموذج لغوي، وتُبنى التقارير من بيانات النظام التجريبية.', 'The assistant understands defined phrasings with rules, not a language model, and reports are built from the system’s demo data.')}</div></details>
      </div>

      <LocalDataPanel />
      <div className="sr-thread" aria-live="polite">
        {empty && (
          <div className="sr-welcome">
            <h2>{L('ماذا تريد أن تعرف؟', 'What would you like to see?')}</h2>
            <div className="sr-suggest">{SUGGESTIONS.map((s) => <button key={s.ar} type="button" className="sr-suggest__btn" onClick={() => send(s[ar ? 'ar' : 'en'])}>{s[ar ? 'ar' : 'en']}</button>)}</div>
          </div>
        )}
        {conv?.messages.map((m) => {
          if (m.role === 'user') return <div key={m.id} className="sr-msg sr-msg--user"><div className="sr-bubble">{m.text}</div></div>;
          const model = models[m.id]; const isBusy = busy?.msgId === m.id; const isLast = m.id === lastReportId;
          return (
            <div key={m.id} className="sr-msg sr-msg--ai">
              <div className="sr-avatar" aria-hidden="true">ذ</div>
              <div className="sr-ai">
                {m.kind === 'clarify' && <div className="sr-bubble sr-bubble--ai"><b>{m.question[ar ? 'ar' : 'en']}</b><div className="sr-suggest sr-suggest--inline">{(m.options || []).map((o) => <button key={o.text} type="button" className="sr-suggest__btn" disabled={!!busy} onClick={() => send(o.text)}>{o.label[ar ? 'ar' : 'en']}</button>)}</div></div>}
                {m.kind === 'unsupported' && <div className="sr-bubble sr-bubble--ai"><b>{m.question ? m.question[ar ? 'ar' : 'en'] : L('لم أفهم الطلب. جرّب مثلاً:', 'I did not understand the request. Try for example:')}</b><div className="sr-suggest sr-suggest--inline">{SUGGESTIONS.slice(0, 3).map((x) => <button key={x.ar} type="button" className="sr-suggest__btn" disabled={!!busy} onClick={() => send(x[ar ? 'ar' : 'en'])}>{x[ar ? 'ar' : 'en']}</button>)}</div></div>}
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
                {m.kind !== 'unsupported' && m.kind !== 'clarify' && m.kind !== 'confirm' && (
                  <div className="sr-bubble sr-bubble--ai">
                    {m.kind === 'question' ? L('الإجابة:', 'Answer:') : (m.changes?.length > 0 ? L('فهمتُ الطلب:', 'Understood:') : L('التقرير بالنطاق الحالي.', 'Report for the current scope.'))}
                    {m.changes?.length > 0 && <div className="sr-changes">{m.changes.map((c, i) => <span key={i} className="sr-chip sr-chip--changed">{c}</span>)}</div>}
                    {m.spec && <InterpretationSummary msg={m} chips={specChips(m.spec)} L={L} editable={isLast && !busy} editing={isLast && editOpen} onEdit={() => setEditOpen((v) => !v)} panel={<FilterPanel key={JSON.stringify(m.spec.scope) + m.spec.compare} spec={m.spec} today={today} ar={ar} L={L} sourceName={sourceName} onApply={(p) => { setEditOpen(false); applyFilters(p); }} />} />}
                    {isBusy && <div className="sr-progress" role="status"><span className="sr-spin" aria-hidden="true" /> {stepText(busy.step)}… <button type="button" className="btn btn-sm btn-ghost" onClick={stop}>{L('إيقاف', 'Stop')}</button></div>}
                    {m.status === 'stopped' && <div className="sr-warn">{L('أُوقف الإعداد.', 'Generation was stopped.')} <button type="button" className="btn btn-sm" onClick={() => retry(m)}>{L('إعادة المحاولة', 'Retry')}</button></div>}
                    {m.status === 'error' && <div className="sr-warn" role="alert">{L('تعذّر إعداد التقرير. تحقق من اتصال خدمة البيانات ثم أعد المحاولة.', 'The report could not be prepared. Check the data service and try again.')} <button type="button" className="btn btn-sm" onClick={() => retry(m)}>{L('إعادة المحاولة', 'Retry')}</button></div>}
                  </div>
                )}
                {model && (
                  <div className="sr-card card">
                    <div className="sr-card__bar">
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCollapsed((c) => ({ ...c, [m.id]: !(c[m.id] ?? !isLast) }))}>{(collapsed[m.id] ?? !isLast) ? `▸ ${L('عرض', 'Show')} — ${model.title}` : `▾ ${L('طيّ', 'Collapse')}`}</button>
                      {isLast && <div className="sr-card__actions">
                        {[['docx', 'Word'], ['xlsx', 'Excel'], ['pptx', 'PowerPoint']].map(([k, n]) => <button key={k} type="button" className="btn btn-sm" disabled={model.empty} aria-disabled={!!exporting || undefined} onClick={() => doExport(k, model)}>{exporting === k ? L('جارٍ التصدير…', 'Exporting…') : `${L('تصدير', 'Export')} ${n}`}</button>)}
                        <button type="button" className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => retry(m)}>↻ {L('إعادة', 'Regenerate')}</button>
                      </div>}
                    </div>
                    {!(collapsed[m.id] ?? !isLast) && (model.empty ? <div className="rv-empty">{L('لا فواتير في هذا الاختيار؛ البيانات غير متاحة وليست صفراً. وسّع الفترة أو المرشحات.', 'No invoices in this selection; the data is unavailable, not zero. Widen the period or filters.')}</div> : <ReportView model={model} />)}
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
        {!empty && <div className="sr-suggest sr-suggest--inline" aria-label={L('طلبات متابعة', 'Follow-ups')}>{FOLLOW_UPS.map((s) => <button key={s.ar} type="button" className="sr-suggest__btn sr-suggest__btn--sm" disabled={!!busy} onClick={() => send(s[ar ? 'ar' : 'en'])}>{s[ar ? 'ar' : 'en']}</button>)}</div>}
        <div className="sr-composer">
          <textarea ref={taRef} id="sr-input" rows={1} className="sr-composer__input" value={input} onChange={(e) => onInput(e.target.value)} onKeyDown={onKey} aria-label={L('طلب تقرير أو سؤال', 'Report request or question')} placeholder={L('اطلب تقريرًا أو اسأل عن الإيرادات والتحصيل…', 'Ask for a report or about revenue and collection…')} />
          {busy ? <button type="button" className="sr-composer__btn sr-composer__btn--stop" onClick={stop} aria-label={L('إيقاف الإعداد', 'Stop generation')}>■</button>
            : <button type="button" className="sr-composer__btn" onClick={() => send(input)} disabled={!input.trim()} aria-label={L('إرسال', 'Send')}>{ar ? '↰' : '➤'}</button>}
        </div>
        <div className="muted sr-hint">{L('Enter للإرسال · Shift+Enter لسطر جديد', 'Enter to send · Shift+Enter for a new line')}</div>
      </div>
    </div>
  );
}
