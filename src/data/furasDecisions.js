// Decision Room items for FURAS DATASET MODE. Only what the exports themselves support: data-quality and data-request items computed from the files.
// Generated-demo items (overdue stock, aged debt, targets, enforcement, «due — no invoice linked») are NOT built here: they need data the exports do not contain.
const bi = (ar, en) => ({ ar, en });
const n = (v) => Number(v).toLocaleString('en-US');

export function furasItems(I) {
  const out = []; const add = (x) => out.push({ category: 'matching', amount: null, evidenceQuality: 0.9, ...x });
  const c = I.repeated; const p = I.payments;
  if (c.numbers > 0) add({
    key: 'furas:repeated', lane: 'decision', role: 'data_owner', dueDays: 30, actionability: 0.8,
    title: bi('أرقام عقود تحمل عدة سجلات', 'Contract numbers carried by several records'),
    problem: bi(`${n(c.numbers)} رقم عقد يحمل ${n(c.records)} سجلاً؛ الحالة تختلف في ${n(c.conflicts.status)} رقماً وقيمة العقد في ${n(I.conflictingValues)}. لا تحدد البيانات السجل الحالي.`, `${n(c.numbers)} contract numbers carry ${n(c.records)} records; the status differs on ${n(c.conflicts.status)} numbers and the contract value on ${n(I.conflictingValues)}. The data does not say which record is current.`),
    figures: [{ label: bi('أرقام لها عدة سجلات', 'Numbers with several records'), value: c.numbers, kind: 'count' }, { label: bi('سجلات فيها', 'Records in them'), value: c.records, kind: 'count' }, { label: bi('أرقام بحالات مختلفة', 'Numbers with different statuses'), value: c.conflicts.status, kind: 'count' }, { label: bi('أرقام بقيم عقد متعارضة', 'Numbers with conflicting contract values'), value: I.conflictingValues, kind: 'count' }],
    cause: { status: 'hypothesis', text: bi('فرضية غير مؤكدة: نسخ أو تعديلات للعقد نفسه. لا تحدد البيانات ذلك.', 'Unconfirmed hypothesis: versions or amendments of the same contract. The data does not say.') },
    evidence: [{ label: bi('أرقام العقود', 'Contract numbers'), to: '/contracts' }],
    recommendation: bi('اسألوا بنك البيانات عن العمود الذي يحدد السجل الحالي؛ وإلى ذلك يُعدّ الرقم المميز تقديراً مؤقتاً ولا تُجمع القيم ولا يُختار سجل.', 'Ask Data Bank which column marks the current record; until then the distinct-number count is provisional, values are not summed and no record is chosen.'),
    decisionNeeded: bi('قاعدة عدّ العقود', 'The rule for counting contracts')
  });
  if (p.capped) add({
    key: 'furas:capped', lane: 'action', role: 'data_owner', dueDays: 30, actionability: 0.9,
    title: bi('مستخرج الدفعات عيّنة محدودة', 'The Payment extract is a limited sample'),
    problem: bi(`${n(p.rows)} صف لـ${n(p.distinctNumbers)} رقم عقد؛ ${n(p.contractsWithThreePlusRows)} عقداً بثلاث دفعات فأكثر منها ${n(p.contiguous)} فقط بأرقام دفعات متتابعة. لا يمكن التحقق من جداول كاملة ولا «دفعة س من ص» ولا مجاميع الأقساط.`, `${n(p.rows)} rows for ${n(p.distinctNumbers)} contract numbers; of ${n(p.contractsWithThreePlusRows)} contracts with 3+ rows only ${n(p.contiguous)} has contiguous batch numbers. Complete schedules, “n of N” and installment totals cannot be verified.`),
    figures: [{ label: bi('صفوف الدفعات', 'Payment rows'), value: p.rows, kind: 'count' }, { label: bi('أرقام عقود', 'Contract numbers'), value: p.distinctNumbers, kind: 'count' }, { label: bi('صفوف تطابق عدة سجلات عقد', 'Rows matching 2+ contract records'), value: p.rowsMatchingSeveralRecords, kind: 'count' }],
    cause: { status: 'confirmed', text: bi('الملف يحوي 10,000 صف بالضبط؛ قاعدة الحد غير موثّقة.', 'The file holds exactly 10,000 rows; the cap rule is not documented.') },
    evidence: [{ label: bi('أرقام العقود', 'Contract numbers'), to: '/contracts' }],
    recommendation: bi('اطلبوا من بنك البيانات سجلات الدفعات الكاملة لعقود محددة.', 'Request the complete payment records for selected contracts from Data Bank.'), decisionNeeded: null
  });
  const d = I.dateIssues;
  if (d.due + d.invoice + d.payment > 0) add({
    key: 'furas:dates', lane: 'action', role: 'data_owner', dueDays: 30, actionability: 0.6,
    title: bi('تواريخ دفعات تحتاج تحققاً', 'Payment dates to validate'),
    problem: bi(`تواريخ الاستحقاق: ${n(d.due)}؛ تواريخ الفواتير: ${n(d.invoice)}؛ تواريخ السداد: ${n(d.payment)} — سنوات غير معقولة أو سنة تشبه الهجرية أو بعد تاريخ الاستخراج. تُعرض كما هي ولا يُحوَّل شيء. تواريخ الاستحقاق المستقبلية مشروعة ولا تُعدّ خطأ.`, `Due dates: ${n(d.due)}; invoice dates: ${n(d.invoice)}; payment dates: ${n(d.payment)} — implausible years, Hijri-like years or dates after the extract date. They are shown as stored and nothing is converted. Future due dates are legitimate and are not counted.`),
    figures: [{ label: bi('استحقاق', 'Due dates'), value: d.due, kind: 'count' }, { label: bi('فواتير', 'Invoice dates'), value: d.invoice, kind: 'count' }, { label: bi('سداد', 'Payment dates'), value: d.payment, kind: 'count' }],
    cause: { status: 'unknown', text: bi('السبب غير معروف؛ يلزم تأكيد بنك البيانات لكيفية تخزين التواريخ.', 'The cause is unknown; Data Bank must confirm how dates are stored.') },
    evidence: [{ label: bi('أرقام العقود', 'Contract numbers'), to: '/contracts' }],
    recommendation: bi('اسألوا بنك البيانات عن تقويم كل عمود تاريخ وصيغته.', 'Ask Data Bank for the calendar and format of each date column.'), decisionNeeded: null
  });
  if (p.rowsNotFound > 0) add({
    key: 'furas:unmatched', lane: 'action', role: 'data_owner', dueDays: 30, actionability: 0.8, title: bi('دفعات رقم عقدها غير موجود', 'Payment rows whose contract number is not found'),
    problem: bi(`${n(p.rowsNotFound)} صف دفعات رقم عقده غير موجود في عرض العقود.`, `${n(p.rowsNotFound)} payment rows carry a contract number that is not in the Contract view.`), figures: [{ label: bi('صفوف غير مطابقة', 'Unmatched rows'), value: p.rowsNotFound, kind: 'count' }],
    cause: { status: 'unknown', text: bi('غير معروف.', 'Unknown.') }, evidence: [{ label: bi('أرقام العقود', 'Contract numbers'), to: '/contracts' }], recommendation: bi('التحقق من مالك البيانات.', 'The data owner to verify.'), decisionNeeded: null
  });
  add({
    key: 'furas:status', lane: 'watch', role: 'investment', dueDays: 60, actionability: 0.3, evidenceQuality: 0.9,
    title: bi('معاني قيم الحالة غير معتمدة', 'Status values have no approved meaning'),
    problem: bi(`${I.statusValues} قيمة حالة للعقد (وقيم حالة للدفعات) تُعرض كما هي مخزنة؛ لا يُفسَّر منها شيء لأن معانيها في الأعمال غير مؤكدة.`, `${I.statusValues} contract status values (and the payment status values) are shown as stored; none is interpreted because their business meanings are not confirmed.`),
    figures: [{ label: bi('قيم حالة العقد', 'Contract status values'), value: I.statusValues, kind: 'count' }], cause: { status: 'confirmed', text: bi('لا قائمة قيم معتمدة في التصديرات.', 'The exports carry no approved value list.') },
    evidence: [{ label: bi('أرقام العقود', 'Contract numbers'), to: '/contracts' }], recommendation: bi('اعتماد قائمة الحالات ومعانيها من الأعمال وبنك البيانات.', 'The business and Data Bank to approve the status list and its meanings.'), decisionNeeded: null
  });
  add({
    key: 'furas:startdate', lane: 'watch', role: 'data_owner', dueDays: 60, actionability: 0.3,
    title: bi('تاريخ بداية العقد شبه غير معبّأ', 'Contract start date is almost never filled'),
    problem: bi(`تاريخ البداية معبّأ في ${n(I.startDateFilled)} من ${n(I.records)} سجلاً؛ وباقي السجلات «غير متاح في البيانات الحالية».`, `The start date is filled in ${n(I.startDateFilled)} of ${n(I.records)} records; for the rest it is “Not available in the current data”.`),
    figures: [{ label: bi('سجلات بتاريخ بداية', 'Records with a start date'), value: I.startDateFilled, kind: 'count' }], cause: { status: 'confirmed', text: bi('الأعمدة الخام لتاريخ البداية والنهاية غير موجودة في التصدير.', 'The raw start and end date columns are not in the export.') },
    evidence: [{ label: bi('أرقام العقود', 'Contract numbers'), to: '/contracts' }], recommendation: bi('اطلبوا من بنك البيانات إتاحة التواريخ الخام.', 'Ask Data Bank to expose the raw dates.'), decisionNeeded: null
  });
  if (I.renewal.links > 0) add({
    key: 'furas:renewal', lane: 'watch', role: 'data_owner', dueDays: 60, actionability: 0.3,
    title: bi('روابط التجديد: المعنى والاتجاه غير مؤكدين', 'Renewal links: meaning and direction unconfirmed'),
    problem: bi(`${n(I.renewal.links)} رابط؛ ${n(I.renewal.selfReference)} يشير إلى سجله نفسه، و${n(I.renewal.sameContractNumber)} يشير إلى سجل بالرقم نفسه. لا يُسمّى أي منها تجديداً قبل التأكيد.`, `${n(I.renewal.links)} links; ${n(I.renewal.selfReference)} point to their own record and ${n(I.renewal.sameContractNumber)} to a record with the same contract number. None is called a renewal until confirmed.`),
    figures: [{ label: bi('روابط', 'Links'), value: I.renewal.links, kind: 'count' }, { label: bi('إشارات ذاتية', 'Self-references'), value: I.renewal.selfReference, kind: 'count' }], cause: { status: 'unknown', text: bi('المعنى غير موثّق.', 'The meaning is not documented.') },
    evidence: [{ label: bi('أرقام العقود', 'Contract numbers'), to: '/contracts' }], recommendation: bi('اسألوا بنك البيانات عن معنى الحقل واتجاهه.', 'Ask Data Bank what the field means and which way it points.'), decisionNeeded: null
  });
  return out;
}
