import { parseCsv } from './ledgerImport';
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, checkBytes, checkZipBudget } from './fileBudget';

globalThis.onmessage = async ({ data: { bytes, name } }) => {
  try {
    checkBytes(bytes, MAX_IMPORT_BYTES);
    let table;
    if (/\.xlsx?$/i.test(name)) {
      const b = new Uint8Array(bytes);
      if (b[0] === 0x50 && b[1] === 0x4b) checkZipBudget(b);
      const XLSX = await import('xlsx');
      const wb = XLSX.read(bytes, { type: 'array', cellDates: false, sheetRows: MAX_IMPORT_ROWS + 2 });
      table = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
    } else table = parseCsv(new TextDecoder().decode(bytes));
    if (table.length > MAX_IMPORT_ROWS + 1 || table.some((row) => row.length > 100)) throw new Error('import_rows_exceeded');
    globalThis.postMessage({ table });
  } catch (error) { globalThis.postMessage({ error: error.message }); }
};
