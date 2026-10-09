// Persistence notice + backup / restore of the browser-local records (plans, objectives, action register, Smart-report conversations).
import React, { useState } from 'react';
import { useAr } from '../utils/useAr';
import { buildBackup, validateBackup, applyBackup } from '../data/localBackup';
import { downloadBlob } from '../utils/download';
import { riyadhDateOf } from '../data/clock';

export default function LocalDataPanel() {
  const { L } = useAr();
  const [pending, setPending] = useState(null); // a validated backup waiting for confirmation
  const [msg, setMsg] = useState(null);
  const exportNow = () => {
    const b = buildBackup(window.localStorage);
    downloadBlob(new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' }), `revenue-demo-backup-${riyadhDateOf(new Date())}.json`);
    setMsg({ ok: true, text: L('تم تنزيل النسخة الاحتياطية.', 'The backup was downloaded.') });
  };
  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try { const obj = JSON.parse(await f.text()); const v = validateBackup(obj); if (!v.ok) { setPending(null); setMsg({ ok: false, text: L('الملف ليس نسخة احتياطية صالحة لهذا النظام؛ لم يتغير شيء.', 'This file is not a valid backup for this system; nothing was changed.') }); return; } setPending({ obj, summary: v.summary }); setMsg(null); } catch { setPending(null); setMsg({ ok: false, text: L('تعذّرت قراءة الملف؛ لم يتغير شيء.', 'The file could not be read; nothing was changed.') }); }
  };
  const confirm = () => { applyBackup(pending.obj, window.localStorage); window.location.reload(); };
  return (
    <details className="card st-card" id="local-data">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{L('أين تُحفظ بياناتي؟ النسخ الاحتياطي والاستعادة', 'Where is my data kept? Backup and restore')}</summary>
      <div className="rv-callout" role="note">{L('الخطط والأهداف وسجل الإجراءات والمحادثات تُحفظ في هذا المتصفح فقط (على هذا الجهاز). لا تُرسل إلى خادم ولا تظهر لمستخدم آخر، وقد تضيع إذا مُسحت بيانات المتصفح. نزّل نسخة احتياطية قبل ذلك.', 'Plans, objectives, the action register and conversations are kept in this browser only (on this device). They are not sent to a server, other users cannot see them, and clearing the browser data removes them. Download a backup first.')}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-sm btn-primary" onClick={exportNow}>{L('تنزيل نسخة احتياطية', 'Download a backup')}</button>
        <label className="btn btn-sm" htmlFor="local-import">{L('استعادة من ملف…', 'Restore from a file…')}</label>
        <input id="local-import" type="file" accept="application/json,.json" onChange={pick} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
      </div>
      {pending && <div className="rv-callout rv-callout--warn" role="alert">{L(`ستحل هذه النسخة (${riyadhDateOf(pending.summary.createdAt)}) محل البيانات الحالية في هذا المتصفح: ${pending.summary.plans} خطة، ${pending.summary.objectives} هدف، ${pending.summary.actions} إجراء، ${pending.summary.proposals} مقترح، ${pending.summary.conversations} محادثة.`, `This backup (${riyadhDateOf(pending.summary.createdAt)}) will REPLACE the data currently in this browser: ${pending.summary.plans} plan(s), ${pending.summary.objectives} objective(s), ${pending.summary.actions} action(s), ${pending.summary.proposals} proposal(s), ${pending.summary.conversations} conversation(s).`)} <button type="button" className="btn btn-sm btn-primary" onClick={confirm}>{L('استبدال البيانات الحالية', 'Replace the current data')}</button> <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPending(null)}>{L('إلغاء', 'Cancel')}</button></div>}
      {msg && <div className={`rv-callout${msg.ok ? '' : ' rv-callout--bad'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</div>}
    </details>
  );
}
