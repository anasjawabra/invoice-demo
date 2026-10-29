// ============================================================================
// AI Financial Planning Copilot — a scripted assistant, not a real LLM (this
// app has no backend/API-key infrastructure anywhere). Mirrors the exact
// pattern already established by src/data/mock.js's own Assistant QA array
// (`{match: [...keywords], build: (...) => ...}` + keyword `.find()`
// matching in Assistant.jsx) — extended here to a richer structured answer:
// Finding / Driver / Financial Impact / Scenario / Action / Data Basis,
// computed live from whichever model (real or illustrative) is active.
// ============================================================================

export const CFO_QA = [
  {
    id: 'funding-gap',
    match: ['funding gap', 'fund the gap', 'close the gap', 'الفجوة التمويلية', 'سد الفجوة', '资金缺口'],
    build: (model, money, t) => ({
      finding: money(model.netPosition),
      driver: model.risks.length ? `${t(`cfo_risk_${model.risks[0].category}`)} — ${t(`cfo_action_${model.risks[0].action}`)}` : t('cfo_copilot_no_driver'),
      impact: [
        { label: t('cfo_copilot_f_expected_collections'), value: money(model.expectedCollections) },
        { label: t('cfo_copilot_f_expected_expenses'), value: money(model.expectedExpenses) }
      ],
      scenario: t('cfo_copilot_gap_scenario'),
      action: model.recommendations.length ? t(`cfo_action_${model.recommendations[0].action}`) : t('cfo_copilot_no_action'),
      basis: 'cfoModel.computeCFOModel — netPosition, risks'
    })
  },
  {
    id: 'collection-opportunities',
    match: ['collection opportunit', 'improve collection', 'raise collection', 'فرص التحصيل', 'تحسين التحصيل', '催收机会'],
    build: (model, money, t) => ({
      finding: `${model.actualRate}%`,
      driver: model.actualRate < 70 ? t('cfo_copilot_below_benchmark') : t('cfo_copilot_at_benchmark'),
      impact: [
        { label: t('cfo_copilot_f_actual_rate'), value: `${model.actualRate}%` },
        { label: t('cfo_copilot_f_benchmark'), value: '70%' }
      ],
      scenario: t('cfo_copilot_collection_scenario'),
      action: t('cfo_action_prioritize_overdue'),
      basis: 'reportAnalytics.computeKpi — actualRate'
    })
  },
  {
    id: 'revenue-shortfall-driver',
    match: ['revenue shortfall', 'why is revenue', 'revenue driver', 'سبب نقص الإيرادات', 'محرك الإيرادات', '收入短缺原因'],
    build: (model, money, t) => {
      const revenueRisk = model.risks.find((r) => r.category === 'revenue');
      return {
        finding: revenueRisk ? money(revenueRisk.impactSAR) : t('cfo_copilot_no_risk'),
        driver: revenueRisk ? t(`cfo_action_${revenueRisk.action}`) : t('cfo_copilot_no_driver'),
        impact: [{ label: t('cfo_copilot_f_expected_collections'), value: money(model.expectedCollections) }],
        scenario: t('cfo_copilot_driver_scenario'),
        action: revenueRisk ? t(`cfo_action_${revenueRisk.action}`) : t('cfo_copilot_no_action'),
        basis: 'cfoModel.computeFinancialRisks — revenue category'
      };
    }
  },
  {
    id: 'overdue-priority',
    match: ['overdue priority', 'which overdue', 'prioritize overdue', 'أولوية المتأخرات', 'ترتيب المتأخرات', '逾期优先级'],
    build: (model, money, t) => {
      const top = model.paymentPriority.filter((r) => r.real).slice(0, 3);
      return {
        finding: top.length ? money(top.reduce((s, r) => s + r.amount, 0)) : t('cfo_copilot_no_overdue'),
        driver: t('cfo_copilot_overdue_driver'),
        impact: top.map((r) => ({ label: r.id, value: `${money(r.amount)} · ${Math.abs(r.days)} ${t('cfo_copilot_days')}` })),
        scenario: t('cfo_copilot_overdue_scenario'),
        action: t('cfo_action_prioritize_overdue'),
        basis: 'cfoModel.computePaymentPriority — real COLLECTIONS rows'
      };
    }
  },
  {
    id: 'year-end-projection',
    match: ['year-end', 'year end projection', 'end of year', 'توقعات نهاية العام', 'نهاية السنة', '年终预测'],
    build: (model, money, t) => ({
      finding: money(model.expectedCollections),
      driver: model.isIllustrative ? t('cfo_copilot_baseline_based') : t('cfo_copilot_trend_based'),
      impact: [{ label: t('cfo_copilot_f_projected'), value: money(model.expectedCollections) }],
      scenario: t('cfo_copilot_yearend_scenario'),
      action: t('cfo_copilot_yearend_action'),
      basis: model.isIllustrative ? 'decisionRoomDemoData.ILLUSTRATIVE_BASELINE_2026' : 'cfoModel — trailing 12-month trend'
    })
  },
  {
    id: 'underperforming-sources',
    match: ['underperforming', 'worst amanah', 'lowest collection', 'أضعف أمانة', 'أدنى تحصيل', '表现最差'],
    build: (model, money, t) => {
      const worst = [...model.perAmanah].filter((p) => p.count > 0).sort((a, b) => a.rate - b.rate)[0];
      return {
        finding: worst ? `${worst.en} — ${worst.rate}%` : t('cfo_copilot_no_breakdown'),
        driver: worst ? t('cfo_copilot_source_driver') : t('cfo_copilot_no_driver'),
        impact: worst ? [{ label: worst.en, value: money(worst.uncollected) }] : [],
        scenario: t('cfo_copilot_source_scenario'),
        action: t('cfo_action_prioritize_overdue'),
        basis: 'cfoModel.computeAmanahShares — per-Amanah real data'
      };
    }
  },
  {
    id: 'target-gap',
    match: ['target gap', 'how far from target', 'gap to target', 'فجوة الهدف', 'المسافة عن الهدف', '目标差距'],
    build: (model, money, t) => ({
      finding: money(model.expectedCollections - model.kpi.collectedValue),
      driver: t('cfo_copilot_target_driver'),
      impact: [
        { label: t('cfo_copilot_f_current'), value: money(model.kpi.collectedValue) },
        { label: t('cfo_copilot_f_target'), value: money(model.expectedCollections) }
      ],
      scenario: t('cfo_copilot_target_scenario'),
      action: t('cfo_copilot_target_action'),
      basis: 'TargetCard — revenueTargetGap'
    })
  }
];

export const CFO_DEFAULT_ANSWER_KEY = 'cfo_copilot_default';

export function matchCopilotQuestion(input) {
  const lower = (input || '').toLowerCase();
  return CFO_QA.find((x) => x.match.some((m) => lower.includes(m.toLowerCase())));
}

// Not real NLU — a small set of regex patterns matching this Copilot's own
// example questions, feeding the same onAssumptionsChange every slider
// already uses. Extracts one N% (or Npp) and picks a lever by keyword
// priority (overdue > collection > capital/capex > operating/opex >
// revenue), with negative-sign detection via /decrease|reduce|lower|delay|
// cut/.
export function parseWhatIf(input) {
  const lower = (input || '').toLowerCase();
  const match = lower.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  let delta = Number(match[1]);
  if (/decrease|reduce|lower|delay|cut/.test(lower)) delta = -delta;

  let lever = null;
  if (/overdue/.test(lower)) lever = 'overdueRecoveryPct';
  else if (/collect/.test(lower)) lever = 'collectionRateDelta';
  else if (/capital|capex|chapter\s*4/.test(lower)) lever = { chapter: 'ch4' };
  else if (/operat|opex|chapter\s*2|chapter\s*3/.test(lower)) lever = { chapter: 'ch2' };
  else if (/revenue/.test(lower)) lever = 'revenueGrowthPct';
  else if (/expense/.test(lower)) lever = 'expenseGrowthPct';
  if (!lever) return null;

  return { lever, delta };
}

export function applyWhatIf(assumptions, whatIf) {
  if (!whatIf) return assumptions;
  if (typeof whatIf.lever === 'object' && whatIf.lever.chapter) {
    return { ...assumptions, chapterAdjustments: { ...assumptions.chapterAdjustments, [whatIf.lever.chapter]: whatIf.delta } };
  }
  return { ...assumptions, [whatIf.lever]: whatIf.delta };
}
