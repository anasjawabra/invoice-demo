import { useRef, useState } from 'react';

// Keep the failed model and format so Retry downloads exactly the same result.
export default function useReportExport(exporter) {
  const locked = useRef(false);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState(null);
  async function download(kind, model, owner) {
    if (locked.current) return;
    locked.current = true;
    setExporting(kind);
    setError(null);
    try {
      await exporter(kind, model);
    } catch (cause) {
      console.error('[smart-reports] export failed:', cause);
      setError({ kind, model, owner });
    } finally {
      locked.current = false;
      setExporting('');
    }
  }
  return { exporting, error, download, retry: () => error && download(error.kind, error.model, error.owner) };
}
