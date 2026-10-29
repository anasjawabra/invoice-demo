import React, { useEffect, useRef, useState } from 'react';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { api } from '../api/client';
import { parseExclusionFile } from '../data/exclusionFiles';
import { EXCLUSION_RULES } from '../data/revenueMetrics';
import { addBatch, withdrawBatch } from '../data/workflowStore';
import { downloadBlob } from '../utils/download';
import TableCsvExport from './TableCsvExport';
import Pager from './Pager';
const REASON = {
  accepted: { en: 'Accepted for local review', ar: 'مقبول للمراجعة المحلية' },
  invalid_invoice_id: { en: 'Invoice identifier is missing or invalid', ar: 'معرّف الفاتورة مفقود أو غير صالح' },
  unsupported_rule: { en: 'Rule is not supported for file review', ar: 'القاعدة غير مدعومة لمراجعة الملفات' },
  rule_disabled: { en: 'Rule is disabled in the current configuration', ar: 'القاعدة معطّلة في الإعداد الحالي' },
  evidence_required: { en: 'Evidence must contain 3–2,000 characters', ar: 'يجب أن يتضمن الدليل من 3 إلى 2000 حرف' },
  duplicate_row: { en: 'Invoice and rule are repeated in this file', ar: 'الفاتورة والقاعدة مكررتان في هذا الملف' },
  not_accessible: { en: 'Invoice was not found in your accessible data', ar: 'لم تُعثر على الفاتورة ضمن البيانات المتاحة لك' },
  outside_selected_scope: { en: 'Invoice is outside the selected scope or dates', ar: 'الفاتورة خارج النطاق أو الفترة المحددة' },
  no_eligible_balance: { en: 'Invoice is cancelled or has no eligible unpaid balance', ar: 'الفاتورة ملغاة أو ليس لها رصيد مؤهل غير مسدد' },
  existing_review: { en: 'This invoice and rule already have a review', ar: 'توجد مراجعة سابقة لهذه الفاتورة والقاعدة' },
  rule_conditions_not_met: { en: 'Source data does not satisfy the rule conditions', ar: 'بيانات المصدر لا تستوفي شروط القاعدة' }
};

function BatchCard({ batch, withdraw, canReview }) {
  const { L } = useL(); const [page, setPage] = useState(0);
  return <details className="card card-pad"><summary>{batch.fileName} · {batch.status === 'applied' ? L('Applied in demo', 'مطبّقة في العرض') : L('Withdrawn', 'مسحوبة')} · {batch.rows.length}</summary>
    <p>{batch.by} · <time>{batch.at}</time></p>
    <div className="rv-table-wrap" tabIndex={0}><table className="rv-table"><thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Rule', 'القاعدة')}</th><th>{L('State', 'الحالة')}</th><th>{L('Action', 'الإجراء')}</th></tr></thead><tbody>{batch.rows.slice(page * 50, page * 50 + 50).map((r) => <tr key={`${r.invoiceId}|${r.ruleId}`}><td dir="ltr">{r.invoiceId}</td><td>{r.ruleId}</td><td>{r.status === 'withdrawn' || batch.status === 'withdrawn' ? L('Withdrawn', 'مسحوبة') : L('Applied in demo', 'مطبّقة في العرض')}</td><td><button type="button" className="btn btn-sm" disabled={!canReview || batch.status !== 'applied' || r.status === 'withdrawn'} onClick={() => withdraw(batch.id, r)}>{L('Withdraw row', 'سحب السطر')}</button></td></tr>)}</tbody></table></div>
    <Pager page={page} total={batch.rows.length} size={50} onPage={setPage} />
    <button type="button" className="btn btn-sm" disabled={!canReview || batch.status !== 'applied'} onClick={() => withdraw(batch.id)}>{L('Withdraw whole batch', 'سحب الدفعة كاملة')}</button>
    <TableCsvExport filename={`${batch.id}-audit.csv`} columns={['at', 'actor', 'action', 'invoice_id', 'rule_id', 'note']} rows={batch.history.map((h) => [h.at, h.by, h.action, h.invoiceId || '', h.ruleId || '', h.note || ''])} context={{ batchId: batch.id, fileHash: batch.hash, localDemoAudit: true }} />
    <ol>{batch.history.map((h, i) => <li key={i}>{h.at} · {h.by} · {h.action} · {h.note}</li>)}</ol>
  </details>;
}
export default function ExclusionBatchPanel() {
  const rev = useRevenue(); const { L, B } = useL(); const [preview, setPreview] = useState(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [note, setNote] = useState('');
  const file = useRef(null); const request = useRef(null);
  const stamp = `${rev.currentScopeKey}|${rev.dataVersion}|${rev.workflow.store.revision}|${rev.user?.user}`; const latest = useRef(stamp); latest.current = stamp;
  useEffect(() => { setPreview(null); setBusy(false); request.current?.abort(); return () => request.current?.abort(); }, [stamp]);
  const audit = () => ({ by: rev.user?.user || 'reviewer', at: new Date().toISOString(), note: note.trim() });
  const errorText = L('Could not complete the operation. Check the file, current scope, connection and browser storage; retry without closing this page.', 'تعذّر إكمال العملية. تحقق من الملف والنطاق الحالي والاتصال وتخزين المتصفح، ثم أعد المحاولة دون إغلاق الصفحة.');
  const validate = (rows, signal) => api.validateExclusions(rev.requestFor(rev.scopeEff, { rows }), { signal });
  async function readFile(e) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f || !rev.canReview) return;
    request.current?.abort(); const ac = new AbortController(); request.current = ac; const captured = stamp;
    setBusy(true); setPreview(null); setMessage('');
    try {
      if (f.size > 2 * 1048576 || !/\.csv$/i.test(f.name)) throw new Error('csv_2mib');
      const text = await f.text(); const rows = parseExclusionFile(text);
      const result = await validate(rows, ac.signal); const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((v) => v.toString(16).padStart(2, '0')).join('');
      if (!ac.signal.aborted && latest.current === captured) setPreview({ ...result, rows, fileName: f.name, hash, stamp: captured });
    } catch (err) { if (!ac.signal.aborted) setMessage(`${errorText} (${err.message})`); }
    finally { if (request.current === ac) setBusy(false); }
  }
  async function apply() {
    if (!rev.canReview || !preview?.accepted.length || preview.stamp !== latest.current || !note.trim()) return;
    const p = preview; const ac = new AbortController(); request.current = ac; setBusy(true); setMessage('');
    try {
      const current = await validate(p.rows, ac.signal);
      if (ac.signal.aborted || latest.current !== p.stamp) return;
      if (JSON.stringify(current.accepted) !== JSON.stringify(p.accepted)) throw new Error('data_changed_revalidate');
      const a = audit(); const batch = { id: crypto.randomUUID(), fileName: p.fileName, hash: p.hash, status: 'applied', rows: p.accepted, ...a, scope: rev.scopeEff, history: [{ ...a, action: 'apply_batch' }] };
      const saved = await rev.workflow.update((s) => addBatch(s, batch)); if (!saved.ok) throw new Error(saved.error);
      setPreview(null); setNote(''); setMessage(L('Accepted rows applied to this local demo. Rejected rows were not applied.', 'طُبّقت الصفوف المقبولة في هذا العرض المحلي، ولم تُطبّق الصفوف المرفوضة.'));
    } catch (err) { if (!ac.signal.aborted) setMessage(`${errorText} (${err.message})`); }
    finally { if (request.current === ac) setBusy(false); }
  }
  async function withdraw(id, row) {
    if (!rev.canReview || !note.trim()) { setMessage(L('Enter a withdrawal reason first.', 'أدخل سبب السحب أولاً.')); return; }
    const result = await rev.workflow.update((s) => withdrawBatch(s, id, row, audit()));
    setMessage(result.ok ? L('Withdrawn; the prior analytical state is restored and the local history retained.', 'سُحبت البيانات وأُعيدت الحالة التحليلية السابقة مع حفظ السجل المحلي.') : errorText);
  }
  return <section className="card card-pad" aria-label={L('Exclusion file workflow', 'مسار ملفات الاستبعاد')}>
    <h2>{L('Exclusion files — local review', 'ملفات الاستبعاد — مراجعة محلية')}</h2>
    <p>{L('CSV only; maximum 2 MiB / 5,000 rows. Preview does not change figures. Confirmation applies accepted rows to the demo analytical layer. Formal approval and source systems remain separate. Records stay in this browser for this account and institution.', 'CSV فقط؛ بحد أقصى 2 MiB و5000 صف. لا تغيّر المعاينة الأرقام. يطبّق التأكيد الصفوف المقبولة على الطبقة التحليلية للعرض. الاعتماد الرسمي وأنظمة المصدر منفصلان. تُحفظ السجلات في هذا المتصفح لهذا الحساب والجهة.')}</p>
    {!rev.workflow.ok && <p role="alert">{errorText}</p>}
    <p>{L('Required columns: invoice_id, rule_id, evidence. Each invoice must be accessible in the selected scope with an eligible unpaid balance. Rejected rows include an error code.', 'الأعمدة المطلوبة: invoice_id وrule_id وevidence. يجب أن تكون الفاتورة متاحة ضمن النطاق المحدد ولها رصيد مؤهل غير مسدد. تتضمن الصفوف المرفوضة رمز الخطأ.')}</p>
    <details><summary>{L('Allowed rules', 'القواعد المسموحة')}</summary><ul>{EXCLUSION_RULES.filter((r) => !r.locked && r.id !== 'DEC-1').map((r) => <li key={r.id}>{r.id} · {B(r.label)}</li>)}</ul></details>
    <div className="metric-dictionary-views">
      <button type="button" className="btn btn-sm" onClick={() => downloadBlob(new Blob(['\uFEFFinvoice_id,rule_id,evidence\n'], { type: 'text/csv;charset=utf-8' }), 'exclusion-template.csv')}>{L('Download exclusion template', 'تنزيل نموذج الاستبعاد')}</button>
      <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={readFile} />
      <button type="button" className="btn btn-sm" disabled={!rev.canReview || busy || !rev.workflow.ok} onClick={() => file.current.click()}>{L('Upload exclusion CSV', 'رفع CSV للاستبعاد')}</button>
    </div>
    <label>{L('Review / withdrawal reason', 'سبب المراجعة / السحب')}<textarea className="input" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} /></label>
    {busy && <p role="status">{L('Validating…', 'جارٍ التحقق…')}</p>}
    {message && <p role="status">{message}</p>}
    {preview && <div data-testid="exclusion-preview"><p>{L('Accepted', 'مقبول')}: {preview.accepted.length} · {L('Rejected', 'مرفوض')}: {preview.rejected.length}</p>
      <TableCsvExport label={L('Download accepted rows', 'تنزيل الصفوف المقبولة')} filename="exclusion-accepted.csv" columns={['row', 'invoice_id', 'rule_id', 'evidence', 'balance_sar']} rows={preview.accepted.map((r) => [r.row, r.invoiceId, r.ruleId, r.evidence, r.balance])} context={{ file: preview.fileName, fileHash: preview.hash }} />
      <TableCsvExport label={L('Download rejected rows', 'تنزيل الصفوف المرفوضة')} filename="exclusion-rejected.csv" columns={['row', 'invoice_id', 'rule_id', 'evidence', 'reason']} rows={preview.rejected.map((r) => [r.row, r.invoiceId, r.ruleId, r.evidence, r.reason])} context={{ file: preview.fileName, fileHash: preview.hash }} />
      <div className="rv-table-wrap" tabIndex={0}><table className="rv-table"><thead><tr><th>{L('Row', 'الصف')}</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Rule / result', 'القاعدة / النتيجة')}</th></tr></thead><tbody>{[...preview.accepted.map((r) => ({ ...r, reason: 'accepted' })), ...preview.rejected].sort((a, b) => a.row - b.row).slice(0, 50).map((r) => <tr key={r.row}><td>{r.row}</td><td>{r.invoiceId}</td><td>{r.ruleId} · {B(REASON[r.reason] || { en: r.reason, ar: r.reason })}</td></tr>)}</tbody></table></div>
      <p>{L('Preview shows the first 50 rows; the rejected-row download contains every rejection.', 'تعرض المعاينة أول 50 صفاً؛ ويتضمن ملف المرفوضات جميع الصفوف المرفوضة.')}</p>
      <button type="button" className="btn btn-primary" disabled={!rev.canReview || busy || !preview.accepted.length || !note.trim()} onClick={apply}>{L('Confirm accepted rows in demo', 'تأكيد الصفوف المقبولة في العرض')}</button>
    </div>}
    {rev.workflow.store.batches.slice().reverse().map((b) => <BatchCard key={b.id} batch={b} withdraw={withdraw} canReview={rev.canReview && !busy} />)}
  </section>;
}
