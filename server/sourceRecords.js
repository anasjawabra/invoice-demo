// ============================================================================
// SOURCE RECORDS — the original-source view of ONE unified invoice («بيانات تجريبية»).
//
// The unified invoice (columns in the store) is the single record that carries the amount. This module rebuilds, on demand and
// deterministically from the invoice key, how each source system would describe that same invoice: the original column names of
// the source schemas (tobacco / accommodation platform tables, white-land DS_0xx views, Balady bills, the violations report, the
// Incorta revenue lines), the related records (disclosure, schedule, facility, deed, land, owner, objection, extension request...)
// and the LINKS between systems. Nothing here adds an amount: every amount shown is the unified invoice amount, or a documented
// breakdown of it. All persons, facilities and identifiers are synthetic.
// ============================================================================
import { ENTITIES, SOURCES, ITEMS, CHANNELS, F, grpOf, extOf, GRP, isoOf, municipalityOf } from '../src/data/catalog.js';
import { PARAMS, IMPORT_VERSIONS, SOURCE_PROFILE, GFS_BY_SOURCE, assumptionsFor } from '../src/data/sourceAssumptions.js';
import { Rng, mix } from './world.js';
import { invoiceIdOf, sadadOf, violationOf, payerName, crNoOf, DEED, LICENCE, DISCLOSURE, VISIT, SCHEDULE, REQUEST, facilityKeyOf, personName, nationalIdOf, mobileOf, hash } from './names.js';

const BI = (ar, en) => ({ ar, en });
const fld = (n, ar, en, v) => ({ n, l: BI(ar, en), v: v === undefined ? null : v });
const view = (id, table, title, fields) => ({ id, table, title, fields });
const pad = (n, w) => String(n).padStart(w, '0');
const CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'أبها', 'الطائف', 'بريدة', 'تبوك', 'حائل', 'جازان'];
const DISTRICTS = ['حي النخيل التجريبي', 'حي الربيع التجريبي', 'حي الواحة التجريبي', 'حي الفيصلية التجريبي', 'حي المروج التجريبي', 'حي الصفا التجريبي', 'حي السلام التجريبي', 'حي العليا التجريبي'];
const ACTIVITIES = [['بيع المواد الغذائية بالتجزئة', 'Retail food', 4711], ['مطعم', 'Restaurant', 5610], ['صالون حلاقة', 'Barber', 9602], ['مغسلة ملابس', 'Laundry', 9601], ['بيع الملابس', 'Clothing retail', 4771], ['مقهى', 'Cafe', 5630], ['ورشة صيانة', 'Workshop', 4520], ['صيدلية', 'Pharmacy', 4772]];
const SERVICES = {
  commercial_license: [[101, 'إصدار رخصة نشاط تجاري', 'Issue commercial licence'], [102, 'تجديد رخصة نشاط تجاري', 'Renew commercial licence'], [103, 'نقل ملكية رخصة', 'Transfer of licence ownership']],
  signboard_license: [[201, 'إصدار لوحة محل', 'Issue shop signboard'], [202, 'تجديد لوحة محل', 'Renew shop signboard']],
  building_permit: [[301, 'إصدار رخصة بناء', 'Issue building permit'], [302, 'رخصة سور', 'Fence permit']],
  health_certificate: [[401, 'شهادة صحية سنوية', 'Annual health certificate'], [402, 'شهادة صحية مع تثقيف صحي', 'Health certificate with training']]
};

function paymentFacts(rec) {
  let wallet = 0; let other = 0; let last = null; let lastNonWallet = null;
  for (const p of rec.payments) {
    if (p.channel === 'wallet') wallet += p.amount; else { other += p.amount; if (!lastNonWallet || p.date > lastNonWallet) lastNonWallet = p.date; }
    if (!last || p.date > last) last = p.date;
  }
  return { wallet, other, paid: wallet + other, last, lastNonWallet };
}
const addDays = (iso, n) => isoOf(Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000) + n);
const monthBefore = (iso) => { let y = +iso.slice(0, 4); let m = +iso.slice(5, 7) - 1; if (m < 1) { m = 12; y -= 1; } return [y, m]; };

// raw invoice status of the platform tables (tobacco / accommodation vocabulary is a demo assumption - see A-TB-3)
function disclosureInvoiceStatus(rec, pf, cutoff) {
  if (rec.cancelled) return [4, 'ملغاة', 'Cancelled'];
  if (pf.paid >= rec.grossAmount - 0.5) return [2, 'مسددة', 'Paid'];
  if (pf.paid > 0) return [5, 'مسددة جزئياً', 'Partly paid'];
  if (rec.dueDate < cutoff) return [3, 'منتهية الصلاحية', 'Expired'];
  return [1, 'صادرة', 'Issued'];
}

export function sourceRecord(st, i, rec, D, cutoff) {
  const idKey = st.idKey[i]; const year = Math.floor(idKey / 1e8);
  const src = SOURCES[st.src[i]]; const item = ITEMS[st.item[i]]; const ent = ENTITIES[st.ent[i]];
  const muni = municipalityOf(st.ent[i], st.muni[i]);
  const payer = payerName(st.payer[i]); const gross = rec.grossAmount;
  const sadad = rec.sadadNo; const pf = paymentFacts(rec);
  const r = new Rng(mix(40, idKey % 1000003, year));
  const flags = st.flags[i];
  const amanaNo = String(1000 + st.ent[i] * 10); const baladyaNo = muni ? String(amanaNo * 1 + 1 + st.muni[i]) : null;
  const geoFields = [
    fld('AMANA_NO', 'كود الأمانة', 'Amanah code', amanaNo), fld('ARABIC_AMANA_NAME', 'الأمانة', 'Amanah', ent.ar),
    ...(muni ? [fld('BALADYA_NO', 'كود البلدية', 'Municipality code', baladyaNo), fld('ARABIC_BRANCH_BALADYA_NAME', 'البلدية', 'Municipality', muni.ar)] : [])
  ];
  const facilityKey = facilityKeyOf(st.payer[i]);
  const profile = SOURCE_PROFILE[src.key];
  const out = {
    family: src.key, revenueSource: src.key, sourceLabel: profile?.label || null, item: { key: item.key, ar: item.ar, en: item.en },
    providingSystem: null, level: profile?.level || null, views: [], related: [], links: [], revenueLines: [], checks: {}, assumptions: assumptionsFor(src.key).map((a) => a.id), notes: []
  };
  const rawStatus = disclosureInvoiceStatus(rec, pf, cutoff);

  /* ---------------------------------------------------------------- tobacco / accommodation (disclosure-based) */
  if (src.key === 'tobacco' || src.key === 'accommodation') {
    const tob = src.key === 'tobacco';
    const A = tob ? PARAMS.tobacco : PARAMS.accommodation;
    const pct = A.feePercents[hash(idKey % 1e6, 1) % A.feePercents.length];
    const tax = rec.vatAmount; const fee = gross - tax; const base = Math.round((fee / (pct / 100)) * 100) / 100;
    const [dy, dm] = monthBefore(rec.issueDate);
    const grp = grpOf(flags);
    const dscKey = Number(DISCLOSURE.num(idKey)); const dscNo = DISCLOSURE.of(idKey);
    const replacedBy = grp === GRP.TB_REPLACED ? idKey + 1 : null; const replaces = grp === GRP.TB_REPLACEMENT ? idKey - 1 : null;
    const facName = payer.ar; const crNo = crNoOf(st.payer[i]);
    const reqId = `SR${pad(hash(idKey % 1e6, 2) % 1e10, 10)}`;
    out.providingSystem = BI(tob ? 'منصة إفصاح التبغ (TB_*) عبر إنكورتا' : 'منصة إفصاح الإيواء عبر إنكورتا', tob ? 'Tobacco disclosure platform (TB_*) via Incorta' : 'Accommodation disclosure platform via Incorta').ar;
    out.importVersion = tob ? IMPORT_VERSIONS.tobacco : IMPORT_VERSIONS.accommodation;
    const invoiceFields = [
      fld('INVOICE_KEY', 'رقم الفاتورة بالنظام', 'Invoice key', String(71000000 + (idKey % 1e8))), fld('DISCLOSURE_KEY', 'رقم الإفصاح', 'Disclosure key', dscKey),
      fld('DISCLOSURE_YEAR', 'سنة الإفصاح', 'Disclosure year', dy), fld('DISCLOSURE_MONTH', 'شهر الإفصاح', 'Disclosure month', dm), ...geoFields,
      fld('FACILITY_KEY', 'كود المنشأة', 'Facility key', facilityKey), fld(tob ? 'FACILITY_NAME' : 'ARABIC_FACILITY_NAME', 'اسم المنشأة', 'Facility name', facName),
      fld('STATUS_KEY', 'كود حالة الفاتورة', 'Invoice status key', rawStatus[0]), fld('ARABIC_STATUS_NAME', 'حالة الفاتورة', 'Invoice status', rawStatus[1]),
      fld('TYPE_KEY', 'كود نوع الفاتورة', 'Invoice type key', grp === GRP.TB_REPLACEMENT ? 2 : 1), fld('ARABIC_TYPE_NAME', 'نوع الفاتورة', 'Invoice type', grp === GRP.TB_REPLACEMENT ? 'فاتورة إفصاح معدّل' : 'فاتورة إفصاح شهري')
    ];
    if (tob) invoiceFields.push(fld('CUSTOMER_ID_NO', 'رقم هوية المصدر باسمه الفاتورة', 'Customer ID', nationalIdOf(st.payer[i])), fld('CUSTOMER_ID_TYPE', 'نوع الهوية', 'ID type', 1));
    invoiceFields.push(
      fld('SADAD_NO', 'رقم السداد', 'SADAD number', sadad), fld('AMOUNT', 'قيمة الفاتورة', 'Invoice amount', gross),
      ...(tob ? [fld('FROM_WALLET', 'المبلغ المخصوم من المحفظة', 'Deducted from wallet', pf.wallet)] : [fld('PAID_AMOUNT', 'المبلغ المسدد', 'Paid amount', pf.paid)]),
      fld('SADAD_ISSUE_DATE', 'تاريخ الإصدار', 'Issue date', rec.issueDate), fld('SADAD_EXPIRY_DATE', 'تاريخ انتهاء الصلاحية', 'Expiry date', rec.dueDate), fld('SADAD_PAID_DATE', 'تاريخ السداد', 'Paid date', pf.lastNonWallet || pf.last), fld('SADAD_REQUEST_ID', 'رقم طلب السداد', 'SADAD request id', reqId)
    );
    out.views.push(view('INVOICES', tob ? 'TB_ENT_INVOICES' : 'TB_ENT_INVOICES', BI('الفاتورة في منصة المصدر', 'Invoice in the source platform'), invoiceFields));
    const days = tob ? null : Math.max(1, Math.min(31 * 150, Math.round(base / (150 + (hash(idKey % 1e6, 3) % 450)))));
    const discFields = [
      fld('DISCLOSURE_KEY', 'كود الإفصاح', 'Disclosure key', dscKey), fld('DISCLOSURE_YEAR', 'سنة الإفصاح', 'Disclosure year', dy), fld('DISCLOSURE_MONTH', 'شهر الإفصاح', 'Disclosure month', dm),
      fld('CREATED_DATE', 'تاريخ البداية', 'Period start', `${dy}-${pad(dm, 2)}-01`), fld(tob ? 'DISCLOSURE_DATE' : 'MODIFIED_DATE', 'تاريخ التقديم', 'Submission date', addDays(rec.issueDate, -(hash(idKey % 1e6, 4) % 3))),
      fld(tob ? 'TOTAL_AMOUNT' : 'TOTAL_OCCUPANCY', tob ? 'إجمالي الإفصاح (أساس الاحتساب)' : 'إجمالي الإفصاحات (أساس الاحتساب)', 'Disclosed base', base), fld('TOTAL_PERCENTAGE', 'نسبة الاحتساب', 'Calculation percentage', pct)
    ];
    if (tob) discFields.push(fld('TAX', 'الضريبة', 'VAT', tax), fld('DISCLOSED_BY_NAME', 'اسم المفصح', 'Disclosed by', personName(st.payer[i] + 7).ar), fld('SALES_TYPE_KEY', 'نوع المبيعات', 'Sales type key', 1), fld('ARABIC_SALES_TYPE_NAME', 'نوع المبيعات', 'Sales type', 'مبيعات منتجات التبغ'));
    else discFields.push(fld('OCCUPANCY_DAYS', 'عدد أيام الإفصاح', 'Disclosed days', days), fld('PRICE_PER_DAY_PERCENTAGE', 'السعر اليومي للنسبة', 'Daily price of the percentage', Math.round((fee / days) * 100) / 100), fld('APPROVED_OCCUPANCIES', 'الإفصاحات المعتمدة', 'Approved lines', Math.max(1, Math.round(days / 3))), fld('REJECTED_OCCUPANCIES', 'الإفصاحات المرفوضة', 'Rejected lines', hash(idKey % 1e6, 5) % 3), fld('CREATED_BY', 'التقديم بواسطة', 'Created by', personName(st.payer[i] + 7).ar), fld('IS_APPROVED', 'الاعتماد', 'Approved', 'نعم'), fld('IS_DELETED', 'الحذف', 'Deleted', 'لا'), fld('IS_ACTIVE', 'هل الإفصاح ساري', 'Active', replacedBy ? 'لا' : 'نعم'));
    discFields.push(
      fld('STATUS_KEY', 'كود الحالة', 'Status key', replacedBy ? 3 : 2), fld('ARABIC_STATUS_NAME', 'حالة الإفصاح', 'Disclosure status', replacedBy ? 'مستبدل بإفصاح معدّل' : 'معتمد'),
      fld('TYPE_KEY', 'كود النوع', 'Type key', grp === GRP.TB_REPLACEMENT ? 2 : 1), fld('ARABIC_TYPE_NAME', 'نوع الإفصاح', 'Disclosure type', grp === GRP.TB_REPLACEMENT ? 'معدّل' : 'شهري'),
      ...(tob ? [fld('REPLACED_WITH_KEY', 'الإفصاح الجديد', 'Replaced with', replacedBy ? Number(DISCLOSURE.num(replacedBy)) : null)] : [])
    );
    out.views.push(view('DISCLOSURES', 'TB_ENT_DISCLOSURES', BI('الإفصاح الشهري', 'Monthly disclosure'), discFields));
    out.views.push(view('SCHEDULES', 'TB_ENT_SCHEDULES', BI('جدولة الإفصاح', 'Disclosure schedule'), [
      fld('SCHEDULE_KEY', 'كود الجدولة', 'Schedule key', SCHEDULE.of(idKey)), fld('SCHEDULE_YEAR', 'سنة الجدولة', 'Schedule year', dy), fld('SCHEDULE_MONTH', 'شهر الجدولة', 'Schedule month', dm),
      fld('DISCLOSURE_KEY', 'كود الإفصاح', 'Disclosure key', dscKey), fld('SCHEDULE_STATUS_KEY', 'كود الحالة', 'Status key', 2), fld('ARABIC_STATUS_NAME', 'حالة الجدولة', 'Schedule status', 'تم الإفصاح'),
      fld('CREATED_DATE', 'تاريخ إصدار الجدولة', 'Schedule created', `${dy}-${pad(dm, 2)}-01`), fld('UPDATE_DATE', 'تاريخ التعديل', 'Schedule updated', rec.issueDate)
    ]));
    const rooms = 8 + (hash(st.payer[i], 11) % 150);
    const lic0 = hash(st.payer[i], 12) % 5 + 1;
    const walletBal = Math.round((hash(st.payer[i], 13) % 20000) * 10) / 10;
    out.views.push(view('FACILITIES', 'TB_DIM_FACILITIES', BI('المنشأة', 'Facility'), [
      fld(tob ? 'FACILITY_KEY' : 'FACILITY_ID', 'كود المنشأة', 'Facility key', facilityKey), fld(tob ? 'FACILITY_NAME' : 'ARABIC_FACILITY_NAME', 'اسم المنشأة', 'Facility name', facName),
      ...(tob ? [fld('LICENSE_NO', 'رقم الرخصة', 'Licence number', LICENCE.of(idKey - (idKey % 7)).slice(0, 14)), fld('LICENSE_PERIOD', 'مدة الرخصة (سنة)', 'Licence period (years)', lic0), fld('IS_APPROVED', 'الاعتماد', 'Approved', 'نعم'), fld('SHOP_AREA', 'مساحة المكان', 'Shop area', 20 + (hash(st.payer[i], 14) % 400)), fld('FACILITYBALANCE', 'رصيد المحفظة', 'Wallet balance', walletBal), fld('OWNER_NAME', 'اسم المالك', 'Owner name', personName(st.payer[i]).ar), fld('OWNER_IDENTITY_NO', 'هوية المالك', 'Owner identity', nationalIdOf(st.payer[i])), fld('ARABIC_TYPE_NAME', 'نوع المنشأة', 'Facility type', 'بقالة / مركز تسوق'), fld('CLOSE_STATUS_KEY', 'حالة الإلغاء', 'Close status', 'نشطة')]
        : [fld('REGISTRATION_NUMBER', 'رقم السجل', 'Registration number', crNo), fld('ARABIC_TYPE_NAME', 'نوع المنشأة', 'Facility type', ['فندق', 'شقق مخدومة', 'نزل', 'مجمع سكني'][hash(st.payer[i], 15) % 4]), fld('ROOMS_COUNT', 'عدد الغرف', 'Rooms', rooms), fld('COMMERCIAL_RECORD', 'السجل التجاري', 'Commercial record', crNo), fld('RESPONSIBLE_NAME', 'اسم المسؤول', 'Responsible', personName(st.payer[i] + 3).ar), fld('RESPONSIBLE_MOBILE', 'جوال المسؤول', 'Responsible mobile', mobileOf(st.payer[i]))]),
      fld('DISTRICT', 'الحي', 'District', DISTRICTS[hash(st.payer[i], 16) % DISTRICTS.length]), fld(tob ? 'CR_NO' : 'COMMERCIAL_RECORD', 'السجل التجاري', 'CR number', crNo)
    ]));
    if (replacedBy) out.related.push({ kind: 'replaced_by', label: BI('استُبدلت بفاتورة إفصاح معدّل', 'Replaced by an amended-disclosure invoice'), invoiceId: invoiceIdOf(replacedBy), note: BI('هذه الفاتورة ملغاة؛ تُخصم مرة واحدة وتُحتسب الفاتورة المعدّلة فقط.', 'This invoice is cancelled and deducted once; only the amended invoice is counted.') });
    if (replaces) out.related.push({ kind: 'replaces', label: BI('تحل محل فاتورة الإفصاح الأصلي', 'Replaces the original-disclosure invoice'), invoiceId: invoiceIdOf(replaces) });
    out.checks = { disclosureBase: base, feePercent: pct, fee, vat: tax, amountEqualsFeePlusVat: Math.abs(fee + tax - gross) < 0.5, walletPaid: pf.wallet, sadadPaid: pf.other };
    out.facility = { key: facilityKey, name: facName };
  } else if (src.key === 'white_lands') {
    /* ---------------------------------------------------------------- white lands (deed -> owner -> invoice) */
    const A = PARAMS.white_lands;
    const grp = grpOf(flags); const offset = grp === GRP.WL_OWN2 ? 1 : grp === GRP.WL_OWN3 ? 2 : 0;
    const headIdx = i - offset; const headKey = idKey - offset; const headGrp = grpOf(st.flags[headIdx]);
    const owners = headGrp === GRP.WL_HEAD2 ? 2 : headGrp === GRP.WL_HEAD3 ? 3 : 1;
    let groupGross = 0; const group = [];
    for (let k = 0; k < owners; k += 1) { groupGross += st.gross[headIdx + k]; group.push(headIdx + k); }
    const share = gross / (groupGross || gross);
    const zone = hash(headKey % 1e6, 21) % 4; const rate = A.zoneRates[zone];
    const deedArea = Math.round((groupGross / rate) * 100) / 100; const evalArea = Math.round(deedArea * share * 100) / 100;
    const deedNo = DEED.of(headKey); const deedId = Number(DEED.num(headKey));
    const landId = 5000000 + (headKey % 1e7); const city = CITIES[hash(headKey % 1e6, 22) % CITIES.length];
    const issueD = rec.issueDate; const cycleYear = +issueD.slice(0, 4);
    const month = +issueD.slice(5, 7);
    const ext = extOf(flags); const given = ext === 1 ? Math.round((st.due[i] - st.issue[i] - A.dueDays)) : 0;
    const origDue = isoOf(st.due[i] - given);
    const ownerNat = hash(st.payer[i], 23) % 100 < 80 ? 'NationalId' : 'CR';
    const ownerName = payer.ar; const idNo = ownerNat === 'CR' ? crNoOf(st.payer[i]) : nationalIdOf(st.payer[i]);
    const paidStatus = rec.cancelled ? 'ملغاة' : pf.paid >= gross - 0.5 ? 'مدفوعة' : pf.paid > 0 ? 'مدفوعة جزئياً' : 'غير مدفوعة';
    const invStatus = rec.cancelled ? 'ملغاة' : pf.paid >= gross - 0.5 ? 'مسددة' : 'منشورة';
    out.providingSystem = 'منظومة الأراضي البيضاء (DS_035 ... DS_088)';
    out.importVersion = IMPORT_VERSIONS.white_lands;
    out.views.push(view('DS_038_IdleLandInvoices', 'BIDSCIDLELANDS_ds_038_white_lands_fee_invoices_1', BI('فاتورة رسوم الأراضي البيضاء', 'White-land fee invoice'), [
      fld('InvoiceId', 'معرف الفاتورة', 'Invoice id', 8000000 + (idKey % 1e8)), fld('DeedOwnerRequestId', 'معرف طلب مالك الصك', 'Deed-owner request id', 9000000 + (idKey % 1e8)), fld('LandfessDeedId', 'معرف صك الأراضي البيضاء', 'White-land deed id', deedId),
      fld('IdNumber', 'رقم الهوية', 'Id number', idNo), fld('FullName', 'الاسم الكامل', 'Full name', ownerName), fld('OwnerType', 'نوع المالك', 'Owner type', ownerNat), fld('OwnerTypeAr', 'نوع المالك بالعربية', 'Owner type (ar)', ownerNat === 'CR' ? 'سجل تجاري' : 'هوية وطنية'),
      fld('InvoicePrice', 'قيمة الفاتورة', 'Invoice price', gross), fld('InvoicePaidAmount', 'المبلغ المدفوع', 'Paid amount', pf.paid), fld('InvoiceRestAmount', 'المبلغ المتبقي', 'Rest amount', rec.cancelled ? 0 : Math.max(0, gross - pf.paid)),
      fld('EvaluatedArea', 'المساحة المقيّمة', 'Evaluated area (m2)', evalArea), fld('DeedArea', 'مساحة الصك', 'Deed area (m2)', deedArea),
      fld('InvoiceDate', 'تاريخ الفاتورة', 'Invoice date', issueD), fld('PublishedDate', 'تاريخ النشر', 'Published date', addDays(issueD, 1)), fld('LastTimeToPay', 'آخر موعد للسداد', 'Last time to pay', rec.dueDate), fld('DueDate', 'تاريخ الاستحقاق', 'Due date', origDue), fld('PaidDate', 'تاريخ السداد', 'Paid date', pf.last),
      fld('InvoiceStatusName', 'حالة الفاتورة', 'Invoice status', invStatus), fld('PaidStatusName', 'حالة الدفع', 'Paid status', paidStatus), fld('PublishText', 'نص النشر', 'Publish text', `نُشرت الفاتورة ضمن دورة الفرز ${cycleYear} (بيانات تجريبية)`),
      fld('StageName', 'اسم المرحلة', 'Stage', month === 1 ? 'المرحلة الأولى' : 'المرحلة التكميلية'), fld('PeriodName', 'اسم الدورة', 'Period', `دورة ${cycleYear}`), fld('CityName', 'اسم المدينة', 'City', city),
      fld('StagePeriodStartDate', 'تاريخ بداية الدورة', 'Period start', `${cycleYear}-01-01`), fld('StagePeriodEndDate', 'تاريخ نهاية الدورة', 'Period end', `${cycleYear}-12-31`),
      fld('FarzCycleId', 'معرف دورة الفرز', 'Sorting-cycle id', cycleYear * 100 + 1), fld('DeedStagePeriodId', 'معرف دورة مرحلة الصك', 'Deed stage-period id', headKey % 1e7), fld('SadadNum', 'رقم سداد', 'SADAD number', sadad)
    ]));
    out.views.push(view('DS_088_IdleLandDeeds', 'BIDSCIDLELANDS_ds_088_deeds_1', BI('الصك', 'Deed'), [
      fld('DeedId', 'معرف الصك', 'Deed id', deedId), fld('DeedNumber', 'رقم الصك', 'Deed number', deedNo), fld('DeedArea', 'مساحة الصك', 'Deed area (m2)', deedArea), fld('DeedIssueDate', 'تاريخ إصدار الصك', 'Deed issue date', `${2005 + (hash(headKey % 1e6, 24) % 18)}-0${1 + (hash(headKey % 1e6, 25) % 9)}-1${hash(headKey % 1e6, 26) % 9}`),
      fld('OwnersCount', 'عدد الملاك', 'Owners', owners), fld('DeedTypeName', 'نوع الصك', 'Deed type', ['صك ملكية', 'صك إفراغ', 'صك إرث'][hash(headKey % 1e6, 27) % 3]), fld('DeedExpirationStatusName', 'حالة انتهاء الصك', 'Deed validity', 'ساري'),
      fld('LandTypeName', 'نوع الأرض', 'Land type', ['سكني', 'تجاري', 'سكني تجاري'][hash(headKey % 1e6, 28) % 3]), fld('CityName', 'اسم المدينة', 'City', city), fld('LandId', 'معرف قطعة الأرض', 'Land id', landId), fld('InvoiceCount', 'عدد الفواتير', 'Invoices on the deed', owners), fld('HasInvoice', 'هل يوجد فاتورة', 'Has invoice', 1)
    ]));
    const planNo = `${1000 + (hash(headKey % 1e6, 29) % 8000)}/ج`; const landArea = Math.round(deedArea * (1 + (hash(headKey % 1e6, 30) % 20) / 100) * 100) / 100;
    out.views.push(view('DS_037_IdleLandDetails', 'BIDSCIDLELANDS_ds_037_white_lands_data_1', BI('قطعة الأرض', 'Land plot'), [
      fld('LandId', 'معرف الأرض', 'Land id', landId), fld('LandNo', 'رقم الأرض', 'Land number', `${100 + (hash(headKey % 1e6, 31) % 900)}`), fld('PlanNo', 'رقم المخطط', 'Plan number', planNo), fld('LandArea', 'مساحة الأرض', 'Land area (m2)', landArea),
      fld('DistrictName', 'اسم الحي', 'District', DISTRICTS[hash(headKey % 1e6, 32) % DISTRICTS.length]), fld('LandStatusName', 'حالة الأرض', 'Land status', 'أرض بيضاء مفوترة'), fld('CityName', 'اسم المدينة', 'City', city),
      fld('ZoneName', 'اسم النطاق', 'Zone', `الشريحة ${'ABCD'[zone]}`), fld('DeedId', 'معرف الصك', 'Deed id', deedId), fld('Latitude', 'خط العرض', 'Latitude', (21 + (hash(headKey % 1e6, 33) % 5000) / 1000).toFixed(5)), fld('Longitude', 'خط الطول', 'Longitude', (39 + (hash(headKey % 1e6, 34) % 7000) / 1000).toFixed(5))
    ]));
    out.views.push(view('Basic_IDLE_LANDS_INFO_BS', 'ScannedLands', BI('سجل الأراضي الخاملة (المسح)', 'Idle-land registry (scan)'), [
      fld('GISLandUniqueId', 'رقم تسلسلي', 'GIS unique id', landId + 700000), fld('MAINLANDUSEDSC', 'وصف الغرض', 'Main land use', ['سكني', 'تجاري'][hash(headKey % 1e6, 35) % 2]), fld('ZoneCode', 'كود الشريحة', 'Zone code', zone + 1), fld('ZoneDsc', 'اسم الشريحة', 'Zone name', `الشريحة ${'ABCD'[zone]}`),
      fld('Deed', 'هل وزارة عدل', 'MoJ deed', 'نعم'), fld('RER', 'هل سجل عقاري', 'Real-estate registry', 'لا'), fld('LKAssetsAr', 'وصف ملكية الدولة', 'State-ownership type', 'ملكية خاصة')
    ]));
    out.views.push(view('DS_035_IdleLandOwners', 'BIDSCIDLELANDS_ds_035_white_lands_owners_1', BI('المالك على الصك', 'Deed owner'), [
      fld('OwnerId', 'معرف المالك', 'Owner id', 7000000 + (idKey % 1e8)), fld('DeedId', 'معرف الصك', 'Deed id', deedId), fld('BeneficiaryId', 'معرف المستفيد', 'Beneficiary id', 6000000 + st.payer[i]), fld('OwnerPercentage', 'نسبة الملكية %', 'Ownership %', Math.round(share * 10000) / 100),
      fld('OwnershipArea', 'مساحة الملكية', 'Ownership area (m2)', evalArea), fld('Source', 'مصدر بيانات المالك', 'Owner data source', ['وزارة العدل', 'السجل العقاري'][hash(st.payer[i], 36) % 2]), fld('IdNumber', 'رقم الهوية', 'Id number', idNo), fld('BeneficiaryNameAr', 'اسم المستفيد', 'Beneficiary', ownerName),
      fld('CityName', 'اسم المدينة', 'City', city), fld('InvoiceId', 'معرف الفاتورة', 'Invoice id', 8000000 + (idKey % 1e8)), fld('InvoiceStatusName', 'حالة الفاتورة', 'Invoice status', invStatus), fld('PaidStatusName', 'حالة الدفع', 'Paid status', paidStatus)
    ]));
    if (ext) {
      const recv = addDays(issueD, 5 + (hash(idKey % 1e6, 37) % 25));
      out.views.push(view('DS_041_TimeLimitRequest', 'BIDSCIDLELANDS_ds_041_development_period_extension_1', BI('طلب تمديد المهلة', 'Time-limit extension request'), [
        fld('Id', 'معرف الطلب', 'Request id', 4000000 + (idKey % 1e8)), fld('InvoiceId', 'معرف الفاتورة', 'Invoice id', 8000000 + (idKey % 1e8)), fld('RequestStatusName', 'حالة الطلب', 'Request status', ext === 1 ? 'مقبول' : ext === 2 ? 'مرفوض' : 'قيد المراجعة'),
        fld('Reason', 'سبب الطلب', 'Reason', 'طلب مهلة إضافية لإكمال التطوير (نص تجريبي)'), fld('ReceivedDate', 'تاريخ الاستلام', 'Received', recv), fld('TimeLimitApprovalStatus', 'حالة موافقة التمديد', 'Approval status', ext),
        fld('GivenPeriod', 'المدة الممنوحة (يوم)', 'Given period (days)', ext === 1 ? given : null), fld('RefuseDate', 'تاريخ الرفض', 'Refuse date', ext === 2 ? addDays(recv, 10) : null), fld('RefusalReasonName', 'سبب الرفض', 'Refusal reason', ext === 2 ? 'لم يستوفِ الاشتراطات' : null),
        fld('LastTimeToPay', 'آخر موعد للسداد بعد التمديد', 'Last time to pay after extension', rec.dueDate), fld('InvoiceLastTimeToPay', 'آخر موعد للسداد (الفاتورة الأصلية)', 'Original last time to pay', origDue)
      ]));
      out.related.push({ kind: 'extension', label: BI(ext === 1 ? `تمديد معتمد ${given} يوماً` : ext === 2 ? 'طلب تمديد مرفوض' : 'طلب تمديد قيد المراجعة', ext === 1 ? `Extension approved: ${given} days` : ext === 2 ? 'Extension refused' : 'Extension pending') });
    }
    if (flags & F.OBJECTION) {
      out.views.push(view('DS_040_IdleLandObjections', 'BIDSCIDLELANDS_ds_040_objections_1', BI('الاعتراض', 'Objection'), [
        fld('Id', 'معرف الاعتراض', 'Objection id', 3000000 + (idKey % 1e8)), fld('InvoiceId', 'معرف الفاتورة', 'Invoice id', 8000000 + (idKey % 1e8)), fld('CreatedDate', 'تاريخ الاعتراض', 'Created', addDays(issueD, 8 + (hash(idKey % 1e6, 38) % 30))),
        fld('ObjectionReasonName', 'سبب الاعتراض', 'Reason', ['خطأ في المساحة', 'الأرض مطورة', 'خطأ في الملكية'][hash(idKey % 1e6, 39) % 3]), fld('ObjectionStatusName', 'حالة الاعتراض', 'Status', 'قيد الدراسة'), fld('ObjectionTypeName', 'نوع الاعتراض', 'Type', 'اعتراض على الفاتورة'), fld('Demand', 'مطلب الاعتراض', 'Demand', 'إلغاء الفاتورة أو تعديلها (نص تجريبي)')
      ]));
    }
    if (!rec.cancelled && pf.paid < gross - 0.5 && hash(idKey % 1e6, 40) % 100 < 8) {
      out.views.push(view('DS_039_IdleLand_Violations', 'BIDSCIDLELANDS_ds_039_white_lands_violations_1', BI('مخالفة الأرض (معلومة مرتبطة)', 'Land violation (linked information)'), [
        fld('ViolationId', 'معرف المخالفة', 'Violation id', 2000000 + (idKey % 1e8)), fld('DeedNumber', 'رقم الصك', 'Deed number', deedNo), fld('InvoiceId', 'معرف الفاتورة', 'Invoice id', 8000000 + (idKey % 1e8)), fld('ViolationStatusName', 'حالة المخالفة', 'Status', 'نافذة'),
        fld('InitialFineAmount', 'قيمة الغرامة الابتدائية (غير مضافة للفاتورة)', 'Initial fine (NOT added to the invoice)', Math.round(gross * 0.1)), fld('ViolationPercentage', 'نسبة المخالفة %', 'Violation %', 10), fld('ViolationPaidStatusName', 'حالة سداد الغرامة', 'Fine paid status', 'غير مدفوعة')
      ]));
      out.related.push({ kind: 'violation_info', label: BI('مخالفة مرتبطة: غرامتها معلومة ولا تُضاف إلى مبلغ الفاتورة', 'Linked violation: its fine is information and is not added to the invoice amount') });
    }
    out.related.push({ kind: 'deed', label: BI(owners > 1 ? `صك مشترك بين ${owners} ملاك — فاتورة لكل مالك` : 'صك بمالك واحد', owners > 1 ? `Deed shared by ${owners} owners - one invoice per owner` : 'Single-owner deed'), deedNo,
      invoices: group.map((g) => ({ id: invoiceIdOf(st.idKey[g]), amount: st.gross[g], share: Math.round((st.gross[g] / groupGross) * 10000) / 100, current: g === i })) });
    if (st.exec[i] >= 0 && st.requests[st.exec[i]]?.system === 'white_lands') {
      const q = st.requests[st.exec[i]];
      out.links.push({ system: 'ملف التنفيذ الشامل للأراضي البيضاء', dataset: 'white_lands_enforcement', importVersion: IMPORT_VERSIONS.white_lands_enforcement, keyField: 'رقم أمر التنفيذ', key: q.enforceNum, role: 'enforcement', note: BI('التنفيذ لا يُحتسب تحصيلاً، ومبلغ الأمر لا يُضاف إلى المديونية.', 'Execution is not collection and the order amount is not added to the debt.') });
    }
    out.checks = { owners, ownershipSharePct: Math.round(share * 10000) / 100, groupGross, zoneRate: rate, evaluatedAreaTimesRate: Math.round(evalArea * rate), extension: ext, extensionDays: given, objection: !!(flags & F.OBJECTION) };
    out.land = { landId, deedNo, city };
  } else if (src.key === 'licenses' || src.key === 'municipal_fees') {
    /* ---------------------------------------------------------------- licences & municipal fees (Balady bills) */
    const fam = item.key; const svcList = SERVICES[fam];
    const svc = svcList ? svcList[hash(idKey % 1e6, 51) % svcList.length] : [900, 'خدمة بلدية', 'Municipal service'];
    const billStatus = rec.cancelled ? (hash(idKey % 1e6, 52) % 2 ? 2 : 3) : pf.paid >= gross - 0.5 ? 1 : 0;
    const licId = LICENCE.num(idKey); const reqId = Number(REQUEST.num(idKey).slice(0, 9));
    const nat = hash(st.payer[i], 53) % 100 < 70 ? 'سجل تجاري' : 'هوية وطنية';
    out.providingSystem = src.key === 'licenses' ? 'منصة بلدي (BALADY_BILLS) وتقارير الأمانات الداخلية' : 'إنكورتا — طبقة الإيرادات الموحدة (ENT_REVENUES)';
    out.importVersion = IMPORT_VERSIONS.balady;
    out.views.push(view('BALADY_BILLS', 'TB_ENT_BALADY_BILLS', BI('فاتورة بلدي', 'Balady bill'), [
      fld('DATA_KEY', 'رقم الفاتورة', 'Bill key', rec.id), fld('REQUEST_ID', 'رقم الطلب', 'Request id', reqId), fld('LICENSE_ID', 'رقم الرخصة', 'Licence id', licId), fld('BILL_NUMBER', 'رقم السداد', 'SADAD number', sadad),
      fld('CREATE_DATE', 'تاريخ الفاتورة', 'Bill date', rec.issueDate), fld('SERVICE_KEY', 'كود الخدمة', 'Service key', svc[0]), fld('SERVICE_NAME', 'اسم الخدمة', 'Service', svc[1]),
      fld('OWNER_ID', 'هوية المالك', 'Owner id', nat === 'سجل تجاري' ? crNoOf(st.payer[i]) : nationalIdOf(st.payer[i])), fld('OWNER_TYPE_ID', 'نوع الهوية', 'Owner type', nat === 'سجل تجاري' ? 2 : 1), fld('NATIONAL_NUMBER', 'الرقم الموحد', 'Unified number', nat === 'سجل تجاري' ? `700${pad(hash(st.payer[i], 54) % 1e7, 7)}` : null),
      fld('BILL_UPDATE_DATE', 'تاريخ التحديث', 'Updated', pf.last || rec.issueDate), fld('PAID_DATE', 'تاريخ السداد', 'Paid date', pf.last), fld('BILL_AMOUNT', 'مبلغ الفاتورة', 'Bill amount', gross),
      fld('BILL_STATUS_KEY', 'كود الحالة', 'Status key', billStatus), fld('BILL_STATUS_NAME', 'وصف الحالة', 'Status', PARAMS.licenses.billStatusCodes[billStatus]), fld('AMANA_NO', 'كود الأمانة المحاسبي', 'Amanah accounting code', amanaNo), fld('BALADYA_NO', 'كود البلدية المحاسبي', 'Municipality accounting code', baladyaNo), fld('GIS_CODE', 'كود البلدية', 'GIS code', muni ? `GIS-${amanaNo}-${st.muni[i] + 1}` : null)
    ]));
    if (fam === 'commercial_license' || fam === 'signboard_license') {
      const act = ACTIVITIES[hash(st.payer[i], 55) % ACTIVITIES.length];
      const rate = 12 + (hash(st.payer[i], 56) % 30); const area = Math.max(10, Math.round(gross / rate));
      const issue = rec.issueDate; const isRenew = svc[0] === 102 || svc[0] === 202;
      out.views.push(view('DS_001_Issued_Commercial_Licenses', 'Commerial_License_atbl', BI('الرخصة التجارية (سجل الرخصة)', 'Commercial licence record'), [
        fld('LIC_ID', 'رقم الرخصة', 'Licence id', licId), fld('REQ_ID', 'رقم الطلب', 'Request id', reqId), fld('IS_CURRENT_LICENSE', 'آخر طلب على الرخصة؟', 'Latest request on the licence', 1), fld('ISSUE_DATE_G', 'تاريخ بداية الرخصة', 'Licence start', issue),
        fld('SADAD_END_DATE', 'تاريخ نهاية الرخصة', 'Licence end', addDays(issue, 365)), fld('NAME_REQ_TYPE', 'نوع الطلب', 'Request type', svc[1]), fld('NAME_REQ_STATES', 'وصف حالة الطلب', 'Request status', 'مكتمل'),
        fld('STATUS_DESC_MAP', 'حالة الرخصة (المعتمدة)', 'Approved licence status', billStatus === 1 ? 'سارية' : billStatus >= 2 ? 'ملغية' : 'سارية'), fld('SHOP_AREA', 'مساحة المحل (مشتقة افتراضياً)', 'Shop area (derived by assumption)', area),
        fld('D_ACTIVITIES_NAME', 'النشاط التفصيلي', 'Detailed activity', act[0]), fld('ISIC_NUMBER', 'كود نشاط أيزك', 'ISIC code', act[2]), fld('WORKER_TYPE_ID', 'كود نوع العاملين', 'Worker type', 1 + (hash(st.payer[i], 57) % 3)),
        fld('NAME_BOARD_TYPE', 'نوع اللوحة', 'Board type', ['لوحة عادية', 'لوحة مضيئة'][hash(st.payer[i], 58) % 2]), fld('ENTRY_MODE', 'كود مصدر إدخال الرخصة', 'Entry mode', 1), fld('STATUS_ID_BILLS', 'كود حالة الفاتورة', 'Bill status', billStatus),
        fld('BILL_NUMBER', 'رقم آخر فاتورة مرتبطة بالرخصة', 'Last bill linked to the licence', sadad), fld('CREATE_DATE_BILLS', 'تاريخ إنشاء الفاتورة', 'Bill created', rec.issueDate), fld('PAID_DATE', 'تاريخ دفع الفاتورة', 'Bill paid', pf.last), fld('FULL_NAME_OWNER', 'اسم مالك الرخصة', 'Owner', payer.ar), fld('IS_RENEWAL', 'تجديد؟', 'Renewal', isRenew ? 'نعم' : 'لا')
      ]));
      out.related.push({ kind: 'licence', label: BI('سجل الرخصة التجارية يحمل آخر فاتورة فقط؛ بقية فواتير الرخصة تأتي من BALADY_BILLS', 'The commercial-licence row carries only the last bill; earlier bills come from BALADY_BILLS'), licenceId: LICENCE.of(idKey) });
    } else if (fam === 'building_permit') {
      out.views.push(view('Building_license_vw', 'LICENCES / BILLS', BI('رخصة البناء', 'Building licence'), [
        fld('LIC_ID', 'رقم الرخصة', 'Licence id', licId), fld('NAME_AR_licencse_type', 'نوع المبنى', 'Building type', ['سكني', 'تجاري', 'سور'][hash(idKey % 1e6, 59) % 3]), fld('CREATE_DATE_BILL', 'تاريخ إنشاء الفاتورة', 'Bill created', rec.issueDate), fld('BILL_NUMBER', 'رقم فاتورة الرخصة', 'Bill number', sadad), fld('PAID_DATE_G', 'تاريخ سداد الفاتورة', 'Bill paid', pf.last),
        fld('AREA', 'إجمالي مساحة المبنى', 'Building area (m2)', 120 + (hash(idKey % 1e6, 60) % 900)), fld('FLOORS_COUNT', 'إجمالي عدد الأدوار', 'Floors', 1 + (hash(idKey % 1e6, 61) % 5)), fld('STATES_REQUESTS_NAME', 'حالة الطلب', 'Request status', 'مكتمل'),
        fld('ENG_OFF_DESIGNER_NAME_AR', 'اسم المكتب المصمم', 'Designer office', 'مكتب هندسي تجريبي'), fld('OWNER_TYPE_ID', 'كود هوية المالك', 'Owner id type', nat === 'سجل تجاري' ? 2 : 1)
      ]));
    } else if (fam === 'health_certificate') {
      out.views.push(view('medical_license_bs', 'BILLS / MED_REQUESTS', BI('الشهادة الصحية', 'Health certificate'), [
        fld('REQUEST_ID', 'رقم طلب الشهادة الصحية', 'Certificate request', reqId), fld('LIC_ID', 'رقم الرخصة', 'Licence id', licId), fld('cer_type', 'نوع الشهادة', 'Certificate type', svc[0] === 401 ? 'شهادة سنوية' : 'شهادة مع تثقيف صحي'), fld('CREATE_DATE', 'تاريخ إنشاء الفاتورة', 'Bill created', rec.issueDate),
        fld('BILL_NUMBER', 'رقم فاتورة الشهادة', 'Bill number', sadad), fld('AMOUNT', 'مبلغ الفاتورة', 'Bill amount', gross), fld('NAME_BILL_STATUES', 'حالة الفاتورة', 'Bill status', PARAMS.licenses.billStatusCodes[billStatus]), fld('NAME_CER', 'حالة الشهادة', 'Certificate status', billStatus === 1 ? 'سارية' : 'غير سارية')
      ]));
    }
    out.checks = { billStatusKey: billStatus, billStatusName: PARAMS.licenses.billStatusCodes[billStatus], service: svc[1] };
  } else if (src.key === 'fines') {
    /* ---------------------------------------------------------------- fines (violations report) */
    const A = PARAMS.fines; const diff = hash(idKey % 1e6, 71) % 100 < A.differentValueShare * 100;
    const violationValue = diff ? Math.round((gross * (0.5 + (hash(idKey % 1e6, 72) % 80) / 100)) / 10) * 10 : gross;
    const act = ACTIVITIES[hash(st.payer[i], 73) % ACTIVITIES.length];
    const size = [['S', 'صغيرة'], ['M', 'متوسطة'], ['L', 'كبيرة']][hash(st.payer[i], 74) % 3];
    const paidRaw = rec.cancelled ? 'ملغاة' : pf.paid >= gross - 0.5 ? 'مسددة' : pf.paid > 0 ? 'مسددة جزئياً' : 'غير مسددة';
    const desc = { building_violations: 'مخالفة اشتراطات البناء', signage_violations: 'مخالفة اللوحات التجارية', health_violations: 'مخالفة الاشتراطات الصحية' }[item.key] || 'مخالفة بلدية';
    out.providingSystem = 'إيفاء / ممتثل (تقرير المخالفات عبر إنكورتا)';
    out.importVersion = IMPORT_VERSIONS.violations;
    const visitStart = addDays(rec.issueDate, -(hash(idKey % 1e6, 75) % 4));
    out.views.push(view('Violations_report_BV', 'Violations_report', BI('تقرير المخالفات', 'Violations report'), [
      fld('رقم_الزيارة', 'رقم الزيارة', 'Visit number', VISIT.of(idKey)), fld('نوع_الرقابة', 'نوع الرقابة', 'Inspection type', ['رقابة ميدانية', 'بلاغ', 'رقابة دورية'][hash(idKey % 1e6, 76) % 3]), fld('الامانة', 'الأمانة', 'Amanah', ent.ar), fld('اسم_البلدية', 'اسم البلدية', 'Municipality', muni?.ar || null),
      fld('اسم_المراقب', 'اسم المراقب', 'Inspector', personName(hash(idKey % 1e6, 77) % 5000).ar), fld('رقم_هوية_المراقب', 'رقم هوية المراقب', 'Inspector id', nationalIdOf(hash(idKey % 1e6, 77) % 5000)), fld('اسم_المنشأة', 'اسم المنشأة', 'Facility', payer.ar), fld('رقم_الرخصة', 'رقم الرخصة', 'Licence number', LICENCE.of(idKey - (idKey % 11)).slice(0, 14)),
      fld('رقم_هوية_المخالف', 'رقم هوية المخالف', 'Offender id', nationalIdOf(st.payer[i])), fld('تاريخ_بدء_الزيارة', 'تاريخ بدء الزيارة', 'Visit start', visitStart), fld('تاريخ_انهاء_الزيارة', 'تاريخ انهاء الزيارة', 'Visit end', visitStart),
      fld('وصف_المخالفة', 'وصف المخالفة', 'Violation description', desc), fld('رقم_بند_اللائحة', 'رقم بند اللائحة', 'Regulation item', `${1 + (hash(idKey % 1e6, 78) % 40)}/${1 + (hash(idKey % 1e6, 79) % 9)}`), fld('اسم_اللائحة', 'اسم اللائحة', 'Regulation', 'لائحة الغرامات والجزاءات البلدية (تجريبية)'),
      fld('رقم_السداد', 'رقم السداد', 'SADAD number', sadad), fld('قيمة_الفاتورة', 'قيمة الفاتورة', 'Invoice value', gross), fld('قيمة_المخالفة', 'قيمة المخالفة', 'Violation value', violationValue),
      fld('اسم_النشاط', 'اسم النشاط', 'Activity', act[0]), fld('رقم_نشاط_الأيزيك', 'رقم نشاط الأيزيك', 'ISIC code', act[2]), fld('رقم_السجل_التجاري', 'رقم السجل التجاري', 'CR number', crNoOf(st.payer[i])),
      fld('حالة_الاعتماد', 'حالة الاعتماد', 'Approval status', 'معتمدة'), fld('تاريخ_اعتماد_المخالفة', 'تاريخ اعتماد المخالفة', 'Approval date', rec.issueDate), fld('اسم_المعتمد', 'اسم المعتمد', 'Approver', personName(hash(idKey % 1e6, 80) % 300).ar),
      fld('رقم_المخالفة_في_ايفاء', 'رقم المخالفة في إيفاء', 'Efaa violation number', rec.violationNumber), fld('معرف_المخالفة', 'معرف المخالفة', 'Violation id', `V${pad(idKey % 1e8, 9)}`), fld('يتطلب_التنبيه_لأول_مرة', 'يتطلب التنبيه لأول مرة', 'First-time warning required', 'لا'),
      fld('حالة_السداد', 'حالة السداد', 'Payment status', paidRaw), fld('رمز_حجم_المنشأة', 'رمز حجم المنشأة', 'Facility size code', size[0]), fld('حجم_المنشأة', 'حجم المنشأة', 'Facility size', size[1]), fld('هل_تم_التصحيح', 'هل تم التصحيح', 'Corrected', hash(idKey % 1e6, 81) % 100 < 35 ? 'نعم' : 'لا'), fld('مدير_الرقابة', 'مدير الرقابة', 'Supervision manager', personName(hash(idKey % 1e6, 82) % 80).ar)
    ]));
    if (diff) out.related.push({ kind: 'value_gap', label: BI(`قيمة المخالفة (${Math.round(violationValue).toLocaleString('en-US')}) تختلف عن قيمة الفاتورة (${Math.round(gross).toLocaleString('en-US')}) — تُحتسب قيمة الفاتورة`, `Violation value differs from the invoice value - the invoice value is counted`) });
    out.checks = { invoiceValue: gross, violationValue, valuesDiffer: diff };
  } else if (src.key === 'housing_sales') {
    out.providingSystem = 'قطاع الإسكان (لا مخطط فواتير مرفق)';
    out.importVersion = IMPORT_VERSIONS.tahseel_central;
    out.views.push(view('HOUSING_SALE', '—', BI('بيع سكني (بنية الفاتورة الموحدة فقط)', 'Residential sale (unified-invoice structure only)'), [
      fld('BUYER_REF', 'مرجع المشتري', 'Buyer reference', payer.ar), fld('UNIT_REF', 'مرجع الوحدة', 'Unit reference', `UNIT-${pad(hash(idKey % 1e6, 91) % 1e6, 6)}`), fld('SADAD', 'رقم سداد', 'SADAD number', sadad), fld('SALE_AMOUNT', 'قيمة البيع', 'Sale amount', gross)
    ]));
    out.notes.push(BI('لا يوجد مخطط فواتير للمبيعات السكنية في الملفات المرفقة؛ البيانات تتبع بنية الفاتورة الموحدة فقط.', 'There is no sales-invoice schema in the supplied files; the data follows the unified-invoice structure only.'));
  } else if (src.key === 'investment') {
    out.providingSystem = 'فرص (عقود) ثم تحصيل';
    out.importVersion = IMPORT_VERSIONS.furas;
    out.views.push(view('FURAS_CONTRACT_PAYMENT', 'Furas', BI('دفعة عقد فرص', 'Furas contract payment'), [
      fld('contract_no', 'رقم العقد', 'Contract number', rec.co || rec.contract?.ref || null), fld('installment_no', 'رقم الدفعة', 'Installment', rec.contractPaymentNo), fld('installments_total', 'عدد الدفعات', 'Installments', rec.contractPaymentTotal), fld('contract_status', 'حالة ربط العقد', 'Contract link state', rec.contract?.status)
    ]));
  }

  /* ---------------------------------------------------------------- Incorta revenue lines (ENT_REVENUES): the invoice total is REPEATED on every line */
  const tot = rec.lineItems.reduce((s, l) => s + l.amount, 0);
  const settleDay = pf.last ? addDays(pf.last, 1 + (hash(idKey % 1e6, 95) % 3)) : null;
  out.revenueLines = rec.lineItems.map((l) => ({
    REVENUE_KEY: `RV-${pad(idKey % 1e8, 9)}-${l.no}`, DETAIL_ID: l.no, ACCOUNT_NO: sadad, SADAD_TRANSACTION_ID: pf.last ? `TX${pad(hash(idKey % 1e6, 96) % 1e10, 10)}` : null,
    APPLICATION_NAME: SOURCES[st.src[i]].platform, TOTAL_AMOUNT: gross, DETAIL_AMOUNT: l.amount, GFS_MAIN_CODE: GFS_BY_SOURCE[src.key] || null, GFS_NAME: l.name, PARENT_NAME: profile?.label?.ar || src.key, REVENUE_VALID: 'Y', FULL_COLLECTION: 'Y',
    ISSUE_DATE_KEY: rec.issueDate, EXPIRATION_DATE_KEY: rec.dueDate, PAYMENT_DATE_KEY: pf.last, RECONCILITION_DATE_KEY: settleDay, CANCELATION_DATE_KEY: rec.cancelled ? rec.cancelled.date : null,
    PAYMENT_STATUS: rec.cancelled ? 'ملغاة' : pf.paid >= gross - 0.5 ? 'مسددة' : pf.paid > 0 ? 'مسددة جزئياً' : 'غير مسددة', CHANNEL: pf.last ? (rec.payments[rec.payments.length - 1]?.channel || null) : null
  }));
  out.checks.revenueLines = { lines: out.revenueLines.length, sumOfDetailAmount: tot, invoiceTotal: gross, totalRepeatedOnEveryLine: out.revenueLines.length > 1, sumEqualsInvoice: Math.abs(tot - gross) < 0.5, knownAmountConflict: rec.amountCheck?.status === 'conflict' };

  /* ---------------------------------------------------------------- links between systems (one unified invoice, several supplying systems) */
  const central = st.scope[i] === 0;
  out.links.unshift({ system: central ? 'تحصيل' : 'تقارير الأمانات الداخلية', dataset: central ? 'invoice_details' : 'internal_reports', importVersion: central ? IMPORT_VERSIONS.tahseel_central : IMPORT_VERSIONS.tahseel_internal, keyField: 'رقم الفاتورة', key: rec.id, role: 'primary', note: BI('المرجع لحالة الفاتورة والتحصيل', 'Reference for invoice status and collection') });
  out.links.push({ system: 'إنكورتا', dataset: 'ENT_REVENUES', importVersion: IMPORT_VERSIONS.incorta_items, keyField: 'ACCOUNT_NO', key: sadad, role: 'items', note: BI(`${out.revenueLines.length} بند؛ المبلغ الإجمالي مكرر على كل بند ويُحتسب مرة`, `${out.revenueLines.length} line(s); the total repeats on every line and is counted once`) });
  if (central) out.links.push({ system: 'مكين', dataset: 'invoice_amanah', importVersion: IMPORT_VERSIONS.makeen, keyField: 'رقم الفاتورة', key: rec.id, role: 'amanah', present: st.alink[i] !== 2, note: st.alink[i] === 2 ? BI('غير موجودة في مكين — الأمانة «غير محدد»', 'Not in Makeen - Amanah shown as unassigned') : BI('تحدد الأمانة والبلدية', 'Gives the Amanah and municipality') });
  if (src.key === 'fines') out.links.push({ system: 'إيفاء', dataset: 'violations_v2', importVersion: IMPORT_VERSIONS.efaa_v2, keyField: 'رقم المخالفة', key: rec.violationNumber, role: 'violation', note: BI('الحالة كما في إيفاء تُحفظ منفصلة عن حالة تحصيل', 'The Efaa status is kept apart from the Tahseel status') });
  if (src.key === 'tobacco' || src.key === 'accommodation') out.links.push({ system: src.key === 'tobacco' ? 'منصة التبغ' : 'منصة الإيواء', dataset: 'TB_ENT_INVOICES', importVersion: out.importVersion, keyField: 'INVOICE_KEY / SADAD_NO', key: sadad, role: 'activity-source', note: BI('الإفصاح ← الجدولة ← المنشأة', 'Disclosure -> schedule -> facility') });
  if (src.key === 'white_lands') out.links.push({ system: 'منظومة الأراضي البيضاء', dataset: 'DS_038_IdleLandInvoices', importVersion: IMPORT_VERSIONS.white_lands, keyField: 'SadadNum / InvoiceId', key: sadad, role: 'activity-source', note: BI('الفاتورة ← الصك ← القطعة ← المالك', 'Invoice -> deed -> land plot -> owner') });
  if (src.key === 'licenses' || src.key === 'municipal_fees') out.links.push({ system: 'بلدي', dataset: 'BALADY_BILLS', importVersion: IMPORT_VERSIONS.balady, keyField: 'BILL_NUMBER', key: sadad, role: 'activity-source', note: BI('يربط الفاتورة بالرخصة والطلب والمالك', 'Links the bill to the licence, request and owner') });
  if (src.key === 'investment' && rec.co) out.links.push({ system: 'فرص', dataset: 'contracts_payments', importVersion: IMPORT_VERSIONS.furas, keyField: 'رقم العقد + رقم الدفعة', key: `${rec.co} / ${rec.contractPaymentNo}`, role: 'contract' });
  if (rec.executionNo && src.key === 'investment') out.links.push({ system: 'سند', dataset: 'execution_requests', importVersion: IMPORT_VERSIONS.sanad, keyField: 'رقم طلب التنفيذ', key: rec.executionNo, role: 'enforcement', note: BI('التنفيذ لا يُحتسب تحصيلاً ولا يُضاف للمديونية', 'Execution is not collection and is not added to the debt') });
  if (pf.last) out.links.push({ system: 'سداد', dataset: 'settlement', importVersion: IMPORT_VERSIONS.sadad, keyField: 'SADAD_TRANSACTION_ID', key: out.revenueLines[0]?.SADAD_TRANSACTION_ID, role: 'settlement', note: BI('تاريخ التسوية يلي تاريخ السداد ولا يحل محله', 'The settlement date follows, and never replaces, the payment date') });
  out.countedOnce = true;
  out.linkSummary = BI(`فاتورة موحدة واحدة تحمل ${out.links.length} سجلات مصدرية؛ المبلغ ${Math.round(gross).toLocaleString('en-US')} يُحتسب مرة واحدة.`, `One unified invoice carries ${out.links.length} source records; the amount ${Math.round(gross).toLocaleString('en-US')} is counted once.`);
  void D; void CHANNELS; void violationOf;
  return out;
}
