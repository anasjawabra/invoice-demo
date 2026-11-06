import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useSourceRecords } from '../context/SourceRecordsContext';
import { useAsync } from '../utils/useAsync';
import { useL } from '../utils/bi';
import { RecordHeader, StatusGroup, Figures, Facts, Section, RecordState } from '../components/record/RecordPage';
import { RecordLink, useReturnTarget } from '../utils/returnContext';
import { invoicePath, ordersListPath } from '../utils/paths';
import { METHODS, SOURCES, REPORTS, reportById } from '../data/ingestion/reports';
import { PayStatusChip } from '../components/revenue/EnforcementUI';
import { EXECUTION_BASIS, AMOUNT_DEFINITION, sourceStatuses } from '../data/ingestion/eefaa';
import { RELATION_STATUS, RELATION_RULE } from '../data/ingestion/relations';
import { ID_FLAG } from '../data/ingestion/ids';
import { FIELD_FLAG_LABEL } from '../data/ingestion/importer';
import { ExecChip, RelationChip, EefaaAmount, when, maskId } from '../components/revenue/EnforcementSources';
import SectionNav, { Info } from '../components/revenue/SectionNav';
import InvoiceDetailsTable from '../components/revenue/InvoiceDetailsTable';
import '../styles/enforcement-details.css';

const CMP_LABEL = { sadadNo: { ar: 'رقم السداد', en: 'Sadad number' }, amount: { ar: 'المبلغ', en: 'Amount' }, amanah: { ar: 'الأمانة', en: 'Amanah' } };
const FIELD_LABEL = { violationNo: { ar: 'رقم المخالفة (مرشّح)', en: 'Violation number (candidate)' }, serialNo: { ar: 'الرقم التسلسلي', en: 'Serial number' }, entity: { ar: 'الجهة', en: 'Entity' }, amanah: { ar: 'الأمانة', en: 'Amanah' }, city: { ar: 'المدينة', en: 'City' },
  category: { ar: 'تصنيف المخالفة', en: 'Violation category' }, amount: { ar: 'قيمة المخالفة', en: 'Violation amount' }, violationDate: { ar: 'تاريخ المخالفة', en: 'Violation date' }, claimNoticeDate: { ar: 'تاريخ استلام رسالة المطالبة', en: 'Claim notice received' },
  completionStatus: { ar: 'حالة الإكتمال', en: 'Completion status' }, executionRequestStatus: { ar: 'حالة طلب التنفيذ', en: 'Execution request status' }, executionNo: { ar: 'رقم التنفيذ (كما سُمّي في المصدر)', en: 'Execution number (as labelled in the source)' },
  referralDate: { ar: 'تاريخ الرفع للتنفيذ', en: 'Referred to execution' }, executionDate: { ar: 'تاريخ التنفيذ', en: 'Execution date' }, sadadNo: { ar: 'رقم السداد', en: 'Sadad number' }, invoiceStatus: { ar: 'حالة الفاتورة', en: 'Invoice status' },
  efaaStatus: { ar: 'حالة إيفاء', en: 'Eefaa status' }, sadadStatus: { ar: 'حالة سداد', en: 'Sadad status' }, sadadAmount: { ar: 'مبلغ سداد', en: 'Sadad amount' }, businessRef: { ar: 'المرجع التجاري', en: 'Business reference' }, resolutionRef: { ar: 'مرجع القرار', en: 'Resolution reference' },
  bookingType: { ar: 'نوع الحجز', en: 'Booking type' }, fineDescription: { ar: 'وصف الغرامة', en: 'Fine description' }, periodCount: { ar: 'عدد أو فترة', en: 'Count or period' }, createdDate: { ar: 'تاريخ الإنشاء', en: 'Created' }, paymentDate: { ar: 'تاريخ الدفع', en: 'Payment date' },
  cancellationDate: { ar: 'تاريخ الإلغاء', en: 'Cancellation date' }, identityNo: { ar: 'رقم الهوية', en: 'Identity number' }, violatorId: { ar: 'هوية المخالف', en: 'Violator id' }, ownerId: { ar: 'معرّف المالك', en: 'Owner id' }, fullName: { ar: 'الاسم الكامل', en: 'Full name' }, violatorName: { ar: 'اسم المخالف', en: 'Violator name' }, violationTypeId: { ar: 'معرّف نوع المخالفة', en: 'Violation type id' }, inspectionType: { ar: 'نوع التفتيش', en: 'Inspection type' }, insertDate: { ar: 'تاريخ الإدخال', en: 'Inserted' }, referenceId: { ar: 'الرقم المرجعي', en: 'Reference id' } };


// the summary of the violation: every business field the reports can supply, in one place, with the report(s) behind each value; a field no imported report carries is said to be missing (never left out)
const SUMMARY = [
  ['identity', { ar: 'الهوية والتصنيف', en: 'Identity and classification' }, ['violationNo', 'serialNo', 'businessRef', 'resolutionRef', 'violationTypeId', 'category', 'bookingType', 'inspectionType', 'fineDescription']],
  ['where', { ar: 'الجهة والموقع', en: 'Entity and location' }, ['entity', 'amanah', 'city']],
  ['violator', { ar: 'المخالف (بيانات شخصية مخفية)', en: 'Violator (personal data masked)' }, ['violatorName', 'fullName', 'identityNo', 'violatorId', 'ownerId']],
  ['money', { ar: 'المبالغ وحالة السداد', en: 'Amounts and payment status' }, ['amount', 'sadadAmount', 'sadadNo', 'invoiceStatus', 'efaaStatus', 'sadadStatus', 'periodCount']],
  ['dates', { ar: 'التواريخ', en: 'Dates' }, ['violationDate', 'claimNoticeDate', 'createdDate', 'insertDate', 'paymentDate', 'cancellationDate']],
  ['execution', { ar: 'التنفيذ (كما يذكره المصدر)', en: 'Execution (as stated by the source)' }, ['completionStatus', 'executionRequestStatus', 'executionNo', 'referralDate', 'executionDate']]
];
// the key facts of the violation: a compact grid, each value with small numbered badges for the report(s) behind it (ONE legend maps badge -> report); a field no imported report carries is said to be missing
function DetailsSection({ g, L, B, sar }) {
  const all = REPORTS.filter((r) => r.source === 'eefaa'); const numOf = (id) => { const i = all.findIndex((r) => r.id === id); return i < 0 ? '•' : i + 1; };
  const show = (f) => { if (f.value == null) return <span className="muted">{L('Not available in the imported reports', 'غير متوفر في التقارير المستوردة')}</span>; if (f.personal) return <span dir="ltr">{maskId(f.value)}</span>; if (f.name === 'amount' || f.name === 'sadadAmount') return <span dir="ltr">{sar(f.value)}</span>; return <span dir="auto">{String(f.value)}</span>; };
  const badges = (f) => { const ids = [...new Set(f.sources.map((x) => x.report))]; return ids.length ? <span className="ed-rbs">{ids.map((id) => { const tip = `${B(reportById(id)?.label)} · ${f.sources.filter((x) => x.report === id).map((x) => x.label).join('، ')}`; return <span key={id} className="ed-rb" role="img" aria-label={tip} title={tip}>{numOf(id)}</span>; })}</span> : null; };
  return (
    <Section id="details" title={L('Violation details', 'تفاصيل المخالفة')}>
      <ul className="ed-legend" aria-label={L('Legend: the number beside a value is the report that supplied it', 'دليل الأرقام: الرقم بجانب القيمة هو التقرير الذي زوّد بها')}>
        {all.map((r, i) => <li key={r.id}><span className="ed-rb" aria-hidden="true">{i + 1}</span><span>{B(r.label)}</span>{g.reports.includes(r.id) ? <span className="rv-tag rv-tag--ok">{L('supplied', 'وردت')}</span> : <span className="ed-legend__off">{L('not in the imported file', 'غير موجودة في الملف المستورد')}</span>}</li>)}
      </ul>
      <Info>
        {g.grouping === 'candidate_violation_number' && <p style={{ margin: '0 0 6px' }}>{L('The report rows below are grouped because they carry an EQUAL candidate violation number. That equality is not a confirmed identity: the data owner has not confirmed that «رقم المخالفة», «Finenumber» and «رقم الغرامة» are the same identifier or that it is unique.', 'جُمعت صفوف التقارير أدناه لأنها تحمل رقم مخالفة مرشّحاً متساوياً. وهذا التساوي ليس هوية مؤكدة: لم يؤكد مالك البيانات أن «رقم المخالفة» و«Finenumber» و«رقم الغرامة» معرّف واحد وأنه فريد.')}</p>}
        <p style={{ margin: 0 }}>{L('Everything the imported Eefaa reports say about this violation, grouped. Each value is numbered with the report it came from; where reports disagree both values are kept. A blank means no imported report carries the field — not that the violation lacks it.', 'كل ما تقوله تقارير إيفاء المستوردة عن هذه المخالفة، مجمّعاً. وتُرقَّم كل قيمة برقم التقرير الذي جاءت منه؛ وعند اختلاف التقارير تُحفظ القيمتان. والفراغ يعني أن لا تقرير مستورداً يحمل الحقل — لا أن المخالفة تخلو منه.')}</p>
      </Info>
      {SUMMARY.map(([key, title, names]) => { const list = names.map((n) => g.fields[n]).filter((f) => f && (f.value != null || f.sources.length || f.flags.length)); const missing = names.filter((n) => !g.fields[n] || (g.fields[n].value == null && !g.fields[n].sources.length && !g.fields[n].flags.length)); return (
        <div key={key} className="ed-group">
          <h3 className="ed-group__t">{B(title)}</h3>
          {list.length > 0 ? <dl className="ed-grid">{list.map((f) => <div key={f.name} className={`ed-cell${f.conflict ? ' ed-cell--conflict' : ''}`}><dt>{B(FIELD_LABEL[f.name] || { ar: f.name, en: f.name })}</dt><dd>{show(f)}{f.conflict && <span className="rv-tag rv-tag--bad" title={f.values.join(' · ')}>{L('reports differ', 'التقارير تختلف')}</span>}{badges(f)}</dd></div>)}</dl> : null}
          {missing.length > 0 && <p className="ed-missing">{list.length ? L('Not available in the imported reports: ', 'غير متوفر في التقارير المستوردة: ') : L('Not available in the imported reports — no imported report carries these fields: ', 'غير متوفر في التقارير المستوردة — لا تقرير مستورداً يحمل هذه الحقول: ')}{missing.map((n) => B(FIELD_LABEL[n] || { ar: n, en: n })).join('، ')}</p>}
        </div>); })}
    </Section>
  );
}

// the details page of one Eefaa violation (a group of report rows that share an EQUAL candidate violation number, or one report row)
export default function EefaaViolationPage() {
  const { key: raw } = useParams(); const key = decodeURIComponent(raw || '');
  const rev = useRevenue(); const sr = useSourceRecords(); const { L, B, ar, sar } = useL();
  const ret = useReturnTarget({ path: '/enforcement?view=eefaa', label: L('Enforcement orders management', 'إدارة أوامر التنفيذ') });
  const g = sr.groups.find((x) => x.key === key); const rel = sr.relations.byGroup.get(key);
  const [note, setNote] = useState({}); const [msg, setMsg] = useState(null);
  const asked = useMemo(() => (g ? g.sadadNumbers.map((v) => ({ kind: 'sadad_no', value: String(v) })) : []), [g]);
  const askKey = asked.map((x) => x.value).join('|');
  const { data: resolved } = useAsync(() => (asked.length ? rev.enforcement.resolve(asked) : Promise.resolve({ results: [] })), [askKey, rev.dataVersion]);
  const crumbs = [{ label: L('Dashboards and reports', 'لوحة المعلومات والتقارير'), to: '/insights' }, { label: L('Enforcement orders management', 'إدارة أوامر التنفيذ'), to: '/enforcement?view=eefaa' }, { label: g?.violationNo || key, ltr: true }];
  if (!sr.ready) return <div className="rp"><RecordHeader crumbs={crumbs} title={key} ret={ret} /><RecordState loading kind={L('Eefaa violation', 'مخالفة إيفاء')} /></div>;
  if (!g) return <div className="rp"><RecordHeader crumbs={crumbs} title={key} ret={ret} /><RecordState notFound kind={L('Eefaa violation', 'مخالفة إيفاء')} backTo={{ path: '/enforcement?view=eefaa', label: L('Back to Eefaa violations', 'العودة إلى مخالفات إيفاء') }} /></div>;

  const val = (f) => (f.personal ? maskId(f.value) : f.value);
  const names = Object.keys(g.fields).filter((n) => g.fields[n].sources.length || g.fields[n].flags.length);
  const stat = sourceStatuses(g);
  const byRef = new Map((resolved?.results || []).map((x) => [x.ref?.value || x.value, x]));
  const invoiceRows = []; for (const sd of g.sadadNumbers) for (const c of (byRef.get(String(sd))?.candidates || [])) if (!invoiceRows.some((x) => x.invoiceId === c.invoiceId)) invoiceRows.push(c);
  const entity = g.fields.amanah?.value || g.fields.entity?.value;
  const lastImport = g.lastImportedAt; const batches = [...new Set(g.records.map((r) => r.ingestion.batchId))];
  return (
    <div className="rp ed">
      <RecordHeader crumbs={crumbs} ret={ret} kind={L('Eefaa violation', 'مخالفة إيفاء')} title={g.violationNo || g.records[0].keyValue} id={g.violationNo || g.records[0].keyValue}
        statuses={<>
          <StatusGroup label={L('Record type', 'نوع السجل')}>{L('Violation record (not an enforcement order)', 'سجل مخالفة (وليس أمر تنفيذ)')}</StatusGroup>
          <StatusGroup label={L('Execution basis', 'أساس التنفيذ')} hint={L('Only what a source report states', 'فقط ما يذكره تقرير مصدري')}><ExecChip basis={g.execution.basis} /></StatusGroup>
        </>} />
      <div id="summary" className="ed-anchor">
        <Figures label={L('Key figures', 'أرقام رئيسية')} items={[
          { label: L('Violation amount', 'قيمة المخالفة'), value: <EefaaAmount g={g} />, note: <Info summary={L('What is this amount?', 'ما هذا المبلغ؟')}>{B(AMOUNT_DEFINITION)}</Info>, tone: g.fields.amount?.conflict ? 'warn' : undefined },
          { label: L('Supplying reports', 'التقارير المصدرية'), value: g.reports.length },
          { label: L('Linked invoices', 'الفواتير المرتبطة'), value: invoiceRows.length, note: L('by an exact Sadad-number match', 'بمطابقة تامة لرقم السداد') },
          { label: L('Last read', 'آخر قراءة'), value: when(lastImport) }
        ]} />
      </div>
      <SectionNav items={[
        { id: 'summary', label: L('Summary', 'الملخص') },
        { id: 'details', label: L('Details', 'التفاصيل') },
        { id: 'invoices', label: L('Linked invoices', 'الفواتير المرتبطة'), count: invoiceRows.length }
      ]} />
      {msg && <div className="rv-callout ed-msg" role="status" aria-live="polite">{msg.text}</div>}

      <DetailsSection g={g} L={L} B={B} sar={sar} />

      <Section id="invoices" title={L('Linked invoices', 'الفواتير المرتبطة')} count={invoiceRows.length}>
        {invoiceRows.length ? <InvoiceDetailsTable rows={invoiceRows} /> : <p className="muted">{g.sadadNumbers.length ? L('No invoice in the demo ledger carries this violation’s Sadad number.', 'لا فاتورة في السجل التجريبي تحمل رقم سداد هذه المخالفة.') : L('This violation has no Sadad number in the data read, so no invoice is shown.', 'لا رقم سداد لهذه المخالفة في البيانات المقروءة، فلا فاتورة معروضة.')}</p>}
      </Section>
    </div>
  );
}
