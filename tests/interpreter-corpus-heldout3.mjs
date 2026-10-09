// HELD-OUT SET 3 (round 4): written AFTER the set-2 tuning, never run before its recorded first run (docs/interpreter-heldout3-first-run.txt).
// Purpose: test whether the tuning generalises. `exp` is the correct reading, or kind clarify/unsupported where asking or declining is the right behaviour.
import { TODAY } from './interpreter-corpus.mjs';
const RY = 'Riyadh Amanah'; const JD = 'Jeddah Amanah'; const MK = 'Makkah Amanah'; const MD = 'Al Madinah Amanah'; const EP = 'Eastern Province Amanah'; const TB = 'Tabuk Amanah'; const AB = 'Al Bahah Amanah'; const QS = 'Al-Qassim Amanah'; const TF = 'Taif Amanah'; const JZ = 'Jazan Amanah'; const AS = 'Asir Amanah'; const HL = "Ha'il Amanah"; const NJ = 'Najran Amanah';
const C = [];
const add = (cat, q, exp = {}, after = null) => C.push({ id: 4000 + C.length, cat, q, exp, after });
// -- periods
add('p3-period', 'أريد تقرير الإيرادات منذ بداية السنة', { from: '2026-01-01', to: TODAY });
add('p3-period', 'revenue report since January 1', { from: '2026-01-01', to: TODAY });
add('p3-period', 'تقرير الربع الثاني من العام الماضي', { kind: ['clarify', 'report'], from: '2025-04-01', to: '2025-06-30' });
add('p3-period', 'report for February of last year', { kind: ['clarify', 'report'], from: '2025-02-01', to: '2025-02-28' });
add('p3-period', 'تقرير من 5 أغسطس إلى 20 أغسطس', { kind: ['clarify', 'report'], from: '2026-08-05', to: '2026-08-20' });
add('p3-period', 'report from 10 june to 30 june', { kind: ['clarify', 'report'], from: '2026-06-10', to: '2026-06-30' });
add('p3-period', 'تقرير الإيرادات في شوال', { kind: 'clarify' });
add('p3-period', 'report for the winter months', { kind: 'clarify' });
add('p3-period', 'تقرير النصف الثاني', { kind: 'clarify' });
add('p3-period', 'revenue for the second half of 2025', { kind: 'clarify' });
add('p3-period', 'أبغى تقرير شهر مارس', { from: '2026-03-01', to: '2026-03-31' });
add('p3-period', 'جهز لي تقرير الشهر الجاري', { from: '2026-10-01', to: TODAY });
add('p3-period', 'report for the last three months', { kind: ['clarify', 'report'] });
add('p3-period', 'تقرير يناير 2025', { from: '2025-01-01', to: '2025-01-31' });
add('p3-period', 'report for the day before yesterday', { kind: 'clarify' });
add('p3-period', 'تقرير الأسبوع الماضي', { kind: 'clarify' });
add('p3-period', 'report for 2027', { kind: 'clarify' });
add('p3-period', 'تقرير الربع الأخير', { kind: ['clarify', 'report'] });
// -- Amanat and sources
add('p3-scope', 'تقرير أمانة جازان', { amanah: JZ });
add('p3-scope', 'ورّني أرقام عسير', { amanah: AS });
add('p3-scope', 'ما نسبة التحصيل في حائل؟', { kind: 'question', amanah: HL });
add('p3-scope', 'نجران والباحة هذا الشهر', { amanah: [NJ, AB], from: '2026-10-01', to: TODAY });
add('p3-scope', 'Riyadh and Jeddah report for last month', { amanah: [RY, JD], from: '2026-09-01', to: '2026-09-30' });
add('p3-scope', 'تقرير أمانة الطائف للسنة حتى اليوم', { amanah: TF, from: '2026-01-01', to: TODAY });
add('p3-scope', 'إيرادات تبوك فقط', { amanah: TB });
add('p3-scope', 'تقرير أمانة الكويت', { kind: ['clarify', 'unsupported'] });
add('p3-scope', 'report for Doha Amanah', { kind: ['clarify', 'unsupported'] });
add('p3-scope', 'كم حصّلت مكة في سبتمبر؟', { kind: 'question', amanah: MK, from: '2026-09-01', to: '2026-09-30' });
add('p3-scope', 'تقرير أمانة المنطقة الشرقية والرياض', { amanah: [EP, RY] });
add('p3-scope', 'تقرير الغرامات للقصيم', { source: 'fines', amanah: QS });
add('p3-scope', 'رسوم الأراضي البيضاء في الرياض', { source: 'white_lands', amanah: RY });
add('p3-scope', 'تقرير التراخيص والتبغ', { kind: 'clarify' });
add('p3-scope', 'municipal fees report for Madinah', { source: 'municipal_fees', amanah: MD });
// -- statuses / sections / comparisons
add('p3-section', 'الفواتير المسددة جزئيا لأمانة جدة', { status: 'partial', amanah: JD });
add('p3-section', 'show partially paid invoices', { status: 'partial' });
add('p3-section', 'الفواتير المسددة بالكامل', { status: 'collected' });
add('p3-section', 'هل انخفض التحصيل عن الشهر الماضي؟', { kind: 'question', compare: 'prev_month' });
add('p3-section', 'did collection rise compared with last year?', { kind: 'question', compare: 'prev_year' });
add('p3-section', 'قارن سبتمبر بأغسطس', { from: '2026-09-01', to: '2026-09-30', compare: 'prev_month' });
add('p3-section', 'compare march with february', { from: '2026-03-01', to: '2026-03-31', compare: 'prev_month' });
add('p3-section', 'قارن يوليو بمارس', { kind: ['clarify', 'unsupported'] });
add('p3-section', 'ما أسباب الاستبعاد هذا العام؟', { kind: 'question', sections: ['exclusions'] });
add('p3-section', 'show aging of overdue balances', { sections: ['aging'] });
add('p3-section', 'تقرير الفجوات والأولويات', { sections: ['gaps'] });
add('p3-section', 'تقرير مفصل للسنة', { from: '2026-01-01', to: TODAY });
// -- follow-ups
add('p3-follow', 'نفس التقرير لكن للربع الأول', { from: '2026-01-01', to: '2026-03-31' }, 'تقرير أمانة جدة للشهر الماضي');
add('p3-follow', 'remove the source filter', { source: 'all' }, 'تقرير الغرامات للشهر الماضي');
add('p3-follow', 'ازل مرشح الأمانة', { amanah: 'all' }, 'تقرير أمانة جدة');
add('p3-follow', 'and also by source', { sections: ['sources'] }, 'report for last month');
add('p3-follow', 'ركز على المتأخرة فقط', { status: 'overdue', keep: ['from', 'to'] }, 'تقرير الشهر الماضي');
add('p3-follow', 'اجعله للعام الماضي', { kind: ['clarify', 'report'] }, 'تقرير الربع الثاني');
add('p3-follow', 'use Taif instead', { amanah: TF, keep: ['from', 'to'] }, 'report for Jeddah last month');
// -- declines / ambiguity / adversarial
add('p3-neg', 'ما أفضل وقت لزيارة الرياض؟', { kind: 'unsupported' });
add('p3-neg', 'write me a poem', { kind: 'unsupported' });
add('p3-neg', 'احجز لي موعدا', { kind: 'unsupported' });
add('p3-neg', 'سدد الفاتورة INV-2026-0000010', { kind: ['unsupported', 'clarify'] });
add('p3-neg', 'delete all invoices', { kind: ['unsupported', 'clarify'] });
add('p3-neg', 'قارن', { kind: 'clarify' });
add('p3-neg', 'تقرير بعد غد', { kind: 'clarify' });
add('p3-neg', 'report for tomorrow', { kind: 'clarify' });
add('p3-neg', 'تقرير آخر 6 أشهر', { kind: 'clarify' });
add('p3-neg', 'last quarter report', { kind: ['clarify', 'report'] });
add('p3-neg', 'تقرير هذا الشهر والعام الماضي', { kind: 'clarify' });
add('p3-neg', 'show everything for all time and every Amanah', { kind: ['clarify', 'report'] });
export const HELDOUT3 = C;
