import React from 'react';
import { useParams } from 'react-router-dom';
import { useL } from '../../utils/bi';
import { useAsync } from '../../utils/useAsync';
import { furas } from '../../api/furasClient';
import { RecordHeader, Section, RecordState } from '../../components/record/RecordPage';
import { DatasetBanner, NA, Tag, UnavailableList } from '../../components/furas/FurasParts';

const FLAG = { out_of_range: { en: 'to validate (out of range)', ar: 'للتحقق (خارج النطاق)' }, epoch: { en: 'to validate (1970)', ar: 'للتحقق (1970)' }, hijri_like: { en: 'to validate (Hijri-like year, not converted)', ar: 'للتحقق (سنة تشبه الهجرية، دون تحويل)' }, after_extract: { en: 'to validate (after the extract date)', ar: 'للتحقق (بعد تاريخ الاستخراج)' }, unreadable: { en: 'unreadable', ar: 'غير مقروء' } };

// One contract NUMBER in FURAS DATASET MODE: every record that carries it, the payment rows of the capped extract listed once, and what the exports cannot say.
export default function FurasContract() {
  const { no: raw } = useParams(); const no = decodeURIComponent(raw || '');
  const { L, B, ar, count, sar } = useL();
  const { data: c, loading, error } = useAsync(() => furas.contract(no), [no]);
  const { data: S } = useAsync(() => furas.summary(), []);
  const crumbs = [{ label: L('Contracts', 'العقود'), to: '/contracts' }, { label: no, ltr: true }];
  if (!c) return <div className="rp"><RecordHeader crumbs={crumbs} title={no} /><RecordState loading={loading && !error} error={error && error.status !== 404 ? error : null} notFound={!loading && error?.status === 404} kind={L('Contract number', 'رقم العقد')} backTo={{ path: '/contracts', label: L('Back to the contracts', 'العودة إلى العقود') }} /></div>;
  const val = (v, f = sar) => (v == null ? <NA /> : f(v));
  const date = (v, flag) => (v == null ? <NA /> : <><span dir="ltr">{v}</span>{flag && <> <Tag tone="proposed">{B(FLAG[flag])}</Tag></>}</>);
  const diff = (f) => c.differingFields.includes(f) && <> <Tag tone="proposed">{L('differs between records', 'يختلف بين السجلات')}</Tag></>;
  return (
    <div className="rp">
      <RecordHeader crumbs={crumbs} kind={L('Contract number', 'رقم عقد')} title={c.contractNumber} statuses={<><span className="rv-tag">{L(`${c.recordCount} record(s) carry this number`, `${c.recordCount} سجل يحمل هذا الرقم`)}</span> <Tag tone="proposed">{L('current record not determined', 'السجل الحالي غير محدد')}</Tag></>} />
      <DatasetBanner S={S} />
      <div className="rp-limit">{L('A contract number is not a record key. Each record below is shown as stored; where records disagree the difference is marked and no record is chosen. Contract values are never summed across records.', 'رقم العقد ليس مفتاح سجل. يُعرض كل سجل أدناه كما هو؛ وحيث تختلف السجلات يُوسَم الاختلاف ولا يُختار سجل. ولا تُجمع قيم العقد بين السجلات.')}</div>
      <Section id="records" title={L('Contract records', 'سجلات العقد')} count={c.recordCount}>
        <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Contract records', 'سجلات العقد')}>
          <thead><tr><th>{L('Record', 'السجل')}</th><th>{L('Opportunity no.', 'رقم الفرصة')}</th><th>{L('Service type', 'نوع الخدمة')}</th><th>{L('Status (as stored)', 'الحالة (كما هي)')}</th><th>{L('Awarding', 'الترسية')}</th><th>{L('Signing', 'التوقيع')}</th><th>{L('Start', 'البداية')}</th><th>{L('End', 'النهاية')}</th><th className="num">{L('Contract value', 'قيمة العقد')}</th><th className="num">{L('Annual value', 'القيمة السنوية')}</th><th>{L('Amanah (source)', 'الأمانة (المصدر)')}</th><th>{L('Renewal link', 'رابط التجديد')}</th></tr></thead>
          <tbody>{c.records.map((r, i) => (
            <tr key={i}>
              <td dir="ltr">{r.recordKey}<div className="muted" style={{ fontSize: 11 }} dir="ltr">{L('investor', 'المستثمر')} {r.investorId || '—'}</div></td>
              <td dir="ltr">{r.opportunityNumber || <NA />}{diff('opportunityNumber')}</td>
              <td dir="auto">{r.contractType || <NA />}{diff('contractType')}</td>
              <td dir="auto">{r.status || <NA />}{r.rentalStatus && <div className="muted" style={{ fontSize: 11 }}>{L('rental status', 'حالة التأجير')}: {r.rentalStatus}</div>}{diff('status')}</td>
              <td>{date(r.awardingDate, r.dateFlags.awardingdate)}</td><td>{date(r.signingDate, r.dateFlags.signingdate)}</td><td>{date(r.startDate, r.dateFlags.startdate)}{diff('startDate')}</td><td>{date(r.endDate, r.dateFlags.enddate)}{diff('endDate')}</td>
              <td className="num" dir="ltr">{val(r.contractValue)}{diff('contractValue')}</td><td className="num" dir="ltr">{val(r.annualValue)}{diff('annualValue')}</td>
              <td dir="auto">{r.municipality ? `${r.municipality.code} · ${r.municipality.sourceName}` : <NA />}{r.municipality?.flag && <> <Tag tone="proposed">{L('entity scope to be confirmed', 'نطاق الجهة بانتظار التأكيد')}</Tag></>}</td>
              <td dir="auto">{r.renewalLink == null ? '—' : !r.renewalLink.resolved ? L('target record not found', 'السجل المستهدف غير موجود') : r.renewalLink.selfReference ? L('points to itself (to review)', 'يشير إلى نفسه (للمراجعة)') : <span dir="ltr">{r.renewalLink.contractNumber}{r.renewalLink.sameContractNumber ? ` (${L('same number', 'الرقم نفسه')})` : ''}</span>}</td>
            </tr>))}</tbody>
        </table></div>
      </Section>
      <Section id="payments" title={L('Payment rows in the capped extract', 'صفوف الدفعات في المستخرج المحدود')} count={c.payments.rowsInExtract}
        note={<div className="rp-limit">{L('Each row is listed once and is never joined to the contract amounts above. These are the rows the extract holds for this number: not a complete schedule, so there is no “n of N”, no total, no collected or unpaid amount. Amounts are the scheduled values as stored.', 'يُعرض كل صف مرة واحدة ولا يُربط بمبالغ العقد أعلاه. هذه الصفوف التي يحملها المستخرج لهذا الرقم: ليست جدولاً كاملاً، فلا «دفعة س من ص» ولا إجمالي ولا مبلغ محصّل أو غير مسدّد. المبالغ هي القيم المجدولة كما هي.')}</div>}>
        {c.payments.rowsInExtract ? (
          <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Payment rows', 'صفوف الدفعات')}>
            <thead><tr><th className="num">{L('Batch no.', 'رقم الدفعة')}</th><th>{L('Batch year', 'سنة الدفعة')}</th><th>{L('Status (as stored)', 'الحالة (كما هي)')}</th><th>{L('Type', 'النوع')}</th><th>{L('Frequency', 'الدورية')}</th><th>{L('Due date', 'الاستحقاق')}</th><th>{L('Invoice date', 'تاريخ الفاتورة')}</th><th>{L('Payment date', 'تاريخ السداد')}</th><th className="num">{L('Scheduled amount', 'المبلغ المجدول')}</th><th className="num">{L('Balance (as stored)', 'الرصيد (كما هو)')}</th><th>{L('Opportunity no.', 'رقم الفرصة')}</th></tr></thead>
            <tbody>{c.payments.rows.map((p, i) => (
              <tr key={i}>
                <td className="num" dir="ltr">{p.batchNumber ?? <NA />}</td><td dir="ltr">{p.batchYear ?? <NA />}</td><td dir="auto">{p.status || <NA />}</td><td>{p.paymentType || <NA />}</td><td>{p.method || <NA />}</td>
                <td>{date(p.dueDate, p.dateFlags.dueDate)}</td><td>{date(p.invoiceDate, p.dateFlags.invoiceDate)}</td><td>{date(p.paymentDate, p.dateFlags.paymentDate)}</td>
                <td className="num" dir="ltr">{val(p.amount)}</td><td className="num" dir="ltr">{val(p.balance)}</td>
                <td dir="ltr">{p.opportunityNumber || <NA />}{p.recordsWithSameOpportunity > 1 && <div><Tag tone="proposed">{L(`matches ${p.recordsWithSameOpportunity} records`, `يطابق ${p.recordsWithSameOpportunity} سجلات`)}</Tag></div>}{p.recordsWithSameOpportunity === 0 && <div><Tag tone="proposed">{L('no record with this opportunity number', 'لا سجل بهذا رقم الفرصة')}</Tag></div>}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <div className="muted">{L('No payment row for this number in the extract. That is not evidence that none exists: the extract is a limited sample.', 'لا صف دفعات لهذا الرقم في المستخرج. وهذا ليس دليلاً على عدم وجود دفعات: المستخرج عيّنة محدودة.')}</div>}
      </Section>
      <Section id="cases" secondary title={L('Case rows (ContractManagement)', 'صفوف الحالات (ContractManagement)')} count={c.caseRows.count}>
        <div className="rp-limit">{L('Workflow cases that name this contract number or one of its opportunity numbers. They are cases, not payments or invoices.', 'حالات سير عمل تذكر رقم العقد أو أحد أرقام فرصه. هي حالات وليست دفعات أو فواتير.')}</div>
        {c.caseRows.byLabel.length ? <div className="rp-tablewrap" tabIndex={0}><table><tbody>{c.caseRows.byLabel.map((x) => <tr key={String(x.value)}><td dir="auto">{x.value || <NA />}</td><td className="num" dir="ltr">{count(x.rows)}</td></tr>)}</tbody></table></div> : <div className="muted">{L('None in the exports.', 'لا شيء في التصديرات.')}</div>}
      </Section>
      <Section id="na" secondary title={L('Not available in the current data', 'غير متاح في البيانات الحالية')}><UnavailableList /></Section>
    </div>
  );
}
