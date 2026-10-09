import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { ProvenanceBadge } from '../components/revenue/RevenueUI';
import { UNAVAILABLE_REVENUE_SOURCES } from '../data/revenueLedger';
import { importRows, parseCsv, SAMPLE_CSV, SAMPLE_LINES_CSV, REQUIRED, REPORT_TYPES } from '../data/ledgerImport';
import { SOURCE_ROLES, buildImportLog, freshnessOf, FRESHNESS_LEVELS, buildMatchRules, qualityOverview } from '../data/sourceMap';
import { api } from '../api/client';
import SourceCoverage from '../components/revenue/SourceCoverage';
import { fmtRiyadh } from '../data/clock';

const REASON_TEXT = {
  missing_invoice_id: ['Missing invoice id', 'رقم الفاتورة مفقود'],
  id_scientific_notation: ['Identifier shown in scientific notation (digits lost) — not used for matching; export IDs as text', 'المعرّف بصيغة علمية (فُقدت أرقام) — لا يُستخدم للربط؛ صدّر المعرفات كنص'],
  id_decimal_suffix: ['Identifier converted to a number — export IDs as text', 'المعرّف حُوّل إلى رقم — صدّر المعرفات كنص'],
  duplicate_of_existing_record: ['Already in the ledger (not counted twice)', 'موجود في السجل (لا يُحتسب مرتين)'],
  duplicate_in_file: ['Duplicate inside the file (not counted twice)', 'مكرر داخل الملف (لا يُحتسب مرتين)'],
  missing_amanah: ['Missing Amanah', 'الأمانة مفقودة'],
  unknown_amanah: ['Unknown Amanah', 'أمانة غير معروفة'],
  missing_issue_date: ['Missing issue date', 'تاريخ الإصدار مفقود'],
  invalid_amount: ['Invalid amount (a missing number is never turned into zero)', 'مبلغ غير صالح (الرقم المفقود لا يتحول إلى صفر)'],
  non_positive_amount: ['Amount must be positive', 'يجب أن يكون المبلغ موجباً']
};
const reasonText = (code, ar) => {
  const key = Object.keys(REASON_TEXT).find((k) => code.startsWith(k));
  return key ? REASON_TEXT[key][ar ? 1 : 0] : code;
};

const VALIDATION_LABEL = {
  columns: ['Required columns present', 'الأعمدة المطلوبة متوفرة'],
  id_text: ['Identifiers kept as text, none lost to scientific notation', 'المعرفات نصية ولم يفقد أيٌّ منها دقته'],
  duplicates: ['No duplicate invoice (file or ledger)', 'لا تكرار للفواتير (في الملف أو السجل)'],
  line_dedupe: ['Report lines collapsed to one row per invoice', 'تجميع بنود التقرير في صف لكل فاتورة'],
  amounts: ['Amounts valid', 'المبالغ صالحة'],
  dates: ['Dates valid and in order', 'التواريخ صالحة ومتسلسلة'],
  amanah: ['Amanah recognised', 'الأمانة معروفة'],
  reupload: ['Not a re-upload of an earlier file', 'ليس إعادة رفع لملف سابق']
};

const OPEN_DECISIONS = [
  { d: ['Which collection-rate definition is official', 'أي تعريف لنسبة التحصيل هو الرسمي'], s: ['Collected ÷ net billed in scope is the primary rate; a rate over gross billed is always named and kept apart.', 'المحصّل ÷ صافي المفوتر ضمن النطاق هو النسبة الأساسية؛ وأي نسبة على إجمالي المفوتر تُسمّى بوضوح وتُفصل.'] },
  { d: ['Approval of exclusion rules (INC-1, EXE-1, EFA-1, NOC-1, DEC-1, OBJ-1) and their priority order', 'اعتماد قواعد الاستبعاد (INC-1, EXE-1, EFA-1, NOC-1, DEC-1, OBJ-1) وترتيب أولوياتها'], s: ['Configurable; results under unapproved rules are labelled “غير معتمدة” everywhere they appear.', 'قابلة للضبط؛ وتُوسم نتائج القواعد غير المعتمدة بـ «غير معتمدة» أينما ظهرت.'] },
  { d: ['Which raw CR statuses qualify for exclusion (Deleted / Cancelled / Suspended)', 'أي حالات السجل التجاري الخام تؤهل للاستبعاد (Deleted / Cancelled / Suspended)'], s: ['Raw status always kept; default parameter Deleted + Cancelled; nothing is excluded without human approval.', 'تُحفظ الحالة الخام دائماً؛ المعامل الافتراضي Deleted + Cancelled؛ ولا يُستبعد شيء دون اعتماد بشري.'] },
  { d: ['Treatment of VAT and amounts belonging to other beneficiaries', 'معالجة ضريبة القيمة المضافة ومبالغ الجهات المستفيدة الأخرى'], s: ['Amounts are shown as invoiced; VAT is shown separately where the source declares it; nothing collected through the entity is assumed to be its revenue.', 'تُعرض المبالغ كما فُوتّرت؛ وتُفصل الضريبة حيث يصرّح بها المصدر؛ ولا يُفترض أن كل ما حُصّل عبر الجهة إيراد لها.'] },
  { d: ['Approved collection target (amount and rate), monthly curve and its versions', 'المستهدف المعتمد للتحصيل (المبلغ والنسبة) والمنحنى الشهري وإصداراته'], s: ['Demo inputs, labelled; never derived from data and never used by the forecast.', 'مُدخلات تجريبية موسومة؛ لا تُشتق من البيانات ولا يستخدمها التنبؤ.'] },
  { d: ['Coverage denominator (eligible original budget, chapters 1–3)', 'مقام التغطية (الميزانية الأصلية المؤهلة للأبواب 1–3)'], s: ['Shown only with the approved denominator; no actual spend or revenue target is substituted.', 'تُعرض فقط مع المقام المعتمد؛ ولا يُستبدل بالمصروف الفعلي أو بمستهدف الإيراد.'] },
  { d: ['Grace period for overdue status', 'فترة السماح لحالة التأخر'], s: ['0 days (overdue the day after the due date); affects ageing only.', '0 يوم (متأخر بعد يوم الاستحقاق)؛ يؤثر في الأعمار فقط.'] },
  { d: ['Which amount is authoritative when the invoice value and its items disagree', 'أي مبلغ هو المعتمد عند اختلاف قيمة الفاتورة عن بنودها'], s: ['Flagged, never corrected; metrics use the source header amount.', 'يُعلَّم ولا يُصحَّح؛ وتستخدم المؤشرات مبلغ رأس المصدر.'] }
];

const fmtDt = (iso) => (iso ? (/Z$|[+-]\d\d:\d\d$/.test(iso) ? fmtRiyadh(iso) : iso.slice(0, 16).replace('T', ' ')) : '—');

export default function DataSources() {
  const rev = useRevenue();
  const { L, B, ar } = useL();
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [reportType, setReportType] = useState('');
  const [reportDate, setReportDate] = useState('');
  const fileRef = useRef(null);
  const { uploads, cfg } = rev;

  // all figures on this page come from the data service (counts only; invoices are never loaded into the browser)
  const [dq, setDq] = useState(null);
  useEffect(() => {
    let off = false;
    const allScope = { from: '2000-01-01', to: cfg.cutoff, amanah: 'all', source: 'all' };
    Promise.all([api.quality(rev.requestFor(allScope)), api.bridge(rev.requestFor(allScope))]).then(([q, b]) => { if (!off) setDq({ q, b }); });
    return () => { off = true; };
  }, [rev.requestFor, rev.dataVersion, cfg.cutoff]); // eslint-disable-line react-hooks/exhaustive-deps
  const importLog = useMemo(() => (dq ? buildImportLog(cfg.cutoff, { q: dq.q, counts: rev.meta?.counts || {} }) : []), [dq, cfg.cutoff, rev.meta]);
  const bridge = dq?.b;
  const rules = useMemo(() => (dq ? buildMatchRules(dq.q, dq.b) : []), [dq]);
  const quality = useMemo(() => (dq ? qualityOverview(dq.q) : { records: 0, missingMandatory: 0, amountConflicts: 0, unassignedAmanah: 0, contractUnmatched: 0, pendingExclusions: 0 }), [dq]);

  const sources = useMemo(() => SOURCE_ROLES.map((s) => {
    const entries = importLog.filter((e) => e.source === s.id);
    const latest = [...entries].sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''))[0];
    return { ...s, entries, latest, fresh: latest ? freshnessOf(latest, cfg.cutoff) : null };
  }), [cfg.cutoff, importLog]);
  const freshCount = (lvl) => sources.filter((s) => s.fresh?.level === lvl).length;
  const matchedTotal = rules.reduce((s, r) => s + r.matched, 0);
  const unmatchedTotal = rules.reduce((s, r) => s + r.unmatched, 0);

  const runImport = (table, name) => {
    setResult(importRows(table, [], { fileName: name, uploadedAt: new Date().toISOString(), reportType: reportType || null, reportDate: reportDate || null, previousImports: uploads.log }));
    setCommitted(false);
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      if (/\.xlsx?$/i.test(f.name)) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: false });
        // raw:false keeps what the sheet DISPLAYS (identifiers stay as they appear); numbers already damaged by Excel are caught by validation
        const table = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
        runImport(table, f.name);
      } else runImport(parseCsv(await f.text()), f.name);
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const commit = () => {
    if (!result || !result.accepted.length) return;
    rev.commitUpload(result);
    setCommitted(true);
  };

  const logRows = [
    ...uploads.log.map((u) => ({ user: true, source: 'tahseel', report: u.reportType, scopeType: 'central', entity: null, from: '—', to: u.uploadCutoff || '—', basis: '—', extractedAt: null, uploadedAt: u.uploadedAt, version: u.version, rows: u.rowsRead ?? u.accepted + u.rejected, accepted: u.accepted, rejected: u.rejected, note: { ar: `${u.fileName}${u.reuploadOf ? ' — إعادة رفع لنفس المحتوى' : ''}`, en: `${u.fileName}${u.reuploadOf ? ' — re-upload of the same content' : ''}` }, checksum: u.checksum })),
    ...importLog
  ].sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));

  const treat = [
    { k: 'unmatched_report', n: bridge?.unmatched.count || 0, amount: bridge?.unmatched.amount || 0, text: L('Unpaid-report invoices not found in the details report', 'فواتير تقرير غير المسدد غير الموجودة في بيان التفاصيل'), to: '/executive' },
    { k: 'unassigned', n: quality.unassignedAmanah, text: L('Central invoices with no Amanah in Makeen (shown as “unassigned”)', 'فواتير مركزية بلا أمانة في مكين (تظهر «غير محدد»)'), to: '/invoices?amanah=Unassigned' },
    { k: 'contract', n: quality.contractUnmatched, text: L('Investment invoices whose contract was not matched (kept in the base — not “no contract”)', 'فواتير استثمار لم تتم مطابقة عقدها (تبقى في الأساس — وليست «بدون عقد»)'), to: '/contracts' },
    { k: 'conflicts', n: quality.amountConflicts, text: L('Invoices whose items do not add up to the invoice value', 'فواتير لا يطابق مجموع بنودها قيمة الفاتورة'), to: '/risk' },
    { k: 'pending', n: quality.pendingExclusions, text: L('Exclusion candidates awaiting review', 'مرشحو استبعاد بانتظار المراجعة'), to: '/noncollection' },
    { k: 'efaa', n: rules.find((r) => r.id === 'M6')?.unmatched || 0, text: L('Violations whose Tahseel and Efaa statuses differ (both kept)', 'مخالفات تختلف حالتها بين تحصيل وإيفاء (تُحفظ الحالتان)'), to: '/invoices?src=fines' },
    { k: 'ocr', n: dq?.q.ocrLowConfidence || 0, text: L('CR numbers read by OCR with low confidence', 'أرقام سجل تجاري مقروءة بـ OCR بثقة منخفضة'), to: '/contracts' }
  ];

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <div className="page-title">{L('Data sources', 'مصادر البيانات')}</div>
          <div className="page-sub">{L('How current each source is, what period it covers, which version is loaded, and how completely its records match. Availability, freshness, record quality and matching are four different things.', 'مدى حداثة كل مصدر، والفترة التي يغطيها، والإصدار المحمّل، ومدى اكتمال مطابقة سجلاته. توفر المصدر وحداثته وجودة سجلاته واكتمال مطابقته أمور مختلفة.')}</div>
        </div>
        <ProvenanceBadge kind="demo" />
      </div>

      <div className="rv-callout rv-callout--warn">
        <b>{L('Demo data — not the Ministry\'s figures.', 'بيانات تجريبية — وليست أرقام الوزارة.')}</b>{' '}
        {L('Each source is assumed to arrive by direct feed or by the team uploading its report daily, weekly or monthly. The records below are generated demo data labelled “تجريبية”; real reports are loaded with the uploader at the bottom of this page.', 'يُفترض أن كل مصدر يصل بالربط المباشر أو برفع الفريق لتقريره يومياً أو أسبوعياً أو شهرياً. السجلات أدناه بيانات تجريبية مولّدة وموسومة «تجريبية»؛ وتُحمَّل التقارير الفعلية بأداة الرفع أسفل الصفحة.')}
      </div>

      <SourceCoverage />

      <div className="rv-tiles" aria-label={L('Four different questions', 'أربعة أسئلة مختلفة')}>
        <div className="rv-tile"><div className="rv-tile__label">{L('1 · Source available', '1 · توفر المصدر')}</div><div className="rv-tile__value">{sources.filter((s) => s.latest).length}/{sources.length}</div><div className="rv-tile__sub">{L('sources with a loaded report', 'مصادر لها تقرير محمّل')}</div></div>
        <div className="rv-tile"><div className="rv-tile__label">{L('2 · Data freshness', '2 · حداثة البيانات')}</div><div className="rv-tile__value">{freshCount('fresh')}<small> {L('fresh', 'حديثة')}</small></div><div className="rv-tile__sub">{freshCount('aging')} {L('ageing', 'تقادمت')} · {freshCount('stale')} {L('stale', 'قديمة')}</div></div>
        <div className="rv-tile"><div className="rv-tile__label">{L('3 · Record quality', '3 · جودة السجلات')}</div><div className="rv-tile__value">{quality.records - quality.missingMandatory - quality.amountConflicts}<small>/{quality.records}</small></div><div className="rv-tile__sub">{quality.amountConflicts} {L('amount conflicts', 'تعارض مبلغ')} · {quality.missingMandatory} {L('missing mandatory', 'حقل إلزامي ناقص')}</div></div>
        <div className="rv-tile"><div className="rv-tile__label">{L('4 · Matching completeness', '4 · اكتمال المطابقة')}</div><div className="rv-tile__value">{matchedTotal + unmatchedTotal ? Math.round((matchedTotal / (matchedTotal + unmatchedTotal)) * 100) : 0}%</div><div className="rv-tile__sub">{unmatchedTotal} {L('records need treatment', 'سجل يحتاج معالجة')}</div></div>
      </div>

      <div className="card card-pad">
        <h3 className="rv-sec-title">{L('Sources: last update, period covered, reference date, version', 'المصادر: آخر تحديث والفترة والتاريخ المرجعي والإصدار')}</h3>
        <div className="rv-table-wrap">
          <table className="rv-table">
            <thead><tr>
              <th>{L('Source', 'المصدر')}</th><th>{L('Role (field authority)', 'الدور (سلطة الحقول)')}</th><th>{L('Refresh', 'الدورية')}</th>
              <th>{L('Last upload', 'آخر رفع')}</th><th>{L('Period in the content', 'الفترة في المحتوى')}</th><th>{L('Reference date', 'التاريخ المرجعي')}</th>
              <th className="num">{L('Version', 'الإصدار')}</th><th>{L('Freshness', 'الحداثة')}</th>
            </tr></thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td><b>{B(s.name)}</b></td>
                  <td style={{ fontSize: 11.5, minWidth: 280 }} dir="auto">{B(s.role)}
                    <div style={{ marginTop: 3 }}>{s.authority.map((a, i) => <span key={i} className="rv-tag rv-tag--ok">{B(a)}</span>)}</div>
                    {s.rule && <div className="muted" style={{ marginTop: 3 }}>{B(s.rule)}</div>}
                  </td>
                  <td>{B(s.cadence)}</td>
                  <td dir="ltr">{fmtDt(s.latest?.uploadedAt)}</td>
                  <td dir="ltr" style={{ fontSize: 11.5 }}>{s.entries.map((e) => `${e.from} → ${e.to}`).filter((v, i, a) => a.indexOf(v) === i).join(' · ') || '—'}</td>
                  <td dir="ltr">{s.latest ? (s.latest.to > cfg.cutoff ? cfg.cutoff : s.latest.to) : '—'}</td>
                  <td className="num" dir="ltr">{s.latest ? `v${s.latest.version}` : '—'}</td>
                  <td>{s.fresh ? <span className={`rv-badge rv-badge--sm rv-badge--${FRESHNESS_LEVELS[s.fresh.level].tone}`}>{B(FRESHNESS_LEVELS[s.fresh.level])} · {s.fresh.ageDays} {L('d', 'يوم')}</span> : <span className="rv-badge rv-badge--sm rv-badge--na">{L('No report', 'لا تقرير')}</span>}</td>
                </tr>
              ))}
              {UNAVAILABLE_REVENUE_SOURCES.map((s) => (
                <tr key={s.id}><td><b>{B(s)}</b></td><td colSpan={6}>{L('Revenue source with no records in this demo dataset; no schema or feed is assumed.', 'مصدر إيراد بلا سجلات في بيانات هذا العرض؛ ولا يُفترض مخطط أو تغذية.')}</td><td><span className="rv-badge rv-badge--sm rv-badge--na">{L('No data', 'لا بيانات')}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rv-sec-sub" style={{ marginTop: 8 }}>{L('The period is read from the report CONTENT, not the file name. No single source is the reference for every field: each owns the fields listed in green.', 'تُقرأ الفترة من محتوى التقرير وليس من اسم الملف. ولا يوجد مصدر واحد مرجع لكل الحقول: لكل مصدر الحقول المدرجة بالأخضر.')}</p>
      </div>

      <div className="card card-pad">
        <h3 className="rv-sec-title">{L('Matching and quality results', 'نتائج المطابقة وجودة البيانات')}</h3>
        <p className="rv-sec-sub">{L('One documented rule per join: the key used, the relationship, the status, the evidence and why a record did not match. Manual review is required where marked.', 'قاعدة موثقة لكل ربط: المفتاح والعلاقة والحالة ومصدر الدليل وسبب عدم المطابقة. المراجعة اليدوية مطلوبة حيث يُشار.')}</p>
        <div className="rv-table-wrap">
          <table className="rv-table">
            <thead><tr><th>#</th><th>{L('From → To', 'من ← إلى')}</th><th>{L('Join key', 'مفتاح الربط')}</th><th>{L('Relationship', 'العلاقة')}</th><th className="num">{L('Matched', 'مطابق')}</th><th className="num">{L('Unmatched', 'غير مطابق')}</th><th className="num">{L('Pending / future', 'معلّق / مستقبلي')}</th><th>{L('Evidence', 'مصدر الدليل')}</th><th>{L('Reason when unmatched', 'سبب عدم المطابقة')}</th><th>{L('Review', 'مراجعة')}</th></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.id}</b></td>
                  <td style={{ fontSize: 11.5 }}>{B(r.from)} <span aria-hidden="true">→</span> {B(r.to)}</td>
                  <td style={{ fontSize: 11.5 }}>{B(r.key)}</td>
                  <td style={{ fontSize: 11.5 }}>{B(r.relation)}</td>
                  <td className="num">{r.matched}</td>
                  <td className="num">{r.unmatched > 0 ? <b style={{ color: 'var(--danger, #b3261e)' }}>{r.unmatched}</b> : 0}</td>
                  <td className="num">{r.pending ?? '—'}</td>
                  <td style={{ fontSize: 11.5 }}>{B(r.evidence)}</td>
                  <td style={{ fontSize: 11.5 }} dir="auto">{B(r.reason)}{r.note && <div className="muted">{B(r.note)}</div>}</td>
                  <td>{r.review ? L('Manual', 'يدوية') : L('Automatic', 'آلية')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4 className="rv-sec-title" style={{ fontSize: 13, marginTop: 14 }}>{L('Records that need treatment', 'سجلات تحتاج معالجة')}</h4>
        <ul className="rv-list">
          {treat.map((t) => (
            <li key={t.k}>
              <Link to={t.to}><b>{t.n}</b> — {t.text}</Link>
              {t.amount != null && <small className="muted"> · {L('amount', 'المبلغ')} {Math.round(t.amount).toLocaleString('en-US')} {L('SAR', 'ريال')}</small>}
            </li>
          ))}
        </ul>
      </div>

      <div className="card card-pad">
        <h3 className="rv-sec-title">{L('Import and version log', 'سجل الاستيراد والإصدارات')}</h3>
        <p className="rv-sec-sub">{L('Each load keeps its metadata. A periodic refresh adds a version; the same record is never counted twice.', 'يحتفظ كل تحميل ببياناته الوصفية. والتحديث الدوري يضيف إصداراً؛ ولا يُحتسب السجل نفسه مرتين.')}</p>
        <div className="rv-table-wrap">
          <table className="rv-table">
            <thead><tr>
              <th>{L('Source', 'المصدر')}</th><th>{L('Report type', 'نوع التقرير')}</th><th>{L('Central / internal', 'مركزي / داخلي')}</th><th>{L('Entity', 'الجهة')}</th>
              <th>{L('Period and basis', 'الفترة وأساسها')}</th><th>{L('Extracted', 'وقت الاستخراج')}</th><th>{L('Uploaded', 'وقت الرفع')}</th>
              <th className="num">{L('Version', 'الإصدار')}</th><th className="num">{L('Rows', 'الصفوف')}</th><th className="num">{L('Accepted / rejected', 'مقبول / مرفوض')}</th><th>{L('Note', 'ملاحظة')}</th>
            </tr></thead>
            <tbody>
              {logRows.map((e, i) => (
                <tr key={`${e.source}-${e.uploadedAt}-${i}`}>
                  <td>{B(SOURCE_ROLES.find((s) => s.id === e.source)?.name)}{e.user && <span className="rv-badge rv-badge--sm rv-badge--up">{L('Uploaded by you', 'رفعتَه')}</span>}</td>
                  <td dir="ltr" style={{ fontSize: 11.5 }}>{e.report}</td>
                  <td>{e.scopeType === 'internal' ? L('Internal', 'داخلي') : L('Central', 'مركزي')}</td>
                  <td>{e.entity ? B(e.entity) : '—'}</td>
                  <td dir="ltr" style={{ fontSize: 11.5 }}>{e.from} → {e.to} ({e.basis})</td>
                  <td dir="ltr">{fmtDt(e.extractedAt)}</td>
                  <td dir="ltr">{fmtDt(e.uploadedAt)}</td>
                  <td className="num" dir="ltr">v{e.version}</td>
                  <td className="num">{e.rows}</td>
                  <td className="num">{e.accepted} / {e.rejected}</td>
                  <td style={{ fontSize: 11.5 }} dir="auto">{B(e.note)}{e.checksum && <div className="muted" dir="ltr">#{e.checksum}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="rv-sec-title">{L('Upload a report', 'رفع تقرير')}</h3>
        <p className="rv-sec-sub">{L(`CSV or Excel. Required columns: ${REQUIRED.join(', ')} (a line-level unpaid report only needs invoice id, issue date and amount; the Amanah comes from Makeen). Identifiers are read as text. Records are validated, de-duplicated against the ledger and kept with their provenance and version.`, `CSV أو Excel. الأعمدة المطلوبة: ${REQUIRED.join(', ')} (تقرير غير المسدد على مستوى البنود يحتاج رقم الفاتورة وتاريخ الإصدار والمبلغ فقط؛ والأمانة من مكين). تُقرأ المعرفات كنص. تُتحقق السجلات وتُزال تكراراتها مقارنة بالسجل وتُحفظ بمصدرها وإصدارها.`)}</p>
        <div className="rv-form">
          <label>{L('Report type', 'نوع التقرير')}
            <select className="input" id="up_type" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option value="">{L('Detect from columns', 'اكتشاف من الأعمدة')}</option>
              {Object.entries(REPORT_TYPES).map(([k, v]) => <option key={k} value={k}>{B(v)}</option>)}
            </select>
          </label>
          <label>{L('Reference date (optional)', 'التاريخ المرجعي (اختياري)')}
            <input className="input" id="up_date" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </label>
          <label>{L('File', 'الملف')}
            <input ref={fileRef} id="up_file" className="input" type="file" accept=".csv,.xlsx,.xls" onChange={onFile} aria-label={L('Upload report file', 'رفع ملف تقرير')} />
          </label>
          <button type="button" className="btn btn-sm" onClick={() => runImport(parseCsv(SAMPLE_CSV), 'sample-details.csv')}>{L('Sample: invoice details', 'عيّنة: تفاصيل الفواتير')}</button>
          <button type="button" className="btn btn-sm" onClick={() => runImport(parseCsv(SAMPLE_LINES_CSV), 'sample-unpaid-lines.csv')}>{L('Sample: unpaid report (lines)', 'عيّنة: غير المسدد (بنود)')}</button>
          {busy && <span className="muted">{L('Reading…', 'جارٍ القراءة…')}</span>}
        </div>

        {result && (
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {result.missingColumns.length > 0 ? (
              <div className="rv-callout rv-callout--bad" role="alert">{L(`Required column(s) missing: ${result.missingColumns.join(', ')}. Nothing was imported — and no shifted column is repaired automatically.`, `أعمدة مطلوبة مفقودة: ${result.missingColumns.join(', ')}. لم يُستورد شيء — ولا يُصلَح أي عمود منزاح تلقائياً.`)}</div>
            ) : (
              <>
                {result.meta.reuploadOf && <div className="rv-callout rv-callout--warn" role="status"><b>{L('Same content as an earlier upload', 'نفس محتوى رفع سابق')}</b> — {fmtDt(result.meta.reuploadOf)}. {L('Records already in the ledger are skipped, so nothing is counted twice.', 'السجلات الموجودة في السجل تُتخطى فلا يُحتسب شيء مرتين.')}</div>}
                <div className="rv-tiles">
                  <div className="rv-tile rv-tile--good"><div className="rv-tile__label">{L('Accepted invoices', 'فواتير مقبولة')}</div><div className="rv-tile__value">{result.accepted.length}</div></div>
                  <div className={`rv-tile${result.rejected.length ? ' rv-tile--bad' : ''}`}><div className="rv-tile__label">{L('Rejected', 'مرفوض')}</div><div className="rv-tile__value">{result.rejected.length}</div></div>
                  <div className="rv-tile"><div className="rv-tile__label">{L('Lines → invoices', 'بنود ← فواتير')}</div><div className="rv-tile__value" dir="ltr">{result.linesRead} → {result.rowsRead}</div></div>
                  <div className="rv-tile"><div className="rv-tile__label">{L('Report type · version', 'نوع التقرير · الإصدار')}</div><div className="rv-tile__value" dir="ltr" style={{ fontSize: 14 }}>{result.meta.reportType} · v{result.meta.version}</div></div>
                </div>
                <ul className="rv-list" aria-label={L('Validation checks', 'فحوصات التحقق')}>
                  {result.validations.map((v) => (
                    <li key={v.id}>
                      <span className={`rv-badge rv-badge--sm ${v.ok ? 'rv-badge--good' : 'rv-badge--bad'}`}>{v.ok ? L('OK', 'سليم') : `${v.count}`}</span> {VALIDATION_LABEL[v.id]?.[ar ? 1 : 0] || v.id}{v.info ? <small className="muted"> · {v.count} {L('lines merged', 'بنداً مدموجاً')}</small> : null}
                    </li>
                  ))}
                </ul>
                {result.rejected.length > 0 && (
                  <div className="rv-table-wrap"><table className="rv-table" style={{ minWidth: 0 }}>
                    <thead><tr><th>{L('Row', 'الصف')}</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Why rejected', 'سبب الرفض')}</th></tr></thead>
                    <tbody>{result.rejected.map((r) => <tr key={r.row}><td className="num">{r.row}</td><td dir="ltr">{r.id || '—'}</td><td>{r.reasons.map((x) => reasonText(x, ar)).join('؛ ')}</td></tr>)}</tbody>
                  </table></div>
                )}
                {result.warnings.length > 0 && <div className="rv-callout rv-callout--warn">{result.warnings.map((w) => `${w.id}: ${w.warnings.join(', ')}`).join(' · ')}</div>}
                {result.afterCutoff > 0 && <div className="rv-callout rv-callout--warn">{L(`${result.afterCutoff} record(s) are dated after the analysis reference date and are not counted.`, `${result.afterCutoff} سجلاً مؤرخاً بعد التاريخ المرجعي للتحليل ولا يُحتسب.`)}</div>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={commit} disabled={!result.accepted.length || committed || !rev.canReview}>{committed ? L('Imported', 'تم الاستيراد') : L(`Import ${result.accepted.length} accepted invoice(s)`, `استيراد ${result.accepted.length} فاتورة مقبولة`)}</button>
                  {!rev.canReview && <span className="muted">{L('Read-only role: cannot import.', 'دور للقراءة فقط: لا يمكن الاستيراد.')}</span>}
                  {committed && <span className="muted">{L('Imported records are labelled “Uploaded data” and flow into every metric through the shared layer.', 'السجلات المستوردة موسومة «بيانات مرفوعة» وتدخل في كل المؤشرات عبر الطبقة المشتركة.')}</span>}
                </div>
              </>
            )}
          </div>
        )}
        {uploads.log.length > 0 && <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={rev.clearUploads} disabled={!rev.canReview}>{L('Remove all uploaded records', 'إزالة جميع السجلات المرفوعة')}</button>}
      </div>

      <div className="card card-pad">
        <h3 className="rv-sec-title">{L('Open business decisions and the safe default in use', 'قرارات الأعمال المفتوحة والافتراض الآمن المستخدم')}</h3>
        <div className="rv-table-wrap">
          <table className="rv-table">
            <thead><tr><th>{L('Decision', 'القرار')}</th><th>{L('Safe default in this demo', 'الافتراض الآمن في هذا العرض')}</th></tr></thead>
            <tbody>{OPEN_DECISIONS.map((x, i) => <tr key={i}><td dir="auto">{x.d[ar ? 1 : 0]}</td><td dir="auto" style={{ fontSize: 12 }}>{x.s[ar ? 1 : 0]}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
