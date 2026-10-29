import { csvCell } from './csv.js';
import { EXCLUSION_RULE_SET_VERSION } from '../data/revenueMetrics.js';
export function tableCsv(columns, rows, context) {
  return '\uFEFF' + ['# Synthetic demo data; SAR amounts; import identifiers as text,' + csvCell(JSON.stringify({ ...context, ruleVersion: EXCLUSION_RULE_SET_VERSION, rowCount: rows.length })), columns.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n') + '\n';
}
