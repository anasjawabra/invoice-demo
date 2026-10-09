// The fixed (predefined) reports: established formats that open directly, with no prompt. Each is a fixed list of report-model sections,
// so on-screen figures, exports and smart reports all come from the SAME builder (src/data/reportModel.js).
export const FIXED_REPORTS = [
  { key: 'monthly', ar: 'الملخص التنفيذي الشهري للإيرادات', en: 'Monthly executive revenue summary', sections: ['executive', 'sources', 'amanah', 'exclusions', 'gaps'], compare: 'prev_year', purpose: { ar: 'ملخص شهري: الأداء والمقارنة بالعام الماضي وأبرز الفجوات', en: 'Monthly summary: performance, comparison with last year and the main gaps' } },
  { key: 'trends', ar: 'اتجاهات الإيرادات والتحصيل', en: 'Revenue and collection trends', sections: ['trends', 'bases'], compare: 'prev_year', purpose: { ar: 'الأداء شهراً بشهر ومقابل العام الماضي', en: 'Month by month and against last year' } },
  { key: 'amanah', ar: 'أداء الأمانات والبلديات', en: 'Amanah and municipality performance', sections: ['amanah'], compare: 'prev_year', purpose: { ar: 'الأمانات والبلديات: نسبة التحصيل وغير المحصّل', en: 'Amanahs and municipalities: collection rate and uncollected' } },
  { key: 'sources', ar: 'أداء مصادر الإيراد', en: 'Revenue-source performance', sections: ['sources'], compare: 'prev_year', purpose: { ar: 'أداء كل مصدر إيراد', en: 'Performance of each revenue source' } },
  { key: 'aging', ar: 'الفواتير غير المسددة والتقادم', en: 'Outstanding invoices and aging', sections: ['aging', 'gaps'], compare: 'none', purpose: { ar: 'الرصيد القائم وأعماره وأكبر الفجوات', en: 'The standing balance, its age and the biggest gaps' } },
  { key: 'exclusions', ar: 'الاستبعادات وأسبابها', en: 'Exclusions and reasons', sections: ['exclusions'], compare: 'prev_year', purpose: { ar: 'ما استُبعد من المفوتر وأسبابه', en: 'What was excluded from billing, and why' } },
  { key: 'status', ar: 'حالة الدفع وقنوات السداد', en: 'Payment status and channels', sections: ['status', 'channels'], compare: 'none', purpose: { ar: 'الفواتير حسب حالة الدفع وقنوات السداد', en: 'Invoices by payment status and payment channel' } },
  { key: 'budget', ar: 'الميزانية وتنفيذ الإنفاق', en: 'Budget and expenditure execution', sections: ['budget'], compare: 'none', purpose: { ar: 'الميزانية والصرف وتغطية المصروفات التشغيلية (بيانات تجريبية)', en: 'Budget, spending and operating-spending coverage (demo data)' } },
  { key: 'quality', ar: 'اكتمال البيانات والمطابقة', en: 'Data completeness and reconciliation', sections: ['quality'], compare: 'none', purpose: { ar: 'فحوص المطابقة واكتمال البيانات', en: 'Reconciliation checks and data completeness' } }
];
export const LEGACY_SECTION_TO_REPORT = { executive: 'monthly', trends: 'trends', amanah: 'amanah', sources: 'sources', aging: 'aging', exclusions: 'exclusions', gaps: 'aging', status: 'status', budget: 'budget', quality: 'quality', bases: 'trends', channels: 'status' };

// the catalogue is shown in three groups (no numbering: the order carries no sequence)
export const FIXED_GROUPS = [{ ar: 'ملخصات', en: 'Summaries', keys: ['monthly', 'trends'] }, { ar: 'تحليل', en: 'Analysis', keys: ['amanah', 'sources', 'exclusions'] }, { ar: 'متابعة وجودة', en: 'Follow-up and quality', keys: ['aging', 'status', 'budget', 'quality'] }];
