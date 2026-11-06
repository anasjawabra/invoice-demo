// IntelliBill demo data (ES module)
// Source: legacy assets/js/data.js

/* ---------- Demo accounts (DISPLAY ONLY) ----------
   Sign-in is verified by the data service (server/identity); the browser bundle holds NO passwords. This list is only the display names of the three seeded demo accounts
   (the same names the server seeds), kept for tests and any page that needs to name a demo user. */
export const DEMO_ACCOUNT_HINTS = [
  { user: 'demo', name: 'Li Fangjun', nameEn: 'Li Fangjun', nameAr: 'Li Fangjun', role: 'Shared Service Center · Manager', roleEn: 'Shared Service Center · Manager', roleAr: 'مركز الخدمات المشتركة · مدير', avatar: 'LF' },
  { user: 'auditor', name: 'Ahmad Al-Saud', nameEn: 'Ahmad Al-Saud', nameAr: 'أحمد آل سعود', role: 'Auditor', roleEn: 'Auditor', roleAr: 'مدقق', avatar: 'AS' },
  { user: 'admin', name: 'System Admin', nameEn: 'System Admin', nameAr: 'مدير النظام', role: 'Platform Admin', roleEn: 'Platform Admin', roleAr: 'مدير المنصة', avatar: 'AD' }
];

/* ---------- Invoices ---------- */
// Every invoice also carries the Amanah/beneficiary-ID fields a real
// extract joins in (see gfsForInvoice/collectionStatusFor below) — this is
// what makes the Invoices list an AGGREGATOR view, not just a bill list.
// None of the ORIGINAL fields below are renamed or removed: `.tag` still
// drives RECON/OCR_SAMPLES/NODE_DRAWERS, `.status` still drives the
// Dashboard lifecycle tiles and Assistant stats, `.payType`/`.collectedVia`
// still drive the voluntary/enforcement split, `.co` still drives the
// Invoices deep-link, and `.entityEn` is still the exact PAYER_MASTER key.
export const INVOICES = [
  {
    id: '177-882607310000', billerId: '177', sadadNo: '882607310000',
    payType: 'deferred',
    centralSource: true,
    entity: 'Al-Rajhi Construction Group',
    entityEn: 'Al-Rajhi Construction Group',
    entityAr: 'مجموعة الراجحي للإنشاءات',
    amanah: 'Riyadh Amanah', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض',
    beneficiaryId: '1042883055',
    amount: 1749000,
    currency: 'SAR',
    source: 'Foras',
    co: 'CO-88231',
    vat: '3001234567800003',
    date: '2026-07-26',
    status: 'pending',
    risk: 12,
    confidence: 0.97,
    tag: 'normal'
  },
  {
    id: '177-882607300000', billerId: '177', sadadNo: '882607300000',
    payType: 'deferred',
    centralSource: true,
    entity: 'NEOM Logistics',
    entityEn: 'NEOM Logistics',
    entityAr: 'نيوم للخدمات اللوجستية',
    amanah: 'Tabuk Amanah', amanahEn: 'Tabuk Amanah', amanahAr: 'أمانة منطقة تبوك',
    beneficiaryId: '7009988766',
    violationNumber: '10000020226730',
    amount: 307000,
    currency: 'SAR',
    source: 'Mumathil',
    co: 'CO-88192',
    vat: '3009988776600001',
    date: '2026-07-26',
    status: 'anomaly',
    risk: 82,
    confidence: 0.71,
    tag: 'fraud'
  },
  {
    id: '177-882607290000', billerId: '177', sadadNo: '882607290000',
    payType: 'deferred',
    centralSource: true,
    entity: 'Saudi Tech Solutions',
    entityEn: 'Saudi Tech Solutions',
    entityAr: 'الحلول التقنية السعودية',
    amanah: 'Riyadh Amanah', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض',
    municipality: 'Al-Olaya', municipalityEn: 'Al-Olaya Municipality', municipalityAr: 'بلدية العليا',
    beneficiaryId: '1022334455',
    amount: 87500,
    currency: 'SAR',
    source: 'Foras',
    co: 'CO-88155',
    vat: '3002233445500007',
    date: '2026-07-25',
    status: 'approved',
    risk: 8,
    confidence: 0.99,
    tag: 'normal',
    // Cash arrived because the payer settled on their own — the other half
    // of the "collected" split the stakeholder asked for (voluntary vs forced).
    collectedVia: 'voluntary'
  },
  {
    id: '177-882607280000', billerId: '177', sadadNo: '882607280000',
    payType: 'deferred',
    centralSource: true,
    entity: 'Gulf Facility Mgmt',
    entityEn: 'Gulf Facility Mgmt',
    entityAr: 'إدارة مرافق الخليج',
    amanah: 'Eastern Province Amanah', amanahEn: 'Eastern Province Amanah', amanahAr: 'أمانة المنطقة الشرقية',
    beneficiaryId: '1041883055',
    violationNumber: '10000020226728',
    amount: 1099000,
    currency: 'SAR',
    source: 'Mumathil',
    co: 'CO-88231',
    vat: '3001234567800003',
    date: '2026-07-25',
    status: 'duplicate',
    risk: 0,
    confidence: 0.95,
    tag: 'dup'
  },
  {
    id: '177-882607270000', billerId: '177', sadadNo: '882607270000',
    payType: 'deferred',
    centralSource: true,
    entity: 'Aramco Logistics Supply',
    entityEn: 'Aramco Logistics Supply',
    entityAr: 'أرامكو للإمداد اللوجستي',
    amanah: 'Eastern Province Amanah', amanahEn: 'Eastern Province Amanah', amanahAr: 'أمانة المنطقة الشرقية',
    municipality: 'Al-Khobar', municipalityEn: 'Al-Khobar Municipality', municipalityAr: 'بلدية الخبر',
    beneficiaryId: '2055667788',
    hasOpenObjection: true,
    amount: 4835500,
    currency: 'SAR',
    source: 'Baladi',
    co: 'CO-87990',
    vat: '3005566778800002',
    date: '2026-07-24',
    status: 'review',
    risk: 46,
    confidence: 0.68,
    tag: 'taxfail'
  },
  {
    id: '010-882607260000', billerId: '010', sadadNo: '882607260000',
    payType: 'prepaid',
    centralSource: false,
    entity: 'Riyadh Municipal Works',
    entityEn: 'Riyadh Municipal Works',
    entityAr: 'أعمال بلدية الرياض',
    amanah: 'Riyadh Amanah', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض',
    beneficiaryId: '1077889900',
    licenseNumber: '450210465726',
    amount: 1073000,
    currency: 'SAR',
    source: 'Amanah Internal Reports (Riyadh Amanah)',
    co: 'CO-87921',
    vat: '3007788990000004',
    date: '2026-07-24',
    status: 'approved',
    risk: 15,
    confidence: 0.96,
    tag: 'normal'
  },
  {
    id: '027-882607250000', billerId: '027', sadadNo: '882607250000',
    payType: 'prepaid',
    centralSource: false,
    entity: 'STC Telecom Services',
    entityEn: 'STC Telecom Services',
    entityAr: 'STC لخدمات الاتصالات',
    amanah: 'Makkah Amanah', amanahEn: 'Makkah Amanah', amanahAr: 'أمانة منطقة مكة المكرمة',
    municipality: 'Al-Aziziyah', municipalityEn: 'Al-Aziziyah Municipality', municipalityAr: 'بلدية العزيزية',
    municipalitySourceValues: ['بلدية العزيزية', 'بلدية عسفان'], // two source systems name different municipalities for this invoice (one is not in the reference): kept as a CONFLICT for review, never merged
    beneficiaryId: '1033445566',
    licenseNumber: '450310556725',
    amount: 272500,
    currency: 'SAR',
    source: 'Amanah Internal Reports (Makkah Amanah)',
    co: 'CO-87880',
    vat: '3003344556600009',
    date: '2026-07-23',
    status: 'approved',
    risk: 5,
    confidence: 0.98,
    tag: 'normal'
  },
  {
    id: '177-882607240000', billerId: '177', sadadNo: '882607240000',
    payType: 'deferred',
    centralSource: true,
    entity: 'Bahri Maritime Logistics',
    entityEn: 'Bahri Maritime Logistics',
    entityAr: 'البحري للخدمات اللوجستية البحرية',
    amanah: 'Jeddah Amanah', amanahEn: 'Jeddah Amanah', amanahAr: 'أمانة محافظة جدة',
    municipality: 'Al-Shati', municipalityEn: 'Al-Shati Municipality', municipalityAr: 'بلدية الشاطئ',
    beneficiaryId: '3066778899',
    amount: 1601500,
    currency: 'SAR',
    source: 'Baladi',
    co: 'CO-87812',
    vat: '3006677889900005',
    date: '2026-07-23',
    status: 'pending',
    risk: 33,
    confidence: 0.9,
    tag: 'normal'
  },
  {
    id: '177-882607220000', billerId: '177', sadadNo: '882607220000',
    payType: 'deferred',
    centralSource: true,
    entity: 'Al-Noor Trading',
    entityEn: 'Al-Noor Trading',
    entityAr: 'النور للتجارة',
    amanah: 'Jeddah Amanah', amanahEn: 'Jeddah Amanah', amanahAr: 'أمانة محافظة جدة',
    beneficiaryId: '1044556677',
    amount: 687500,
    currency: 'SAR',
    source: 'Mumathil',
    co: 'CO-87764',
    vat: '3004455667700006',
    date: '2026-07-20',
    status: 'approved',
    risk: 10,
    confidence: 0.97,
    tag: 'normal',
    // Cash arrived only after referral to the judiciary and a forced bank
    // transfer — the "collected via enforcement" half of the same split.
    collectedVia: 'enforcement'
  },
  // Trailing 12-month history — gives the Dashboard's period filter
  // (previous month / 3 / 6 / 12 months / by year / custom range) real
  // dated rows to show visibly different totals for, instead of every
  // preset collapsing to the same single-week cluster above.
  {
    id: '177-882508100000', billerId: '177', sadadNo: '882508100000', payType: 'deferred', centralSource: true,
    entity: 'Red Sea Global Contracting', entityEn: 'Red Sea Global Contracting', entityAr: 'البحر الأحمر للمقاولات',
    amanah: 'Tabuk Amanah', amanahEn: 'Tabuk Amanah', amanahAr: 'أمانة منطقة تبوك', beneficiaryId: '3088112233',
    amount: 599000, currency: 'SAR', source: 'Baladi', co: 'CO-86210', vat: '3008811223300010',
    date: '2025-08-14', status: 'approved', risk: 9, confidence: 0.97, tag: 'normal'
  },
  {
    id: '028-882508100000', billerId: '028', sadadNo: '882508100000', payType: 'prepaid', centralSource: false,
    entity: 'Jeddah Development Co.', entityEn: 'Jeddah Development Co.', entityAr: 'جدة للتطوير',
    amanah: 'Jeddah Amanah', amanahEn: 'Jeddah Amanah', amanahAr: 'أمانة محافظة جدة', beneficiaryId: '1022001100',
    amount: 266500, currency: 'SAR', source: 'Amanah Internal Reports (Jeddah Amanah)', co: 'CO-86340', vat: '3002200110000011',
    date: '2025-09-10', status: 'approved', risk: 6, confidence: 0.98, tag: 'normal'
  },
  {
    id: '177-882509020000', billerId: '177', sadadNo: '882509020000', payType: 'deferred', centralSource: true,
    entity: 'NEOM Logistics', entityEn: 'NEOM Logistics', entityAr: 'نيوم للخدمات اللوجستية',
    amanah: 'Tabuk Amanah', amanahEn: 'Tabuk Amanah', amanahAr: 'أمانة منطقة تبوك', beneficiaryId: '7009988766',
    amount: 630500, currency: 'SAR', source: 'Mumathil', co: 'CO-86510', vat: '3009988776600001',
    date: '2025-10-05', status: 'approved', risk: 11, confidence: 0.96, tag: 'normal'
  },
  {
    id: '177-882509400000', billerId: '177', sadadNo: '882509400000', payType: 'deferred', centralSource: true,
    entity: 'Al-Ahsa Agricultural Est.', entityEn: 'Al-Ahsa Agricultural Est.', entityAr: 'مؤسسة الأحساء الزراعية',
    amanah: 'Al-Ahsa Amanah', amanahEn: 'Al-Ahsa Amanah', amanahAr: 'أمانة محافظة الأحساء', beneficiaryId: '1044115566',
    amount: 169500, currency: 'SAR', source: 'Foras', co: 'CO-86690', vat: '3004411556600012',
    date: '2025-11-18', status: 'duplicate', risk: 0, confidence: 0.93, tag: 'dup'
  },
  {
    id: '177-882509750000', billerId: '177', sadadNo: '882509750000', payType: 'deferred', centralSource: true,
    entity: 'Al-Rajhi Construction Group', entityEn: 'Al-Rajhi Construction Group', entityAr: 'مجموعة الراجحي للإنشاءات',
    amanah: 'Riyadh Amanah', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض', beneficiaryId: '1042883055',
    amount: 937500, currency: 'SAR', source: 'Foras', co: 'CO-86840', vat: '3001234567800003',
    date: '2025-12-22', status: 'approved', risk: 14, confidence: 0.97, tag: 'normal'
  },
  {
    id: '177-882605200000', billerId: '177', sadadNo: '882605200000', payType: 'deferred', centralSource: true,
    entity: 'Bahri Maritime Logistics', entityEn: 'Bahri Maritime Logistics', entityAr: 'البحري للخدمات اللوجستية البحرية',
    amanah: 'Jeddah Amanah', amanahEn: 'Jeddah Amanah', amanahAr: 'أمانة محافظة جدة', beneficiaryId: '3066778899',
    amount: 2641000, currency: 'SAR', source: 'Baladi', co: 'CO-87010', vat: '3006677889900005',
    date: '2026-01-12', status: 'approved', risk: 20, confidence: 0.92, tag: 'normal'
  },
  {
    id: '027-882605200000', billerId: '027', sadadNo: '882605200000', payType: 'prepaid', centralSource: false,
    entity: 'STC Telecom Services', entityEn: 'STC Telecom Services', entityAr: 'STC لخدمات الاتصالات',
    amanah: 'Makkah Amanah', amanahEn: 'Makkah Amanah', amanahAr: 'أمانة منطقة مكة المكرمة', beneficiaryId: '1033445566',
    amount: 182000, currency: 'SAR', source: 'Amanah Internal Reports (Makkah Amanah)', co: 'CO-87070', vat: '3003344556600009',
    date: '2026-01-28', status: 'approved', risk: 4, confidence: 0.99, tag: 'normal'
  },
  {
    id: '177-882605450000', billerId: '177', sadadNo: '882605450000', payType: 'deferred', centralSource: true,
    entity: 'Tabuk Housing Authority', entityEn: 'Tabuk Housing Authority', entityAr: 'هيئة إسكان تبوك',
    amanah: 'Tabuk Amanah', amanahEn: 'Tabuk Amanah', amanahAr: 'أمانة منطقة تبوك', beneficiaryId: '1055002233',
    amount: 578000, currency: 'SAR', source: 'Mumathil', co: 'CO-87140', vat: '3005500223300013',
    date: '2026-02-15', status: 'review', risk: 39, confidence: 0.74, tag: 'taxfail',
    // Exclusion category: struck-off commercial registry / deceased debtor —
    // excluded from net-invoiced entirely, never counted as collected.
    debtorInvalid: true,
    debtorInvalidReason: 'struck_off_registry'
  },
  {
    id: '177-882605600000', billerId: '177', sadadNo: '882605600000', payType: 'deferred', centralSource: true,
    entity: 'Gulf Facility Mgmt', entityEn: 'Gulf Facility Mgmt', entityAr: 'إدارة مرافق الخليج',
    amanah: 'Eastern Province Amanah', amanahEn: 'Eastern Province Amanah', amanahAr: 'أمانة المنطقة الشرقية', beneficiaryId: '1041883055',
    amount: 1089500, currency: 'SAR', source: 'Mumathil', co: 'CO-87220', vat: '3001234567800003',
    date: '2026-03-09', status: 'approved', risk: 10, confidence: 0.98, tag: 'normal'
  },
  {
    id: '177-882605750000', billerId: '177', sadadNo: '882605750000', payType: 'deferred', centralSource: true,
    entity: 'Saudi Tech Solutions', entityEn: 'Saudi Tech Solutions', entityAr: 'الحلول التقنية السعودية',
    amanah: 'Riyadh Amanah', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض', beneficiaryId: '1022334455',
    amount: 625500, currency: 'SAR', source: 'Foras', co: 'CO-87300', vat: '3002233445500007',
    date: '2026-03-30', status: 'approved', risk: 7, confidence: 0.98, tag: 'normal'
  },
  {
    id: '177-882605900000', billerId: '177', sadadNo: '882605900000', payType: 'deferred', centralSource: true,
    entity: 'Aramco Logistics Supply', entityEn: 'Aramco Logistics Supply', entityAr: 'أرامكو للإمداد اللوجستي',
    amanah: 'Eastern Province Amanah', amanahEn: 'Eastern Province Amanah', amanahAr: 'أمانة المنطقة الشرقية', beneficiaryId: '2055667788',
    amount: 1465500, currency: 'SAR', source: 'Baladi', co: 'CO-87380', vat: '3005566778800002',
    date: '2026-04-20', status: 'approved', risk: 17, confidence: 0.95, tag: 'normal'
  },
  {
    id: '010-882606050000', billerId: '010', sadadNo: '882606050000', payType: 'prepaid', centralSource: false,
    entity: 'Riyadh Municipal Works', entityEn: 'Riyadh Municipal Works', entityAr: 'أعمال بلدية الرياض',
    amanah: 'Riyadh Amanah', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض', beneficiaryId: '1077889900',
    amount: 1109000, currency: 'SAR', source: 'Amanah Internal Reports (Riyadh Amanah)', co: 'CO-87450', vat: '3007788990000004',
    date: '2026-05-11', status: 'approved', risk: 12, confidence: 0.96, tag: 'normal'
  },
  {
    id: '177-882606200000', billerId: '177', sadadNo: '882606200000', payType: 'deferred', centralSource: true,
    entity: 'Al-Noor Trading', entityEn: 'Al-Noor Trading', entityAr: 'النور للتجارة',
    amanah: 'Jeddah Amanah', amanahEn: 'Jeddah Amanah', amanahAr: 'أمانة محافظة جدة', beneficiaryId: '1044556677',
    amount: 670000, currency: 'SAR', source: 'Mumathil', co: 'CO-87560', vat: '3004455667700006',
    date: '2026-05-27', status: 'approved', risk: 8, confidence: 0.97, tag: 'normal',
    collectedVia: 'voluntary'
  },
  {
    id: '177-882606350000', billerId: '177', sadadNo: '882606350000', payType: 'deferred', centralSource: true,
    entity: 'Metro Transport', entityEn: 'Metro Transport', entityAr: 'مترو للنقل',
    amanah: 'Riyadh Amanah', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض', beneficiaryId: '3066004455',
    amount: 1363500, currency: 'SAR', source: 'Baladi', co: 'CO-87630', vat: '3006600445500014',
    date: '2026-06-08', status: 'approved', risk: 15, confidence: 0.95, tag: 'normal',
    collectedVia: 'enforcement'
  },
  {
    id: '177-882606500000', billerId: '177', sadadNo: '882606500000', payType: 'deferred', centralSource: true,
    entity: 'Coastal Logistics', entityEn: 'Coastal Logistics', entityAr: 'الساحلية للخدمات اللوجستية',
    amanah: 'Eastern Province Amanah', amanahEn: 'Eastern Province Amanah', amanahAr: 'أمانة المنطقة الشرقية', beneficiaryId: '3066770011',
    amount: 572000, currency: 'SAR', source: 'Foras', co: 'CO-87700', vat: '3006677001100015',
    date: '2026-06-24', status: 'pending', risk: 22, confidence: 0.9, tag: 'normal',
    // Investment-category invoice (Foras) with no linked Furas contract —
    // the flag rule confirmed across the Mini-BRD and the raw transcript.
    hasContract: false
  },
  // Remaining 9 provinces (previously "no data in this demo") — one fictional
  // invoice each, so every Amanah/province has at least some coverage across
  // the map, the Amanah filter, and the target-achievement ring gauges.
  {
    id: '177-882608010000', billerId: '177', sadadNo: '882608010000', payType: 'deferred', centralSource: true,
    entity: 'Najran Border Trading Co.', entityEn: 'Najran Border Trading Co.', entityAr: 'شركة نجران للتجارة الحدودية',
    amanah: 'Najran Amanah', amanahEn: 'Najran Amanah', amanahAr: 'أمانة منطقة نجران', beneficiaryId: '1099887701',
    amount: 415000, currency: 'SAR', source: 'Baladi', co: 'CO-88301', vat: '3009988770100016',
    date: '2025-09-05', status: 'approved', risk: 11, confidence: 0.97, tag: 'normal'
  },
  {
    id: '177-882608020000', billerId: '177', sadadNo: '882608020000', payType: 'prepaid', centralSource: false,
    entity: 'Arar Logistics Hub', entityEn: 'Arar Logistics Hub', entityAr: 'مركز عرعر اللوجستي',
    amanah: 'Northern Borders Amanah', amanahEn: 'Northern Borders Amanah', amanahAr: 'أمانة منطقة الحدود الشمالية', beneficiaryId: '1088776602',
    amount: 268000, currency: 'SAR', source: 'Mumathil', co: 'CO-88321', vat: '3008877660200017',
    date: '2026-02-01', status: 'pending', risk: 27, confidence: 0.89, tag: 'normal'
  },
  {
    id: '177-882608030000', billerId: '177', sadadNo: '882608030000', payType: 'deferred', centralSource: true,
    entity: 'Hail Agri Industries', entityEn: 'Hail Agri Industries', entityAr: 'حائل للصناعات الزراعية',
    amanah: "Ha'il Amanah", amanahEn: "Ha'il Amanah", amanahAr: 'أمانة منطقة حائل', beneficiaryId: '1077665503',
    amount: 512500, currency: 'SAR', source: 'Foras', co: 'CO-88341', vat: '3007766550300018',
    date: '2025-10-18', status: 'approved', risk: 9, confidence: 0.98, tag: 'normal'
  },
  {
    id: '177-882608040000', billerId: '177', sadadNo: '882608040000', payType: 'deferred', centralSource: true,
    entity: 'Abha Highland Developers', entityEn: 'Abha Highland Developers', entityAr: 'مطورو أبها للمرتفعات',
    amanah: 'Asir Amanah', amanahEn: 'Asir Amanah', amanahAr: 'أمانة منطقة عسير', beneficiaryId: '1066554404',
    amount: 891000, currency: 'SAR', source: 'Baladi', co: 'CO-88361', vat: '3006655440400019',
    date: '2025-11-30', status: 'review', risk: 41, confidence: 0.7, tag: 'taxfail'
  },
  {
    id: '006-882608050000', billerId: '006', sadadNo: '882608050000', payType: 'prepaid', centralSource: false,
    entity: 'Madinah Hospitality Group', entityEn: 'Madinah Hospitality Group', entityAr: 'مجموعة المدينة للضيافة',
    amanah: 'Al Madinah Amanah', amanahEn: 'Al Madinah Amanah', amanahAr: 'أمانة المدينة المنورة', beneficiaryId: '1055443305',
    amount: 1245000, currency: 'SAR', source: 'Amanah Internal Reports (Al Madinah Amanah)', co: 'CO-88381', vat: '3005544330500020',
    date: '2026-01-15', status: 'approved', risk: 13, confidence: 0.96, tag: 'normal'
  },
  {
    id: '177-882608060000', billerId: '177', sadadNo: '882608060000', payType: 'deferred', centralSource: true,
    entity: 'Qassim AgroTech', entityEn: 'Qassim AgroTech', entityAr: 'القصيم للتقنية الزراعية',
    amanah: 'Al-Qassim Amanah', amanahEn: 'Al-Qassim Amanah', amanahAr: 'أمانة منطقة القصيم', beneficiaryId: '1044332206',
    amount: 356500, currency: 'SAR', source: 'Foras', co: 'CO-88401', vat: '3004433220600021',
    date: '2026-03-22', status: 'pending', risk: 24, confidence: 0.91, tag: 'normal',
    // Investment-category invoice (Foras) with no linked Furas contract.
    hasContract: false
  },
  {
    id: '177-882608070000', billerId: '177', sadadNo: '882608070000', payType: 'prepaid', centralSource: false,
    entity: 'Al Bahah Tourism Estates', entityEn: 'Al Bahah Tourism Estates', entityAr: 'عقارات الباحة السياحية',
    amanah: 'Al Bahah Amanah', amanahEn: 'Al Bahah Amanah', amanahAr: 'أمانة منطقة الباحة', beneficiaryId: '1033221107',
    amount: 198000, currency: 'SAR', source: 'Baladi', co: 'CO-88421', vat: '3003322110700022',
    date: '2025-12-08', status: 'approved', risk: 6, confidence: 0.98, tag: 'normal'
  },
  {
    id: '177-882608080000', billerId: '177', sadadNo: '882608080000', payType: 'deferred', centralSource: true,
    entity: 'Jazan Port Services', entityEn: 'Jazan Port Services', entityAr: 'خدمات ميناء جازان',
    amanah: 'Jazan Amanah', amanahEn: 'Jazan Amanah', amanahAr: 'أمانة منطقة جازان', beneficiaryId: '1022110008',
    amount: 733500, currency: 'SAR', source: 'Mumathil', co: 'CO-88441', vat: '3002211000800023',
    date: '2026-04-05', status: 'duplicate', risk: 0, confidence: 0.94, tag: 'dup'
  },
  {
    id: '103-882608090000', billerId: '103', sadadNo: '882608090000', payType: 'prepaid', centralSource: false,
    entity: 'Al Jawf Agricultural Co.', entityEn: 'Al Jawf Agricultural Co.', entityAr: 'شركة الجوف الزراعية',
    amanah: 'Al Jawf Amanah', amanahEn: 'Al Jawf Amanah', amanahAr: 'أمانة منطقة الجوف', beneficiaryId: '1011009909',
    amount: 287000, currency: 'SAR', source: 'Amanah Internal Reports (Al Jawf Amanah)', co: 'CO-88461', vat: '3001100990900024',
    date: '2026-05-19', status: 'approved', risk: 8, confidence: 0.97, tag: 'normal'
  }
];

/* ---------- GFS revenue-account classification, by originating platform ----------
   A real aggregator extract joins every invoice back to a GFS
   revenue account regardless of which of the 4 platforms actually issued
   it — derived here once rather than repeated on all 24 records. */
const GFS_BY_SOURCE = {
  Foras: { code: '1421901', name: 'Investment Fees', nameEn: 'Investment Fees', nameAr: 'رسوم الاستثمار' },
  Mumathil: { code: '1438001', name: 'Penalties & Fines', nameEn: 'Penalties & Fines', nameAr: 'جزاءات وغرامات مفروضة بموجب أنظمة الجهة' },
  Baladi: { code: '142113', name: 'Municipal Fees', nameEn: 'Municipal Fees', nameAr: 'رسوم بلدية متنوعة' }
};
const GFS_INTERNAL = { code: '142162', name: 'Commercial License Fees', nameEn: 'Commercial License Fees', nameAr: 'اصدار رخص الانشطة التجارية' };

export function gfsForInvoice(inv) {
  if (!inv) return null;
  if (GFS_BY_SOURCE[inv.source]) return GFS_BY_SOURCE[inv.source];
  if (inv.source?.startsWith('Amanah Internal Reports')) return GFS_INTERNAL;
  return null;
}

/* ---------- Status dictionary ---------- */
export const STATUS = {
  pending: { label: 'Pending', labelEn: 'Pending', labelAr: 'قيد الانتظار', color: 'blue' },
  approved: { label: 'Approved', labelEn: 'Approved', labelAr: 'تمت الموافقة', color: 'green' },
  anomaly: { label: 'Fraud Warning', labelEn: 'Fraud Warning', labelAr: 'تحذير احتيال', color: 'red' },
  duplicate: {
    label: 'Duplicate Blocked',
    labelEn: 'Duplicate Blocked',
    labelAr: 'منع التكرار',
    color: 'gold'
  },
  review: { label: 'Review Needed', labelEn: 'Review Needed', labelAr: 'مراجعة بشرية', color: 'orange' },
  rejected: { label: 'Rejected', labelEn: 'Rejected', labelAr: 'مرفوض', color: 'grey' }
};
/* ---------- Payer master (Sanad / ERP registry) ----------
   Referenced by the validation & anomaly agents so intermediate tool results
   quote real-looking, internally-consistent payer records. */
export const PAYER_MASTER = {
  'Al-Rajhi Construction Group': {
    cr: 'CR-1010-448120', vatReg: '3001234567800003', sinceYear: 2014,
    invoices90d: 41, onTimeRate: 0.94, defaultRisk: 'low'
  },
  'NEOM Logistics': {
    cr: 'CR-7010-990015', vatReg: '3009988776600001', sinceYear: 2026,
    invoices90d: 0, onTimeRate: null, defaultRisk: 'unknown'
  },
  'Gulf Facility Mgmt': {
    cr: 'CR-1010-448120', vatReg: '3001234567800003', sinceYear: 2018,
    invoices90d: 12, onTimeRate: 0.88, defaultRisk: 'low'
  },
  'Aramco Logistics Supply': {
    cr: 'CR-2055-338890', vatReg: '3005566778800002', sinceYear: 2011,
    invoices90d: 27, onTimeRate: 0.91, defaultRisk: 'low'
  }
};

/* ---------- 3-way reconciliation dataset (Invoice ↔ Collection Order ↔ Accrual Confirmation) ----------
   Per scenario, internally consistent multi-line fee-assessment records + ZATCA 15%
   VAT recompute. `invUnit` = invoice unit rate, `poUnit` = collection-order unit rate,
   `benchUnit` = standard fee-tariff benchmark, `grnQty` = accrual-confirmed qty.
   Status chips are DERIVED in ReconciliationTable from these raw values. */
export const RECON = {
  normal: {
    invoiceNo: '177-882607310000',
    payer: 'Al-Rajhi Construction Group',
    co: 'CO-88231',
    accrual: 'AC-2026-4471',
    contract: 'SANAD-CT-2231',
    currency: 'SAR',
    lines: [
      { no: 1, item: { en: 'Site occupation fee (m²)', ar: 'رسوم إشغال الموقع (م²)' }, qty: 2000, poQty: 2000, grnQty: 2000, invUnit: 375, poUnit: 375, benchUnit: 372 },
      { no: 2, item: { en: 'Construction-waste disposal fee (ton)', ar: 'رسوم التخلص من مخلفات البناء (طن)' }, qty: 250, poQty: 250, grnQty: 250, invUnit: 1400, poUnit: 1400, benchUnit: 1385 },
      { no: 3, item: { en: 'Scaffolding permit fee (month)', ar: 'رسوم ترخيص السقالات الشهرية (شهر)' }, qty: 5, poQty: 5, grnQty: 5, invUnit: 30000, poUnit: 30000, benchUnit: 29500 }
    ],
    vat: { subtotal: 1250000, declared: 187500, expected: 187500, rate: 15 },
    taxId: { value: '3001234567800003', valid: true }
  },
  fraud: {
    invoiceNo: '177-882607300000',
    payer: 'NEOM Logistics',
    co: 'CO-88192',
    accrual: 'AC-2026-4460',
    contract: 'SANAD-CT-7715',
    currency: 'SAR',
    // Invoice↔CO↔Accrual are internally consistent (3-way verification PASSES at Validation);
    // the anomaly signal is fee-vs-tariff, caught downstream by Anomaly & Fraud Detection.
    lines: [
      { no: 1, item: { en: 'Heavy-vehicle route permit fee (trip)', ar: 'رسوم تصريح مسار المركبات الثقيلة (رحلة)' }, qty: 120, poQty: 120, grnQty: 120, invUnit: 3200, poUnit: 3200, benchUnit: 2320 },
      { no: 2, item: { en: 'Fuel & environmental levy', ar: 'رسوم الوقود والبيئة الإضافية' }, qty: 1, poQty: 1, grnQty: 1, invUnit: 102000, poUnit: 102000, benchUnit: 98000 }
    ],
    vat: { subtotal: 486000, declared: 72900, expected: 72900, rate: 15 },
    taxId: { value: '3009988776600001', valid: true }
  },
  dup: {
    invoiceNo: '177-882607280000',
    payer: 'Gulf Facility Mgmt',
    co: 'CO-88231',
    accrual: 'AC-2026-4471',
    contract: 'SANAD-CT-2231',
    currency: 'SAR',
    duplicateOf: '177-882607310000',
    lines: [
      { no: 1, item: { en: 'Facility operating license fee (month)', ar: 'رسوم ترخيص تشغيل المرفق (شهر)' }, qty: 1, poQty: 1, grnQty: 1, invUnit: 1250000, poUnit: 1250000, benchUnit: 1250000 }
    ],
    vat: { subtotal: 1250000, declared: 187500, expected: 187500, rate: 15 },
    taxId: { value: '3001234567800003', valid: true }
  },
  taxfail: {
    invoiceNo: '177-882607270000',
    payer: 'Aramco Logistics Supply',
    co: 'CO-87990',
    accrual: 'AC-2026-4402',
    contract: 'SANAD-CT-2799',
    currency: 'SAR',
    // Line 1 unit rate differs from the Collection Order → total variance +2.4%; VAT declared
    // ≠ ZATCA-expected; tax-ID fails ZATCA check-digit validation.
    lines: [
      { no: 1, item: { en: 'Warehouse zoning fee (month)', ar: 'رسوم تقسيم المستودعات (شهر)' }, qty: 12, poQty: 12, grnQty: 12, invUnit: 180000, poUnit: 173750, benchUnit: 172000 },
      { no: 2, item: { en: 'Fleet registration renewal fee', ar: 'رسوم تجديد تسجيل الأسطول' }, qty: 1, poQty: 1, grnQty: 1, invUnit: 620000, poUnit: 620000, benchUnit: 610000 },
      { no: 3, item: { en: 'Handling & customs levy', ar: 'رسوم المناولة والتخليص الجمركي' }, qty: 1, poQty: 1, grnQty: 1, invUnit: 400000, poUnit: 400000, benchUnit: 395000 }
    ],
    vat: { subtotal: 3180000, declared: 472800, expected: 477000, rate: 15 },
    taxId: { value: '3005566778800002', valid: false }
  }
};

/* ---------- Illustrative Sanad-style enforcement-order / invoice-linkage finding ----------
   Fictional, illustrative-only figures — NOT derived from any real Sanad
   extract or any confidential ministry data. Shaped to demonstrate the same
   kind of finding a real enforcement/invoice linkage audit could surface
   (referral records reviewed, orders actually issued vs. requested, and how
   many of those issued orders carry no linked invoice number), with
   invented case numbers, amounts, and Amanahs for demo purposes only. */
export const SANAD_ENFORCEMENT = {
  recordsReviewed: 31850,
  missingInvoicePct: 7,
  ordersIssued: 2180,
  // Small residual gap (~7%) — the large majority are already linked from
  // prior manual reconciliation work; this remaining slice is the actual
  // backlog this demo's OCR-linking flow (below) illustrates a fix for.
  ordersUnlinked: 153,
  ordersUnlinkedValue: 10000000,
  sample: [
    { enforceNum: 'EN-2607714', amanahEn: 'Riyadh Amanah', amanah: 'Riyadh Amanah', amanahAr: 'أمانة الرياض', amount: 355000, defendant: { en: 'Individual (investor)', ar: 'فرد (مستثمر)' } },
    { enforceNum: 'EN-2119843', amanahEn: 'Eastern Province Amanah', amanah: 'Eastern Province Amanah', amanahAr: 'أمانة المنطقة الشرقية', amount: 590500, defendant: { en: 'Registered company', ar: 'شركة مسجلة في المملكة' } },
    { enforceNum: 'EN-2884026', amanahEn: 'Jeddah Amanah', amanah: 'Jeddah Amanah', amanahAr: 'أمانة محافظة جدة', amount: 875250, defendant: { en: 'Registered company', ar: 'شركة مسجلة في المملكة' } },
    { enforceNum: 'EN-2093317', amanahEn: 'Tabuk Amanah', amanah: 'Tabuk Amanah', amanahAr: 'أمانة منطقة تبوك', amount: 412500, defendant: { en: 'Registered company', ar: 'شركة مسجلة في المملكة' } },
    { enforceNum: 'EN-2451982', amanahEn: 'Makkah Amanah', amanah: 'Makkah Amanah', amanahAr: 'أمانة منطقة مكة المكرمة', amount: 268000, defendant: { en: 'Individual (investor)', ar: 'فرد (مستثمر)' } },
    { enforceNum: 'EN-2760541', amanahEn: 'Al Madinah Amanah', amanah: 'Al Madinah Amanah', amanahAr: 'أمانة المدينة المنورة', amount: 1245000, defendant: { en: 'Registered company', ar: 'شركة مسجلة في المملكة' } }
  ]
};

/* ---------- Utility ---------- */
export function fmtMoney(n) {
  return n.toLocaleString('en-US');
}
