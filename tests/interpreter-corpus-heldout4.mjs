// HELD-OUT SET 4 (round 5): written BEFORE this round's interpreter work (the interpretation-summary / unsupported-qualifier guards) and
// run once on the unchanged interpreter (docs/interpreter-heldout4-first-run.txt). It emphasises requests with a part the interpreter cannot apply
// (the audit's «unsafe silent misread» class) next to ordinary requests. `exp` is the correct reading, or kind clarify/unsupported where asking is right.
import { TODAY } from './interpreter-corpus.mjs';
const RY = 'Riyadh Amanah'; const JD = 'Jeddah Amanah'; const MK = 'Makkah Amanah'; const MD = 'Al Madinah Amanah'; const EP = 'Eastern Province Amanah'; const TB = 'Tabuk Amanah'; const QS = 'Al-Qassim Amanah'; const AS = 'Asir Amanah'; const TF = 'Taif Amanah';
const C = [];
const add = (cat, q, exp = {}, after = null) => C.push({ id: 5000 + C.length, cat, q, exp, after });
// -- ordinary, fully supported requests (must be read, not interrogated)
add('p4-ok', 'تقرير الإيرادات لشهر أغسطس', { from: '2026-08-01', to: '2026-08-31' });
add('p4-ok', 'ورّني تحصيل أمانة عسير هذا العام', { amanah: AS, from: '2026-01-01', to: TODAY });
add('p4-ok', 'report for Taif last month', { amanah: TF, from: '2026-09-01', to: '2026-09-30' });
add('p4-ok', 'أريد الفواتير المتأخرة في الرياض', { status: 'overdue', amanah: RY });
add('p4-ok', 'collection performance of Jeddah year to date', { amanah: JD, from: '2026-01-01', to: TODAY });
add('p4-ok', 'تقرير الغرامات لأمانة المدينة المنورة للربع الثالث', { source: 'fines', amanah: MD, from: '2026-07-01', to: '2026-09-30' });
add('p4-ok', 'قارن هذا الشهر بالشهر الماضي', { compare: 'prev_month', from: '2026-10-01', to: TODAY });
add('p4-ok', 'show exclusions for the eastern province this year', { amanah: EP, sections: ['exclusions'], from: '2026-01-01', to: TODAY });
add('p4-ok', 'ما إجمالي المفوتر هذا الشهر؟', { kind: 'question', from: '2026-10-01', to: TODAY });
add('p4-ok', 'تقرير الاستثمار في تبوك', { source: 'investment', amanah: TB });
add('p4-ok', 'monthly revenue trend for Qassim', { amanah: QS, sections: ['trends'] });
add('p4-ok', 'اعرض المتأخرات حسب المصدر', { sections: ['aging', 'sources'] });
// -- a part the system cannot apply: ask, never silently drop it
add('p4-neg', 'تقرير الإيرادات لأكبر 10 دافعين', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'top 5 payers by overdue amount', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'تقرير حسب العميل', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'revenue report broken down by license type', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'الفواتير التي تتجاوز مليون ريال', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'invoices above 500000 SAR in Riyadh', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'تقرير الإيرادات بالدولار', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'report in euros for last month', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'تقرير للمستثمر شركة النور', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'collections by employee', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'تقرير عن حي الملقا', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'report for the Olaya district', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'الفواتير الصادرة يوم الثلاثاء', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'تقرير مع توقعات الربع القادم', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'report excluding Riyadh', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'تقرير الإيرادات ما عدا الغرامات', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'مقارنة بنفس الفترة قبل ثلاث سنوات', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'average collection time per invoice', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'تقرير الرسوم المتعثرة فقط', { kind: ['clarify', 'unsupported'] });
add('p4-neg', 'report for the contract holders with arrears', { kind: ['clarify', 'unsupported'] });
// -- period / scope edge cases
add('p4-edge', 'تقرير من 1 يوليو حتى 31 أغسطس', { kind: ['clarify', 'report'], from: '2026-07-01', to: '2026-08-31' });
add('p4-edge', 'report for the previous quarter', { kind: ['clarify', 'report'] });
add('p4-edge', 'تقرير نهاية العام الماضي', { kind: 'clarify' });
add('p4-edge', 'report for next month', { kind: 'clarify' });
add('p4-edge', 'تقرير الأسبوعين الماضيين', { kind: 'clarify' });
add('p4-edge', 'Jeddah and Taif and Makkah this month', { amanah: [JD, TF, MK], from: '2026-10-01', to: TODAY });
add('p4-edge', 'تقرير أمانة الرياض وأمانة الإحساء', { amanah: ['Riyadh Amanah', 'Al-Ahsa Amanah'] });
add('p4-edge', 'تقرير أمانة الدمام', { kind: ['clarify', 'unsupported', 'report'] });
add('p4-edge', 'Q3 2025 report', { from: '2025-07-01', to: '2025-09-30' });
add('p4-edge', 'تقرير الإيواء في المنطقة الشرقية', { source: 'accommodation', amanah: EP });
add('p4-edge', 'compare Riyadh with Jeddah', { amanah: [RY, JD], sections: ['amanah'] });
add('p4-edge', 'تقرير مارس وأبريل', { kind: 'clarify' });
add('p4-edge', 'revenue for this month and last year', { kind: 'clarify' });
// -- follow-ups
add('p4-follow', 'اجعله للربع الأول فقط', { from: '2026-01-01', to: '2026-03-31' }, 'تقرير السنة حتى اليوم');
add('p4-follow', 'والآن أمانة جدة', { amanah: JD, keep: ['from', 'to'] }, 'تقرير الرياض للشهر الماضي');
add('p4-follow', 'sort by amount descending', { kind: ['clarify', 'unsupported'] }, 'report for last month');
add('p4-follow', 'اعرضه كل أسبوع', { kind: ['clarify', 'unsupported'] }, 'تقرير الشهر الماضي');
add('p4-follow', 'send it to the minister', { kind: ['clarify', 'unsupported'] }, 'report for last month');
add('p4-follow', 'ركّز على الفواتير المستبعدة', { status: 'excluded', keep: ['from', 'to'] }, 'تقرير الشهر الماضي');
add('p4-follow', 'group it by day', { kind: ['clarify', 'unsupported'] }, 'report for last month');
add('p4-follow', 'compare with the same month two years ago', { kind: ['clarify', 'unsupported'] }, 'report for last month');
add('p4-follow', 'back to year to date', { from: '2026-01-01', to: TODAY }, 'تقرير الشهر الماضي');
add('p4-follow', 'and only municipal fees', { source: 'municipal_fees', keep: ['from', 'to'] }, 'report for last month');
// -- declines
add('p4-decl', 'ما هي عاصمة اليابان؟', { kind: 'unsupported' });
add('p4-decl', 'translate this report to French', { kind: ['clarify', 'unsupported'] });
add('p4-decl', 'ارسل التقرير بالبريد', { kind: ['unsupported', 'clarify'] });
add('p4-decl', 'change the invoice amount', { kind: ['unsupported', 'clarify'] });
add('p4-decl', 'ألغ الفاتورة INV-2026-0000100', { kind: ['unsupported', 'clarify'] });
add('p4-decl', 'ماذا ستكون الإيرادات العام القادم؟', { kind: ['clarify', 'unsupported'] });
add('p4-decl', 'اعطني رأيك في الميزانية', { kind: ['clarify', 'unsupported', 'report', 'question'] });
add('p4-decl', 'hello', { kind: ['unsupported', 'clarify'] });
add('p4-decl', 'شكراً', { kind: ['unsupported', 'clarify'] });
export const HELDOUT4 = C;
