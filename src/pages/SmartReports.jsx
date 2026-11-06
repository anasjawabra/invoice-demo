// «التقارير الذكية» — the ONE reporting experience (it replaces the former report centre and the former smart-reports page).
// A conversation: the user asks for a report or asks a question, or attaches files; the assistant answers from the shared data layer and the files.
// Follow-ups act on the latest result («change the chart», «show the tables only», «turn it into a presentation»); see src/data/chatIntents.js.
// Interpretation is rule-based (it is NOT a language model) and the page says so. Each report is a MODEL (src/data/reportModel.js)
// that is both rendered here and exported, so the file always contains what is on screen.
// ACCESS (docs/access-control.md §6): the page runs inside the signed-in user's effective scope for the `smart_reports` module (useReportAccess). Requests are interpreted within it («all municipalities» = all AUTHORIZED ones, an unauthorized
// entity gets an access message), every saved report stores the scope it covers and is RE-CHECKED against the CURRENT access when reopened (the cached figures of a report whose scope is no longer covered are never rendered),
// exports follow the `smart_reports` module (no separate export permission; a read-only role may export), and everything saved here (history, reports, drafts) is filed under the user.
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useInRouterContext, useLocation } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { muniLabel } from '../data/municipalityModel';
import { amanahFilterOptions, REVENUE_SOURCE_KEYS } from '../data/revenueLedger';
import { previousScope } from '../data/revenueMetrics';
import { startOfYear, startOfMonth } from '../data/clock';
import { interpret, defaultSpec, describeChange, previousMonthScope } from '../data/reportIntents';
import { buildReportModel, SECTION_META, SECTION_ORDER } from '../data/reportModel';
import { NC_APPENDIX_ROWS } from '../data/ncReportModel';
import { sourceAr, sourceEn } from '../data/insightsEngine';
import ReportView from '../components/smart/ReportView';
import { exportModel, reportFileName, EXPORT_FORMATS } from '../utils/exportReportModel';
import ExportDialog from '../components/smart/ExportDialog';
import { interpretChat, CHART_NAME } from '../data/chatIntents';
import { applyView, mergeView, emptyView, hasCharts, hasTables, cleanView } from '../data/reportView';
import { assignChartIds } from '../data/chartIds';
import { interpretChartRequest, viewAfterRequest } from '../data/chartRequests';
import { skippedLine } from '../components/charts/chartPickerLogic';
import { readAttachment, previewOf, kindLabel, noteText, sizeText, ACCEPT, MAX_FILES } from '../data/chatFiles';
import { buildAttachmentModel, refsOfAttachments } from '../data/chatAnalysis';
import { suggestionsFor } from '../data/reportSuggestions';
import { fmtRiyadh, fmtRangeText, fmtDateText, riyadhToday, riyadhDateOf } from '../data/clock';
import { FieldsForm } from '../components/filters/MoreFilters';
import DataInfo from '../components/filters/DataInfo';
import { buildScopeDefs } from '../components/filters/filterConfig';
import { cascadePatch, clearedNoticeText } from '../components/filters/filterLogic';
import { measure, headlineCfg } from '../data/measure';
import { usePersistOnChange } from '../utils/usePersistOnChange';
import LocalDataPanel from '../components/LocalDataPanel';
import { PRESETS, detectPreset, presetRange } from '../data/periodPresets';
import { createStore, userKeyOf, makeRecord, modelOfRecord, versionsOf, nextVersion, canView, mergeCoverage, metaOf } from '../data/reportStore';
import { useReportAccess } from '../data/useReportAccess';
import { coverageGeo, checkCoverage, createAccessBoundCache, respecWithin, sanitizeScopeValues, allAuthorizedLabel, allMunicipalitiesLabel, isNoAccess, REOPEN_MSG, SANITIZE_NOTICE } from '../data/reportAccess';
import { geoScopeKey } from '../data/geoScope';

// Conversations and the reports they produced are saved PER SIGNED-IN USER by src/data/reportStore.js: the light conversation list, and for every report its finished model in both languages.
// A saved report is shown as it was saved; it is never rebuilt when a conversation is reopened. A message left 'working' by a closed page is shown as interrupted.
const store = createStore();
const loadConvs = (uk) => store.listConvs(uk).map((c) => ({ ...c, messages: c.messages.map((m) => (m.status === 'working' ? { ...m, status: 'stopped' } : m)) }));
const saveConvsFor = (uk) => (c) => { store.saveConvs(uk, c); };
const RIYADH_NOTE = ['توقيت الرياض', 'Riyadh time'];
// unsent text of the request box, kept per conversation for this browser session (written only when the user types; cleared on send)
const DRAFT_KEY = 'ib_smart_drafts_v1'; // filed under the signed-in user: another user on the same tab never sees these words
const draftKey = (uk) => `${DRAFT_KEY}:${uk || 'anon'}`;
const readDrafts = (uk) => { try { const v = JSON.parse(window.sessionStorage.getItem(draftKey(uk)) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const writeDraft = (uk, id, text) => { try { const d = readDrafts(uk); if (text) d[id || 'new'] = text; else delete d[id || 'new']; if (Object.keys(d).length) window.sessionStorage.setItem(draftKey(uk), JSON.stringify(d)); else window.sessionStorage.removeItem(draftKey(uk)); } catch { /* storage unavailable: the draft stays in the box only */ } };
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const NO_VIEW = emptyView(); // the one «no view» object, so the per-result cache below hits
const noteOf = (n, ar) => (n && typeof n === 'object' ? (ar ? n.ar : n.en) || n.en || n.ar || '' : n || ''); // a view note is text, or { ar, en } (written by the chart toolbar so it reads right in either language)

const SUGGESTIONS = [
  { ar: 'أنشئ تقرير الإيرادات لهذا الشهر', en: 'Create the revenue report for this month' },
  { ar: 'قارن أداء التحصيل بين الأمانات', en: 'Compare collection performance between Amanahs' },
  { ar: 'حلّل المتأخرات حسب مصدر الإيراد', en: 'Analyse overdue balances by revenue source' }
];
const STEPS = { scope: ['أحدد النطاق والتصفية', 'Setting the scope and filters'], read: ['أقرأ بيانات الفواتير والتحصيل', 'Reading invoice and collection data'], compare: ['أحسب المقارنة بالفترة المكافئة', 'Computing the equivalent-period comparison'], build: ['أُعدّ الجداول والرسوم والنتائج', 'Preparing tables, charts and findings'], check: ['أراجع المطابقة المالية', 'Checking the financial reconciliation'] };

// The editor of a report's scope (opened by «تعديل» on the scope line): the SAME shared filter components as every page (FieldsForm / PeriodSelect / FilterField), with its own draft and an explicit Apply.
// It changes nothing by itself: «تطبيق» hands { compare, scope } to applyFilters(), which builds the new report exactly as before.
function FilterPanel({ spec, today, ar, L, onApply, onCancel, access }) {
  const rev = useRevenue(); const lang = ar ? 'ar' : 'en';
  const sp = spec || defaultSpec(today); const sc = sp.scope;
  const defs = useMemo(() => buildScopeDefs(['period', 'amanah', 'municipality', 'source', 'status', 'comparison'], { access, today, comparison: { value: sp.compare, default: 'none' } }), [access, today, sp.compare]); // the Amanah / municipality lists come only from the user's access
  const init = useMemo(() => { // a value outside the access (an old spec, an injected one) is dropped from the editor and said so
    const r = sanitizeScopeValues({ amanah: Array.isArray(sc.amanah) ? sc.amanah : sc.amanah, muni: sc.muni || 'all' }, access);
    return { period: { preset: detectPreset(sc.from, sc.to, today), from: sc.from, to: sc.to }, amanah: Array.isArray(r.amanah) ? '__multi' : r.amanah, municipality: r.muni, source: sc.source, status: sc.status || 'all', comparison: sp.compare, __dropped: r.dropped };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [d, setD] = useState(init); const [note, setNote] = useState(init.__dropped?.length ? L(SANITIZE_NOTICE.ar, SANITIZE_NOTICE.en) : '');
  const change = (patch) => { const r = cascadePatch(defs, d, patch); setD(r.values); setNote(clearedNoticeText(defs, r.cleared, lang)); };
  const dirty = JSON.stringify(d) !== JSON.stringify(init) || !!init.__dropped?.length;
  return (
    <div className="ft-scopeedit" role="region" aria-label={L('تعديل نطاق التقرير', 'Edit the report scope')}>
      <FieldsForm defs={defs} values={d} onChange={change} lang={lang} ctx={{ today }} notice={note} idPrefix="sr-ed" flat />
      <div className="ft-panel__foot">
        <button type="button" className="btn btn-primary btn-sm ft-btn" disabled={!dirty} onClick={() => onApply({ compare: d.comparison, scope: { from: d.period.from, to: d.period.to, amanah: d.amanah === '__multi' ? sc.amanah : d.amanah, muni: d.municipality, source: d.source, status: d.status, scopeType: sc.scopeType || 'all' } })}>{L('تطبيق وتحديث التقرير', 'Apply and update the report')}</button>
        {onCancel && <button type="button" className="btn btn-ghost btn-sm ft-btn" onClick={onCancel}>{L('إلغاء', 'Cancel')}</button>}
        <span className="muted" style={{ fontSize: 12 }}>{L('التقارير الجديدة تستخدم هذا النطاق حتى تغيّره.', 'New reports keep using this scope until you change it.')}</span>
      </div>
    </div>
  );
}

// ONE concise scope line per report («الفترة · الأمانة · المصدر · المقارنة») with the «تعديل / Edit» action; the calculation basis and the report sections sit behind the «i» control.
// It states what WAS applied (never that the request was applied in full); only values that came from the request (or were inherited from the dashboard filter) carry a tag.
function InterpretationSummary({ msg, chips, L, editable, editing, onEdit, panel, pending = false, sections = null }) {
  const by = Object.fromEntries(chips.map((c) => [c.k, c]));
  const changed = new Set(msg.changeKeys || []); const keyOf = { period: ['period'], amanah: ['amanah', 'muni'], source: ['source'], status: ['status', 'scopeType'], cmp: ['compare'] };
  const secs = msg.spec?.sections || sections || [];
  const sc0 = msg.spec?.scope; const inherited = (g) => !!sc0 && ((g === 'amanah' && (sc0.amanah !== 'all' || sc0.muni !== 'all')) || (g === 'source' && sc0.source !== 'all') || (g === 'status' && ((sc0.status || 'all') !== 'all' || (sc0.scopeType || 'all') !== 'all')));
  const tag = (g) => (keyOf[g].some((k) => changed.has(k)) ? L('من طلبك', 'from your request') : msg.changeKeys && msg.firstReport && inherited(g) ? L('من تصفية لوحة المعلومات', 'from the dashboard filter') : null);
  const allMuni = L('كل البلديات', 'All municipalities'); const allMuni2 = L('كل البلديات ضمن صلاحيتك', 'All municipalities within your access'); const allStatus = L('كل الحالات', 'All statuses');
  const parts = [
    ['period', by.period?.value],
    ['amanah', [by.amanah?.value, by.muni?.value && by.muni.value !== allMuni && by.muni.value !== allMuni2 ? by.muni.value : null].filter(Boolean).join(' · ')],
    ['source', by.source?.value],
    ...(by.status?.value && by.status.value !== allStatus || by.st?.value ? [['status', [by.status?.value !== allStatus ? by.status?.value : null, by.st?.value].filter(Boolean).join(' · ')]] : []),
    ['cmp', by.cmp?.value || L('بدون مقارنة', 'No comparison')]
  ];
  const rows = [
    { label: L('أساس القياس', 'Reporting basis'), value: by.basis?.value },
    ...(secs.length ? [{ label: L('أقسام التقرير', 'Report sections'), value: secs.map((k) => (SECTION_META[k] ? L(SECTION_META[k].ar, SECTION_META[k].en) : k)).join(L('، ', ', ')) }] : []),
    { label: L('ملاحظة', 'Note'), value: pending ? L('هذا ما سأطبّقه إن أكّدت. عدّله إن لم يطابق ما قصدته.', 'This is what I will apply if you confirm. Edit it if it is not what you meant.') : L('هذا ما طُبّق على التقرير. وما لا أستطيع تطبيقه أسألك عنه قبل الإعداد.', 'This is what was applied to the report. Anything I cannot apply I ask about before generating.') }
  ];
  return (
    <div className="sr-interp ft-interp" role="group" aria-label={L('نطاق التقرير', 'Report scope')}>
      <div className="ft-scopeline">
        <span className="ft-scopeline__text">{parts.map(([g, v], i) => <React.Fragment key={g}>{i > 0 ? ' · ' : ''}{i === 0 && <em>{L('نطاق التقرير: ', 'Report scope: ')}</em>}<bdi>{v}</bdi>{tag(g) && <small className="ft-scopeline__tag">({tag(g)})</small>}</React.Fragment>)}</span>
        <DataInfo lang={L('ar', 'en')} title={L('تفاصيل النطاق', 'Scope details')} rows={rows} />
        {editable && <button type="button" className="btn btn-sm btn-ghost ft-btn" aria-expanded={!!editing} onClick={onEdit}>{editing ? L('إغلاق التعديل', 'Close editing') : L('تعديل', 'Edit')}</button>}
      </div>
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

// the page is keyed by the signed-in user: another user on the same device starts from THEIR OWN history, never the previous user's
export default function SmartReports(props) {
  const { user } = useRevenue();
  return <SmartReportsInner key={userKeyOf(user) || 'anon'} {...props} />;
}

// shown instead of the workspace when the signed-in user does not (or no longer) hold the `smart_reports` module: no history, no saved report, no figure
function NoReportsAccess({ L }) {
  return (
    <div className="sr-page"><div className="sr-restricted" role="alert">
      <h2>🔒 {L('لا تملك صلاحية التقارير الذكية', 'You do not have access to Smart reports')}</h2>
      <p>{L(REOPEN_MSG.permission.ar, REOPEN_MSG.permission.en)}</p>
    </div></div>
  );
}

function SmartReportsInner(props) {
  const ra = useReportAccess(); const { ar } = useL();
  if (ra.ready && !ra.permitted) return <NoReportsAccess L={(a, e) => (ar ? a : e)} />; // the permission is gone: nothing saved is read, nothing is shown
  return <SmartReportsBody {...props} ra={ra} />;
}

function SmartReportsBody({ embedded = false, initialQuery = null, onQueryConsumed = null, ra }) {
  const rev = useRevenue();
  const uk = userKeyOf(rev.user);
  const viewer = ra.viewer; const access = viewer.geo; // `viewer` = the signed-in account's CURRENT access: saved results are re-checked against it (reportAccess.checkCoverage)
  const { lang, ar } = useL();
  const L = useCallback((a, e) => (ar ? a : e), [ar]); // Arabic first, English second (the shared useL().L is English first)
  const today = rev.cfg.cutoff;
  const [convs, setConvs] = useState(() => loadConvs(uk));
  // entering «التقارير الذكية» ALWAYS lands on the main page (the landing «ماذا تريد أن تعرف؟»), never on the last conversation: earlier conversations stay one click away in «سجل المحادثات»
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState(() => readDrafts(uk).new || '');
  const viewerRef = useRef(viewer); viewerRef.current = viewer;
  const [busy, setBusy] = useState(null); // { msgId, step, token }
  const [showHistory, setShowHistory] = useState(false); const [histQ, setHistQ] = useState('');
  const histBtnRef = useRef(null); const histCloseRef = useRef(null);
  const closeHistory = useCallback(() => { setShowHistory(false); window.setTimeout(() => histBtnRef.current?.focus(), 0); }, []); // closing returns to the same conversation state, with focus back on the button that opened it
  useEffect(() => { if (showHistory) window.setTimeout(() => histCloseRef.current?.focus(), 0); }, [showHistory]);
  const [editOpen, setEditOpen] = useState(false); const [editPendingId, setEditPendingId] = useState(null);
  const [exporting, setExporting] = useState('');
  // saved reports of this user, by the assistant message that produced them (loaded from the store as a conversation is opened; never rebuilt)
  const recsRef = useRef({}); const loadedRef = useRef(new Set()); const unreadableRef = useRef(new Set()); const [tick, bump] = useReducer((n) => n + 1, 0);
  const modelCache = useRef(new WeakMap());
  // derived caches (finished models per language, chart ids, per-view results) are valid for ONE access signature (user · accessVersion · scope · permission): when it changes they are dropped and every open result re-derives (and re-checks its coverage)
  const boundRef = useRef(createAccessBoundCache());
  const [saveInfo, setSaveInfo] = useState({}); // convId -> { ok, error, notes }
  const [sel, setSel] = useState({}); // convId -> the report (assistant message id) the person is looking at: the next request builds on it
  const [confirmDel, setConfirmDel] = useState(null);
  const convsRef = useRef(convs); convsRef.current = convs;
  const [dockH, setDockH] = useState(150); const dockRef = useRef(null);
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
  // (a dashboard filter holding a value outside the user's access — a stale URL / stored selection — is dropped here too, with a notice: a new conversation never starts from a wider scope than the user's)
  const shared = useMemo(() => { const e = rev.scopeEff; const r = sanitizeScopeValues({ amanah: e.amanah, muni: e.muni || 'all' }, access); return { dropped: r.dropped, spec: { ...defaultSpec(today), preset: rev.scope.preset, scope: { from: e.from, to: e.to, amanah: r.amanah, source: e.source, scopeType: e.scopeType || 'all', muni: r.muni, status: e.status || 'all', product: e.product, mainClass: e.mainClass } } }; }, [rev.scopeEff, rev.scope.preset, today, viewer.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const sharedSpec = shared.spec;
  const conv = convs.find((c) => c.id === activeId) || null;
  const labelOfAmanah = useCallback((k) => { const a = amanahFilterOptions().find((x) => x.key === k); return a ? (ar ? a.ar : a.en) : k; }, [ar]);

  usePersistOnChange(convs, saveConvsFor(uk)); // written only after a user action, never when the page loads or a stored conversation is reopened
  // follow the conversation only when it GROWS while it is open (never on arrival or when reopening — F-16a)
  const seenLen = useRef({ id: null, n: 0 }); const pendingChart = useRef(null); // pendingChart = { id, focus } — a chart whose presentation was just changed: the page returns to IT, not to the end of the thread
  useEffect(() => { const n = conv?.messages.length || 0; const grew = seenLen.current.id === conv?.id && n > seenLen.current.n; seenLen.current = { id: conv?.id, n }; if (grew && !pendingChart.current) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [conv?.id, conv?.messages.length]);
  useEffect(() => {
    const p = pendingChart.current; if (!p) return undefined; pendingChart.current = null;
    const t = window.setTimeout(() => { const el = document.querySelector(`.sr-card.is-cur [data-chart-id="${p.id}"]`); if (!el) return; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (p.focus) el.querySelector('.cf-btn')?.focus({ preventScroll: true }); }, 80);
    return () => window.clearTimeout(t);
  }, [conv?.messages.length]);
  useEffect(() => { const el = taRef.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; } }, [input]);

  // switching conversation brings back that conversation's unsent text (and keeps the one just left)
  const draftFor = useRef(activeId || 'new');
  useEffect(() => { const key = activeId || 'new'; if (draftFor.current === key) return; draftFor.current = key; setInput(readDrafts(uk)[key] || ''); }, [activeId]);
  const onInput = (v) => { setInput(v); writeDraft(uk, draftFor.current, v); };
  const patchConv = useCallback((id, fn) => setConvs((cs) => { let changed = false; const n = cs.map((c) => { if (c.id !== id) return c; const r = fn(c); if (r !== c) changed = true; return r; }); return changed ? n : cs; }), []);
  const patchMsg = useCallback((convId, msgId, patch) => patchConv(convId, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) })), [patchConv]);

  /* ---------------- saved reports: what the conversation has produced, as it was saved ---------------- */
  const ensureLoaded = (convId) => { // idempotent, synchronous: the saved models of a conversation are read from the store the first time it is shown
    if (!convId || loadedRef.current.has(convId)) return; loadedRef.current.add(convId);
    const { records, unreadable } = store.loadReports(uk, convId);
    recsRef.current = { ...records, ...recsRef.current }; unreadable.forEach((id) => unreadableRef.current.add(id));
  };
  const restrictedConv = (c) => !!c && !canView(c.access, viewer); // a conversation whose scope the signed-in organisation no longer covers
  const restricted = !!conv && restrictedConv(conv);
  if (conv && !restricted) ensureLoaded(conv.id);
  const recsOfConv = (convId) => Object.values(recsRef.current).filter((r) => r.convId === convId);
  const recMapOf = (convId) => Object.fromEntries(recsOfConv(convId).map((r) => [r.msgId, r]));
  const modelOf = useCallback((m) => { // the saved model in the language shown now (both languages are saved for a system report), with its save details in `meta`
    const rec = recsRef.current[m.id]; if (!rec || !canView(rec.coverage, viewer)) return null;
    let byLang = modelCache.current.get(rec); if (!byLang) { byLang = {}; modelCache.current.set(rec, byLang); }
    const l = lang === 'ar' ? 'ar' : 'en'; if (!byLang[l]) byLang[l] = modelOfRecord(rec, l);
    return byLang[l];
  }, [tick, lang, viewer]); // eslint-disable-line react-hooks/exhaustive-deps
  // a result = the saved model + a view. Derived once per (model, view): `model` = what is shown; `baseAll` = the saved model with chart ids; `base` = baseAll after the legacy global «make them …» command only
  // (the block the per-chart configs are applied to — what the chart toolbar edits).
  const idsCache = useRef(new WeakMap()); const viewCache = useRef(new WeakMap());
  if (boundRef.current.bind(ra.signature)) { modelCache.current = new WeakMap(); idsCache.current = new WeakMap(); viewCache.current = new WeakMap(); attData.current = {}; }
  const derive = useCallback((raw, viewIn) => {
    let baseAll = idsCache.current.get(raw); if (!baseAll) { baseAll = assignChartIds(raw); idsCache.current.set(raw, baseAll); }
    const view = viewIn || NO_VIEW; let byView = viewCache.current.get(baseAll); if (!byView) { byView = new WeakMap(); viewCache.current.set(baseAll, byView); }
    let r = byView.get(view);
    if (!r) { r = { model: applyView(baseAll, view).model, view, baseAll, base: view.chartKind ? applyView(baseAll, { ...emptyView(), chartKind: view.chartKind }).model : baseAll }; byView.set(view, r); }
    return r;
  }, []);
  const resultOf = useCallback((m, list) => { // → { model (with its view applied), view, base, baseAll, rootId, rootKind } | null
    if (m.role !== 'assistant') return null;
    if (m.kind === 'view' || m.kind === 'export') { const root = list.find((x) => x.id === m.baseId); const raw = root && modelOf(root); if (!raw) return null; return { ...derive(raw, m.view), rootId: m.baseId, rootKind: root.kind === 'attachments' ? 'attachments' : 'report' }; }
    if (m.kind === 'attachments' || m.spec) { const raw = modelOf(m); if (!raw) return null; return { ...derive(raw, m.view), rootId: m.id, rootKind: m.kind === 'attachments' ? 'attachments' : 'report' }; } // a result rebuilt from a follow-up keeps the view already agreed (chart type, parts shown)
    return null;
  }, [modelOf, derive]);
  // the result a follow-up acts on: the last result of the SELECTED report (a version the person opened), otherwise the last result of the conversation
  const latest = useMemo(() => {
    if (!conv) return null; const all = []; for (let i = conv.messages.length - 1; i >= 0; i -= 1) { const r = resultOf(conv.messages[i], conv.messages); if (r) all.push({ ...r, msgId: conv.messages[i].id }); }
    if (!all.length) return null; const want = sel[conv.id]; return (want && all.find((r) => r.rootId === want)) || all[0];
  }, [conv, resultOf, sel]);
  // the version list of the open conversation: every report generated in it, oldest first
  const versions = useMemo(() => (conv ? versionsOf(recMapOf(conv.id)) : []), [conv, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const curRec = latest ? recsRef.current[latest.rootId] || null : null;
  const selRootMsg = latest && conv ? conv.messages.find((x) => x.id === latest.rootId) : null;
  const spec = restricted ? null : (selRootMsg?.spec || conv?.spec || null); // a follow-up, the filter panel and the scope line all speak about the version that is open

  /* ---------------- generation of a system report ---------------- */
  const generate = useCallback(async (sp, token, setStep) => {
    const sc = sp.scope; const cutoff = rev.cfg.cutoff;
    token.access = viewerRef.current.geo; token.av = viewerRef.current.accessVersion; // the access the report is built under (the data service enforces the same scope on every call); the saved record states it
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
    const ncScope = { ...scopeKeys, from: sc.from, to: sc.to };
    const [prev, cash, bridge, ncAnalysis, dist] = await Promise.all([
      prevSc ? rev.data.snapshot({ ...prevSc, ...scopeKeys }, atEnd) : Promise.resolve(null),
      sp.sections.includes('trends') ? rev.data.series({ ...scope }, { asOf: sc.to < cutoff ? sc.to : cutoff }) : Promise.resolve(null),
      sp.sections.includes('quality') ? rev.data.bridge({ ...scopeKeys, from: '2000-01-01', to: cutoff }) : Promise.resolve(null),
      // «تحليل أسباب عدم التحصيل»: the structured analysis of the SAME scope, with the largest supporting invoices attached for the appendix (the model builder is pure and never fetches)
      sp.sections.includes('noncollection') ? rev.data.noncollection(ncScope).then(async (nc) => { const l = await rev.data.list(ncScope, { filters: { nc: {} }, sort: { key: 'outstanding', dir: 'desc' }, page: 0, pageSize: NC_APPENDIX_ROWS, withNc: true }).catch(() => null); return l ? { ...nc, invoices: l.rows, invoicesTotal: l.total } : nc; }) : Promise.resolve(null),
      // bins + quartiles (never rows) for the histogram / box / 3-level tree companions of the chart picker; measured at the SAME cut-off as the snapshot (`atEnd`), otherwise the model refuses the payload. A failure only removes those companions.
      rev.data.distributions(ncScope, atEnd).catch(() => null)
    ]);
    const inputs = { spec: sp, out, prev, compare: sp.compare, prevScope: prevSc, cash, bridge, targets: rev.targets, cases: rev.cases, meta: rev.meta, ncAnalysis, dist, access: coverageGeo(sp, token.access) }; // the model builder states the scope the report COVERS (request ∩ the user's access) in the report and its files
    const generatedAt = new Date(); // ONE moment for both language models: they hold the same figures
    const warn = { ar: 'تعذّر تحقق إحدى علاقات المطابقة المالية لهذا الاختيار؛ راجع قسم اكتمال البيانات والمطابقة.', en: 'One financial reconciliation identity did not hold for this selection; see the completeness and reconciliation section.' };
    const build = (l) => { const m = buildReportModel({ ...inputs, lang: l, generatedAt }); if (!m.equationOk) m.sections.unshift({ key: 'warn', title: l === 'ar' ? 'تنبيه' : 'Warning', purpose: '', blocks: [{ type: 'callout', tone: 'warn', text: warn[l] }] }); return m; };
    await step('build');
    const model = { models: { ar: build('ar'), en: build('en') }, generatedAt: generatedAt.toISOString(), cutoff, access: token.access, av: token.av };
    await step('check');
    return model;
  }, [rev, today]);

  // write every saved report of a conversation to the store; the store may reduce the OLDEST versions to fit (stated in the page), never the newest
  const commitRecords = useCallback((convId) => {
    const all = Object.fromEntries(Object.values(recsRef.current).filter((r) => r.convId === convId).map((r) => [r.msgId, r]));
    const w = store.saveReports(uk, convId, all);
    if (w.ok) recsRef.current = { ...recsRef.current, ...w.records };
    setSaveInfo((i) => ({ ...i, [convId]: { ok: w.ok, error: w.error || null, over: !!w.over } }));
    patchConv(convId, (c) => { const rs = Object.values(recsRef.current).filter((r) => r.convId === convId); const access = rs.reduce((a, r) => mergeCoverage(a, r.coverage), null); const reports = rs.filter((r) => r.kind === 'report').length; return JSON.stringify(c.access) === JSON.stringify(access) && c.reports === reports ? c : { ...c, access, reports }; });
    bump();
    return w;
  }, [uk, patchConv]);
  const addRecord = useCallback((rec) => { recsRef.current = { ...recsRef.current, [rec.msgId]: rec }; unreadableRef.current.delete(rec.msgId); setSel((x) => ({ ...x, [rec.convId]: rec.msgId })); return commitRecords(rec.convId); }, [commitRecords]);
  const accessOf = (convId, c) => { const rs = recsOfConv(convId); return rs.length ? { access: rs.reduce((a, r) => mergeCoverage(a, r.coverage), null), reports: rs.filter((r) => r.kind === 'report').length } : { access: c.access ?? null, reports: c.reports ?? 0 }; };
  const requestIdOf = (convId, msgId) => { const c = convsRef.current.find((x) => x.id === convId); const i = c ? c.messages.findIndex((x) => x.id === msgId) : -1; return i > 0 ? c.messages[i - 1].id : null; };

  const run = useCallback(async (convId, msgId, sp, { pace = 0, requestId = null } = {}) => {
    const token = { cancelled: false, taskId: null, pace };
    setBusy({ msgId, step: 'scope', token });
    try {
      const built = await generate(sp, token, (k) => setBusy((b) => (b && b.msgId === msgId ? { ...b, step: k } : b)));
      const l = lang === 'ar' ? 'ar' : 'en'; const model = built.models[l];
      // the finished model is SAVED as a new version of this conversation's report; an earlier version is never overwritten
      addRecord(makeRecord({ msgId, convId, kind: 'report', lineageId: `L-${convId}`, version: nextVersion(recMapOf(convId)), requestId: requestId || requestIdOf(convId, msgId), generatedAt: built.generatedAt, cutoff: built.cutoff, lang: l, spec: sp, org: viewer, models: built.models, access: built.access, owner: uk, accessVersion: built.av }));
      // the conversation is named after its FIRST report (what it is about), unless the person renamed it
      const firstId = (c) => c.messages.find((m) => m.role === 'assistant' && m.spec)?.id;
      const nameOf = () => { const sc = sp.scope; const am = sc.amanah === 'all' ? null : [].concat(sc.amanah).map(labelOfAmanah).join('، '); return [model.title, fmtRangeText(sc.from, sc.to, ar ? 'ar' : 'en'), am, sc.source !== 'all' ? (ar ? sourceAr(sc.source) : sourceEn(sc.source)) : null].filter(Boolean).join(' · ').slice(0, 80); };
      patchConv(convId, (c) => { const t = c.titleSource !== 'user' && firstId(c) === msgId ? nameOf() : c.title; return c.messages.some((m) => m.id === msgId && m.status === 'done' && m.title === model.title) && t === c.title ? c : { ...c, title: t, messages: c.messages.map((m) => (m.id === msgId ? { ...m, status: 'done', title: model.title } : m)) }; });
    } catch (e) {
      const stopped = token.cancelled || e.stopped;
      if (!stopped) console.error('[smart-reports] the report could not be prepared:', e);
      patchConv(convId, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, status: stopped ? 'stopped' : 'error' } : m)) }));
    } finally { setBusy((b) => (b && b.msgId === msgId ? null : b)); }
  }, [generate, patchConv, labelOfAmanah, ar, lang, viewer, addRecord]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => { if (!busy) return; if (busy.step === 'think') { busy.token.finish?.(); return; } busy.token.cancelled = true; if (busy.token.taskId) rev.cancelTask(busy.token.taskId); };

  /* ---------------- attached files: read, match with the system data, answer ---------------- */
  const scopeTextOf = useCallback((sp) => { const sc = sp.scope; const am = sc.amanah === 'all' ? (access.all ? L('كل الأمانات والجهات', 'All Amanahs') : allAuthorizedLabel(access, ar ? 'ar' : 'en')) : [].concat(sc.amanah).map(labelOfAmanah).join('، '); return [fmtRangeText(sc.from, sc.to, ar ? 'ar' : 'en'), am, sc.source !== 'all' ? (ar ? sourceAr(sc.source) : sourceEn(sc.source)) : null].filter(Boolean).join(' · '); }, [L, ar, labelOfAmanah, viewer.key]); // eslint-disable-line react-hooks/exhaustive-deps
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
      addRecord(makeRecord({ msgId, convId, kind: 'attachments', requestId: requestIdOf(convId, msgId), generatedAt: new Date().toISOString(), cutoff: today, lang: lang === 'ar' ? 'ar' : 'en', spec: sp, org: viewer, models: { [lang === 'ar' ? 'ar' : 'en']: model }, access: viewerRef.current.geo, owner: uk, accessVersion: viewerRef.current.accessVersion })); // the files are never stored; their analysis is, in the language it was written in
      patchConv(convId, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, status: 'done', title: model.title } : m)) }));
    } catch (e) {
      const stopped = token.cancelled || e.stopped;
      if (!stopped) console.error('[smart-reports] the attachments could not be analysed:', e);
      patchMsg(convId, msgId, { status: stopped ? 'stopped' : 'error' });
    } finally { setBusy((b) => (b && b.msgId === msgId ? null : b)); }
  }, [rev, scopeTextOf, buildAttModel, patchConv, patchMsg, addRecord, lang, viewer, today]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!viewerRef.current.permitted || !viewerRef.current.canExport) { patchMsg(convId, msgId, { status: 'error' }); return; } // re-checked at the moment of the click: the permission may have been withdrawn since the button was drawn
    setExporting(format);
    try { await exportModel(format, model); patchMsg(convId, msgId, { status: 'done', fileName: reportFileName(model, EXPORT_FORMATS.find((f) => f.key === format)?.ext || format) }); }
    catch (e) { console.error('[smart-reports] export failed:', e); patchMsg(convId, msgId, { status: 'error' }); }
    finally { setExporting(''); }
  }, [patchMsg]);

  /* ---------------- sending ---------------- */
  const send = useCallback((text, override = null, { fresh = false } = {}) => {
    if (!fresh && !override && conv && restrictedConv(conv)) return; // a conversation outside the person's permissions is never continued
    const q0 = (text || '').trim();
    const sendFiles = fresh || override ? [] : files.filter((f) => !f.reading);
    if ((!q0 && !sendFiles.length) || busy || (!fresh && !override && readingAny)) return;
    const q = q0 || L('حلّل الملفات المرفقة مع بيانات النظام', 'Analyse the attached files together with the system data');
    let c = fresh ? null : conv; // a request that arrives through a link starts its own conversation
    if (!c) { c = { id: uid(), title: q.slice(0, 48), createdAt: Date.now(), updatedAt: Date.now(), spec: sharedSpec, messages: [] }; }
    const lr = fresh ? null : latest;
    const userMsg = { id: uid(), role: 'user', text: q, ...(sendFiles.length ? { attachments: sendFiles.map(({ id, name, size, kind, status, note }) => ({ id, name, size, kind, status, note })) } : {}) };
    const asId = uid();
    // a chart request («اعرضه كأشرطة أفقية», «أعلى 5 + أخرى», …) is read first by src/data/chartRequests.js; whatever it returns is answered (applied, asked about, or explained) — never ignored
    let cr = !override && lr && !sendFiles.length && hasCharts(lr.model) ? interpretChartRequest(q, { model: lr.baseAll, base: lr.base, view: lr.view, lang }) : null;
    const legacy = override ? null : interpretChat(q, { hasResult: !!lr, resultKind: lr?.rootKind || null, hasCharts: lr ? hasCharts(lr.model) : false, hasTables: lr ? hasTables(lr.model) : false, pendingFiles: sendFiles.length });
    if (cr && cr.type === 'ask' && legacy && legacy.type === 'chart') cr = null; // «اعرضها كأعمدة»: the global command (every chart that can take it) keeps working instead of asking which chart
    const chat = override || cr ? null : legacy;
    let aMsg = null; let after = null; let interpretText = q;
    const say = (ar_, en_) => ({ id: asId, role: 'assistant', kind: 'text', plain: L(ar_, en_), status: 'done' });
    if (cr) {
      if (cr.type === 'apply' && cr.noop) aMsg = say(cr.note.ar, cr.note.en); // already shown that way: said, nothing changes (no new card, no Undo)
      else if (cr.type === 'apply') {
        const nv = viewAfterRequest(lr.view, cr, lr.base);
        aMsg = { id: asId, role: 'assistant', kind: 'view', baseId: lr.rootId, view: nv, note: cr.note, undo: cleanView(lr.view || NO_VIEW), chartId: cr.chartId || null, status: 'done' };
        if (cr.chartId) pendingChart.current = { id: cr.chartId, focus: false };
      } else if (cr.type === 'ask') aMsg = { id: asId, role: 'assistant', kind: 'clarify', question: cr.question, options: cr.options || [], status: 'done' };
      else if (cr.type === 'unsuitable') aMsg = { id: asId, role: 'assistant', kind: 'clarify', question: cr.reason, options: (cr.alternatives || []).map((a) => ({ label: a.label, text: a.text })), status: 'done' };
      else aMsg = { id: asId, role: 'assistant', kind: 'clarify', question: cr.question || { ar: 'ما الرسم الذي تقصده؟', en: 'Which chart do you mean?' }, options: [], status: 'done' };
    } else if (chat) {
      if (chat.type === 'attach') { aMsg = { id: asId, role: 'assistant', kind: 'attachments', status: 'working', groupTerm: chat.groupTerm || null }; after = () => runAttach(c.id, asId, sendFiles, { groupTerm: chat.groupTerm || null, question: q0, sp: c.spec || sharedSpec }); }
      else if (chat.type === 'need') aMsg = { id: asId, role: 'assistant', kind: 'clarify', question: chat.question, options: chat.options, status: 'done' };
      else if (chat.type === 'chart') {
        const r = applyView(lr.model, { chartKind: chat.kind }); const nm = CHART_NAME[chat.kind][ar ? 'ar' : 'en'];
        const why = skippedLine(r.skippedList, lang); // each chart that stayed as it was, with ITS reason (a reconciliation, a part-of-whole bar, a running total, a type the data cannot take)
        if (r.changed) aMsg = { id: asId, role: 'assistant', kind: 'view', baseId: lr.rootId, view: mergeView(lr.view, { chartKind: chat.kind }), undo: cleanView(lr.view || NO_VIEW), note: `${L(`غيّرتُ ${r.changed === 1 ? 'الرسم' : `${r.changed} رسوم`} إلى ${nm}.`, `Changed ${r.changed === 1 ? 'the chart' : `${r.changed} charts`} to ${nm}.`)}${why ? ` ${why}` : ''}`, status: 'done' };
        else aMsg = r.skippedList.length ? say(`لم أغيّر أي رسم إلى ${nm}. ${why} جرّب نوعاً آخر، أو افتح «تغيير الرسم» فوق الرسم لترى ما يناسب بياناته.`, `No chart was changed to ${nm}. ${why} Try another type, or open “Change chart” above the chart to see what its data supports.`) : say(`الرسم ${nm} بالفعل.`, `The chart is already a ${nm} chart.`);
      } else if (chat.type === 'only') {
        const want = chat.only; const none = (want === 'tables' && !hasTables(lr.model)) || (want === 'charts' && !hasCharts(lr.model));
        if (none) aMsg = say(`لا ${want === 'tables' ? 'جداول' : 'رسوم'} في هذه النتيجة لأعرضها.`, `There are no ${want === 'tables' ? 'tables' : 'charts'} in this result to show.`);
        else aMsg = { id: asId, role: 'assistant', kind: 'view', baseId: lr.rootId, view: mergeView(lr.view, { only: want === 'all' ? null : want }), note: want === 'all' ? L('أعدتُ عرض كل أقسام النتيجة.', 'Showing every part of the result again.') : L(`عرضتُ ${want === 'tables' ? 'الجداول' : want === 'charts' ? 'الرسوم' : 'المؤشرات'} فقط. اكتب «اعرض الكل» للعودة.`, `Showing the ${want === 'tables' ? 'tables' : want === 'charts' ? 'charts' : 'indicators'} only. Say “show everything” to go back.`), status: 'done' };
      } else if (chat.type === 'export') {
        if (!viewer.canExport) aMsg = say(REOPEN_MSG.exportDenied.ar, REOPEN_MSG.exportDenied.en);
        else if (lr.model.empty) aMsg = say('النتيجة الحالية لا تحتوي بيانات لأضعها في ملف.', 'The current result holds no data to put in a file.');
        else { aMsg = { id: asId, role: 'assistant', kind: 'export', baseId: lr.rootId, view: lr.view, format: chat.format, status: 'working' }; after = () => runExport(c.id, asId, chat.format, lr.model); }
      } else if (chat.type === 'summary') aMsg = { id: asId, role: 'assistant', kind: 'text', plain: summarize(lr.model), status: 'done' };
      else if (chat.type === 'regroup') {
        const data = attData.current[lr.rootId];
        if (!data) aMsg = say('لإعادة التجميع أحتاج الملف نفسه، ولم يعد محتواه محفوظاً بعد إعادة فتح المحادثة. أرفقه من جديد.', 'To regroup I need the file itself, and its content is not kept after the conversation is reopened. Attach it again.');
        else {
          const model = buildAttModel(data, { groupTerm: chat.term, question: q }); attData.current[asId] = data;
          addRecord(makeRecord({ msgId: asId, convId: c.id, kind: 'attachments', requestId: userMsg.id, generatedAt: new Date().toISOString(), cutoff: today, lang: lang === 'ar' ? 'ar' : 'en', spec: c.spec || sharedSpec, org: viewer, models: { [lang === 'ar' ? 'ar' : 'en']: model }, access: viewerRef.current.geo, owner: uk, accessVersion: viewerRef.current.accessVersion }));
          aMsg = { id: asId, role: 'assistant', kind: 'attachments', status: 'done', title: model.title, groupTerm: chat.term, regroup: true, view: lr.view };
        }
      } else if (chat.type === 'section') interpretText = chat.text;
    }
    if (!aMsg) {
      const res = override ? { kind: 'report', spec: override.spec, changes: override.changes || [], ...(override.accessNotice ? { accessNotice: override.accessNotice } : {}) } : interpret(interpretText, c.messages.some((m) => m.spec) ? ((lr && lr.rootKind === 'report' && c.messages.find((x) => x.id === lr.rootId)?.spec) || c.spec) : null, today, { base: sharedSpec, access });
      const lbl = (ch) => describeChange(ch, lang, { amanahLabel: labelOfAmanah, spec: res.spec, access });
      if (res.kind === 'unsupported' && res.noAccess) aMsg = { id: asId, role: 'assistant', kind: 'unsupported', question: res.question, status: 'done' };
      else if (res.kind === 'unsupported' || res.kind === 'empty') aMsg = { id: asId, role: 'assistant', kind: 'unsupported', question: res.question || null, status: 'done' };
      else if (res.kind === 'clarify') aMsg = { id: asId, role: 'assistant', kind: 'clarify', question: res.question, options: res.options, status: 'done' };
      else if (res.confirm?.length && !override) aMsg = { id: asId, role: 'assistant', kind: 'confirm', status: 'pending', confirm: res.confirm, ...(res.accessNotice ? { accessNote: res.accessNotice } : {}), pending: { kind: res.kind, spec: res.spec, changes: res.changes.map(lbl), changeKeys: res.changes.map((x) => x.key), firstReport: !c.messages.some((m) => m.spec) } };
      else { aMsg = { id: asId, role: 'assistant', kind: res.kind, spec: res.spec, changes: res.changes.map(lbl), changeKeys: res.changes.map((x) => x.key), firstReport: !c.messages.some((m) => m.spec), status: 'working', ...(res.accessNotice ? { accessNote: res.accessNotice } : {}), ...(override?.refreshOf ? { refreshOf: override.refreshOf } : {}), ...(chat?.type === 'section' && lr ? { view: lr.view } : {}) }; after = () => run(c.id, asId, aMsg.spec, { pace: PACE, requestId: userMsg.id }); }
    }
    const next = { ...c, ...accessOf(c.id, c), title: c.messages.length ? c.title : q.slice(0, 48), updatedAt: Date.now(), spec: aMsg.spec || c.spec, messages: [...c.messages.map((m) => (m.kind === 'confirm' && m.status === 'pending' ? { ...m, status: 'superseded' } : m)), userMsg, aMsg] };
    setConvs((cs) => (cs.some((x) => x.id === c.id) ? cs.map((x) => (x.id === c.id ? next : x)) : [next, ...cs]));
    setActiveId(c.id); setInput(''); writeDraft(uk, c.id, ''); writeDraft(uk, draftFor.current, '');
    if (sendFiles.length) { setFiles([]); setPreviewId(null); setFileNote(''); }
    animated.current.add(userMsg.id); animated.current.add(asId);
    if (after) after();
    else { // a quick answer still shows the assistant preparing it
      const token = { cancelled: false, taskId: null };
      setTyping((t) => ({ ...t, [asId]: true })); setBusy({ msgId: asId, step: 'think', token });
      const done = () => { window.clearTimeout(thinkTimers.current[asId]); delete thinkTimers.current[asId]; setTyping((t) => { const { [asId]: _x, ...rest } = t; return rest; }); setBusy((b) => (b && b.msgId === asId ? null : b)); };
      thinkTimers.current[asId] = window.setTimeout(done, 750 + Math.min(600, q.length * 8)); token.finish = done;
    }
  }, [busy, conv, today, lang, labelOfAmanah, run, runAttach, runExport, sharedSpec, files, readingAny, latest, buildAttModel, L, ar, access, viewer.canExport]); // eslint-disable-line react-hooks/exhaustive-deps

  // a change made with the chart toolbar (picker / customize / reset): ONE new view message on the open result — the saved report and its version are untouched, nothing is regenerated and no data is fetched
  const commitChartView = useCallback((newView, meta = {}) => {
    if (!conv || !latest || busy) return;
    const msg = { id: uid(), role: 'assistant', kind: 'view', baseId: latest.rootId, view: newView, note: meta.note || '', undo: cleanView(latest.view || NO_VIEW), chartId: meta.chartId || null, status: 'done' };
    pendingChart.current = meta.chartId ? { id: meta.chartId, focus: true } : null;
    patchConv(conv.id, (c) => ({ ...c, updatedAt: Date.now(), messages: [...c.messages, msg] }));
  }, [conv, latest, busy, patchConv]);
  // «تراجع»: the view that was open before this change comes back as a new view message (and the chip then offers the way forward again)
  const undoView = (m) => {
    if (!conv || busy || !m.undo) return;
    const back = { id: uid(), role: 'assistant', kind: 'view', baseId: m.baseId, view: m.undo, note: m.undone ? { ar: 'أعدتُ التغيير الذي تراجعتَ عنه.', en: 'Re-applied the change you had undone.' } : { ar: 'تراجعتُ عن آخر تغيير؛ عاد العرض كما كان. الأرقام لم تتغيّر.', en: 'Undid the last change; the view is back as it was. The figures were never changed.' }, undo: cleanView(m.view), undone: !m.undone, chartId: m.chartId || null, status: 'done' };
    pendingChart.current = m.chartId ? { id: m.chartId, focus: false } : null;
    patchConv(conv.id, (c) => ({ ...c, updatedAt: Date.now(), messages: [...c.messages, back] }));
  };

  // the demo asks the user to confirm the interpreted scope in the risky categories BEFORE anything is generated
  const confirmPending = (msg) => {
    const pd = msg.pending; if (busy || !pd) return;
    patchConv(conv.id, (c) => ({ ...c, spec: pd.spec, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === msg.id ? { id: m.id, role: 'assistant', kind: pd.kind, spec: pd.spec, changes: pd.changes, changeKeys: pd.changeKeys, firstReport: pd.firstReport, confirmedByUser: true, status: 'working' } : m)) }));
    run(conv.id, msg.id, pd.spec, { pace: PACE });
  };
  const cancelPending = (msg) => patchConv(conv.id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msg.id ? { ...m, status: 'cancelled' } : m)) }));
  const retry = (msg) => { if (busy) return; patchConv(conv.id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msg.id ? { ...m, status: 'working' } : m)) })); run(conv.id, msg.id, msg.spec, { pace: PACE }); };
  // a conversation whose scope the CURRENT access no longer covers: its figures stay unread; the request behind its latest report can be re-run within the current access (a NEW conversation; the locked one is untouched)
  const specOfConv = (c) => ([...(c?.messages || [])].reverse().find((m) => m.role === 'assistant' && m.spec && (m.kind === 'report' || m.kind === 'question')) || {}).spec || c?.spec || null;
  const canRegenerate = (c) => { const sp = specOfConv(c); return !!sp && !!respecWithin(sp, access); };
  const regenerateWithin = (c) => {
    if (busy) return; const sp = specOfConv(c); const r = sp ? respecWithin(sp, access) : null; if (!r) return;
    send(L('أعد إنشاء التقرير ضمن صلاحياتي الحالية', 'Regenerate the report within my current access'), { spec: r.spec, changes: [], accessNotice: r.dropped.length ? SANITIZE_NOTICE : REOPEN_MSG.regenerated }, { fresh: true });
  };
  const newConv = () => { if (busy) return; setActiveId(null); setInput(''); setShowHistory(false); setFiles([]); setFileNote(''); setPreviewId(null); taRef.current?.focus(); };
  // clicking «التقارير الذكية» in the navigation while already inside a conversation also returns to the main page (every navigation to this route changes the router location key; actions inside the page do not)
  const inRouter = useInRouterContext(); const locKey = inRouter ? useLocation().key : null; const firstLoc = useRef(locKey); // eslint-disable-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (firstLoc.current === locKey) return;
    firstLoc.current = locKey; setActiveId(null); setInput(readDrafts(uk).new || ''); setShowHistory(false); setFiles([]); setFileNote(''); setPreviewId(null);
  }, [locKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [renaming, setRenaming] = useState(null); // { id, text }
  const renameConv = (id, text) => { const t = text.trim().slice(0, 80); if (t) patchConv(id, (c) => ({ ...c, title: t, titleSource: 'user' })); setRenaming(null); window.setTimeout(() => document.getElementById(`sr-rn-${id}`)?.focus(), 0); };
  // deleting a conversation deletes its saved report versions too (after the person confirmed)
  const removeConv = (id) => {
    store.removeConv(uk, id); recsRef.current = Object.fromEntries(Object.entries(recsRef.current).filter(([, r]) => r.convId !== id)); loadedRef.current.delete(id);
    setConvs((cs) => cs.filter((c) => c.id !== id)); if (id === activeId) setActiveId(null); setConfirmDel(null); writeDraft(uk, id, ''); bump();
  };
  // «تحديث التقرير»: a NEW version built from the same request with the data as it is now; the saved version it came from is left exactly as it was
  const refreshReport = (rootId) => {
    const root = conv?.messages.find((x) => x.id === rootId); if (!root?.spec || busy) return;
    const rolled = presetRange(root.spec.preset, today); const moved = rolled && (rolled.from !== root.spec.scope.from || rolled.to !== root.spec.scope.to);
    const sp = moved ? { ...JSON.parse(JSON.stringify(root.spec)), scope: { ...root.spec.scope, ...rolled } } : root.spec;
    send(L('حدّث التقرير ببيانات اليوم', 'Refresh the report with current data'), { spec: sp, changes: moved ? [{ key: 'period', value: `${rolled.from} → ${rolled.to}` }] : [], refreshOf: rootId });
  };

  const applyFilters = (patch, baseSpec = null) => {
    const base = baseSpec ? JSON.parse(JSON.stringify(baseSpec)) : spec ? JSON.parse(JSON.stringify(spec)) : JSON.parse(JSON.stringify(sharedSpec));
    const next = { ...base, ...patch, scope: { ...base.scope, ...(patch.scope || {}) } };
    next.preset = detectPreset(next.scope.from, next.scope.to, today); // the label of the period follows the dates that were actually chosen
    const changes = [];
    for (const k of ['from', 'to']) if (patch.scope && patch.scope[k] && patch.scope[k] !== base.scope[k]) { if (!changes.some((x) => x.key === 'period')) changes.push({ key: 'period', value: `${next.scope.from} → ${next.scope.to}` }); }
    for (const k of ['amanah', 'muni', 'source', 'status', 'scopeType']) if (patch.scope && JSON.stringify(patch.scope[k]) !== undefined && JSON.stringify(patch.scope[k]) !== JSON.stringify(base.scope[k])) changes.push({ key: k, value: patch.scope[k] });
    if (patch.compare && patch.compare !== base.compare) changes.push({ key: 'compare', value: patch.compare });
    if (!changes.length) return;
    send(L('طبّق التصفية: ', 'Apply filters: ') + changes.map((c) => describeChange(c, lang, { amanahLabel: labelOfAmanah, spec: next, access })).join('، '), { spec: next, changes });
  };

  // download the file of a result: the SAME model and view the conversation shows
  async function doExport(kind, model) {
    if (exporting || !viewerRef.current.permitted || !viewerRef.current.canExport) return;
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

  const canSend = (input.trim() || files.some((f) => !f.reading)) && !readingAny && !restricted;
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend) send(input); } };

  /* ---------------- pieces ---------------- */
  const sourceName = (k) => (k === 'all' ? L('كل المصادر', 'All sources') : ar ? sourceAr(k) : sourceEn(k));
  const specChips = useCallback((sp) => {
    const sc = sp.scope;
    const amLabel = sc.amanah === 'all' ? (access.all ? L('كل الأمانات والجهات', 'All Amanahs') : allAuthorizedLabel(access, ar ? 'ar' : 'en')) : [].concat(sc.amanah).map(labelOfAmanah).join('، '); // «all» under a restricted access = everything the access allows (never a wider reading)
    const mu = (sc.muni || 'all') === 'all' ? allMunicipalitiesLabel(access, sc.amanah, ar ? 'ar' : 'en') : muniLabel(sc.muni, ar ? 'ar' : 'en'); // the reference name (or the explicit group), never an internal id
    const st = { all: L('كل الحالات', 'All statuses'), collected: L('محصّلة', 'Collected'), open: L('قائمة', 'Open'), overdue: L('متأخرة', 'Overdue'), partial: L('جزئية', 'Partial'), not_due: L('لم تستحق', 'Not due'), cancelled: L('ملغاة', 'Cancelled'), excluded: L('مستبعدة', 'Excluded') }[sc.status || 'all'];
    const cmp = { none: null, prev_month: L('مقارنة بالشهر الماضي', 'vs last month'), prev_year: L('مقارنة بالعام الماضي', 'vs last year') }[sp.compare];
    return [
      { k: 'period', label: L('الفترة', 'Period'), value: fmtRangeText(sc.from, sc.to, ar ? 'ar' : 'en') }, { k: 'amanah', label: L('الأمانة / الجهة', 'Amanah'), value: amLabel }, { k: 'muni', label: L('البلدية', 'Municipality'), value: mu },
      { k: 'source', label: L('المصدر', 'Source'), value: sourceName(sc.source) }, { k: 'status', label: L('الحالة', 'Status'), value: st },
      ...(sc.scopeType && sc.scopeType !== 'all' ? [{ k: 'st', label: L('النطاق', 'Scope'), value: sc.scopeType === 'internal' ? L('داخلي', 'Internal') : L('مركزي', 'Central') }] : []),
      { k: 'basis', label: L('الأساس', 'Basis'), value: L(`فواتير الفترة · التحصيل حتى ${fmtDateText(sc.to < today ? sc.to : today, 'ar')}`, `Period invoices · collections to ${fmtDateText(sc.to < today ? sc.to : today, 'en')}`) }, ...(cmp ? [{ k: 'cmp', label: L('المقارنة', 'Comparison'), value: cmp }] : [])
    ];
  }, [today, ar, L, labelOfAmanah, viewer.key]); // eslint-disable-line react-hooks/exhaustive-deps
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
      const root = conv?.messages.find((x) => x.id === latest.rootId); // a report: suggestions come from what it contains
      out.push(...suggestionsFor(latest.model, root?.spec));
    }
    return out.slice(0, 3); // at most three suggestions: more than that is noise
  }, [latest, conv]);

  const [exportFor, setExportFor] = useState(null); // the report (assistant message id) the export dialog is open for
  const when = (iso) => `${fmtRiyadh(iso)}`;
  // every saved report of the open conversation as the dialog needs it: the finished model in each language it holds WITH the view agreed for it (chart type, parts shown), so the file is what is on screen
  const exportVersions = useMemo(() => {
    if (!conv || restrictedConv(conv)) return [];
    const viewOf = (rootId) => { let v = conv.messages.find((x) => x.id === rootId)?.view || null; conv.messages.forEach((x) => { if (x.kind === 'view' && x.baseId === rootId) v = x.view; }); return v || emptyView(); };
    return Object.values(recsRef.current).filter((r) => r.convId === conv.id && canView(r.coverage, viewer)).sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt))).map((r) => {
      const view = viewOf(r.msgId); const mk = (l) => { if (!r.models[l]) return null; const m = applyView(modelOfRecord(r, l), view).model; if (r.spec) Object.defineProperty(m, '_inputs', { value: { spec: r.spec }, enumerable: false }); return m; }; // `_inputs.spec` only keeps the file name's period (the exporters read it); the language models are the saved ones
      const models = { ar: mk('ar'), en: mk('en') }; const one = r.kind === 'attachments';
      const langReason = one ? L('هذا تحليل لملفاتك المرفقة؛ الملفات لا تُحفظ، فلا يمكن إعادة كتابته بلغة أخرى. أرفق الملفات من جديد للحصول على اللغة الأخرى.', 'This is an analysis of your attached files; the files are never stored, so it cannot be rewritten in the other language. Attach the files again to get the other language.')
        : r.prune?.language ? L('حُذفت نسخة اللغة الأخرى من هذا الإصدار لتوفير مساحة التخزين في هذا المتصفح، فلا يمكن التحويل.', 'The other-language copy of this version was removed to save storage space in this browser, so the language cannot be switched.') : null;
      const meta = metaOf(r); const noExport = !viewer.canExport ? L(REOPEN_MSG.exportDenied.ar, REOPEN_MSG.exportDenied.en) : null; const blocked = noExport || r.prune?.detail ? noExport || L('حُذفت تفاصيل هذا الإصدار (الجداول والرسوم) لتوفير مساحة التخزين؛ لا يمكن تصديره. افتح إصداراً أحدث أو حدّث التقرير.', 'The details of this version (tables and charts) were removed to save storage space; it cannot be exported. Open a newer version or refresh the report.') : null;
      const title = (models.ar || models.en)?.title || '';
      const scopeNote = (models.ar || models.en)?.access ? L(`نطاق الصلاحية الذي أُعدّ ضمنه التقرير: ${(models.ar || models.en).access.summary.ar}`, `Access scope this report was prepared within: ${(models.ar || models.en).access.summary.en}`) : null; // the file names the authorized scope it holds
      return { id: r.msgId, label: one ? title : `v${r.version} — ${title} — ${when(r.generatedAt)}`, meta: one ? { ...meta, version: null } : meta, models, langReason, exportable: !blocked && !((models.ar || models.en)?.empty), blocked, scopeNote };
    });
  }, [conv, tick, viewer, ar, viewer.canExport]); // eslint-disable-line react-hooks/exhaustive-deps
  const exportButtons = (model, rootId) => (
    <div className="sr-card__actions" role="group" aria-label={L('تصدير التقرير', 'Export report')}>
      <button type="button" className="btn btn-sm btn-primary" disabled={model.empty || !viewer.canExport} title={!viewer.canExport ? L(REOPEN_MSG.exportDenied.ar, REOPEN_MSG.exportDenied.en) : undefined} onClick={() => setExportFor(rootId)}>{L('تصدير التقرير', 'Export report')}</button>
      {!viewer.canExport && <small className="muted" role="note">{L(REOPEN_MSG.exportDenied.ar, REOPEN_MSG.exportDenied.en)}</small>}
    </div>
  );
  const pickVersion = (rootId) => { setSel((x) => ({ ...x, [conv.id]: rootId })); window.setTimeout(() => document.querySelector(`.sr-card.is-cur[data-root="${rootId}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80); };
  const saveFail = conv && saveInfo[conv.id] && saveInfo[conv.id].ok === false;
  const prunedNow = versions.filter((r) => r.prune);

  // the composer must never cover the result: the thread keeps room for the dock beneath it (its height is measured)
  useEffect(() => { const el = dockRef.current; if (!el || typeof ResizeObserver === 'undefined') return undefined; const ro = new ResizeObserver(() => setDockH(Math.round(el.getBoundingClientRect().height))); ro.observe(el); return () => ro.disconnect(); }, []);

  return (
    <div className={`sr-page${drag ? ' is-drag' : ''}`} dir={ar ? 'rtl' : 'ltr'} onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDrag(true); } }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false); }} onDrop={onDrop}>
      <div className="sr-top">
        {!embedded && <div className="sr-top__titles"><h1 className="page-title">{L('التقارير الذكية', 'Smart reports')}</h1><p className="sr-top__sub">{L('اطلب تقريراً أو اسأل عن الإيرادات والتحصيل بلغتك.', 'Ask for a report or a question about revenue and collection.')}</p></div>}
        <div className="sr-top__actions">
          <button type="button" className="btn btn-sm btn-primary" onClick={newConv} disabled={!!busy}>＋ {L('محادثة جديدة', 'New conversation')}</button>
          <button type="button" ref={histBtnRef} className="btn btn-sm" aria-haspopup="dialog" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>{L('سجل المحادثات', 'Conversation history')}{convs.length > 0 && <span className="sr-top__count" aria-label={L(`${convs.length} محادثة`, `${convs.length} conversations`)}>{convs.length}</span>}</button>
        </div>
      </div>
      <ExportDialog open={!!exportFor} onClose={() => setExportFor(null)} activeId={exportFor} L={L} ar={ar} versions={exportVersions} />
      {drag && <div className="sr-dropzone" role="status">{L('أفلت الملفات هنا لإرفاقها', 'Drop the files here to attach them')}</div>}

      {showHistory && (() => {
        const q = histQ.trim().toLowerCase();
        const lockedTitle = L('محادثة خارج صلاحياتك الحالية', 'Conversation outside your current permissions');
        const list = convs.filter((c) => !q || (restrictedConv(c) ? lockedTitle : `${c.title} ${c.messages.map((m) => m.text || '').join(' ')}`).toLowerCase().includes(q)); // a restricted conversation is searched by its generic title only: nothing of its content leaks
        const day = (iso) => (iso ? riyadhDateOf(iso) : ''); const t0 = riyadhToday(); const y = new Date(Date.parse(`${t0}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
        const groups = [[L('اليوم', 'Today'), list.filter((c) => day(c.updatedAt) >= t0)], [L('أمس', 'Yesterday'), list.filter((c) => day(c.updatedAt) === y)], [L('أقدم', 'Earlier'), list.filter((c) => day(c.updatedAt) < y)]].filter(([, l]) => l.length);
        return (
          <div className="sr-drawer__scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) closeHistory(); }}>
          <aside className="sr-drawer" role="dialog" aria-modal="true" aria-label={L('سجل المحادثات', 'Conversation history')} onKeyDown={(e) => { if (e.key === 'Escape') closeHistory(); }}>
            <header className="sr-drawer__head"><h2>{L('سجل المحادثات', 'Conversation history')}</h2><button type="button" ref={histCloseRef} className="btn btn-sm btn-ghost" aria-label={L('إغلاق السجل', 'Close history')} onClick={closeHistory}>✕</button></header>
            {convs.length > 0 && <input type="search" className="input sr-history__q" value={histQ} onChange={(e) => setHistQ(e.target.value)} placeholder={L('ابحث في المحادثات…', 'Search conversations…')} aria-label={L('بحث في المحادثات', 'Search conversations')} />}
            {!convs.length && <div className="sr-drawer__empty"><p>{L('لا توجد محادثات محفوظة بعد', 'No saved conversations yet')}</p><button type="button" className="btn btn-sm btn-primary" onClick={() => { closeHistory(); newConv(); }}>＋ {L('محادثة جديدة', 'New conversation')}</button></div>}
            {convs.length > 0 && !list.length && <div className="muted">{L('لا نتائج مطابقة.', 'No matching conversations.')}</div>}
            <div className="sr-drawer__list">
            {groups.map(([label, items]) => (
              <section key={label} className="sr-history__group" aria-label={label}>
                <h3 className="sr-history__h">{label}</h3>
                {items.map((c) => { const locked = restrictedConv(c); return (
                  <div key={c.id} className={`sr-history__item ${c.id === activeId ? 'is-active' : ''}${locked ? ' is-locked' : ''}`} aria-current={c.id === activeId ? 'true' : undefined}>
                    {confirmDel === c.id ? (
                      <div className="sr-history__confirm" role="alertdialog" aria-label={L('تأكيد حذف المحادثة', 'Confirm deleting the conversation')}>
                        <span>{L('حذف هذه المحادثة وكل إصدارات تقاريرها المحفوظة نهائياً؟', 'Delete this conversation and all its saved report versions permanently?')}</span>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => removeConv(c.id)}>{L('حذف', 'Delete')}</button>
                        <button type="button" className="btn btn-sm btn-ghost" autoFocus onClick={() => setConfirmDel(null)}>{L('إلغاء', 'Cancel')}</button>
                      </div>
                    ) : <>
                    {renaming?.id === c.id
                      ? <input id={`sr-rni-${c.id}`} className="input" autoFocus maxLength={80} aria-label={L('اسم المحادثة', 'Conversation name')} value={renaming.text} onChange={(e) => setRenaming({ id: c.id, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') renameConv(c.id, renaming.text); if (e.key === 'Escape') setRenaming(null); }} onBlur={() => renameConv(c.id, renaming.text)} />
                      : <button type="button" className="sr-history__open" onClick={() => { if (!busy) { setActiveId(c.id); closeHistory(); } }}>{locked ? <><b>🔒 {lockedTitle}</b><small className="sr-history__prev">{L('لم يعد لديك صلاحية على كامل نطاقها؛ يمكنك إعادة إنشائها ضمن صلاحياتك أو حذفها.', 'You no longer have access to its full scope; you can regenerate it within your access or delete it.')}</small></> : <><b>{c.title}</b><small className="sr-history__prev">{(c.messages.find((m) => m.role === 'user')?.text || '').slice(0, 90)}</small></>}<small>{fmtRiyadh(c.updatedAt)}{locked ? '' : ` · ${c.messages.filter((m) => m.role === 'user').length} ${L('طلب', 'requests')}`}{!locked && c.reports > 1 ? ` · ${c.reports} ${L('إصدارات', 'versions')}` : ''}</small></button>}
                    {!locked && <button type="button" id={`sr-rn-${c.id}`} className="btn btn-sm btn-ghost" aria-label={L('إعادة تسمية المحادثة', 'Rename the conversation')} onClick={() => setRenaming({ id: c.id, text: c.title })}>✎</button>}
                    <button type="button" className="btn btn-sm btn-ghost" aria-label={L('حذف المحادثة', 'Delete the conversation')} onClick={() => setConfirmDel(c.id)}>×</button>
                    </>}
                  </div>); })}
              </section>))}
            </div>
            <footer className="sr-drawer__foot"><LocalDataPanel /></footer>
          </aside></div>);
      })()}

      {spec && scopeDiffers && <div className="sr-note" role="note">{L('لهذه المحادثة نطاقها الخاص، وهو يختلف عن تصفية لوحة المعلومات الحالية؛ لن يتغير نطاقها تلقائياً.', 'This conversation keeps its own scope, which differs from the current dashboard filters; it never changes automatically.')} <button type="button" className="sr-link" onClick={() => applyFilters({ scope: sharedSpec.scope })}>{L('مزامنة نطاق المحادثة مع لوحة المعلومات', 'Sync the conversation scope with the dashboard')}</button></div>}


      {!restricted && saveFail && <div className="sr-warn" role="alert">{L('تعذّر حفظ تقارير هذه المحادثة في هذا المتصفح (مساحة التخزين ممتلئة أو غير متاحة). تبقى معروضة حتى تغلق الصفحة ولن تكون في السجل بعد إعادة التحميل. احذف محادثات قديمة من السجل ثم حدّث التقرير.', 'The reports of this conversation could not be saved in this browser (storage is full or unavailable). They stay on screen until you close the page and will not be in the history after a reload. Delete old conversations from the history, then refresh the report.')}</div>}
      {!restricted && prunedNow.length > 0 && <div className="sr-note" role="note">{L('لتوفير مساحة التخزين في هذا المتصفح حُذف جزء من الإصدارات القديمة: ', 'To save storage space in this browser, part of the older versions was removed: ')}{prunedNow.map((r) => `v${r.version} (${r.prune.detail ? L('الجداول والرسوم', 'tables and charts') : L('نسخة اللغة الأخرى', 'the other language')})`).join(L('، ', ', '))}. {L('الإصدار الأحدث كامل.', 'The newest version is complete.')}</div>}
      {!restricted && versions.length > 0 && (
        <nav className="sr-vers" aria-label={L('إصدارات التقرير', 'Report versions')}>
          <span className="sr-vers__lbl">{L('الإصدارات:', 'Versions:')}</span>
          {versions.map((r) => { const on = latest?.rootId === r.msgId; return (
            <button key={r.msgId} type="button" className={`sr-vers__btn${on ? ' is-on' : ''}`} aria-pressed={on} disabled={!!busy && !on} onClick={() => pickVersion(r.msgId)} title={`${L('الإصدار', 'Version')} ${r.version} · ${L('أُنشئ', 'generated')} ${when(r.generatedAt)} · ${L('بيانات حتى', 'data to')} ${r.cutoff}${r.prune ? ` · ${L('حُذف جزء منه لتوفير المساحة', 'part removed to save space')}` : ''}`}>
              <b>v{r.version}</b><small dir="ltr">{when(r.generatedAt).slice(5)}</small><small>{L('حتى', 'to')} <bdi dir="ltr">{r.cutoff.slice(5)}</bdi></small>{r.prune ? <i aria-hidden="true">⚠</i> : null}
            </button>); })}
        </nav>)}

      <div className="sr-thread" aria-live="polite">
        {restricted && (
          <div className="sr-restricted" role="alert">
            <h2>🔒 {L(REOPEN_MSG.scope.ar.split('،')[0], REOPEN_MSG.scope.en.split(',')[0])}</h2>
            <p>{L(REOPEN_MSG.scope.ar.split('، ').slice(1).join('، '), REOPEN_MSG.scope.en.split(', ').slice(1).join(', ').replace(/^./, (c) => c.toUpperCase()))} {L('بدّل إلى جهة تشمل ذلك النطاق، أو أعد الإنشاء ضمن صلاحياتك، أو احذف المحادثة من السجل.', 'Switch to an organisation that covers that scope, regenerate within your access, or delete the conversation from the history.')}</p>
            <div><button type="button" className="btn btn-sm btn-primary" disabled={!!busy || !canRegenerate(conv)} onClick={() => regenerateWithin(conv)}>↻ {L('إعادة الإنشاء ضمن صلاحياتي الحالية', 'Regenerate within my current access')}</button> <button type="button" className="btn btn-sm" onClick={newConv}>＋ {L('محادثة جديدة', 'New conversation')}</button> <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(conv.id) || setShowHistory(true)}>{L('حذف هذه المحادثة', 'Delete this conversation')}</button></div>
          </div>
        )}
        {!restricted && empty && (
          <div className="sr-welcome">
            <h2>{L('ماذا تريد أن تعرف؟', 'What would you like to see?')}</h2>
            <p className="muted sr-welcome__sub">{L('اسأل عن الإيرادات والتحصيل.', 'Ask about revenue and collection.')}</p>
            <div className="sr-suggest">{SUGGESTIONS.map((s) => <button key={s.ar} type="button" className="sr-suggest__btn" onClick={() => send(s[ar ? 'ar' : 'en'])}>{s[ar ? 'ar' : 'en']}</button>)}</div>
          </div>
        )}
        {!restricted && conv?.messages.map((m) => {
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
                    <InterpretationSummary pending sections={m.pending.spec.sections} msg={{ changeKeys: m.pending.changeKeys, firstReport: m.pending.firstReport }} chips={specChips(m.pending.spec)} L={L} editable={m.status === 'pending' && !busy} editing={m.status === 'pending' && editPendingId === m.id} onEdit={() => setEditPendingId((v) => (v === m.id ? null : m.id))} panel={<FilterPanel key={`${m.id}${JSON.stringify(m.pending.spec.scope)}`} spec={m.pending.spec} today={today} ar={ar} L={L} onCancel={() => setEditPendingId(null)} access={access} onApply={(p) => { setEditPendingId(null); applyFilters(p, m.pending.spec); }} />} />
                    {m.status === 'pending' && <div className="sr-suggest sr-suggest--inline"><button type="button" className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => confirmPending(m)}>{L('تأكيد وإعداد التقرير', 'Confirm and build the report')}</button><button type="button" className="btn btn-sm btn-ghost" onClick={() => cancelPending(m)}>{L('إلغاء', 'Cancel')}</button></div>}
                    {m.status === 'cancelled' && <div className="muted">{L('أُلغي الطلب ولم يُعدّ تقرير.', 'Cancelled — no report was built.')}</div>}
                    {m.status === 'superseded' && <div className="muted">{L('حلّ محلّه طلب أحدث.', 'Replaced by a newer request.')}</div>}
                  </div>
                )}
                {m.kind === 'view' && <div className="sr-bubble sr-bubble--ai"><Typewriter text={noteOf(m.note, ar)} animate={fresh} onTick={tick} />{m.undo && isLast && <div className="sr-undo"><button type="button" className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => undoView(m)}>{m.undone ? `↷ ${L('إعادة التطبيق', 'Redo')}` : `↶ ${L('تراجع', 'Undo')}`}</button></div>}</div>}
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
                    {m.kind === 'question' ? L('الإجابة:', 'Answer:') : m.refreshOf ? L('أعددتُ إصداراً جديداً بالبيانات الحالية؛ الإصدار السابق محفوظ كما كان.', 'Built a new version with the current data; the previous version is kept as it was.') : (m.changes?.length > 0 ? L('فهمتُ الطلب:', 'Understood:') : L('التقرير بالنطاق الحالي.', 'Report for the current scope.'))}
                    {m.changes?.length > 0 && <div className="sr-changes">{m.changes.map((c, i) => <span key={i} className="sr-chip sr-chip--changed">{c}</span>)}</div>}
                    {m.accessNote && <div className="muted" style={{ fontSize: 12 }} role="note">{noteOf(m.accessNote, ar)}</div>}
                    {m.spec && <InterpretationSummary msg={m} chips={specChips(m.spec)} L={L} editable={isLast && !busy} editing={isLast && editOpen} onEdit={() => setEditOpen((v) => !v)} panel={<FilterPanel key={JSON.stringify(m.spec.scope) + m.spec.compare} spec={m.spec} today={today} ar={ar} L={L} onCancel={() => setEditOpen(false)} access={access} onApply={(p) => { setEditOpen(false); applyFilters(p); }} />} />}
                    {isBusy && <AgentSteps order={SYS_ORDER} current={busy.step} textOf={stepText} L={L} onStop={stop} />}
                    {m.status === 'stopped' && <div className="sr-warn">{L('أُوقف الإعداد.', 'Generation was stopped.')} <button type="button" className="btn btn-sm" onClick={() => retry(m)}>{L('إعادة المحاولة', 'Retry')}</button></div>}
                    {m.status === 'error' && <div className="sr-warn" role="alert">{L('تعذّر إعداد التقرير. تحقق من اتصال خدمة البيانات ثم أعد المحاولة.', 'The report could not be prepared. Check the data service and try again.')} <button type="button" className="btn btn-sm" onClick={() => retry(m)}>{L('إعادة المحاولة', 'Retry')}</button></div>}
                  </div>
                )}
                {showCard && (
                  <div className={`sr-card card${fresh ? ' sr-reveal' : ''}${isLast ? ' is-cur' : ''}`} id={`sr-card-${m.id}`} data-root={res.rootId}>
                    <div className="sr-card__bar">
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCollapsed((c) => ({ ...c, [m.id]: !(c[m.id] ?? !isLast) }))}>{(collapsed[m.id] ?? !isLast) ? `▸ ${L('عرض', 'Show')} — ${shown.title}` : `▾ ${L('إغلاق', 'Close')}`}</button>
                      {isLast && <>
                        {exportButtons(shown, res.rootId)}
                      </>}
                    </div>
                    {isLast && curRec && !(collapsed[m.id] ?? !isLast) && (
                      <div className={`sr-saved${saveFail ? ' is-unsaved' : ''}`} role="status">
                        <span><b>{saveFail ? L('تقرير غير محفوظ', 'Report not saved') : curRec.kind === 'report' ? L('تقرير محفوظ', 'Saved report') : L('تحليل محفوظ', 'Saved analysis')}</b> · {L('أُنشئ', 'Generated')} <bdi dir="ltr">{when(curRec.generatedAt)}</bdi> <small>({L(RIYADH_NOTE[0], RIYADH_NOTE[1])})</small> · {L('بيانات حتى', 'Data to')} <bdi dir="ltr">{curRec.cutoff}</bdi>{curRec.kind === 'report' && <> · {L('الإصدار', 'Version')} {curRec.version}</>}</span>
                        {curRec.kind === 'report' && <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => refreshReport(curRec.msgId)} title={L('يبني إصداراً جديداً ببيانات اليوم ولا يستبدل هذا الإصدار', 'Builds a new version with today’s data; this version is not replaced')}>↻ {L('تحديث التقرير', 'Refresh report')}</button>}
                        <small className="sr-saved__note">{curRec.kind === 'report' ? L('الأرقام كما حُفظت وقت الإنشاء؛ التحديث ينشئ إصداراً جديداً ولا يستبدل هذا.', 'The figures are as they were when generated; refreshing builds a new version and never replaces this one.') : L('الملفات المرفقة لا تُحفظ؛ يُحفظ التحليل فقط.', 'The attached files are not stored; only the analysis is.')}</small>
                      </div>)}
                    {!(collapsed[m.id] ?? !isLast) && (shown.empty ? <div className="rv-empty">{isFileResult ? L('لم يمكن قراءة أي ملف من المرفقات؛ راجع الملاحظات أعلاه.', 'None of the attached files could be read; see the notes above.') : L('لا فواتير في هذا الاختيار؛ البيانات غير متاحة وليست صفراً. وسّع الفترة أو التصفية.', 'No invoices in this selection; the data is unavailable, not zero. Widen the period or filters.')}</div> : <ReportView model={shown} base={isLast && !busy ? res.base : null} view={res.view} onChartView={isLast && !busy ? commitChartView : null} />)}
                  </div>
                )}
                {m.status === 'done' && m.spec && (m.kind === 'report' || m.kind === 'question') && !model && !isBusy && <div className="sr-warn" role="alert">{unreadableRef.current.has(m.id) ? L('تعذّر استرجاع هذا الإصدار المحفوظ (بياناته تالفة)، ولن يُعرض بأرقام غير مطابقة لما حُفظ.', 'This saved version could not be restored (its data is damaged); it is not shown with figures that differ from what was saved.') : L('لم يُحفظ هذا الإصدار في هذا المتصفح، فلا يمكن عرضه كما كان.', 'This version was not saved in this browser, so it cannot be shown as it was.')} <button type="button" className="btn btn-sm" onClick={() => refreshReport(m.id)} disabled={!!busy}>{L('إنشاء إصدار جديد ببيانات اليوم', 'Create a new version with current data')}</button></div>}
                {m.status === 'done' && m.kind === 'attachments' && !model && !isBusy && <div className="sr-warn" role="alert">{L('تحليل المرفقات المحفوظ لم يعد متاحاً. أرفق الملفات من جديد.', 'The saved attachment analysis is no longer available. Attach the files again.')}</div>}
              </div>
            </div>
          );
        })}
        <div ref={endRef} style={{ scrollMarginBottom: dockH + 12 }} />
      </div>

      <div className="sr-dock" ref={dockRef}>
        {!restricted && versions.length > 1 && curRec?.kind === 'report' && <div className="sr-buildson" role="note">{L('الطلب التالي يُبنى على', 'Your next request builds on')} <b>{L('الإصدار', 'version')} {curRec.version}</b> · <bdi dir="ltr">{when(curRec.generatedAt)}</bdi>{curRec.msgId !== versions[versions.length - 1].msgId ? <> · <button type="button" className="sr-link" onClick={() => pickVersion(versions[versions.length - 1].msgId)}>{L('الانتقال إلى الأحدث', 'Switch to the latest')}</button></> : null}</div>}
        {!restricted && !empty && followUps.length > 0 && <div className="sr-suggest sr-suggest--inline" aria-label={L('طلبات متابعة', 'Follow-ups')}>{followUps.map((s) => <button key={s.ar} type="button" className="sr-suggest__btn sr-suggest__btn--sm" disabled={!!busy} title={s.why ? s.why[ar ? 'ar' : 'en'] : undefined} onClick={() => send(s[ar ? 'ar' : 'en'])}>{s[ar ? 'ar' : 'en']}</button>)}</div>}
        {files.length > 0 && <div className="sr-files" role="list" aria-label={L('المرفقات', 'Attachments')}>{files.map((f) => <FileChip key={f.id} f={f} ar={ar} L={L} open={previewId === f.id} onToggle={() => setPreviewId((p) => (p === f.id ? null : f.id))} onRemove={() => removeFile(f.id)} />)}</div>}
        {previewId && files.find((f) => f.id === previewId && !f.reading) && <FilePreview f={files.find((f) => f.id === previewId)} ar={ar} L={L} />}
        {fileNote && <div className="sr-warn" role="status">{fileNote}</div>}
        <div className={`sr-composer${busy ? ' is-busy' : canSend ? ' is-ready' : ''}${restricted ? ' is-disabled' : ''}`}>
          <input ref={fileRef} id="sr-file" type="file" multiple accept={ACCEPT} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <button type="button" className="sr-composer__attach" onClick={() => fileRef.current?.click()} disabled={!!busy || restricted || files.length >= MAX_FILES} aria-label={L('إرفاق ملفات', 'Attach files')} title={L('إرفاق PDF أو Word أو Excel أو CSV أو PowerPoint أو صور', 'Attach PDF, Word, Excel, CSV, PowerPoint or images')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
          </button>
          <textarea ref={taRef} id="sr-input" rows={1} disabled={restricted} className="sr-composer__input" value={input} onChange={(e) => onInput(e.target.value)} onKeyDown={onKey} aria-label={L('طلب تقرير أو سؤال', 'Report request or question')} placeholder={files.length ? L('ماذا تريد من الملفات؟ أو أرسل للتحليل', 'What do you want from the files? Or just send') : L('اطلب تقريرًا أو اسأل، أو أرفق ملفات…', 'Ask for a report or a question, or attach files…')} />
          {busy ? <button type="button" className="sr-composer__btn sr-composer__btn--stop" onClick={stop} aria-label={L('إيقاف الإعداد', 'Stop generation')}>■</button>
            : <button type="button" className="sr-composer__btn" onClick={() => send(input)} disabled={!canSend} aria-label={L('إرسال', 'Send')}>{ar ? '↰' : '➤'}</button>}
        </div>
        <div className="muted sr-hint">{L('Enter للإرسال · Shift+Enter لسطر جديد · اسحب الملفات إلى هنا لإرفاقها', 'Enter to send · Shift+Enter for a new line · drag files here to attach them')}</div>
      </div>
    </div>
  );
}
