// Strategic objectives and targets. Two system targets (collection rate, cumulative receipts) come from the unapproved demo inputs; users add
// their own objectives. An objective is «مقترح» until a reviewer approves it; progress is measured against the shared dashboard figures.
import React, { useState } from 'react';
import { useAr } from '../../utils/useAr';
import { fmtMoney } from '../../utils/money';
import { OBJECTIVE_METRICS, addObjective, updateObjective, removeObjective, objectiveProgress } from '../../data/planStore';
import { actorName } from '../../utils/actor';

const STATE = { met: ['تحقق', 'Met', 'var(--green)'], on_track: ['على المسار', 'On track', 'var(--secondary)'], off_track: ['متأخر عن المستهدف', 'Off track', 'var(--danger)'], unavailable: ['غير متاح', 'Not available', 'var(--txt-mute)'] };

export default function ObjectivesPanel({ store, setStore, actuals, systemRows, canEdit, user, today }) {
  const { L, ar, lang } = useAr();
  const by = actorName(user, lang) || L('مستخدم', 'user');
  const [form, setForm] = useState(null);
  const fmtVal = (metric, v) => (v == null ? L('غير متاح', 'n/a') : OBJECTIVE_METRICS[metric].unit === 'sar' ? fmtMoney(v, { lang }) : `${v.toFixed(1)}%`);
  const Row = ({ o, system }) => {
    const pr = objectiveProgress(o, actuals); const st = STATE[pr.state]; const m = OBJECTIVE_METRICS[o.metric];
    return (
      <tr>
        <td><b>{o.title}</b>{o.note && <div className="muted" style={{ fontSize: 11.5 }}>{o.note}</div>}<div className="muted" style={{ fontSize: 11.5 }}>{ar ? m.ar : m.en}</div></td>
        <td dir="ltr">{fmtVal(o.metric, pr.actual)}</td>
        <td dir="ltr">{fmtVal(o.metric, o.target)}</td>
        <td><span style={{ color: st[2], fontWeight: 700 }}>{ar ? st[0] : st[1]}</span>{pr.ratio != null && <div className="muted" dir="ltr" style={{ fontSize: 11.5 }}>{(pr.ratio * 100).toFixed(0)}%</div>}</td>
        <td>{o.status === 'approved' ? <span className="st-tag st-tag--actual">{L('معتمد', 'approved')}{o.approvedBy ? ` — ${o.approvedBy}` : ''}</span> : <span className="st-tag st-tag--warn">{system ? L('مُدخل تجريبي — غير معتمد', 'demo input — unapproved') : L('مقترح — غير معتمد', 'proposed — unapproved')}</span>}</td>
        <td>{o.owner || <span className="muted">{L('غير مسند', 'unassigned')}</span>}</td>
        <td dir="ltr">{o.due || '—'}</td>
        <td>{!system && canEdit && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><button type="button" className="btn btn-sm btn-ghost" onClick={() => setStore((s) => updateObjective(s, o.id, o.status === 'approved' ? { status: 'proposed', approvedBy: null } : { status: 'approved', approvedBy: by }, by))}>{o.status === 'approved' ? L('إلغاء الاعتماد', 'Unapprove') : L('اعتماد', 'Approve')}</button><button type="button" className="btn btn-sm btn-ghost" onClick={() => setStore((s) => removeObjective(s, o.id))} aria-label={L('حذف', 'Delete')}>×</button></div>}</td>
      </tr>
    );
  };
  return (
    <div className="card st-card">
      <div className="st-table-wrap"><table className="table" aria-label={L('الأهداف والمستهدفات', 'Objectives and targets')}>
        <thead><tr><th>{L('الهدف', 'Objective')}</th><th>{L('الفعلي', 'Actual')}</th><th>{L('المستهدف', 'Target')}</th><th>{L('الحالة', 'Progress')}</th><th>{L('الاعتماد', 'Approval')}</th><th>{L('المسؤول', 'Owner')}</th><th>{L('الاستحقاق', 'Due')}</th><th /></tr></thead>
        <tbody>
          {systemRows.map((o) => <Row key={o.id} o={o} system />)}
          {store.objectives.map((o) => <Row key={o.id} o={o} system={false} />)}
        </tbody>
      </table></div>
      {!store.objectives.length && <div className="muted" style={{ fontSize: 12.5 }}>{L('لا أهداف استراتيجية مسجلة بعد. الصفان أعلاه مستهدفات تجريبية غير معتمدة؛ أضف هدفاً (يبقى «مقترحاً» حتى يعتمده مراجع). لا توجد أهداف رسمية مدمجة.', 'No strategic objectives recorded yet. The rows above are unapproved demo targets; add an objective (it stays “proposed” until a reviewer approves it). No official objectives are built in.')}</div>}
      <div style={{ display: 'flex', gap: 6 }}><button type="button" className="btn btn-sm" disabled={!canEdit} title={canEdit ? '' : L('يتطلب صلاحية المراجعة', 'Requires review permission')} onClick={() => setForm(form ? null : { title: '', metric: 'collection_rate', target: '', due: '', owner: '', note: '' })}>＋ {L('هدف جديد', 'New objective')}</button></div>
      {form && (
        <div className="st-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          <div className="st-field"><label htmlFor="ob-t">{L('عنوان الهدف', 'Objective')}</label><input id="ob-t" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="st-field"><label htmlFor="ob-m">{L('المؤشر المرتبط', 'Linked indicator')}</label><select id="ob-m" className="select" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>{Object.entries(OBJECTIVE_METRICS).map(([k, v]) => <option key={k} value={k}>{ar ? v.ar : v.en}</option>)}</select></div>
          <div className="st-field"><label htmlFor="ob-v">{L('القيمة المستهدفة', 'Target value')}</label><input id="ob-v" type="number" className="input" min="0" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></div>
          <div className="st-field"><label htmlFor="ob-d">{L('تاريخ الاستحقاق', 'Due date')}</label><input id="ob-d" type="date" className="input" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></div>
          <div className="st-field"><label htmlFor="ob-o">{L('المسؤول (اختياري)', 'Owner (optional)')}</label><input id="ob-o" className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></div>
          <div className="st-field"><label htmlFor="ob-n">{L('ملاحظة', 'Note')}</label><input id="ob-n" className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}><button type="button" className="btn btn-primary btn-sm" disabled={!form.title.trim() || !(Number(form.target) > 0)} onClick={() => { setStore((s) => addObjective(s, { by, fields: { title: form.title.trim(), metric: form.metric, target: Number(form.target), due: form.due || null, owner: form.owner.trim() || null, note: form.note.trim() } })); setForm(null); }}>{L('إضافة', 'Add')}</button></div>
        </div>
      )}
    </div>
  );
}
