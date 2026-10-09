// HELD-OUT SET 5 (round 5): written AFTER the unsupported-qualifier / unknown-word guards and never run before its recorded first run
// (docs/interpreter-heldout5-first-run.txt). It is the independent check of that work; after the record it becomes a regression set.
import { TODAY } from './interpreter-corpus.mjs';
const RY = 'Riyadh Amanah'; const JD = 'Jeddah Amanah'; const MK = 'Makkah Amanah'; const MD = 'Al Madinah Amanah'; const EP = 'Eastern Province Amanah'; const TB = 'Tabuk Amanah'; const QS = 'Al-Qassim Amanah'; const AS = 'Asir Amanah'; const TF = 'Taif Amanah'; const HL = "Ha'il Amanah"; const JZ = 'Jazan Amanah'; const NJ = 'Najran Amanah'; const AB = 'Al Bahah Amanah'; const JF = 'Al Jawf Amanah';
const C = [];
const add = (cat, q, exp = {}, after = null) => C.push({ id: 6000 + C.length, cat, q, exp, after });
// -- ordinary supported requests, many phrasings (must be read, not interrogated)
add('p5-ok', 'ممكن تقرير عن إيرادات أمانة حائل لهذا الشهر', { amanah: HL, from: '2026-10-01', to: TODAY });
add('p5-ok', 'ورني الفواتير المتأخرة في جازان', { status: 'overdue', amanah: JZ });
add('p5-ok', 'summary report for Najran for the first quarter', { amanah: NJ, from: '2026-01-01', to: '2026-03-31' });
add('p5-ok', 'تقرير رسوم الأراضي البيضاء في الجوف', { source: 'white_lands', amanah: JF });
add('p5-ok', 'what is the collection rate in Al Bahah this year?', { kind: 'question', amanah: AB, from: '2026-01-01', to: TODAY });
add('p5-ok', 'تحصيل أمانة القصيم في شهر يونيو', { amanah: QS, from: '2026-06-01', to: '2026-06-30' });
add('p5-ok', 'show me aging of balances for Makkah', { amanah: MK, sections: ['aging'] });
add('p5-ok', 'ما حالة المستبعدات في المنطقة الشرقية هذا العام؟', { kind: 'question', amanah: EP, sections: ['exclusions'], from: '2026-01-01', to: TODAY });
add('p5-ok', 'تقرير الإيرادات للربع الثاني مقارنة بالعام الماضي', { compare: 'prev_year', from: '2026-04-01', to: '2026-06-30' });
add('p5-ok', 'report on fines in Madinah last month', { source: 'fines', amanah: MD, from: '2026-09-01', to: '2026-09-30' });
add('p5-ok', 'وين وصل التحصيل في تبوك؟', { kind: 'question', amanah: TB });
add('p5-ok', 'detailed report for the year so far', { from: '2026-01-01', to: TODAY });
add('p5-ok', 'هات لي تقرير الشهر الماضي لأمانة الطائف', { amanah: TF, from: '2026-09-01', to: '2026-09-30' });
add('p5-ok', 'تقرير مصادر الإيراد لأمانة جدة', { amanah: JD, sections: ['sources'] });
add('p5-ok', 'tobacco revenue this month', { source: 'tobacco', from: '2026-10-01', to: TODAY });
add('p5-ok', 'اعرض الفواتير الملغاة', { status: 'cancelled' });
// -- a part that cannot be applied: ask, never drop it silently
add('p5-neg', 'تقرير الإيرادات لأعلى 3 أمانات', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'five biggest debtors in Jeddah', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'تقرير بحسب نوع الرخصة', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'collections grouped by inspector', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'الفواتير فوق 250 ألف ريال', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'show invoices under 1000 riyals', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'تقرير الإيرادات بالجنيه', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'revenue in US dollars', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'تقرير عن مستثمر معين', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'report about Al-Faisaliyah Company', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'تقرير مفصل عن حي النخيل', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'collections near King Fahd Road', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'تقرير الإيرادات باستثناء الرياض', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'report without fines', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'تقرير ربع سنوي مع التوقعات', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'what will collections be next month', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'الفواتير المسددة يوم الخميس', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'report for Ramadan 1447', { kind: 'clarify' });
add('p5-neg', 'تقرير مقارنة بالعام قبل الماضي', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'invoices that were disputed', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'الرسوم الموقوفة فقط', { kind: ['clarify', 'unsupported'] });
add('p5-neg', 'report on the licences expiring soon', { kind: ['clarify', 'unsupported'] });
// -- period / scope edge cases
add('p5-edge', 'تقرير الربع الرابع', { kind: ['clarify', 'report'] });
add('p5-edge', 'report from 1 april to 30 april', { kind: ['clarify', 'report'], from: '2026-04-01', to: '2026-04-30' });
add('p5-edge', 'تقرير مطلع هذا العام', { kind: 'clarify' });
add('p5-edge', 'report for the second half of the year', { kind: 'clarify' });
add('p5-edge', 'Hail and Jazan and Najran together', { amanah: [HL, JZ, NJ] });
add('p5-edge', 'تقرير أمانة المنطقة الغربية', { kind: ['clarify', 'unsupported'] });
add('p5-edge', 'تقرير أمانة الخبر', { kind: ['clarify', 'unsupported'] });
add('p5-edge', 'قارن عسير بجازان', { amanah: [AS, JZ], sections: ['amanah'] });
add('p5-edge', 'compare September with August for Riyadh', { amanah: RY, from: '2026-09-01', to: '2026-09-30', compare: 'prev_month' });
add('p5-edge', 'تقرير ما بين يناير ومارس', { kind: ['clarify', 'report'], from: '2026-01-01', to: '2026-03-31' });
// -- follow-ups
add('p5-follow', 'خله لشهر أغسطس', { from: '2026-08-01', to: '2026-08-31' }, 'تقرير السنة حتى اليوم');
add('p5-follow', 'make it Jazan', { amanah: JZ, keep: ['from', 'to'] }, 'report for Taif last month');
add('p5-follow', 'مرتبة تنازليا بالمبلغ', { kind: ['clarify', 'unsupported'] }, 'تقرير الشهر الماضي');
add('p5-follow', 'email it every morning', { kind: ['clarify', 'unsupported'] }, 'report for last month');
add('p5-follow', 'and by revenue source', { sections: ['sources'] }, 'report for last month');
add('p5-follow', 'أضف المقارنة بالعام الماضي', { compare: 'prev_year', keep: ['from', 'to'] }, 'تقرير الشهر الماضي');
add('p5-follow', 'only invoices bigger than a million', { kind: ['clarify', 'unsupported'] }, 'report for last month');
add('p5-follow', 'لا أريد أمانة الرياض', { kind: ['clarify', 'unsupported', 'report'] }, 'تقرير الشهر الماضي');
add('p5-follow', 'show the same for every amanah', { amanah: 'all', keep: ['from', 'to'] }, 'تقرير أمانة جدة للشهر الماضي');
// -- declines
add('p5-decl', 'ما سعر الذهب اليوم؟', { kind: 'unsupported' });
add('p5-decl', 'write the minister a letter', { kind: ['unsupported', 'clarify'] });
add('p5-decl', 'امسح كل الفواتير', { kind: ['unsupported', 'clarify'] });
add('p5-decl', 'approve the plan', { kind: ['unsupported', 'clarify'] });
add('p5-decl', 'من أنت؟', { kind: ['unsupported', 'clarify'] });
add('p5-decl', 'what can you do', { kind: ['unsupported', 'clarify'] });
export const HELDOUT5 = C;
