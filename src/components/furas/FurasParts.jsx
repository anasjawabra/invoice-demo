import React from 'react';
import { useL } from '../../utils/bi';
import { NOT_AVAILABLE } from '../../data/contractRules';

// Shared pieces of the FURAS DATASET MODE pages. Every number comes from the local exports through /api/furas/*; nothing here is generated.
export function NA({ why }) {
  const { B } = useL();
  return <span className="muted" title={why}>{B(NOT_AVAILABLE)}</span>;
}
export const Tag = ({ children, tone = '' }) => <span className={`rp-origin ${tone ? `rp-origin--${tone}` : ''}`}>{children}</span>;

// what the dataset is, which extract, and how much of it each file covers
export function DatasetBanner({ S }) {
  const { L, count } = useL();
  if (!S) return null;
  const d = S.dataset;
  return (
    <div className="rp-limit rp-furasbanner" role="note">
      <b>{L('Furas dataset mode', 'وضع بيانات فرص')}</b> — {L('the six Databank exports of the Furas schema, read from this computer only (not in Git, builds or logs).', 'تصديرات بنك البيانات الستة لمخطط فرص، تُقرأ من هذا الحاسوب فقط (ليست في Git ولا في الإصدارات ولا في السجلات).')}{' '}
      {L('Extract date', 'تاريخ الاستخراج')}: <b dir="ltr">{d.extract}</b> · ETL <span dir="ltr">{d.etl}</span>.{' '}
      {L('Nothing on these pages is generated: values not in the exports show “Not available in the current data”.', 'لا شيء في هذه الصفحات مُولَّد: ما ليس في التصديرات يظهر «غير متاح في البيانات الحالية».')}
      <details style={{ marginTop: 6 }}>
        <summary>{L('Files and coverage', 'الملفات والتغطية')}</summary>
        <table aria-label={L('Files and coverage', 'الملفات والتغطية')}><thead><tr><th>{L('View', 'العرض')}</th><th className="num">{L('Rows', 'الصفوف')}</th><th className="num">{L('Columns in the file', 'الأعمدة في الملف')}</th><th>{L('Coverage', 'التغطية')}</th></tr></thead>
          <tbody>{d.files.map((f) => <tr key={f.key}><td dir="ltr">{f.view}</td><td className="num" dir="ltr">{count(f.rows)}</td><td className="num" dir="ltr">{f.columns} ({f.schemaColumns} {L('schema', 'مخطط')} + 2 ETL)</td>
            <td>{f.scope === 'capped_sample' ? <Tag tone="proposed">{L('Limited sample — exactly 10,000 rows; the cap rule is not documented', 'عيّنة محدودة — 10,000 صف بالضبط؛ قاعدة الحد غير موثّقة')}</Tag> : L('Not capped at 10,000 rows; completeness is not confirmed', 'ليست مقيّدة بـ10,000 صف؛ واكتمالها غير مؤكد')}</td></tr>)}</tbody></table>
      </details>
    </div>
  );
}

// the limits that follow from the files themselves — every figure is computed from them
export function LimitsPanel({ S, open = false }) {
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
  return (
    <details className="rp-rulenote" open={open}>
      <summary>{L('What these exports support — and what they do not', 'ما تدعمه هذه التصديرات — وما لا تدعمه')}</summary>
      <ul>{items.map(([k, v]) => <li key={k}><b>{k}</b> — <span dir="auto">{v}</span></li>)}</ul>
    </details>
  );
}

// the figures the exports cannot support — shown, not hidden
export function UnavailableList() {
  const { L } = useL();
  const rows = [
    [L('Collected amounts', 'المبالغ المحصّلة'), L('Not in the Furas payment fields; needs Tahseel', 'ليست في حقول دفعات فرص؛ تحتاج تحصيل')],
    [L('Unpaid balances', 'الأرصدة غير المسدّدة'), L('Needs collected amounts and a validated invoice match', 'تحتاج المبالغ المحصّلة ومطابقة فاتورة متحقَّقاً منها')],
    [L('Collection rate', 'نسبة التحصيل'), L('Needs authoritative collection data and validated matching', 'تحتاج بيانات تحصيل معتمدة ومطابقة متحقَّقاً منها')],
    [L('Installment “n of N”, complete schedules, upcoming installments', 'الدفعة «س من ص» والجداول الكاملة والدفعات القادمة'), L('The Payment extract is a limited sample', 'مستخرج الدفعات عيّنة محدودة')],
    [L('“Due — no invoice linked”', '«مستحقة — لا فاتورة مرتبطة»'), L('Needs a validated schedule and invoice linkage', 'تحتاج جدولاً وربط فواتير متحقَّقاً منهما')],
    [L('Invoice and SADAD link of an installment', 'ربط القسط بالفاتورة وسداد'), L('No validated key in the exports', 'لا مفتاح متحقَّقاً في التصديرات')]
  ];
  return (
    <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Not available in the current data', 'غير متاح في البيانات الحالية')}>
      <thead><tr><th>{L('Figure', 'المؤشر')}</th><th>{L('Status', 'الحالة')}</th><th>{L('Why', 'السبب')}</th></tr></thead>
      <tbody>{rows.map(([a, b]) => <tr key={a}><td>{a}</td><td><NA /></td><td className="muted">{b}</td></tr>)}</tbody>
    </table></div>
  );
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
    [L('Case rows (ContractManagement) whose contract number is in the Contract view', 'صفوف الحالات التي رقم عقدها في عرض العقود'), count(cs.contractNumberFound), `${count(cs.withContractNumber)}`],
    [L('Case rows whose opportunity number is in the Contract view', 'صفوف الحالات التي رقم فرصتها في عرض العقود'), count(cs.opportunityNumberFound), `${count(cs.withOpportunityNumber)}`],
    [L('Renewal links whose target record exists / self-references', 'روابط التجديد التي سجلها المستهدف موجود / إشارات ذاتية'), `${count(c.renewal.resolved)} / ${count(c.renewal.selfReference)}`, `${count(c.renewal.links)}`]
  ];
  return (
    <details className="rp-rulenote">
      <summary>{L('Integrity checks computed from the files (duplicates, unmatched records)', 'فحوص السلامة المحسوبة من الملفات (التكرار والسجلات غير المطابقة)')}</summary>
      <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Integrity checks', 'فحوص السلامة')}><thead><tr><th>{L('Check', 'الفحص')}</th><th className="num">{L('Result', 'النتيجة')}</th><th className="num">{L('Out of', 'من')}</th></tr></thead>
        <tbody>{rows.map(([a, b, d]) => <tr key={a}><td>{a}</td><td className="num" dir="ltr">{b}</td><td className="num" dir="ltr">{d}</td></tr>)}</tbody></table></div>
    </details>
  );
}

// the overview used by the Contracts list and the Furas product page
export function FurasOverview({ S }) {
  const { L, count, short, sar } = useL();
  if (!S) return null;
  const c = S.contracts; const p = S.payments;
  const Tile = ({ label, value, sub, tone }) => <div className={`rv-tile${tone ? ` rv-tile--${tone}` : ''}`}><div className="rv-tile__label">{label}</div><div className="rv-tile__value" dir="ltr">{value}</div>{sub && <div className="rv-tile__sub">{sub}</div>}</div>;
  return (
    <>
      <div className="rv-tiles">
        <Tile label={L('Contract records', 'سجلات العقود')} value={count(c.records)} sub={L('rows of the Contract view', 'صفوف عرض العقود')} />
        <Tile label={L('Distinct contract numbers', 'أرقام العقود المميزة')} value={count(c.distinctNumbers)} sub={L('provisional: a number is not a record key and the current record is not known', 'مؤقت: الرقم ليس مفتاح سجل والسجل الحالي غير معروف')} />
        <Tile tone="warn" label={L('Numbers with several records', 'أرقام لها عدة سجلات')} value={count(c.numbersWithSeveralRecords)} sub={L(`${count(c.recordsInRepeatedNumbers)} records · different statuses on ${count(c.conflictsAmongRepeated.status)} · different contract values on ${count(c.conflictsAmongRepeated.value)}`, `${count(c.recordsInRepeatedNumbers)} سجلاً · حالات مختلفة في ${count(c.conflictsAmongRepeated.status)} · قيم عقد مختلفة في ${count(c.conflictsAmongRepeated.value)}`)} />
        <Tile label={L('Contract value — numbers with one consistent value', 'قيمة العقد — الأرقام ذات القيمة الموحّدة')} value={short(c.values.sumOfSingleValues)} sub={L(`${count(c.values.numbersWithSingleValue)} numbers, each counted once. Not included: ${count(c.values.numbersWithConflictingValues)} numbers with conflicting values and ${count(c.values.numbersWithoutValue)} without a value.`, `${count(c.values.numbersWithSingleValue)} رقماً، كلٌّ مرة واحدة. غير مشمول: ${count(c.values.numbersWithConflictingValues)} رقماً بقيم متعارضة و${count(c.values.numbersWithoutValue)} بلا قيمة.`)} />
        <Tile label={L('Payment rows in the extract', 'صفوف الدفعات في المستخرج')} value={count(p.rows)} sub={L(`limited sample · ${count(p.distinctNumbers)} contract numbers · all found in the Contract view`, `عيّنة محدودة · ${count(p.distinctNumbers)} رقم عقد · كلها موجودة في عرض العقود`)} />
        <Tile label={L('Scheduled amounts of those rows', 'المبالغ المجدولة لتلك الصفوف')} value={short(p.scheduledAmount.total)} sub={L('PAYMENTAMOUNT as stored, one amount per row; not a contract total, not collections', 'PAYMENTAMOUNT كما هو، مبلغ لكل صف؛ ليس إجمالي عقد وليس تحصيلاً')} />
      </div>
      <div className="rv-tiles">
        {[[L('Collected', 'المحصّل')], [L('Unpaid balance', 'الرصيد غير المسدّد')], [L('Collection rate', 'نسبة التحصيل')], [L('Due — no invoice linked', 'مستحقة — لا فاتورة مرتبطة')]].map(([l]) => <div key={l} className="rv-tile"><div className="rv-tile__label">{l}</div><div className="rv-tile__value"><NA /></div></div>)}
      </div>
      <details className="rp-rulenote"><summary>{L('Figures that are not available in the current data', 'مؤشرات غير متاحة في البيانات الحالية')}</summary><UnavailableList /></details>
      <div className="rp-grid2">
        <Breakdown title={L('Service type (as stored) — records · numbers', 'نوع الخدمة (كما هو) — سجلات · أرقام')} rows={c.byType.map((x) => [x.value, x.records, x.numbers])} />
        <Breakdown title={L('Opportunity status (as stored; meanings not confirmed) — records · numbers', 'حالة الفرصة (كما هي؛ معانيها غير مؤكدة) — سجلات · أرقام')} rows={c.byStatus.map((x) => [x.value, x.records, x.numbers])} />
        <Breakdown title={L('Amanah (source names) — records · numbers', 'الأمانة (الأسماء في المصدر) — سجلات · أرقام')} rows={c.byMunicipality.map((m) => [`${m.code} · ${m.sourceName}${m.flag ? ` ⚑` : ''}`, m.records, m.numbers])} note={c.byMunicipality.some((m) => m.flag) ? L('⚑ Code 002 is named «أمانة العاصمة المقدسة» in the data, while the generated demo uses «أمانة منطقة مكة المكرمة»: the entity scope is to be confirmed; the source name is kept unchanged.', '⚑ الرمز 002 يُسمّى «أمانة العاصمة المقدسة» في البيانات بينما يستخدم العرض المُولَّد «أمانة منطقة مكة المكرمة»: نطاق الجهة بانتظار التأكيد؛ ويبقى اسم المصدر دون تغيير.') : null} />
        <Breakdown title={L('Payment status (as stored) — rows · scheduled amount', 'حالة الدفعة (كما هي) — صفوف · المبلغ المجدول')} rows={p.byStatus.map((x) => [x.value, x.rows, short(x.scheduledAmount)])} third />
      </div>
    </>
  );
}
function Breakdown({ title, rows, note, third }) {
  const { count } = useL();
  return (
    <section className="rp-section"><h3 className="rp-h2" style={{ fontSize: 14 }}>{title}</h3>
      <div className="rp-tablewrap" tabIndex={0}><table><tbody>{rows.map(([a, b, d]) => <tr key={a}><td dir="auto">{a}</td><td className="num" dir="ltr">{count(b)}</td><td className="num" dir="ltr">{third ? d : count(d)}</td></tr>)}</tbody></table></div>
      {note && <div className="muted" style={{ fontSize: 12 }}>{note}</div>}
    </section>
  );
}
