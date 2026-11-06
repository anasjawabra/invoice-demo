// Synthetic blocks (illustrative numbers only) for the hierarchy / flow chart kinds: donut · treemap · sunburst · sankey — used by tests/chart-hier.test.mjs and scripts/make-chart-gallery-hier.mjs.
const B = 1e9; const M = 1e6;
const sum = (a) => a.reduce((t, x) => t + x.value, 0);
const node = (label, kids, value) => (Array.isArray(kids) ? { label, value: sum(kids), children: kids } : { label, value: kids ?? value });
export function hierSamples(lang) {
  const t = (a, e) => (lang === 'ar' ? a : e);
  const srcs = t(['سداد', 'بلدي', 'الأراضي البيضاء', 'غرامات المخالفات'], ['SADAD', 'Baladi', 'White lands', 'Violation fines']);
  const leaves = (seed) => srcs.map((s, k) => node(s, ((seed * 7 + k * 5) % 9 + 2) * 12 * M));
  const direct = t('مباشر (على مستوى الأمانة)', 'Direct (Amanah level)'); const unspec = t('غير محدد', 'Not specified');
  const amanah = (name, munis) => node(name, [...munis.map(([m, s]) => node(m, leaves(s))), node(direct, leaves(3).slice(0, 2)), node(unspec, leaves(4).slice(0, 1))]);
  const tree3 = node(t('صافي المفوتر — الإجمالي', 'Net billed — total'), [
    amanah(t('أمانة منطقة الرياض', 'Riyadh Region Amanah'), [[t('بلدية العليا', 'Olaya Municipality'), 1], [t('بلدية الملز', 'Malaz Municipality'), 2], [t('بلدية الشمال', 'North Municipality'), 5]]),
    amanah(t('أمانة محافظة جدة', 'Jeddah Governorate Amanah'), [[t('بلدية الصفا', 'Safa Municipality'), 6], [t('بلدية البلد', 'Balad Municipality'), 7]]),
    amanah(t('أمانة المنطقة الشرقية', 'Eastern Region Amanah'), [[t('بلدية الدمام', 'Dammam Municipality'), 8]]),
    amanah(t('أمانة منطقة المدينة المنورة', 'Madinah Region Amanah'), [[t('بلدية قباء', 'Quba Municipality'), 9], [t('بلدية العوالي', 'Awali Municipality'), 3]])
  ]);
  const names = t(['أمانة منطقة الرياض', 'أمانة محافظة جدة', 'أمانة المنطقة الشرقية', 'أمانة منطقة المدينة المنورة', 'أمانة منطقة القصيم', 'أمانة منطقة عسير', 'أمانة منطقة تبوك', 'أمانة منطقة حائل', 'أمانة منطقة الجوف', 'أمانة منطقة جازان', 'أمانة العاصمة المقدسة', 'أمانة منطقة الباحة'],
    ['Riyadh Region Amanah', 'Jeddah Governorate Amanah', 'Eastern Region Amanah', 'Madinah Region Amanah', 'Qassim Region Amanah', 'Asir Region Amanah', 'Tabuk Region Amanah', 'Hail Region Amanah', 'Jouf Region Amanah', 'Jazan Region Amanah', 'Makkah Amanah', 'Baha Region Amanah']);
  const vals12 = names.map((_, i) => (13 - i) * 0.31 * B);
  const tree60 = node(t('إجمالي', 'Total'), names.slice(0, 6).map((a, g) => node(a, Array.from({ length: 10 }, (_, k) => node(t(`بند ${g + 1}.${k + 1}`, `Item ${g + 1}.${k + 1}`), ((g * 3 + k * 7) % 11 + 1) * 8 * M)))));
  const mkFlow = (extra) => ({
    nodes: [{ id: 'gross', label: t('إجمالي المفوتر', 'Gross billed'), col: 0, role: 'gross' }, { id: 'excl', label: t('الاستثناءات', 'Exclusions'), col: 1, role: 'exclusions' }, { id: 'net', label: t('صافي المفوتر', 'Net billed'), col: 1, role: 'net' }, { id: 'coll', label: t('المحصّل', 'Collected'), col: 2, role: 'collected' }, { id: 'unc', label: t('غير المحصّل', 'Uncollected'), col: 2, role: 'uncollected' }, ...(extra ? [{ id: 'canc', label: t('ملغاة', 'Cancelled'), col: 2 }, { id: 'dup', label: t('مكررة', 'Duplicate'), col: 2 }, { id: 'ex', label: t('معفاة', 'Exempt'), col: 2 }] : [])],
    links: [{ from: 'gross', to: 'excl', value: 3.27 * B }, { from: 'gross', to: 'net', value: 11.43 * B }, { from: 'net', to: 'coll', value: 7.58 * B }, { from: 'net', to: 'unc', value: 3.85 * B }, ...(extra ? [{ from: 'excl', to: 'canc', value: 2.4 * B }, { from: 'excl', to: 'dup', value: 0.75 * B }, { from: 'excl', to: 'ex', value: 0.12 * B }] : [])]
  });
  const fl = mkFlow(false); const fl2 = mkFlow(true); const T0 = { type: 'chart' };
  return {
    donut: { ...T0, kind: 'donut', title: t('توزيع الاستثناءات بحسب السبب', 'Exclusions by reason'), labels: t(['ملغاة', 'مكررة', 'معفاة', 'أخرى مؤكدة'], ['Cancelled', 'Duplicate', 'Exempt', 'Other confirmed']), series: [{ label: t('المبلغ', 'Amount'), values: [2.4 * B, 0.75 * B, 0.12 * B, 0] }] },
    donut_other: { ...T0, kind: 'donut', title: t('صافي المفوتر بحسب الأمانة', 'Net billed by Amanah'), labels: names, series: [{ label: t('المبلغ', 'Amount'), values: vals12 }] },
    donut_one: { ...T0, kind: 'donut', title: t('جزء واحد', 'One part'), labels: [names[0]], series: [{ label: 'v', values: [5.5 * B] }] },
    donut_neg: { ...T0, kind: 'donut', title: t('قيم سالبة', 'Negative'), labels: ['A', 'B', 'C'], series: [{ label: 'v', values: [5 * B, -1 * B, 2 * B] }] },
    donut_zero: { ...T0, kind: 'donut', title: t('كل القيم صفر', 'All zero'), labels: ['A', 'B'], series: [{ label: 'v', values: [0, 0] }] },
    donut_null: { ...T0, kind: 'donut', title: t('قيمة ناقصة', 'A missing value'), labels: ['A', 'B', 'C', 'D'], series: [{ label: 'v', values: [5 * B, null, 2 * B, 0] }] },
    donut_long: { ...T0, kind: 'donut', title: t('عناوين طويلة', 'Long labels'), labels: [t('أمانة منطقة المدينة المنورة وما يتبعها من بلديات ومراكز خدمة ومحافظات', 'Madinah Region Amanah and all of its municipalities, service centres and governorates'), t('الأراضي البيضاء ورسوم الأراضي البيضاء المستحقة على الملاك', 'White lands and the white-land fees due from owners'), 'C'], series: [{ label: 'v', values: [4.2 * B, 1.1 * B, 0.7 * B] }] },
    treemap: { ...T0, kind: 'treemap', title: t('صافي المفوتر: الأمانة ← البلدية ← المصدر', 'Net billed: Amanah → municipality → source'), tree: tree3, levels: t(['الأمانة', 'البلدية', 'المصدر'], ['Amanah', 'Municipality', 'Source']) },
    treemap_flat: { ...T0, kind: 'treemap', title: t('صافي المفوتر بحسب الأمانة', 'Net billed by Amanah'), labels: names, series: [{ label: t('المبلغ', 'Amount'), values: vals12.map((v, i) => (i === 10 ? null : i === 11 ? 0 : v)) }] },
    treemap_60: { ...T0, kind: 'treemap', title: t('٦٠ بنداً', '60 leaves'), tree: tree60 },
    treemap_bad: { ...T0, kind: 'treemap', title: t('شجرة غير جمعية', 'Non-additive'), tree: { label: 'Total', value: 100 * M, children: [{ label: 'a', value: 60 * M }, { label: 'b', value: 30 * M }] } },
    treemap_neg: { ...T0, kind: 'treemap', title: 'neg', tree: { label: 'Total', value: 40 * M, children: [{ label: 'a', value: 60 * M }, { label: 'b', value: -20 * M }] } },
    treemap_zero: { ...T0, kind: 'treemap', title: 'zero', tree: { label: 'Total', value: 0, children: [{ label: 'a', value: 0 }, { label: 'b', value: 0 }] } },
    treemap_null: { ...T0, kind: 'treemap', title: 'null leaf', tree: { label: 'Total', value: 60 * M, children: [{ label: 'a', value: 60 * M }, { label: 'b', value: null }] } },
    treemap_single: { ...T0, kind: 'treemap', title: t('عقدة واحدة', 'Single node'), tree: { label: t('الإجمالي', 'Total'), value: 12.5 * B } },
    treemap_long: { ...T0, kind: 'treemap', title: t('عناوين طويلة', 'Long labels'), tree: node(t('إجمالي', 'Total'), [node(t('أمانة منطقة المدينة المنورة وما يتبعها من بلديات ومراكز خدمة', 'Madinah Region Amanah and everything under it'), [node(t('رسوم الأراضي البيضاء المستحقة على الملاك', 'White-land fees due from the owners'), 400 * M), node(t('غرامات المخالفات البلدية', 'Municipal violation fines'), 250 * M)]), node(t('أمانة محافظة جدة', 'Jeddah Amanah'), [node(t('سداد', 'SADAD'), 300 * M), node(t('بلدي', 'Baladi'), 90 * M)])]) },
    sunburst: { ...T0, kind: 'sunburst', title: t('صافي المفوتر: الأمانة ← البلدية ← المصدر', 'Net billed: Amanah → municipality → source'), tree: tree3, levels: t(['الأمانة', 'البلدية', 'المصدر'], ['Amanah', 'Municipality', 'Source']) },
    sunburst_2: { ...T0, kind: 'sunburst', title: t('مستويان', 'Two levels'), tree: node(t('الإجمالي', 'Total'), [node(names[0], leaves(1)), node(names[1], leaves(2)), node(names[2], leaves(5))]) },
    sunburst_bad: { ...T0, kind: 'sunburst', title: 'bad', tree: { label: 'Total', value: 10 * M, children: [{ label: 'a', value: 3 * M, children: [{ label: 'x', value: 1 * M }, { label: 'y', value: 1 * M }] }, { label: 'b', value: 7 * M }] } },
    sunburst_1ring: { ...T0, kind: 'sunburst', title: 'one ring', tree: { label: 'Total', value: 10 * M, children: [{ label: 'a', value: 3 * M }, { label: 'b', value: 7 * M }] } },
    sunburst_root: { ...T0, kind: 'sunburst', title: 'root only', tree: { label: 'Total', value: 1 * M } },
    sankey: { ...T0, kind: 'sankey', title: t('من إجمالي المفوتر إلى المحصّل', 'From gross billed to collected'), ...fl },
    sankey_ext: { ...T0, kind: 'sankey', title: t('التدفق مع أسباب الاستثناء', 'Flow with exclusion reasons'), ...fl2 },
    sankey_bad: { ...T0, kind: 'sankey', title: 'bad', nodes: fl.nodes, links: fl.links.map((l) => (l.to === 'unc' ? { ...l, value: 3.5 * B } : l)) },
    sankey_neg: { ...T0, kind: 'sankey', title: 'neg', nodes: fl.nodes, links: fl.links.map((l) => (l.to === 'excl' ? { ...l, value: -1 } : l)) },
    sankey_missing: { ...T0, kind: 'sankey', title: 'ghost', nodes: fl.nodes, links: [...fl.links, { from: 'net', to: 'ghost', value: 0 }] },
    sankey_null: { ...T0, kind: 'sankey', title: 'a link without a value', nodes: fl.nodes, links: fl.links.map((l, i) => (i === 3 ? { ...l, value: null } : l)) },
    sankey_single: { ...T0, kind: 'sankey', title: 'single', nodes: [{ id: 'a', label: 'A', col: 0 }], links: [] },
    sankey_tiny: { ...T0, kind: 'sankey', title: t('تدفق صغير جداً', 'A tiny flow'), nodes: [...fl.nodes, { id: 'dis', label: t('متنازع عليه', 'Disputed'), col: 2 }], links: [...fl.links.map((l) => (l.to === 'unc' ? { ...l, value: 3.85 * B - 20 } : l)), { from: 'net', to: 'dis', value: 20 }] },
    sankey_zero: { ...T0, kind: 'sankey', title: t('تدفق صفري', 'A zero flow'), nodes: [...fl.nodes, { id: 'z', label: t('بلا مبلغ', 'No amount'), col: 2 }], links: [...fl.links, { from: 'net', to: 'z', value: 0 }] },
    sankey_long: { ...T0, kind: 'sankey', title: t('عناوين طويلة', 'Long labels'), nodes: [{ id: 'a', label: t('إجمالي المفوتر على مستوى جميع الأمانات والبلديات', 'Gross billed across every Amanah and municipality'), col: 0 }, { id: 'b', label: t('الاستثناءات المعتمدة من اللجنة المختصة بحسب القواعد', 'Exclusions approved by the committee under the rules'), col: 1 }, { id: 'c', label: t('صافي المفوتر بعد خصم الاستثناءات', 'Net billed after deducting exclusions'), col: 1 }], links: [{ from: 'a', to: 'b', value: 3 * B }, { from: 'a', to: 'c', value: 9 * B }] },
    sankey_many: { ...T0, kind: 'sankey', title: t('أمانات ← مصادر', 'Amanahs → sources'), nodes: [...names.slice(0, 8).map((n, i) => ({ id: `a${i}`, label: n, col: 0 })), ...srcs.map((s, k) => ({ id: `s${k}`, label: s, col: 1 }))], links: names.slice(0, 8).flatMap((_, i) => srcs.map((__, k) => ({ from: `a${i}`, to: `s${k}`, value: (((i * 5 + k * 3) % 7) + 1) * 40 * M }))) }
  };
}
