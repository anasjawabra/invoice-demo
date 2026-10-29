import { localize } from '../../utils/zh';
import React, { useRef, useState } from 'react';
import { useRevenue } from '../../context/RevenueContext';
import { useL } from '../../utils/bi';
import { TEMPLATE_COLUMNS, REJECTIONS, readRows, buildTemplate, buildRejectedWorkbook, uploadReasons, UPLOAD_SOURCE } from '../../data/exclusionUpload';
import { fmtDateText } from '../../data/clock';

// «رفع قائمة استبعادات الأمانة» (IIM-30) — the channel for R8 and R9. Download the template → fill it → upload (.xlsx / .csv) → every row is checked against the invoice data → preview the accepted / rejected
// counts and amounts → confirm. Applied rows carry the reason, the source «ملف الأمانة», the file name, the date and the user; rejected rows go back to the Amanah with the reason. The state stays on this device (demo storage only).
const SAMPLE_URL = '/samples/exclusion-upload-sample.xlsx';

function download(name, data, type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function ExclusionUpload() {
  const rev = useRevenue(); const { L, ar, lang, sar, count } = useL();
  const input = useRef(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null); const [prev, setPrev] = useState(null);
  const text = (code) => (REJECTIONS[code] ? (ar ? REJECTIONS[code].ar : localize(REJECTIONS[code].en, lang)) : code);
  const fail = (ar_, en_) => setMsg({ tone: 'bad', text: L(en_, ar_) });

  async function getTemplate() {
    setBusy(true); setMsg(null);
    try { const [XLSX, JSZip] = await Promise.all([import('xlsx'), import('jszip').then((m) => m.default || m)]); download('exclusion-template.xlsx', await buildTemplate(XLSX, JSZip)); } catch { fail('تعذّر إنشاء النموذج.', 'The template could not be created.'); }
    setBusy(false);
  }
  async function onFile(ev) {
    const f = ev.target.files?.[0]; ev.target.value = ''; if (!f) return;
    setBusy(true); setMsg(null); setPrev(null);
    try {
      if (!/\.(xlsx|csv)$/i.test(f.name)) { fail('الملف يجب أن يكون .xlsx أو .csv.', 'The file must be .xlsx or .csv.'); setBusy(false); return; }
      const XLSX = await import('xlsx'); const buf = await f.arrayBuffer();
      const wb = /\.csv$/i.test(f.name) ? XLSX.read(new TextDecoder('utf-8').decode(buf).replace(/^﻿/, ''), { type: 'string', cellDates: true }) : XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]]; const cells = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
      const parsed = readRows(cells);
      if (parsed.error === 'no_header') { fail('لم أجد صف العناوين: استخدم «تنزيل النموذج».', 'The header row was not found: use «Download the template».'); setBusy(false); return; }
      if (parsed.error === 'missing_columns') { fail(`أعمدة ناقصة: ${parsed.missing.join('، ')}.`, `Missing columns: ${parsed.missing.join(', ')}.`); setBusy(false); return; }
      if (!parsed.rows.length) { fail('الملف لا يحتوي صفوفًا.', 'The file has no rows.'); setBusy(false); return; }
      if (parsed.rows.length > 2000) { fail('الحد الأقصى 2000 صف في الملف الواحد.', 'At most 2,000 rows per file.'); setBusy(false); return; }
      const res = await rev.checkExclusionRows(parsed.rows);
      const byRow = new Map(res.rows.map((r) => [r.row, r]));
      setPrev({ file: f.name, rows: parsed.rows.map((r) => ({ ...r, result: byRow.get(r.row) })), accepted: res.accepted, rejected: res.rejected });
    } catch { fail('تعذّرت قراءة الملف. تأكد أنه نموذج صحيح.', 'The file could not be read. Check that it is a valid template.'); }
    setBusy(false);
  }
  const acceptedRows = prev ? prev.rows.filter((r) => r.result?.ok).map((r) => r.result) : [];
  const rejectedRows = prev ? prev.rows.filter((r) => r.result && !r.result.ok) : [];
  const acceptedAmount = acceptedRows.reduce((t, r) => t + (r.outstanding || 0), 0);
  const rejectedAmount = rejectedRows.reduce((t, r) => t + (Number.isFinite(r.amount) ? r.amount : 0), 0);
  async function downloadRejected() { const XLSX = await import('xlsx'); download(prev.file.replace(/\.(xlsx|csv)$/i, '') + '-rejected.xlsx', buildRejectedWorkbook(XLSX, rejectedRows.map((r) => ({ ...r, rejection: text(r.result.code) })))); }
  function confirm() { const r = rev.applyFileExclusions({ file: prev.file, accepted: acceptedRows, rejected: rejectedRows.length }); if (r.ok) { setMsg({ tone: 'ok', text: L(`${count(r.applied)} invoice(s) were excluded and every figure was refreshed.`, `استُبعدت ${count(r.applied)} فاتورة وتحدّثت كل الأرقام.`) }); setPrev(null); } else fail('لا صلاحية لتطبيق الاستبعاد.', 'You are not allowed to apply exclusions.'); }
  const dateText = (iso) => fmtDateText(String(iso).slice(0, 10), lang);

  return (
    <div className="card card-pad" id="exclusion-upload" role="region" aria-label={L('Upload an Amanah exclusion list', 'رفع قائمة استبعادات الأمانة')}>
      <h2 className="h3" style={{ marginTop: 0 }}>{L('Upload an Amanah exclusion list', 'رفع قائمة استبعادات الأمانة')}</h2>
      <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{L(`For «${uploadReasons()[0].en}» and «${uploadReasons()[1].en}». Each row is checked against the invoice data; only a full match is accepted. Source: ${UPLOAD_SOURCE.en}.`, `لسببي «${uploadReasons()[0].ar}» و«${uploadReasons()[1].ar}». يُفحص كل صف مقابل بيانات الفواتير، ويُقبل الصف المطابق بالكامل فقط. المصدر: ${UPLOAD_SOURCE.ar}.`)}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-sm" onClick={getTemplate} disabled={busy}>{L('Download the template', 'تنزيل النموذج')}</button>
        <a className="btn btn-sm btn-ghost" href={SAMPLE_URL} download>{L('Sample file (about 150 rows)', 'ملف تجريبي (نحو 150 صفًا)')}</a>
        <input ref={input} id="excl-file" type="file" accept=".xlsx,.csv" onChange={onFile} hidden aria-label={L('Choose the filled template', 'اختيار النموذج المعبّأ')} />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => input.current?.click()} disabled={busy || !rev.canReview}>{busy ? L('Working…', 'جارٍ العمل…') : L('Upload the file (.xlsx / .csv)', 'رفع الملف (.xlsx / .csv)')}</button>
        {!rev.canReview && <span className="muted" style={{ fontSize: 12 }}>{L('Your role is read-only.', 'دورك للقراءة فقط.')}</span>}
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{L('Columns: ', 'الأعمدة: ')}{TEMPLATE_COLUMNS.map((c) => (ar ? c.ar : localize(c.en, lang))).join(ar ? '، ' : ', ')}</div>
      {msg && <div className={`rv-callout${msg.tone === 'bad' ? ' rv-callout--bad' : ''}`} role="status" aria-live="polite" style={{ marginTop: 12 }}>{msg.text}</div>}

      {prev && (
        <div style={{ marginTop: 12 }}>
          <div className="rv-tiles">
            <div className="rv-tile rv-tile--good"><div className="rv-tile__label">{L('Accepted rows', 'الصفوف المقبولة')}</div><div className="rv-tile__value">{count(prev.accepted)}</div><div className="rv-tile__sub" dir="ltr">{sar(acceptedAmount)}</div></div>
            <div className={`rv-tile${prev.rejected ? ' rv-tile--bad' : ''}`}><div className="rv-tile__label">{L('Rejected rows', 'الصفوف المرفوضة')}</div><div className="rv-tile__value">{count(prev.rejected)}</div><div className="rv-tile__sub" dir="ltr">{sar(rejectedAmount)}</div></div>
          </div>
          <div className="muted" style={{ fontSize: 12, margin: '6px 0' }}>{L(`File ${prev.file} · ${dateText(new Date().toISOString())}. Accepted rows are applied only after you confirm.`, `الملف ${prev.file} · ${dateText(new Date().toISOString())}. لا تُطبَّق الصفوف المقبولة إلا بعد التأكيد.`)}</div>
          {rejectedRows.length > 0 && (
            <div className="rv-table-wrap" tabIndex={0} style={{ maxHeight: 280, overflow: 'auto' }}>
              <table className="rv-table">
                <thead><tr><th>{L('Row', 'الصف')}</th><th>{L('Invoice number', 'رقم الفاتورة')}</th><th>{L('Amanah / entity', 'الأمانة / الجهة')}</th><th>{L('Why it was rejected', 'سبب الرفض')}</th></tr></thead>
                <tbody>{rejectedRows.slice(0, 50).map((r) => <tr key={r.row}><td className="num">{r.row}</td><td dir="ltr">{r.invoiceNo || '—'}</td><td>{r.amanah || '—'}</td><td>{text(r.result.code)}</td></tr>)}</tbody>
              </table>
              {rejectedRows.length > 50 && <div className="muted" style={{ fontSize: 12 }}>{L(`${count(rejectedRows.length - 50)} more in the rejected-rows file.`, `${count(rejectedRows.length - 50)} صفًا آخر في ملف الصفوف المرفوضة.`)}</div>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={confirm} disabled={!acceptedRows.length || !rev.canReview}>{L(`Confirm and apply ${count(acceptedRows.length)} row(s)`, `تأكيد وتطبيق ${count(acceptedRows.length)} صفًا`)}</button>
            <button type="button" className="btn btn-sm" onClick={downloadRejected} disabled={!rejectedRows.length}>{L('Download the rejected rows', 'تنزيل الصفوف المرفوضة')}</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPrev(null)}>{L('Cancel', 'إلغاء')}</button>
          </div>
        </div>
      )}

      {rev.exclusionUploads.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <b style={{ fontSize: 13 }}>{L('Files applied on this device', 'الملفات المطبّقة على هذا الجهاز')}</b>
          <div className="rv-table-wrap" tabIndex={0}>
            <table className="rv-table">
              <thead><tr><th>{L('File', 'الملف')}</th><th>{L('Date', 'التاريخ')}</th><th>{L('By', 'بواسطة')}</th><th className="num">{L('Applied', 'المطبّق')}</th><th className="num">{L('Rejected', 'المرفوض')}</th><th className="num">{L('Excluded (SAR)', 'المستبعد (ريال)')}</th></tr></thead>
              <tbody>{rev.exclusionUploads.map((u, i) => <tr key={`${u.at}-${i}`}><td dir="ltr">{u.file}</td><td>{dateText(u.at)}</td><td>{u.by}</td><td className="num">{count(u.accepted)}</td><td className="num">{count(u.rejected)}</td><td className="num" dir="ltr">{sar(u.amount)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
