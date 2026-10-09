// Interpreter corpus: representative Arabic / English requests with the expected reading — or the expected clarification / refusal.
// Test date 2026-10-09. «after» builds a conversation first (follow-ups). `exp` keys:
//   kind        'report' | 'question' | 'clarify' | 'unsupported'   (default 'report')
//   from / to   the period applied      compare  'none'|'prev_month'|'prev_year'
//   amanah / source / status / scopeType / muni   the scope value applied ('all' = unchanged default)
//   sections    sections that must be present      only  exact section list
//   keep        scope keys that must stay as in the base spec     says  text the clarification must contain
export const TODAY = '2026-10-09';
const P = { thisMonth: ['2026-10-01', TODAY], lastMonth: ['2026-09-01', '2026-09-30'], ytd: ['2026-01-01', TODAY], last3: ['2026-07-01', '2026-09-30'] };
const RY = 'Riyadh Amanah'; const JD = 'Jeddah Amanah'; const EP = 'Eastern Province Amanah'; const MK = 'Makkah Amanah'; const MD = 'Al Madinah Amanah';
const per = ([from, to]) => ({ from, to });
const C = [];
const add = (cat, q, exp = {}, after = null) => C.push({ id: C.length + 1, cat, q, exp, after });

/* ---- period: Arabic ---- */
add('period', 'أنشئ تقرير الإيرادات لهذا الشهر', per(P.thisMonth));
add('period', 'أنشئ تقرير الإيرادات للشهر الماضي', per(P.lastMonth));
add('period', 'تقرير الشهر الماضي', per(P.lastMonth));
add('period', 'أريد تقريراً عن الشهر الماضي', per(P.lastMonth));
add('period', 'جهّز تقرير السنة حتى اليوم', per(P.ytd));
add('period', 'تقرير هذا العام', per(P.ytd));
add('period', 'تقرير السنة الحالية', per(P.ytd));
add('period', 'تقرير آخر 3 أشهر', per(P.last3));
add('period', 'أنشئ تقرير آخر ثلاثة أشهر', per(P.last3));
add('period', 'تقرير الإيرادات لشهر مارس', { from: '2026-03-01', to: '2026-03-31' });
add('period', 'تقرير يناير', { from: '2026-01-01', to: '2026-01-31' });
add('period', 'تقرير فبراير 2026', { from: '2026-02-01', to: '2026-02-28' });
add('period', 'تقرير شهر أغسطس', { from: '2026-08-01', to: '2026-08-31' });
add('period', 'تقرير سبتمبر', { from: '2026-09-01', to: '2026-09-30' });
add('period', 'تقرير مارس 2025', { from: '2025-03-01', to: '2025-03-31' });
add('period', 'تقرير ديسمبر', { from: '2025-12-01', to: '2025-12-31' }); // a month later than the current one = the previous year (flagged in the chip)
add('period', 'تقرير الربع الأول', { from: '2026-01-01', to: '2026-03-31' });
add('period', 'تقرير الإيرادات للربع الثاني', { from: '2026-04-01', to: '2026-06-30' });
add('period', 'تقرير الربع الثالث', { from: '2026-07-01', to: '2026-09-30' });
add('period', 'تقرير الربع الرابع', { from: '2026-10-01', to: TODAY });
add('period', 'تقرير الربع الثاني 2025', { from: '2025-04-01', to: '2025-06-30' });
add('period', 'أنشئ تقرير الإيرادات من 2026-02-01 إلى 2026-02-28', { from: '2026-02-01', to: '2026-02-28' });
add('period', 'تقرير 2026-03-01 → 2026-03-15', { from: '2026-03-01', to: '2026-03-15' });
add('period', 'تقرير الشهر الحالي', per(P.thisMonth));
add('period', 'تقرير الشهر الجاري حتى اليوم', per(P.thisMonth));
/* ---- period: English ---- */
add('period-en', 'Create the revenue report for this month', per(P.thisMonth));
add('period-en', 'Report for last month', per(P.lastMonth));
add('period-en', 'Prepare a year to date report', per(P.ytd));
add('period-en', 'report for the last 3 months', per(P.last3));
add('period-en', 'revenue report for March', { from: '2026-03-01', to: '2026-03-31' });
add('period-en', 'collection report for Q1', { from: '2026-01-01', to: '2026-03-31' });
add('period-en', 'report for January 2026', { from: '2026-01-01', to: '2026-01-31' });
add('period-en', 'show me the report for September', { from: '2026-09-01', to: '2026-09-30' });
add('period-en', 'report for Q2 2025', { from: '2025-04-01', to: '2025-06-30' });
add('period-en', 'a report from 2026-05-01 to 2026-05-31', { from: '2026-05-01', to: '2026-05-31' });
/* ---- invalid / unresolved periods → clarification, never a silent default ---- */
add('period-clarify', 'تقرير من 2026-06-01 إلى 2026-03-01', { kind: 'clarify', says: 'بعد تاريخ النهاية' });
add('period-clarify', 'تقرير الإيرادات من 2027-01-01 إلى 2027-03-01', { kind: 'clarify' });
add('period-clarify', 'تقرير الإيرادات قبل شهرين', { kind: 'clarify' });
add('period-clarify', 'تقرير آخر 6 أشهر', { kind: 'clarify' });
add('period-clarify', 'تقرير الأسبوع الماضي', { kind: 'clarify' });
add('period-clarify', 'تقرير الإيرادات قبل أسبوعين', { kind: 'clarify' });
add('period-clarify', 'report for the last 6 months', { kind: 'clarify' });
add('period-clarify', 'report for last week', { kind: 'clarify' });
add('period-clarify', 'تقرير الربع الأول 2027', { kind: 'clarify', says: 'لم يبدأ' });
add('period-clarify', 'تقرير يناير 2027', { kind: 'clarify', says: 'لم يبدأ' });
/* ---- comparison ---- */
add('compare', 'قارن بالشهر الماضي', { compare: 'prev_month' }, 'أنشئ تقرير الإيرادات لهذا الشهر');
add('compare', 'قارن بالعام الماضي', { compare: 'prev_year' }, 'أنشئ تقرير الإيرادات لهذا الشهر');
add('compare', 'قارن بنفس الفترة من العام الماضي', { compare: 'prev_year' }, 'تقرير السنة حتى اليوم');
add('compare', 'تقرير الشهر الماضي مقارنة بالعام الماضي', { ...per(P.lastMonth), compare: 'prev_year' });
add('compare', 'تقرير هذا الشهر قارن بالشهر الماضي', { ...per(P.thisMonth), compare: 'prev_month' });
add('compare', 'تقرير الاستبعادات شهر سبتمبر مقارنة بأغسطس', { from: '2026-09-01', to: '2026-09-30', compare: 'prev_month' });
add('compare', 'تقرير مارس مقارنة بفبراير', { from: '2026-03-01', to: '2026-03-31', compare: 'prev_month' });
add('compare', 'تقرير الاستبعادات شهر مارس مقارنة بأغسطس', { kind: 'clarify' });
add('compare', 'تقرير مارس مقارنة بيناير', { kind: 'clarify' });
add('compare', 'compare with last month', { compare: 'prev_month', keep: ['from', 'to'] }, 'أنشئ تقرير الإيرادات لهذا الشهر');
add('compare', 'compare with last year', { compare: 'prev_year', keep: ['from', 'to'] }, 'أنشئ تقرير الإيرادات لهذا الشهر');
add('compare', 'report for this month compared with last month', { ...per(P.thisMonth), compare: 'prev_month' });
add('compare', 'last month report vs last year', { ...per(P.lastMonth), compare: 'prev_year' });
add('compare', 'أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم قارن بالشهر الماضي', { ...per(P.thisMonth), compare: 'prev_month' });
add('compare', 'بدون مقارنة', { compare: 'none' }, 'تقرير الشهر الماضي مقارنة بالعام الماضي');
add('compare', 'ألغِ المقارنة', { compare: 'none' }, 'تقرير الشهر الماضي مقارنة بالعام الماضي');
add('compare', 'قارن', { kind: 'clarify' });
add('compare', 'مقارنة', { kind: 'clarify' });
add('compare', 'تقرير السنة حتى اليوم مقارنة بالشهر الماضي', { ...per(P.ytd), compare: 'prev_month' });
add('compare', 'تقرير آخر 3 أشهر قارن بالعام الماضي', { ...per(P.last3), compare: 'prev_year' });
add('compare', 'قارن الرياض بجدة', { amanah: [RY, JD], sections: ['amanah'] });
add('compare', 'قارن بين الرياض وجدة', { amanah: [RY, JD], sections: ['amanah'] });
/* ---- Amanat ---- */
add('amanah', 'تقرير الإيرادات لأمانة الرياض', { amanah: RY });
add('amanah', 'اعرض أمانة جدة فقط', { amanah: JD }, 'تقرير الشهر الماضي');
add('amanah', 'تقرير الاستبعادات للأمانات الشرقية', { amanah: EP });
add('amanah', 'ما نسبة التحصيل في جدة؟', { kind: 'question', amanah: JD });
add('amanah', 'كم المفوتر في الرياض؟', { kind: 'question', amanah: RY });
add('amanah', 'تقرير أمانة مكة المكرمة', { amanah: MK });
add('amanah', 'أداء أمانة المدينة المنورة', { amanah: MD });
add('amanah', 'تقرير المنطقة الشرقية للشهر الماضي', { amanah: EP, ...per(P.lastMonth) });
add('amanah', 'Riyadh Amanah report', { amanah: RY });
add('amanah', 'collection rate in Jeddah', { amanah: JD });
add('amanah', 'show Eastern Province only', { amanah: EP }, 'report for last month');
add('amanah', 'كل الأمانات', { amanah: 'all' }, 'تقرير أمانة الرياض');
add('amanah', 'اعرض جميع الأمانات', { amanah: 'all' }, 'تقرير أمانة الرياض');
add('amanah', 'اعرض أمانة الرياض وجدة فقط', { kind: 'clarify' });
add('amanah', 'اعرض الرياض وجدة', { amanah: [RY, JD] });
add('amanah', 'تقرير أمانة الباحة', { amanah: 'Al Bahah Amanah' });
add('amanah', 'تقرير أمانة تبوك لهذا الشهر', { amanah: 'Tabuk Amanah', ...per(P.thisMonth) });
add('amanah', 'تقرير الطائف', { amanah: 'Taif Amanah' });
add('amanah', 'تقرير الأحساء', { amanah: 'Al-Ahsa Amanah' });
add('amanah', 'مقارنة الأمانات', { sections: ['amanah'] });
/* ---- sources ---- */
add('source', 'تقرير الإيرادات لمصدر الغرامات', { source: 'fines' });
add('source', 'تقرير الاستثمار', { source: 'investment' });
add('source', 'تقرير الأراضي البيضاء', { source: 'white_lands' });
add('source', 'تقرير التبغ', { source: 'tobacco' });
add('source', 'تقرير الإيواء', { source: 'accommodation' });
add('source', 'تقرير مبيعات الإسكان', { source: 'housing_sales' });
add('source', 'تقرير الرسوم البلدية', { source: 'municipal_fees' });
add('source', 'تقرير التراخيص', { source: 'licenses' });
add('source', 'أريد تقريراً عن أكبر 5 بلديات', { source: 'all' });
add('source', 'تقرير عن البلديات', { source: 'all' });
add('source', 'fines revenue report', { source: 'fines' });
add('source', 'tobacco report for last month', { source: 'tobacco', ...per(P.lastMonth) });
add('source', 'white lands collection', { source: 'white_lands' });
add('source', 'تقرير الإيرادات حسب مصدر الإيراد', { source: 'all', sections: ['sources'] });
/* ---- status ---- */
add('status', 'الفواتير المتأخرة فقط', { status: 'overdue' });
add('status', 'اعرض الفواتير المحصلة', { status: 'collected' });
add('status', 'الفواتير الملغاة', { status: 'cancelled' });
add('status', 'الفواتير المستبعدة', { status: 'excluded' });
add('status', 'الفواتير الجزئية فقط', { status: 'partial' });
add('status', 'كل الحالات', { status: 'all' }, 'الفواتير المتأخرة فقط');
add('status', 'المتأخرات حسب مصدر الإيراد', { status: 'all', sections: ['aging', 'sources'] });
add('status', 'تقرير الفواتير المركزية', { scopeType: 'central' });
add('status', 'الفواتير الداخلية فقط', { scopeType: 'internal' });
/* ---- sections ---- */
add('sections', 'تقرير الاستبعادات', { sections: ['exclusions'] });
add('sections', 'تحليل المتأخرات', { sections: ['aging'] });
add('sections', 'تقرير الاتجاه الشهري', { sections: ['trends'] });
add('sections', 'ما فجوات التحصيل؟', { kind: 'question', sections: ['gaps'] });
add('sections', 'جودة البيانات', { sections: ['quality'] });
add('sections', 'قنوات الدفع', { sections: ['channels'] });
add('sections', 'ما الميزانية المتبقية؟', { kind: 'question', only: ['budget'] });
add('sections', 'هل نغطي المصروفات؟', { kind: 'question', only: ['budget'] });
add('sections', 'تقرير الإنفاق', { sections: ['budget'] });
add('sections', 'تقرير تفصيلي', { sections: ['executive', 'trends', 'amanah', 'sources'] });
add('sections', 'ملخص تنفيذي', { only: ['executive'] });
add('sections', 'جهّز تقريراً شهرياً مشابهاً للتقارير المرفقة', { sections: ['executive', 'sources', 'amanah', 'exclusions', 'gaps'], compare: 'prev_year' });
add('sections', 'exclusions report', { kind: 'report' });
add('sections', 'what are the collection gaps?', { kind: 'question' });
add('sections', 'show the aging of overdue invoices', { kind: 'report' });
/* ---- follow-ups ---- */
add('follow-up', 'أضف تحليل الاستبعادات', { sections: ['executive', 'exclusions'] }, 'أنشئ تقرير الإيرادات لهذا الشهر');
add('follow-up', 'أضف المتأخرات', { sections: ['executive', 'aging'] }, 'تقرير الشهر الماضي');
add('follow-up', 'حوّله إلى ملخص تنفيذي', { only: ['executive'] }, 'تقرير تفصيلي');
add('follow-up', 'اعرض أمانة الرياض فقط', { amanah: RY, keep: ['from', 'to', 'source'] }, 'تقرير الشهر الماضي');
add('follow-up', 'للشهر الماضي', { ...per(P.lastMonth) }, 'تقرير السنة حتى اليوم');
add('follow-up', 'وللعام كله', { kind: 'unsupported' }, 'تقرير الشهر الماضي'); // not a supported phrasing: must not be silently misread
add('follow-up', 'قارن بالشهر الماضي', { compare: 'prev_month', keep: ['amanah', 'source'] }, 'تقرير أمانة جدة لهذا الشهر');
add('follow-up', 'الغرامات فقط', { source: 'fines', keep: ['from', 'to'] }, 'تقرير الشهر الماضي');
add('follow-up', 'الفواتير المتأخرة فقط', { status: 'overdue', keep: ['from', 'to', 'source'] }, 'تقرير مصدر الغرامات');
add('follow-up', 'ابدأ من جديد', { from: '2026-01-01', to: TODAY }, 'تقرير الشهر الماضي لأمانة جدة');
add('follow-up', 'أزل كل المرشحات', { amanah: 'all', source: 'all' }, 'تقرير الغرامات لأمانة جدة');
add('follow-up', 'add the exclusions analysis', { sections: ['executive', 'exclusions'] }, 'report for last month');
add('follow-up', 'show Riyadh only', { amanah: RY, keep: ['from', 'to'] }, 'report for last month');
add('follow-up', 'turn it into an executive summary', { only: ['executive'] }, 'تقرير تفصيلي');
add('follow-up', 'اعرض الاتجاه الشهري أيضاً', { sections: ['trends'] }, 'تقرير الشهر الماضي');
add('follow-up', 'ومصادر الإيراد', { sections: ['sources'] }, 'تقرير الشهر الماضي');
add('follow-up', 'نفس التقرير لأمانة مكة', { amanah: MK, keep: ['from', 'to'] }, 'تقرير الشهر الماضي');
/* ---- ambiguous / needs a question ---- */
add('ambiguous', 'قارن', { kind: 'clarify' });
add('ambiguous', 'اعرض أمانة الرياض وجدة فقط', { kind: 'clarify' });
add('ambiguous', 'مقارنة الأداء', { kind: 'clarify' });
add('ambiguous', 'تقرير الربع الثاني', { from: '2026-04-01', to: '2026-06-30' });
add('ambiguous', 'أريد تقريراً', { kind: 'report' });
add('ambiguous', 'ما الوضع؟', { kind: 'question' });
add('ambiguous', 'كيف الأداء؟', { kind: 'question' });
add('ambiguous', 'how are we doing?', { kind: 'question' });
/* ---- unsupported / adversarial: a clarification or an explicit refusal, never a generic report with a wrong scope ---- */
add('unsupported', 'xyzzy plugh', { kind: 'unsupported' });
add('unsupported', 'اكتب لي قصيدة', { kind: 'unsupported' });
add('unsupported', 'ما حال الطقس غداً', { kind: 'unsupported' });
add('unsupported', 'احذف جميع الفواتير', { kind: 'unsupported' });
add('unsupported', 'delete all invoices', { kind: 'unsupported' });
add('unsupported', 'أرسل التقرير بالبريد إلى المدير', { kind: ['unsupported', 'report'], notChanged: true });
add('unsupported', 'hello', { kind: 'unsupported' });
add('unsupported', 'مرحبا', { kind: 'unsupported' });
add('unsupported', 'عدّل المستهدف إلى 80%', { kind: 'unsupported' });
add('unsupported', 'ما رأيك في الوزير؟', { kind: 'unsupported' });
add('unsupported', '؟؟؟', { kind: ['unsupported', 'empty'] });
add('unsupported', '12345', { kind: 'unsupported' });
export const CORPUS = C;
// the failures the audit verified (F-05 table): these must ALL pass
export const VERIFIED_IDS = C.map((c, i) => [c, i]).filter(([c]) => ['أنشئ تقرير الإيرادات للشهر الماضي', 'تقرير الشهر الماضي مقارنة بالعام الماضي', 'تقرير الاستبعادات شهر سبتمبر مقارنة بأغسطس', 'ما نسبة التحصيل في جدة؟', 'ما الميزانية المتبقية؟', 'هل نغطي المصروفات؟', 'قارن الرياض بجدة', 'compare with last month', 'أريد تقريراً عن أكبر 5 بلديات', 'تقرير الاستبعادات للأمانات الشرقية'].includes(c.q)).map(([c]) => c.id);
