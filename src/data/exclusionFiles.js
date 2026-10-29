import { parseCsv } from './ledgerImport.js';
export function parseExclusionFile(text) {
  const parsed = parseCsv(text);
  if (parsed[0]?.[0]?.startsWith('# Synthetic demo data;')) parsed.shift();
  const header = parsed.shift()?.map((x) => x.trim().replace(/^\uFEFF/, '')) || [];
  const required = ['invoice_id', 'rule_id', 'evidence'];
  if (!required.every((k) => header.includes(k)) || new Set(header).size !== header.length || header.some((k) => ![...required, 'row', 'reason', 'reason_en', 'reason_ar', 'balance_sar'].includes(k)) || parsed.length === 0 || parsed.length > 5000 || parsed.some((r) => r.length !== header.length)) throw new Error('bad_columns_or_row_limit');
  return parsed.map((r) => ({ invoiceId: r[header.indexOf('invoice_id')], ruleId: r[header.indexOf('rule_id')], evidence: r[header.indexOf('evidence')] }));
}
