import UISymbol from '../components/UISymbol';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { ScopeBar } from '../components/revenue/RevenueUI';
import { useAsync } from '../utils/useAsync';
import { AsyncBlock } from '../components/strategic/AsyncState';
import Pager from '../components/Pager';
import TableCsvExport from '../components/TableCsvExport';
import { api } from '../api/client';
import { invoicePath } from '../utils/paths';
import { CATEGORY_LABELS, EXCLUSION_RULE_SET_VERSION } from '../data/revenueMetrics';
const STATES = ['open', 'in_progress', 'done', 'dismissed'];
const STATE_LABEL = { open: { en: 'Open', ar: 'مفتوح', zh: '未结' }, in_progress: { en: 'In progress', ar: 'قيد العمل' }, done: { en: 'Done', ar: 'مكتمل' }, dismissed: { en: 'Dismissed', ar: 'مستبعد من المتابعة' } };
export function validAction(input) {
  return typeof input.owner === 'string' && input.owner.trim().length > 0 && input.owner.length <= 120 && typeof input.note === 'string' && input.note.trim().length > 0 && input.note.length <= 2000 && STATES.includes(input.status) && /^20\d\d-\d{2}-\d{2}$/.test(input.dueDate) && Number.isFinite(Date.parse(input.dueDate)) && new Date(input.dueDate).toISOString().slice(0, 10) === input.dueDate;
}
const measure = (row, rev) => ({ net: row.net, collected: row.collected, outstanding: row.outstanding, exclusions: row.exclusions, referenceDate: rev.cfg.cutoff, ruleVersion: EXCLUSION_RULE_SET_VERSION });
export default function Decisions() {
  const rev = useRevenue(); const { L, B, sar } = useL();
  const [search] = useSearchParams(); const requestedId = search.get('invoice');
  const [page, setPage] = useState(0); const [category, setCategory] = useState('all'); const [owner, setOwner] = useState(''); const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(null); const [form, setForm] = useState({ owner: '', dueDate: '', status: 'open', note: '' }); const [message, setMessage] = useState('');
  const actions = rev.workflow.store.actions;
  const [retry, setRetry] = useState(0); const [saving, setSaving] = useState(false);
  const pendingSave = useRef(null); const editToken = useRef(0);
  useEffect(() => () => pendingSave.current?.abort(), []);
  const guard = `${rev.currentScopeKey}|${rev.user?.user}|${rev.canReview}`; const latest = useRef(guard); latest.current = guard;
  useEffect(() => { setPage(0); setSelected(null); }, [rev.currentScopeKey, category, rev.user?.user]);
  const queue = useAsync(() => rev.data.worklist(rev.scopeEff, 50, { page, includeExcluded: true, category }), [rev.data, rev.currentScopeKey, page, category, retry]);
  const stored = useAsync(() => api.workflowRecords(rev.requestFor(rev.scopeEff, { ids: actions.map((a) => a.invoiceId) })), [rev.data, rev.currentScopeKey, actions, retry]);
  const accessible = useMemo(() => new Map((stored.data?.rows || []).map((r) => [r.id, r])), [stored.data]);
  const shown = actions.filter((a) => accessible.has(a.invoiceId) && (!owner.trim() || a.owner.toLowerCase().includes(owner.trim().toLowerCase())) && (status === 'all' || status === a.status) && (category === 'all' || accessible.get(a.invoiceId).cls === category));
  const cancelEdit = () => { editToken.current++; pendingSave.current?.abort(); pendingSave.current = null; setSaving(false); setSelected(null); };
  const choose = (row) => { cancelEdit(); const prior = actions.find((a) => a.invoiceId === row.id); setSelected({ row, prior }); setForm({ owner: prior?.owner || '', dueDate: prior?.dueDate || '', status: prior?.status || 'open', note: '' }); setMessage(''); };
  useEffect(() => {
    if (!requestedId || requestedId.length > 160 || !rev.canReview) return undefined;
    const ac = new AbortController();
    api.workflowRecords(rev.requestFor(rev.scopeEff, { ids: [requestedId] }), { signal: ac.signal }).then((r) => { if (!ac.signal.aborted && r.rows[0]) choose(r.rows[0]); }).catch(() => { if (!ac.signal.aborted) setMessage(L('This invoice could not be loaded in the selected scope.', 'تعذّر تحميل الفاتورة في النطاق المحدد.')); });
    return () => ac.abort();
  }, [requestedId, rev.currentScopeKey, rev.canReview, rev.user?.user]);
  const save = async (e) => {
    e.preventDefault(); if (saving || !rev.canReview || !selected || !validAction(form)) return;
    const captured = guard; const rowId = selected.row.id; const token = editToken.current; const ac = new AbortController(); pendingSave.current = ac; setSaving(true);
    try {
      const result = await api.workflowRecords(rev.requestFor(rev.scopeEff, { ids: [rowId] }), { signal: ac.signal }); const row = result.rows[0]; if (!row || captured !== latest.current || token !== editToken.current) throw new Error('not_accessible');
      const at = new Date().toISOString(); const by = rev.user.user; const measurement = measure(row, rev);
      const saved = await rev.workflow.update((s) => {
        if (ac.signal.aborted || token !== editToken.current || captured !== latest.current) return null;
        const prior = s.actions.find((a) => a.invoiceId === rowId);
        if (prior?.updatedAt !== selected.prior?.updatedAt || !prior && s.actions.length >= 5000) return null;
        const a = { ...prior, invoiceId: rowId, owner: form.owner.trim(), dueDate: form.dueDate, status: form.status, updatedAt: at, before: prior?.before || measurement, after: measurement, history: [...(prior?.history || []), { at, by, owner: form.owner.trim(), dueDate: form.dueDate, status: form.status, note: form.note.trim(), measurement }] };
        return { ...s, actions: [...s.actions.filter((v) => v.invoiceId !== rowId), a] };
      });
      if (!saved.ok) throw new Error(saved.error); setSelected(null); setMessage(L('Local action and observed figures saved.', 'حُفظ الإجراء المحلي والأرقام المرصودة.'));
    } catch { if (!ac.signal.aborted && token === editToken.current && captured === latest.current) setMessage(L('Could not save. Reload the record and retry; check browser storage.', 'تعذّر الحفظ. أعد تحميل السجل وحاول مجدداً، وتحقق من تخزين المتصفح.')); }
    finally { if (pendingSave.current === ac) { pendingSave.current = null; setSaving(false); } }
  };
  return <div className="rv-page"><h1 className="page-title">{L('Decision Room', 'غرفة القرار')}</h1>
    <p>{L('Local action register for current invoice queues. Owner names are local labels; assignments do not send notifications. Actions never change source records or invoice figures. Formal permissions, approval and shared audit require production integration.', 'سجل إجراءات محلي لقوائم الفواتير الحالية. أسماء المسؤولين تسميات محلية ولا تُرسل التعيينات إشعارات. لا تغيّر الإجراءات سجلات المصدر أو أرقام الفواتير. تتطلب الصلاحيات والاعتماد والتدقيق المشترك تكامل الإنتاج.')}</p>
    <ScopeBar />
    {!rev.workflow.ok && <p role="alert">{L('Local workflow storage is unavailable. Editing is disabled.', 'التخزين المحلي للإجراءات غير متاح. التعديل معطّل.')}</p>}
    <label>{L('Queue category', 'فئة القائمة')}<select className="input" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">{L('All', 'الكل')}</option>{['overdue', 'partial', 'not_due', 'excluded', 'objection', 'enforcement', 'linkage_unresolved', 'ineligible_referral'].map((c) => <option key={c} value={c}>{B(CATEGORY_LABELS[c])}</option>)}</select></label>
    <section className="card card-pad"><h2>{L('Current priority queue', 'قائمة الأولوية الحالية')}</h2>
      <AsyncBlock state={queue} onRetry={() => setRetry((v) => v + 1)}><div className="rv-table-wrap" tabIndex={0}><table className="rv-table"><thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Category', 'الفئة')}</th><th>{L('Outstanding', 'المتبقي')}</th><th>{L('Action', 'الإجراء')}</th></tr></thead><tbody>{(queue.data?.rows || []).map((r) => <tr key={r.id}><td><Link to={invoicePath(r.id)}>{r.id}</Link></td><td>{B(CATEGORY_LABELS[r.cls])}</td><td>{sar(r.outstanding + r.exclusionAmount)}</td><td><button type="button" className="btn btn-sm" disabled={!rev.canReview || !rev.workflow.ok} onClick={() => choose(r)}>{L('Assign / decide', 'تعيين / قرار')}</button></td></tr>)}</tbody></table></div><Pager page={page} total={queue.data?.total || 0} size={50} onPage={setPage} /></AsyncBlock>
    </section>
    {selected && <form className="card card-pad" onSubmit={save}><h2>{selected.row.id}</h2><label>{L('Owner (local label)', 'المسؤول (تسمية محلية)')}<input className="input" required maxLength={120} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></label><label>{L('Due date', 'الموعد النهائي')}<input className="input" required type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label><label>{L('Status', 'الحالة')}<select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATES.map((s) => <option key={s} value={s}>{B(STATE_LABEL[s])}</option>)}</select></label><label>{L('Decision / next action note', 'ملاحظة القرار / الإجراء التالي')}<textarea className="input" required maxLength={2000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label><button type="submit" className="btn btn-primary" disabled={saving || !rev.canReview || !rev.workflow.ok || !validAction(form)}>{L('Save local action', 'حفظ الإجراء المحلي')}</button><button type="button" className="btn btn-sm" onClick={cancelEdit}>{L('Cancel', 'إلغاء')}</button></form>}
    {message && <p role="status">{message}</p>}
    <section className="card card-pad"><h2>{L('Saved actions in the selected scope', 'الإجراءات المحفوظة في النطاق المحدد')}</h2><label>{L('Filter owner', 'تصفية المسؤول')}<input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} /></label><label>{L('Filter action status', 'تصفية حالة الإجراء')}<select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">{L('All', 'الكل')}</option>{STATES.map((s) => <option key={s} value={s}>{B(STATE_LABEL[s])}</option>)}</select></label>
      <AsyncBlock state={stored} onRetry={() => setRetry((v) => v + 1)}><TableCsvExport filename="decision-actions.csv" columns={['invoice_id', 'owner', 'due_date', 'status', 'before_net_sar', 'latest_net_sar', 'before_outstanding_sar', 'latest_outstanding_sar', 'history_json']} rows={shown.map((a) => [a.invoiceId, a.owner, a.dueDate, a.status, a.before.net, a.after.net, a.before.outstanding, a.after.outstanding, JSON.stringify(a.history)])} context={{ scope: rev.scopeEff, referenceDate: rev.cfg.cutoff, localDemoAudit: true }} />
      {shown.map((a) => <article key={a.invoiceId}><h3><Link to={invoicePath(a.invoiceId)}>{a.invoiceId}</Link> · {a.owner} · {B(STATE_LABEL[a.status])}</h3><p>{L('Due', 'الموعد')}: {a.dueDate} {a.dueDate < rev.cfg.cutoff && !['done', 'dismissed'].includes(a.status) ? L('— Overdue action', '— إجراء متأخر') : ''}</p><p>{L('Standing balance at first / latest action', 'الرصيد عند الإجراء الأول / الأخير')}: {sar(a.before.outstanding)}<UISymbol name="right" />{sar(a.after.outstanding)}</p><p>{L('Observed figures are not proof of an effect caused by the decision.', 'الأرقام المرصودة ليست دليلاً على أثر سبّبه القرار.')}</p><button type="button" className="btn btn-sm" disabled={!rev.canReview || !rev.workflow.ok} onClick={() => choose(accessible.get(a.invoiceId))}>{L('Update action / observation', 'تحديث الإجراء / الرصد')}</button><details><summary>{L('History', 'السجل')}</summary><ol>{a.history.map((h, i) => <li key={i}>{h.at} · {h.by} · {h.owner} · {B(STATE_LABEL[h.status])} · {h.note}</li>)}</ol></details></article>)}</AsyncBlock>
    </section>
  </div>;
}
