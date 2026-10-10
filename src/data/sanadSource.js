// The structure of the Sanad enforcement-request extract ("New Qadaya View", 20 columns) as the demo understands it — field dictionary, status vocabulary, debtor / execution types —
// and the deterministic SYNTHETIC values the demo cases carry for each field. No record of the real extract is imported or shipped: only its column structure and its code lists
// (status / debtor type / execution type texts are reference vocabulary and are kept verbatim, including the source's own spelling).
//
// RECORD GRAIN: one row = ONE ENFORCEMENT REQUEST («رقم طلب التنفيذ», unique). A claim request («رقم طلب المطالبة بالأداء») can have several enforcement requests, and the «رقم الانفاذ» is shared by
// several rows — its meaning is NOT confirmed. The extract carries NO debtor name or identity (only the debtor TYPE) and ONE optional invoice-number column that is almost always empty:
// invoice numbers live mostly in the free-text description. A share of numeric identifiers arrive corrupted by a spreadsheet (scientific notation, e.g. «2.414E+11») and cannot be matched.

export const SOURCE_FIELDS = [
  { col: 'رقم طلب المطالبة بألاداء', key: 'claimNo', ar: 'رقم طلب المطالبة بالأداء', en: 'Claim request no.', place: 'detail', note: { ar: 'يجمع عدة طلبات تنفيذ أحياناً؛ قد يصل مشوّهاً بالصيغة العلمية.', en: 'Can group several enforcement requests; may arrive in scientific notation.' } },
  { col: 'رقم طلب التنفيذ', key: 'requestNo', ar: 'رقم طلب التنفيذ', en: 'Enforcement request no.', place: 'list', note: { ar: 'مفتاح السجل: صف واحد لكل طلب تنفيذ.', en: 'Record key: one row per enforcement request.' } },
  { col: 'تاريخ المطالبة', key: 'claimDate', ar: 'تاريخ المطالبة', en: 'Claim date', place: 'detail', note: { ar: 'يسبق إنشاء الطلب عادةً.', en: 'Normally precedes the request creation.' } },
  { col: 'الأمانة', key: 'amanah', ar: 'الأمانة', en: 'Amanah', place: 'list', note: { ar: 'مملوء دائماً.', en: 'Always filled.' } },
  { col: 'البلدية', key: 'municipality', ar: 'البلدية', en: 'Municipality', place: 'list', note: { ar: 'اختياري: فارغ في نحو نصف الطلبات (وفي بعض الأمانات دائماً).', en: 'Optional: empty in about half of the requests (always empty for some Amanahs).' } },
  { col: 'رقم حالة الرفع للتنفيذ', key: 'statusId', ar: 'رقم حالة الرفع للتنفيذ', en: 'Status code', place: 'detail', note: { ar: 'رمز الحالة (33 قيمة).', en: 'Status code (33 values).' } },
  { col: 'حالة الرفع للتنفيذ', key: 'statusText', ar: 'حالة الرفع للتنفيذ', en: 'Referral-to-enforcement status', place: 'list', note: { ar: 'نص الحالة كما في المصدر؛ التصنيف إلى مفتوح/موقوف/مغلق مؤقت.', en: 'Status text as in the source; the open/suspended/closed class is provisional.' } },
  { col: 'رقم نوع المنفذ ضدة', key: 'debtorTypeId', ar: 'رقم نوع المنفذ ضده', en: 'Debtor type code', place: 'detail', note: { ar: 'رمز النوع (5 قيم).', en: 'Type code (5 values).' } },
  { col: 'نوع المنفذ ضدة', key: 'debtorType', ar: 'نوع المنفذ ضده', en: 'Debtor type', place: 'list', note: { ar: 'نوع فقط (شركة / فرد / مؤسسة…)؛ لا اسم ولا هوية في الملف.', en: 'Type only (company / individual / …); NO name or identity in the file.' } },
  { col: 'تاريخ الرفع للتنفيذ', key: 'raiseAt', ar: 'تاريخ الرفع للتنفيذ', en: 'Referred to enforcement on', place: 'list', note: { ar: 'تاريخ ووقت؛ لا يسبق إنشاء الطلب.', en: 'Date and time; never before the request creation.' } },
  { col: 'تاريخ انشاء الطلب', key: 'createdAt', ar: 'تاريخ إنشاء الطلب', en: 'Request created on', place: 'detail', note: { ar: 'يسبق الرفع بدقائق عادةً.', en: 'Usually minutes before the referral.' } },
  { col: 'رقم اسم الموظف منشئ الطلب', key: 'employeeId', ar: 'رقم الموظف المنشئ', en: 'Creating employee code', place: 'detail', note: { ar: 'بيانات موظف: تُحجب في العرض الفعلي بحسب الصلاحية.', en: 'Staff data: to be restricted by role in a real deployment.' } },
  { col: 'اسم الموظف منشئ الطلب', key: 'employeeName', ar: 'اسم الموظف المنشئ', en: 'Creating employee', place: 'detail', note: { ar: 'اسم تجريبي في العرض.', en: 'A fictional name in the demo.' } },
  { col: 'المبلغ', key: 'amount', ar: 'المبلغ', en: 'Amount', place: 'list', note: { ar: 'مبلغ الطلب (أحياناً فارغ أو غير رقمي).', en: 'Request amount (occasionally empty or non-numeric).' } },
  { col: 'المبلغ كتابة', key: 'amountWords', ar: 'المبلغ كتابة', en: 'Amount in words', place: 'detail', note: { ar: 'نص حر غير موحّد؛ لا يُستعمل في المطابقة.', en: 'Free text, not standardised; not used for matching.' } },
  { col: 'رقم الانفاذ', key: 'enforcementNo', ar: 'رقم الإنفاذ', en: 'Enforcement no.', place: 'detail', note: { ar: 'مشترك بين عدة صفوف ومعناه غير مؤكد؛ كثير منه مشوّه بالصيغة العلمية. لا يُعامل رقم فاتورة.', en: 'Shared by several rows, meaning NOT confirmed; many are corrupted to scientific notation. Never treated as an invoice number.' } },
  { col: 'رقم الفاتورة', key: 'invoiceNo', ar: 'رقم الفاتورة', en: 'Invoice no. (structured)', place: 'list', note: { ar: 'فارغ في الغالبية الساحقة؛ قيمة واحدة فقط؛ بعضها مشوّه بالصيغة العلمية.', en: 'Empty in the vast majority; a single value only; some corrupted to scientific notation.' } },
  { col: 'رقم نوع التنفيذ', key: 'executionTypeId', ar: 'رقم نوع التنفيذ', en: 'Execution type code', place: 'detail', note: { ar: 'رمز النوع (5 قيم).', en: 'Type code (5 values).' } },
  { col: 'نوع التنفيذ', key: 'executionType', ar: 'نوع التنفيذ (السند التنفيذي)', en: 'Execution type (enforceable instrument)', place: 'detail', note: { ar: 'غالبيته «عقود أو محررات موثقة».', en: 'Mostly «documented contracts or instruments».' } },
  { col: 'الوصف', key: 'description', ar: 'الوصف', en: 'Description', place: 'detail', note: { ar: 'نص حر طويل أحياناً متعدد الأسطر؛ فيه أرقام فواتير (غالباً 12 رقماً) وأرقام عقود ومبالغ — يُقرأ كله.', en: 'Free text, sometimes multi-line; carries invoice numbers (mostly 12 digits), contract numbers and amounts — read in full.' } }
];

// Status vocabulary: code + text VERBATIM from the source (spelling kept). `cls` is the demo's PROVISIONAL class (open / suspended / closed): 'stated' = the text says «مغلق»; 'inferred' = the demo's
// reading of the text (to be confirmed with Sanad). There is NO source status that means «suspended»: the only candidate is the order to stop the deadlines («أمر بوقف المهل»).
const S = (id, text, cls, basis) => ({ id, text, cls, basis });
export const SOURCE_STATUSES = [
  S(1, 'لم يتم التحقق', 'open', 'inferred'), S(2, 'مراجعة الطلب', 'open', 'inferred'), S(3, 'تحت الإجراء لدى الدائرة القضائية', 'open', 'inferred'), S(4, 'طلب استكمال نواقص', 'open', 'inferred'),
  S(8, 'طلب محفوظ', 'open', 'inferred'), S(9, 'مسودة محذوفة', 'closed', 'inferred'), S(11, 'تم إصدار قرار باثبات ترك طلب التنفيذ', 'closed', 'inferred'), S(13, 'مغلق - تم التنفيذ', 'closed', 'stated'),
  S(17, 'تم إصدار أمر تنفيذ', 'open', 'inferred'), S(20, 'تحت الإجراء لدى الدائرة القضائية - تم إصدار امر منع من السفر', 'open', 'inferred'), S(22, 'تحت الإجراء لدى الدائرة القضائية - تم إصدار امر بوقف المهل', 'suspended', 'inferred'),
  S(25, 'تم إصدار قرار برفض طلب وقف المهل', 'open', 'inferred'), S(27, 'خدمات البنك المركزي', 'open', 'inferred'), S(28, 'خدمات هيئة السوق المالية', 'open', 'inferred'), S(29, 'تم إصدار أمر إيقاف خدمات', 'open', 'inferred'),
  S(32, 'تحت الإجراء لدى الدائرة القضائية - تم إصدار امر تمديد منع من السفر', 'open', 'inferred'), S(33, 'تحت الإجراء لدى الدائرة القضائية - تم إصدار قرار إلغاء األومر الصادرة', 'open', 'inferred'),
  S(36, 'الإجراء لدى الدائرة القضائية - تم إصدار قرار برفض طلب فرض الغرامة', 'open', 'inferred'), S(38, 'طلب مقبول', 'open', 'inferred'), S(39, 'طلب غير مقبول', 'closed', 'inferred'),
  S(40, 'مغلق - لعدم استكمال النواقص خلال المهلة', 'closed', 'stated'), S(41, 'مغلق - حكم بعدم الاختصاص', 'closed', 'stated'), S(42, 'تم إصدار حكم بعدم القبول الكلي', 'closed', 'inferred'),
  S(43, 'تحت الإجراء لدى الدائرة القضائية - تم إصدار حكم بعدم القبول الجزئي', 'open', 'inferred'), S(44, 'مغلق – تعذر التنفيذ', 'closed', 'stated'), S(45, 'مغلق - لعدم استكمال النواقص', 'closed', 'stated'),
  S(48, 'مغلق – تم إصدار قرار اإليقاف الدائم', 'closed', 'stated'), S(49, 'مغلق – تم إصدار أمر اإليقاف مؤقتا', 'closed', 'stated'), S(51, 'مغلق – تم ترك الطلب', 'closed', 'stated'),
  S(52, 'مغلق – تم ترك الطلب جزئيا', 'closed', 'stated'), S(53, 'مغلق - في انتظار تحويل األموال', 'closed', 'stated'), S(54, 'ستكمال إجراءات التنفيذ', 'open', 'inferred'), S(55, 'مغلق - إتمام التنفيذ', 'closed', 'stated')
];
export const statusById = (id) => SOURCE_STATUSES.find((s) => s.id === Number(id)) || null;
export const statusClassOf = (id) => statusById(id)?.cls || null; // provisional
export const DEBTOR_TYPES = [{ id: 1, text: 'شركة مسجلة في المملكة' }, { id: 4, text: 'مؤسسة اهلية' }, { id: 5, text: 'جمعية أهلية' }, { id: 6, text: 'فرد (مستثمر)' }, { id: 7, text: 'جهة إدارية' }];
export const EXECUTION_TYPES = [{ id: 1, text: 'حكم نهائي أو عاجل صادر من ديوان المظالم' }, { id: 2, text: 'حكم نهائي او عاجل جهة الإدارة طرفًا فيه' }, { id: 3, text: 'عقود او محررات موثقة' }, { id: 4, text: 'احكام محكمين' }, { id: 5, text: 'أوراق تجارية' }];

// A number a spreadsheet turned into scientific notation («2.414E+11», «9.9E+11»): the original digits are lost — it can never be matched, padded or «repaired».
export const isCorruptedNumber = (v) => /^\s*\d+(?:\.\d+)?E\+?\d+\s*$/i.test(String(v ?? ''));

/* ------------------------------------------------------------------ deterministic synthetic values */
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (list, h, salt) => list[hash(`${h}|${salt}`) % list.length];
const pad = (n) => String(n).padStart(2, '0');
const FIRST = ['محمد', 'عبدالله', 'سعد', 'ناصر', 'فهد', 'خالد', 'تركي', 'سلطان', 'ماجد', 'بدر', 'نورة', 'ريم', 'هدى', 'منى', 'لمى']; // fictional combinations only
const LAST = ['الدوسري', 'العتيبي', 'الشمري', 'الحربي', 'القحطاني', 'الزهراني', 'المطيري', 'العنزي', 'السبيعي', 'الغامدي'];
const MUNI = ['بلدية الوسط', 'بلدية الشرق', 'بلدية الشمال', 'بلدية الجنوب', 'بلدية الغرب', 'بلدية الواحة']; // generic fictional names
const TEMPLATES = {
  contract: 'إيجار - دفعة من العقد المبرم مع المنفذ ضده وفق السند التنفيذي',
  land: 'رسوم الأراضي البيضاء المستحقة على المنفذ ضده',
  fines: 'إشارة إلى الغرامات والجزاءات النظامية المستحقة على المنفذ ضده',
  tobacco: 'قيمة رسوم تقديم منتجات التبغ المستحقة على المنفذ ضده',
  housing: 'سداد رسوم إشغال مرافق الإيواء',
  generic: 'إلزام المنفذ ضده بسداد المستحقات المالية الناتجة عن العقد الموثق'
};
// Excel-style rendering of a long number: «2.414E+11»
export const toSciNotation = (digits) => Number(digits).toExponential(2 + (hash(digits) % 3)).replace('e+', 'E+');

// Arabic amount in words (integer riyals + halalas), the demo's own wording — the source text is free-form and not standardised
const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
const below1000 = (n) => { const h = Math.floor(n / 100); const r = n % 100; const parts = []; if (h) parts.push(HUNDREDS[h]); if (r) parts.push(r < 20 ? ONES[r] : `${r % 10 ? `${ONES[r % 10]} و` : ''}${TENS[Math.floor(r / 10)]}`); return parts.join(' و'); };
export function amountInWords(amount) {
  const v = Math.round(Number(amount) * 100); if (!Number.isFinite(v) || v <= 0) return '';
  const riyal = Math.floor(v / 100); const halala = v % 100; const parts = [];
  const bn = Math.floor(riyal / 1e9); const mn = Math.floor((riyal % 1e9) / 1e6); const th = Math.floor((riyal % 1e6) / 1e3); const rest = riyal % 1e3;
  if (bn) parts.push(bn === 1 ? 'مليار' : bn === 2 ? 'ملياران' : `${below1000(bn)} مليار`);
  if (mn) parts.push(mn === 1 ? 'مليون' : mn === 2 ? 'مليونان' : `${below1000(mn)} ${mn <= 10 ? 'ملايين' : 'مليوناً'}`);
  if (th) parts.push(th === 1 ? 'ألف' : th === 2 ? 'ألفان' : `${below1000(th)} ${th <= 10 ? 'آلاف' : 'ألفاً'}`);
  if (rest) parts.push(below1000(rest));
  const r = `${parts.join(' و')} ريال`; return halala ? `${r} و${below1000(halala)} هللة` : r;
}

const SEED_STATUS = { open: [27, 27, 27, 17, 3, 54, 2, 28, 29, 38], suspended: [22], closed: [55, 55, 13, 51, 51, 40, 45, 53] };
const CLOSE_TO_STATUS = { withdrawn_by_authority: 51, order_expired: 40, replaced_by_other_order: 51 }; // the demo's own closure reasons, mapped to the nearest source text

// The source fields of a demo case, derived deterministically from what the case already has (never random across loads). A field the case already carries (`c.source.*`) is kept.
// `requestStatus` (قيد التنفيذ / موقوف / مغلق) stays the demo's class; the source status is chosen inside that class.
export function adaptSourceCase(c) {
  if (c.source?.requestNo) return c;
  const h = hash(c.enforceNum); const num = Number(String(c.enforceNum).replace(/\D/g, '')) || h;
  const cls = c.requestStatus === 'مغلق' ? 'closed' : c.requestStatus === 'موقوف' ? 'suspended' : 'open';
  const statusId = cls === 'closed' && c.closeReason && CLOSE_TO_STATUS[c.closeReason] ? CLOSE_TO_STATUS[c.closeReason] : pick(SEED_STATUS[cls], h, 'st');
  const st = statusById(statusId);
  const opened = String(c.openedDate || '2025-01-01'); const od = new Date(`${opened}T00:00:00Z`);
  const claimD = new Date(od.getTime() - (5 + (h % 85)) * 864e5); const hh = 8 + (h % 9); const mm = h % 60; const cm = Math.max(0, mm - (2 + (h % 7)));
  const iso = (d) => d.toISOString().slice(0, 10);
  const claimNo = String(4600000000 + (hash(`${c.enforceNum}|claim`) % 399999999));
  const sameAsClaim = hash(`${c.enforceNum}|same`) % 100 < 60;
  const enforcementNo = sameAsClaim ? claimNo : String(100000000 + (hash(`${c.enforceNum}|enf`) % 899999999999));
  const execId = hash(`${c.enforceNum}|ex`) % 100 < 98 ? 3 : [1, 2, 5, 4][hash(`${c.enforceNum}|ex2`) % 4];
  const debtorId = hash(`${c.enforceNum}|dt`) % 100 < 52 ? 1 : hash(`${c.enforceNum}|dt2`) % 100 < 96 ? 6 : [4, 5, 7][hash(`${c.enforceNum}|dt3`) % 3];
  const kindTemplate = c.system === 'white_lands' ? TEMPLATES.land : c.contractNo ? TEMPLATES.contract : [TEMPLATES.generic, TEMPLATES.fines, TEMPLATES.housing, TEMPLATES.tobacco][h % 4];
  const first = pick(FIRST, h, 'f'); const last = pick(LAST, h, 'l');
  const source = {
    requestNo: String(4600000 + (num % 399999)), claimNo, claimDate: iso(claimD), statusId, statusText: st.text, debtorTypeId: debtorId, debtorType: DEBTOR_TYPES.find((d) => d.id === debtorId).text,
    raiseAt: `${opened} ${pad(hh)}:${pad(mm)}`, createdAt: `${opened} ${pad(hh)}:${pad(cm)}`, employeeId: String(20 + (h % 300)), employeeName: `${first} ${pick(FIRST, h, 'f2')} ${last}`, amount: c.amount, amountWords: amountInWords(c.amount),
    enforcementNo, invoiceNo: (c.refs || []).length ? String(c.refs[0].value) : '', executionTypeId: execId, executionType: EXECUTION_TYPES.find((d) => d.id === execId).text,
    municipality: hash(`${c.enforceNum}|mu`) % 100 < 48 ? pick(MUNI, h, 'mu') : null
  };
  // a share of the numeric identifiers arrive corrupted by a spreadsheet, as in the extract; the demo reproduces that (the original digits are NOT recoverable)
  if (hash(`${c.enforceNum}|sci1`) % 100 < 45) source.enforcementNoRaw = toSciNotation(enforcementNo);
  if (hash(`${c.enforceNum}|sci2`) % 100 < 25) source.claimNoRaw = toSciNotation(claimNo);
  return { ...c, source, description: c.description || kindTemplate, sourceMeta: { derived: true, provisionalClass: st.cls, classBasis: st.basis } };
}
