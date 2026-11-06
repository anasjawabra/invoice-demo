// The «by revenue source» summary chart of the invoice lists as a model block with the semantic descriptor the chart picker needs (pure; used by RankedBars and the tests).
// The bars are parts of ONE facet total (collected, or net unpaid); a top-5 view therefore still names the whole, so a pie / donut adds an explicit «Other (rest of total)».
import { dimOf } from '../../data/chartAlts';

export const summaryBlock = (block, { id, dim, measure, total, ar }) => ({
  ...block, id: `summary:${id}`, otherLabel: ar ? 'أخرى' : 'Other',
  dim: dimOf(dim, { measures: [{ key: measure === 'collected' ? 'collected' : 'uncollected', kind: 'amount' }], additive: true, whole: { label: measure === 'collected' ? (ar ? 'إجمالي المحصّل' : 'Total collected') : (ar ? 'صافي غير المحصّل' : 'Net unpaid'), value: total } })
});
