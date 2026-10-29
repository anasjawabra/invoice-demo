// Board Pack summary — assembles a ready-to-read snapshot of the currently
// active plan (whichever model, assumptions and scenario are live right
// now) into one structured object. Purely a presentation-layer summary; no
// new calculations, only formatting of fields cfoModel.js already computed.
export function buildCFOBoardPackReport(model, t, money) {
  return {
    title: t('cfo_boardpack_title'),
    generatedOn: new Date().toISOString().slice(0, 10),
    period: `${model.periodStart} → ${model.periodEnd}`,
    healthScore: model.health.score,
    healthBand: t(`cfo_health_${model.health.band}`),
    keyMetrics: [
      { label: t('cfo_kpi_expected_collections'), value: money(model.expectedCollections) },
      { label: t('cfo_kpi_expected_expenses'), value: money(model.expectedExpenses) },
      { label: t('cfo_kpi_net_position'), value: money(model.netPosition) },
      { label: t('cfo_kpi_coverage'), value: model.expenseCoverage == null ? '—' : `${model.expenseCoverage}%` }
    ],
    risks: model.risks.map((r) => ({
      category: t(`cfo_risk_${r.category}`), severity: r.severity, impact: money(r.impactSAR), action: t(`cfo_action_${r.action}`)
    })),
    recommendations: model.recommendations.map((r) => ({
      category: t(`cfo_risk_${r.riskCategory}`), priority: r.priority, action: t(`cfo_action_${r.action}`), impact: money(r.impactSAR)
    }))
  };
}
