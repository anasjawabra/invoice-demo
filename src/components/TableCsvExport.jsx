import React, { useState } from 'react';
import { useL } from '../utils/bi';
import { downloadBlob } from '../utils/download';
import { tableCsv } from '../utils/tableCsv';
export default function TableCsvExport({ columns, rows, context, filename, label }) {
  const { L } = useL(); const [error, setError] = useState(false);
  return <div><button type="button" className="btn btn-sm" onClick={() => {
    try { const blob = new Blob([tableCsv(columns, rows, context)], { type: 'text/csv;charset=utf-8' }); if (blob.size > 32 * 1048576) throw new Error('too_large'); downloadBlob(blob, filename); setError(false); } catch { setError(true); }
  }}>{label || L('Export CSV', 'تصدير CSV')}</button>{error && <span role="alert">{L('Could not export. Narrow the filters and retry.', 'تعذّر التصدير. ضيّق المرشحات وأعد المحاولة.')}</span>}</div>;
}
