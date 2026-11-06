import React, { useEffect, useRef, useState } from 'react';
import { exportModel, reportFileName } from '../../utils/exportReportModel';
import { buildReportModel } from '../../data/reportModel';
import { rebuildNcModel } from '../../data/ncReportModel';
import { fmtRiyadh } from '../../data/clock';
import { exportPlan } from '../../data/reportView';
import { exportSummary, typeName } from '../charts/chartPickerLogic';

// ONE «تصدير التقرير» action. The dialog exports the SELECTED REPORT (its model — never the chat, the navigation or a screenshot) as PDF or PowerPoint in Arabic or English; other formats are secondary.
// A SAVED report (Smart Reports) arrives as { id, label, meta, models:{ar,en}, langReason, exportable, blocked } — the finished model in each language it holds, with the SAME figures (nothing is recalculated); the version picked in the dialog is exactly the model exported,
// and its save details travel in `model.meta` = { version, generatedAt, cutoff, requestId, reportId, lineageId, period:{from,to}, pruned } for the file name and footers.
// An older shape { id, model } (the dashboard) keeps working: its model may carry build inputs, which re-express it in the other language; without them it stays in its own language.
const PRIMARY = [['pdf', 'PDF'], ['pptx', 'PowerPoint']]; const MORE = [['docx', 'Word'], ['xlsx', 'Excel'], ['csv', 'CSV']];
export const inLanguage = (model, lang) => {
  if (model.lang === lang) return model; if (!model._inputs) return null;
  if (model._inputs.ncReport) return rebuildNcModel(model, lang); // the non-collection analysis: the SAME analysis snapshot re-expressed (keeps its inputs and meta)
  const m = buildReportModel({ ...model._inputs, lang }); Object.defineProperty(m, '_inputs', { value: model._inputs, enumerable: false }); // the other-language model keeps its inputs (period for the file name, a way back)
  if (model.meta) m.meta = model.meta; return m;
};
const modelIn = (v, lang) => (!v ? null : v.models ? v.models[lang] || null : inLanguage(v.model, lang));
const langsOf = (v) => (!v ? [] : v.models ? ['ar', 'en'].filter((l) => v.models[l]) : v.model?._inputs ? ['ar', 'en'] : [v.model?.lang].filter(Boolean));
const ownLang = (v) => (!v ? null : v.models ? (v.models.ar && v.models.en ? null : v.models.ar ? 'ar' : 'en') : v.model?.lang || null);
const titleOf = (v) => v.label || v.model?.title || v.models?.ar?.title || v.models?.en?.title || '';

// «كيف ستظهر الرسوم في الملف»: per chart, how THIS file will hold it (exportPlan reads the report as shown: the view's chart types included).
// PDF and Word always carry the same drawing as the screen; PowerPoint gets a native chart where one exists and otherwise a picture (or a table) — named here BEFORE the export, never substituted silently.
export function ChartsDisclosure({ model, format, L, ar }) {
  const lg = ar ? 'ar' : 'en';
  const plan = React.useMemo(() => { try { return model ? exportPlan(model, model.view || null) : []; } catch { return []; } }, [model]);
  if (!plan.length) return null;
  const sum = exportSummary(plan, lg);
  const T = (a, e) => (ar ? a : e);
  const same = format === 'pdf' || format === 'docx';
  const tableOnly = format === 'xlsx' || format === 'csv';
  const modeText = (e) => (e.pptx === 'native' ? T('رسم أصلي قابل للتحرير', 'native, editable chart') : e.pptx === 'table' ? T('جدول أصلي مظلّل', 'native shaded table') : T('صورة — البيانات في الجدول', 'picture — the data is in the table'));
  const head = same ? (format === 'pdf' ? T('الرسم نفسه كما على الشاشة (متجه) مع جدول بياناته', 'The same drawing as on screen (vector), with its data table') : T('الرسم نفسه كما على الشاشة (صورة) مع جدول بياناته', 'The same drawing as on screen (picture), with its data table'))
    : tableOnly ? T('الأرقام في جداول (لا رسوم)', 'The figures are in tables (no charts)')
      : T(`${sum.native} أصلي قابل للتحرير · ${sum.picture} صورة · ${sum.table} جدول`, `${sum.native} native editable · ${sum.picture} picture · ${sum.table} table`);
  return (
    <div className="sr-exp__f" data-testid="export-charts">
      {format === 'pptx' && sum.fallbacks.length > 0 && <p className="sr-exp__warnline" role="status">⚠ {T(`${sum.fallbacks.length} من ${sum.total} رسوم ستظهر في PowerPoint كصورة أو جدول (غير قابلة للتحرير كرسم) — البيانات في الجدول.`, `${sum.fallbacks.length} of ${sum.total} charts will appear in PowerPoint as a picture or table (not editable as a chart) — the data is in the table.`)}</p>}
      <details className="sr-exp__charts">
        <summary>{T('كيف ستظهر الرسوم في الملف', 'How charts appear in the file')} <small className="muted">— {head}</small></summary>
        {!tableOnly && <ul>{plan.map((e, i) => (
          <li key={e.chartId || i}><bdi dir="auto">{e.title || e.chartId}</bdi> · {typeName(e.typeId, lg)} — {same ? T('الرسم نفسه', 'same drawing') : e.pptx === 'native' ? modeText(e) : <b>{modeText(e)}</b>}</li>
        ))}</ul>}
      </details>
    </div>
  );
}

export default function ExportDialog({ open, onClose, versions, activeId, L: La, ar }) {
  const L = (en, arb) => La(arb, en); // this page's L takes (Arabic, English); the dialog is written (English, Arabic)
  const ref = useRef(null);
  const [vid, setVid] = useState(activeId); const [format, setFormat] = useState('pdf'); const [lang, setLang] = useState(ar ? 'ar' : 'en');
  const [state, setState] = useState({ s: 'idle', file: '' });
  const ver = versions.find((v) => v.id === vid) || versions[0]; const canSwitch = langsOf(ver).length > 1;
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) { setVid(activeId); setState({ s: 'idle', file: '' }); const v = versions.find((x) => x.id === activeId) || versions[0]; setLang(pickLang(v)); d.showModal(); } if (!open && d.open) d.close(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickLang = (v) => { const have = langsOf(v); const want = ar ? 'ar' : 'en'; return have.includes(want) ? want : have[0] || want; }; // the page language when the report holds it, otherwise the language it has
  const pickVersion = (id) => { setVid(id); const v = versions.find((x) => x.id === id); if (v) setLang(pickLang(v)); setState({ s: 'idle', file: '' }); };
  const run = async () => {
    if (!ver) return; setState({ s: 'busy', file: '' });
    try { const model = modelIn(ver, lang); if (!model) throw new Error('language_unavailable'); if (ver.exportable === false) throw new Error('not_exportable'); await exportModel(format, model); setState({ s: 'done', file: reportFileName(model, format) }); }
    catch (e) { console.error('[export] failed:', e); setState({ s: 'error', file: '' }); }
  };
  return (
    <dialog ref={ref} className="ds-dialog sr-export" aria-labelledby="sr-exp-title" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="ds-dialog__body">
        <h2 id="sr-exp-title" className="ds-dialog__title">{L('Export report', 'تصدير التقرير')}</h2>
        {versions.length > 1 && <label className="sr-exp__f">{L('Report version', 'نسخة التقرير')}<select className="input" value={ver?.id} onChange={(e) => pickVersion(e.target.value)}>{versions.map((v, i) => <option key={v.id} value={v.id}>{i === 0 ? L('Latest — ', 'الأحدث — ') : ''}{titleOf(v)}</option>)}</select></label>}
        {ver?.meta && <div className="sr-exp__ver muted" dir="auto">{ver.meta.version ? <b>{L(`Version ${ver.meta.version}`, `الإصدار ${ver.meta.version}`)}</b> : null}{ver.meta.version ? ' · ' : ''}{L('generated ', 'أُنشئ ')}<bdi dir="ltr">{fmtRiyadh(ver.meta.generatedAt)}</bdi> {L('(Riyadh time)', '(توقيت الرياض)')} · {L('data to ', 'بيانات حتى ')}<bdi dir="ltr">{ver.meta.cutoff}</bdi><br />{L('The file holds exactly this version.', 'سيحتوي الملف هذا الإصدار بعينه.')}</div>}
        {ver?.scopeNote && <div className="sr-exp__ver muted" dir="auto" data-testid="export-scope">{ver.scopeNote}</div>}
        {ver?.exportable === false && <div className="sr-warn" role="alert">{ver.blocked}</div>}
        <fieldset className="sr-exp__f"><legend>{L('Format', 'الصيغة')}</legend>
          <div className="sr-exp__row">{PRIMARY.map(([k, n]) => <label key={k} className="sr-exp__opt"><input type="radio" name="sr-exp-format" checked={format === k} onChange={() => setFormat(k)} /> {n}</label>)}</div>
          <details className="sr-exp__more"><summary>{L('Other formats', 'صيغ أخرى')}</summary><div className="sr-exp__row">{MORE.map(([k, n]) => <label key={k} className="sr-exp__opt"><input type="radio" name="sr-exp-format" checked={format === k} onChange={() => setFormat(k)} /> {n}</label>)}</div></details>
        </fieldset>
        <fieldset className="sr-exp__f"><legend>{L('Language', 'اللغة')}</legend>
          <div className="sr-exp__row">{[['ar', 'العربية'], ['en', 'English']].map(([k, n]) => <label key={k} className="sr-exp__opt"><input type="radio" name="sr-exp-lang" checked={lang === k} disabled={!langsOf(ver).includes(k)} onChange={() => setLang(k)} /> {n}</label>)}</div>
          {!canSwitch && <small className="muted" role="note">{ver?.langReason || L('This report can only be exported in the language it was prepared in.', 'يُصدَّر هذا التقرير باللغة التي أُعدّ بها فقط.')}{ownLang(ver) ? L(` Available language: ${ownLang(ver) === 'ar' ? 'Arabic' : 'English'}.`, ` اللغة المتاحة: ${ownLang(ver) === 'ar' ? 'العربية' : 'الإنجليزية'}.`) : ''}</small>}
        </fieldset>
        {ver && <ChartsDisclosure model={modelIn(ver, lang)} format={format} L={L} ar={ar} />}
        <div role="status" aria-live="polite" className="sr-exp__state">
          {state.s === 'busy' && L('Preparing the file…', 'جارٍ تجهيز الملف…')}
          {state.s === 'done' && <span>{L('Downloaded: ', 'تم التنزيل: ')}<bdi dir="ltr">{state.file}</bdi></span>}
          {state.s === 'error' && <span className="sr-warn">{L('The file could not be created.', 'تعذّر إنشاء الملف.')}</span>}
        </div>
        <div className="ds-dialog__actions" style={{ gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>{L('Close', 'إغلاق')}</button>
          <button type="button" className="btn btn-primary" disabled={state.s === 'busy' || !ver || ver.exportable === false || !!(modelIn(ver, lang)?.empty)} onClick={run}>{state.s === 'error' ? L('Retry', 'إعادة المحاولة') : L('Export', 'تصدير')}</button>
        </div>
      </div>
    </dialog>
  );
}
