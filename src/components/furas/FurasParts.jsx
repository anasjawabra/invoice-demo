import React from 'react';
import { useL } from '../../utils/bi';
import { NOT_AVAILABLE } from '../../data/contractRules';
import { Chip, NaCell, BarList, Icon } from './FurasUI';
import { storedText } from '../../data/furasLabels';

// Shared pieces of the FURAS DATASET MODE pages. Every number comes from the local exports through /api/furas/*; nothing here is generated.
export function NA({ why }) { const { B } = useL(); return <span className="fu-na" title={why}>{B(NOT_AVAILABLE)}</span>; }
export const Tag = ({ children, tone = '' }) => <Chip tone={tone === 'proposed' ? 'warn' : tone || 'value'}>{children}</Chip>;

// identity and coverage of the dataset on ONE line; the files table opens on demand
export function DatasetBanner({ S }) {
  const { L, count } = useL();
  if (!S) return null;
  const d = S.dataset; const capped = d.files.filter((f) => f.scope === 'capped_sample');
  return (
    <div className="fu-strip" role="note">
      <span className="fu-strip__dot" aria-hidden="true" />
      <span><b>{L('Furas exports', 'تصديرات فرص')}</b> · {L('extract', 'الاستخراج')} <b dir="ltr">{d.extract}</b> <span className="muted" dir="ltr">(ETL {String(d.etl).slice(0, 10)})</span></span>
      <span>{L('Local copy — not in Git, builds or logs', 'نسخة محلية — ليست في Git ولا الإصدارات ولا السجلات')}</span>
      {capped.length > 0 && <Chip tone="warn" icon="alert" title={L('The cap rule is not documented', 'قاعدة الحد غير موثّقة')}>{L(`Limited samples: ${capped.map((f) => f.view).join(', ')}`, `عيّنات محدودة: ${capped.map((f) => f.view).join('، ')}`)}</Chip>}
      <details>
        <summary>{L('Files and coverage', 'الملفات والتغطية')}</summary>
        <table aria-label={L('Files and coverage', 'الملفات والتغطية')}><thead><tr><th>{L('View', 'العرض')}</th><th className="num">{L('Rows', 'الصفوف')}</th><th className="num">{L('Columns', 'الأعمدة')}</th><th>{L('Coverage', 'التغطية')}</th></tr></thead>
          <tbody>{d.files.map((f) => <tr key={f.key}><td dir="ltr">{f.view}</td><td className="num" dir="ltr">{count(f.rows)}</td><td className="num" dir="ltr">{f.columns} ({f.schemaColumns} + 2 ETL)</td>
            <td>{f.scope === 'capped_sample' ? <Chip tone="warn">{L('Limited sample — exactly 10,000 rows', 'عيّنة محدودة — 10,000 صف بالضبط')}</Chip> : <span className="muted">{L('Not capped at 10,000 rows; completeness not confirmed', 'غير مقيّد بـ10,000 صف؛ الاكتمال غير مؤكد')}</span>}</td></tr>)}</tbody></table>
      </details>
    </div>
  );
}

// the limits that follow from the files themselves — every figure is computed from them
export function LimitsPanel({ S }) {
  const { L, count } = useL();
  if (!S) return null;
  const c = S.contracts; const p = S.payments; const cs = S.cases;
  const items = [
    [L('Payment extract', 'مستخرج الدفعات'), L(`${count(p.rows)} rows (a limited sample) covering ${count(p.distinctNumbers)} contract numbers. Complete schedules, “n of N”, installment totals per contract and “due without invoice” cannot be derived from it, so none is shown.`, `${count(p.rows)} صفاً (عيّنة محدودة) تغطي ${count(p.distinctNumbers)} رقم عقد. لا يمكن اشتقاق جداول كاملة ولا «دفعة س من ص» ولا مجاميع الأقساط لكل عقد ولا «مستحقة بلا فاتورة» منها، فلا يُعرض شيء منها.`)],
    [L('Contract numbers', 'أرقام العقود'), L(`${count(c.records)} contract records carry ${count(c.distinctNumbers)} distinct numbers: ${count(c.numbersWithSeveralRecords)} numbers have several records (${count(c.recordsInRepeatedNumbers)} records, up to ${c.maxRecordsPerNumber} on one number). The data does not say which record is current, so none is chosen and conflicting values are never summed.`, `${count(c.records)} سجل عقد تحمل ${count(c.distinctNumbers)} رقماً مميزاً: ${count(c.numbersWithSeveralRecords)} رقماً له عدة سجلات (${count(c.recordsInRepeatedNumbers)} سجلاً، حتى ${c.maxRecordsPerNumber} على رقم واحد). لا تحدد البيانات أي سجل هو الحالي، فلا يُختار أي سجل ولا تُجمع القيم المتعارضة.`)],
    [L('Payment ↔ contract match', 'مطابقة الدفعة بالعقد'), L(`Every payment contract number (${count(p.numbersFoundInContract)} of ${count(p.distinctNumbers)}) exists in the Contract view, but ${count(p.rowsMatchingSeveralRecords)} payment rows match 2 or more contract records. Joining amounts would give ${count(p.rowsAfterNumberJoin)} rows instead of ${count(p.rows)}; payments are therefore listed once and never joined to contract amounts.`, `كل رقم عقد في الدفعات (${count(p.numbersFoundInContract)} من ${count(p.distinctNumbers)}) موجود في عرض العقود، لكن ${count(p.rowsMatchingSeveralRecords)} صف دفعات يطابق سجلي عقد أو أكثر. ربط المبالغ كان سيعطي ${count(p.rowsAfterNumberJoin)} صفاً بدل ${count(p.rows)}؛ لذا تُعرض الدفعات مرة واحدة ولا تُربط بمبالغ العقود.`)],
    [L('Collection', 'التحصيل'), L(`The collected-amount field is filled in ${count(p.collectedFieldFilled)} of ${count(p.rows)} payment rows. Collected amounts, unpaid balances and the collection rate are not available: they need Tahseel and a validated invoice-to-payment match.`, `حقل المبلغ المحصّل معبّأ في ${count(p.collectedFieldFilled)} من ${count(p.rows)} صف دفعات. المبالغ المحصّلة والأرصدة غير المسدّدة ونسبة التحصيل غير متاحة: تحتاج تحصيل ومطابقة فاتورة/دفعة متحقَّقاً منها.`)],
    [L('Invoice link', 'ربط الفاتورة'), L(`The Payment rows carry no invoice key. A bill number exists only on case rows (${count(cs.sadadBillNumberFilled.contractManagement)} ContractManagement rows) and is not a validated installment-to-invoice key, so no invoice is linked.`, `لا يحمل صف الدفعات مفتاح فاتورة. رقم الفاتورة موجود في صفوف الحالات فقط (${count(cs.sadadBillNumberFilled.contractManagement)} صفاً في ContractManagement) وليس مفتاحاً متحقَّقاً بين القسط والفاتورة، فلا تُربط أي فاتورة.`)],
    [L('Dates', 'التواريخ'), L(`Start date is filled in ${count(c.dates.startFilled)} of ${count(c.records)} records, end date in ${count(c.dates.endFilled)}. Dates are shown as stored; implausible values are marked “to validate” and nothing is converted from Hijri.`, `تاريخ البداية معبّأ في ${count(c.dates.startFilled)} من ${count(c.records)} سجلاً وتاريخ النهاية في ${count(c.dates.endFilled)}. تُعرض التواريخ كما هي؛ وتوسَم القيم غير المعقولة «للتحقق» ولا يُحوَّل شيء من الهجري.`)],
    [L('Statuses', 'الحالات'), L('Status values are shown exactly as stored. Their business meanings are not confirmed, so none is interpreted.', 'تُعرض قيم الحالة كما هي مخزنة. معانيها في الأعمال غير مؤكدة، فلا يُفسَّر منها شيء.')],
    [L('Freshness', 'الحداثة'), L(`Latest ${p.latest.createdField} in the Payment extract: ${p.latest.created || '—'}; latest ${p.latest.paymentDateField}: ${p.latest.paymentDate || '—'}; extract date ${S.dataset.extract}. No update timestamp or extraction rule is in the files, so staleness is not claimed.`, `أحدث ${p.latest.createdField} في مستخرج الدفعات: ${p.latest.created || '—'}؛ أحدث ${p.latest.paymentDateField}: ${p.latest.paymentDate || '—'}؛ تاريخ الاستخراج ${S.dataset.extract}. لا يوجد في الملفات طابع تحديث ولا قاعدة استخراج، فلا يُدَّعى قِدَم البيانات.`)]
  ];
  return <ul className="fu-limits">{items.map(([k, v]) => <li key={k}><b>{k}</b><span dir="auto">{v}</span></li>)}</ul>;
}

// the figures the exports cannot support — one place, not repeated
const unavailableRows = (L) => [
    [L('Collected amounts', 'المبالغ المحصّلة'), L('Not in the Furas payment fields; needs Tahseel', 'ليست في حقول دفعات فرص؛ تحتاج تحصيل')],
    [L('Unpaid balances', 'الأرصدة غير المسدّدة'), L('Needs collected amounts and a validated invoice match', 'تحتاج المبالغ المحصّلة ومطابقة فاتورة متحقَّقاً منها')],
    [L('Collection rate', 'نسبة التحصيل'), L('Needs authoritative collection data and validated matching', 'تحتاج بيانات تحصيل معتمدة ومطابقة متحقَّقاً منها')],
    [L('Installment “n of N”, complete schedules, upcoming installments', 'الدفعة «س من ص» والجداول الكاملة والدفعات القادمة'), L('The Payment extract is a limited sample', 'مستخرج الدفعات عيّنة محدودة')],
    [L('“Due — no invoice linked”', '«مستحقة — لا فاتورة مرتبطة»'), L('Needs a validated schedule and invoice linkage', 'تحتاج جدولاً وربط فواتير متحقَّقاً منهما')],
    [L('Invoice and SADAD link of an installment', 'ربط القسط بالفاتورة وسداد'), L('No validated key in the exports', 'لا مفتاح متحقَّقاً في التصديرات')]
];
export function UnavailableList() {
  const { L } = useL();
  const rows = unavailableRows(L);
  return (
    <div className="fu-figs">{rows.map(([a, b]) => <div key={a} className="fu-fig fu-fig--na"><span className="fu-fig__label">{a}</span><span className="fu-fig__value" style={{ fontSize: 15 }}><NaCell full /></span><span className="fu-fig__sub">{b}</span></div>)}</div>
  );
}

// the compact form for a contract page: one line of chips, the reason on hover
export function UnavailableChips() {
  const { L } = useL();
  return <div className="fu-absent">{unavailableRows(L).map(([a, b]) => <Chip key={a} tone="muted" title={b}>{a}</Chip>)}</div>;
}

// duplicate / unmatched / integrity checks, each computed from the files
export function IntegrityChecks({ S }) {
  const { L, count } = useL();
  if (!S) return null;
  const c = S.contracts; const p = S.payments; const cs = S.cases;
  const rows = [
    [L('Contract record keys are unique', 'مفاتيح سجلات العقود فريدة'), c.recordKeyUnique ? L('yes', 'نعم') : L('no', 'لا'), `${count(c.records)}`],
    [L('Contract records without a contract number', 'سجلات عقود بلا رقم عقد'), count(c.recordsWithoutNumber), `${count(c.records)}`],
    [L('Contract numbers with several records', 'أرقام عقود لها عدة سجلات'), count(c.numbersWithSeveralRecords), `${count(c.distinctNumbers)}`],
    [L('…of them with different statuses / contract values', '…منها بحالات / قيم عقد مختلفة'), `${count(c.conflictsAmongRepeated.status)} / ${count(c.conflictsAmongRepeated.value)}`, `${count(c.numbersWithSeveralRecords)}`],
    [L('Payment contract numbers found in the Contract view', 'أرقام عقود الدفعات الموجودة في عرض العقود'), count(p.numbersFoundInContract), `${count(p.distinctNumbers)}`],
    [L('Payment rows whose number is not in the Contract view (unmatched)', 'صفوف دفعات رقمها غير موجود في عرض العقود (غير مطابقة)'), count(p.rowsNotFound), `${count(p.rows)}`],
    [L('Payment rows matching 2+ contract records (join multiplication avoided)', 'صفوف دفعات تطابق سجلي عقد أو أكثر (تُجنَّب مضاعفة الربط)'), count(p.rowsMatchingSeveralRecords), `${count(p.rows)}`],
    [L('Duplicate payment rows (same contract, batch year, batch number)', 'صفوف دفعات مكررة (العقد والسنة ورقم الدفعة)'), count(p.duplicateRows), `${count(p.rows)}`],
    [L('Contracts with 3+ payment rows whose batch numbers are contiguous', 'عقود بثلاث دفعات فأكثر وأرقام دفعاتها متتابعة'), count(p.contractsWithContiguousBatches), `${count(p.contractsWithThreePlusRows)}`],
    [L('Contract investor ids found in the Investor view', 'معرّفات المستثمر في العقود الموجودة في عرض المستثمر'), count(c.investorIdFound), `${count(c.investorIdFilled)}`],
    [L('Case rows whose contract number is in the Contract view', 'صفوف الحالات التي رقم عقدها في عرض العقود'), count(cs.contractNumberFound), `${count(cs.withContractNumber)}`],
    [L('Case rows whose opportunity number is in the Contract view', 'صفوف الحالات التي رقم فرصتها في عرض العقود'), count(cs.opportunityNumberFound), `${count(cs.withOpportunityNumber)}`],
    [L('Renewal links whose target record exists / self-references', 'روابط التجديد التي سجلها المستهدف موجود / إشارات ذاتية'), `${count(c.renewal.resolved)} / ${count(c.renewal.selfReference)}`, `${count(c.renewal.links)}`]
  ];
  return (
    <div className="fu-tablewrap"><table className="fu-table" aria-label={L('Integrity checks', 'فحوص السلامة')}><thead><tr><th>{L('Check', 'الفحص')}</th><th className="num">{L('Result', 'النتيجة')}</th><th className="num">{L('Out of', 'من')}</th></tr></thead>
      <tbody>{rows.map(([a, b, d]) => <tr key={a}><td>{a}</td><td className="num" dir="ltr">{b}</td><td className="num" dir="ltr">{d}</td></tr>)}</tbody></table></div>
  );
}

// the overview: what the exports hold, as quiet figures and distribution bars (Overview tab and the Furas product page)
export function FurasOverview({ S }) {
  const { L, ar, count, short } = useL();
  if (!S) return null;
  const c = S.contracts; const p = S.payments;
  const Fig = ({ label, value, sub }) => <div className="fu-fig"><span className="fu-fig__label">{label}</span><span className="fu-fig__value" dir="ltr">{value}</span>{sub && <span className="fu-fig__sub">{sub}</span>}</div>;
  const flagged = c.byMunicipality.some((m) => m.flag);
  return (
    <>
      <div className="fu-figs">
        <Fig label={L('Contract value — numbers with one consistent value', 'قيمة العقد — الأرقام ذات القيمة الموحّدة')} value={short(c.values.sumOfSingleValues)} sub={L(`${count(c.values.numbersWithSingleValue)} numbers, each counted once. Not included: ${count(c.values.numbersWithConflictingValues)} with conflicting values, ${count(c.values.numbersWithoutValue)} without a value.`, `${count(c.values.numbersWithSingleValue)} رقماً، كلٌّ مرة واحدة. غير مشمول: ${count(c.values.numbersWithConflictingValues)} بقيم متعارضة و${count(c.values.numbersWithoutValue)} بلا قيمة.`)} />
        <Fig label={L('Scheduled amounts of the payment rows', 'المبالغ المجدولة لصفوف الدفعات')} value={short(p.scheduledAmount.total)} sub={L(`${count(p.rows)} rows, one amount per row (PAYMENTAMOUNT as stored). Not a contract total, not collections.`, `${count(p.rows)} صفاً، مبلغ لكل صف (PAYMENTAMOUNT كما هو). ليس إجمالي عقد وليس تحصيلاً.`)} />
        <Fig label={L('Payment contract numbers found in the Contract view', 'أرقام عقود الدفعات الموجودة في عرض العقود')} value={`${count(p.numbersFoundInContract)} / ${count(p.distinctNumbers)}`} sub={L(`${count(p.rowsMatchingSeveralRecords)} rows match 2+ records — amounts are never joined`, `${count(p.rowsMatchingSeveralRecords)} صفاً يطابق سجلين أو أكثر — ولا تُربط المبالغ`)} />
      </div>
      <div className="fu-grid">
        <section className="fu-card"><h3>{L('Service type (as stored)', 'نوع الخدمة (كما هو)')}</h3><p>{L('records · distinct numbers', 'سجلات · أرقام مميزة')}</p>
          <BarList rows={c.byType.map((x) => ({ label: storedText('type', x.value, ar), a: x.records, b: x.numbers }))} format={count} second={count} /></section>
        <section className="fu-card"><h3>{L('Opportunity status (as stored)', 'حالة الفرصة (كما هي)')}</h3><p>{L('Meanings are not confirmed — none is interpreted. records · numbers', 'معانيها غير مؤكدة — ولا يُفسَّر شيء منها. سجلات · أرقام')}</p>
          <BarList rows={c.byStatus.map((x) => ({ label: storedText('status', x.value, ar), a: x.records, b: x.numbers }))} format={count} second={count} /></section>
        <section className="fu-card"><h3>{L('Amanah (source names)', 'الأمانة (الأسماء في المصدر)')}</h3><p>{L('records · distinct numbers', 'سجلات · أرقام مميزة')}</p>
          <BarList rows={c.byMunicipality.map((m) => ({ label: `${m.code} · ${m.sourceName}`, a: m.records, b: m.numbers, chip: m.flag ? <> <Chip tone="warn" icon="alert" title={L('Entity scope to be confirmed', 'نطاق الجهة بانتظار التأكيد')}>{L('confirm', 'تأكيد')}</Chip></> : null }))} format={count} second={count} />
          {flagged && <p className="fu-note">{L('Code 002 is named «أمانة العاصمة المقدسة» in the data, while the generated demo uses «أمانة منطقة مكة المكرمة»: the entity scope is to be confirmed; the source name is kept unchanged.', 'الرمز 002 يُسمّى «أمانة العاصمة المقدسة» في البيانات بينما يستخدم العرض المُولَّد «أمانة منطقة مكة المكرمة»: نطاق الجهة بانتظار التأكيد؛ ويبقى اسم المصدر دون تغيير.')}</p>}</section>
        <section className="fu-card"><h3>{L('Payment status (as stored)', 'حالة الدفعة (كما هي)')}</h3><p>{L('rows · scheduled amount (not collections)', 'صفوف · المبلغ المجدول (ليس تحصيلاً)')}</p>
          <BarList rows={p.byStatus.map((x) => ({ label: storedText('payStatus', x.value, ar), a: x.rows, b: x.scheduledAmount }))} format={count} second={short} /></section>
      </div>
      <section className="fu-card"><h3>{L('Not available in the current data', 'غير متاح في البيانات الحالية')}</h3><UnavailableList /></section>
    </>
  );
}
