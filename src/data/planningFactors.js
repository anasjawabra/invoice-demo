// «العوامل المؤثرة في فجوة المستهدف» — the labels of the factors section (planning review 07 §4); the factors of a plan are BUILT in src/components/plans/planFactors.js (`planFactorsFor`): three SEPARATE groups, never summed and never read as causes:
//   facts        «حقائق مؤكدة»        amounts and periods taken from records (collected vs planned, billing vs the billing the target requires, pace, outstanding due balances, exclusions, blockers …)
//   hypotheses   «فرضيات تحتاج تحقق»   stated as hypotheses; each says what would confirm it; none is asserted
//   missing      «بيانات ناقصة»        what is absent and would be needed (approved monthly plan, source targets, payment load dates, recovery data …)
// Rules: low collection never stands as a reason by itself; no cause (investor delay, dispute, enforcement delay, operations) is named without a record; no «maximum collectible»; there is NO waterfall —
// the indicators are separate figures, the only reconciled decomposition is by entity (shown in the contribution section). Every item carries bilingual text; money is formatted per language.
const bi = (ar, en) => ({ ar, en });

export const FACTOR_GROUPS = [
  { id: 'facts', title: bi('حقائق مؤكدة', 'Confirmed facts'), sub: bi('مبالغ وفترات من السجلات — أرقام منفصلة لا تُجمع ولا تُفسَّر كأسباب', 'Amounts and periods from the records — separate figures that are not added up and are not causes') },
  { id: 'hypotheses', title: bi('فرضيات تحتاج تحقق', 'Hypotheses that need verification'), sub: bi('لم تثبت: كل فرضية تذكر ما يؤكدها', 'Not established: each hypothesis says what would confirm it') },
  { id: 'missing', title: bi('بيانات ناقصة', 'Missing data'), sub: bi('ما لا نملكه ويلزم لقراءة أدق — منفصل عن الأداء', 'What we do not have and would need for a firmer reading — separate from performance') }
];
export const FACTORS_TITLE = { gap: bi('العوامل المؤثرة في فجوة المستهدف', 'Factors affecting the target gap'), support: bi('العوامل الداعمة لتحقيق المستهدف', 'Factors supporting the target') };
export const FACTORS_NOT_ADDITIVE = bi('هذه مؤشرات منفصلة: لا تُجمع، ولا تُعدّ أسباباً للفجوة، ولا يوجد تحليل شلالي يوحي بذلك. التحليل الوحيد الذي يتطابق مجموعه مع الفجوة هو حسب الجهة (القسم أعلاه).', 'These are separate indicators: they do not add up, they are not causes of the gap, and there is no waterfall that would suggest it. The only decomposition that adds up to the gap is by entity (the section above).');
