// Embedded assistant: ChatGPT-style composer, answers computed from the active filters with supporting figures and a drill-down.
// Rule-based simulation — labelled as such on every answer; no language model is connected.
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAr } from '../../utils/useAr';
import { answer, SUGGESTED_PROMPTS } from '../../data/strategicAssistant';

export default function AssistantPanel({ open, onClose, ctxFactory, onAction, prompts = SUGGESTED_PROMPTS, title = null }) {
  const { L, ar } = useAr();
  const [msgs, setMsgs] = useState([]); const [input, setInput] = useState(''); const [busy, setBusy] = useState(false);
  const last = useRef(null); const endRef = useRef(null); const ta = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);
  useEffect(() => { if (open) ta.current?.focus(); }, [open]);
  useEffect(() => { const el = ta.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; } }, [input]);
  if (!open) return null;

  const send = async (text) => {
    const q = (text || '').trim(); if (!q || busy) return;
    setInput(''); setMsgs((m) => [...m, { role: 'user', text: q }]); setBusy(true);
    try {
      const a = await answer(q, { ...ctxFactory(), last: last.current });
      if (a.intent !== 'unknown') last.current = { intent: a.intent, scope: a.scope };
      setMsgs((m) => [...m, { role: 'ai', a }]);
    } catch (e) { setMsgs((m) => [...m, { role: 'ai', error: String(e.message || e) }]); } finally { setBusy(false); }
  };
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } };

  return (
    <aside className="st-assist" role="dialog" aria-label={L('مساعد لوحة القيادة', 'Dashboard assistant')}>
      <div className="st-assist__head">
        <div><b>{title || L('اسأل لوحة القيادة', 'Ask the dashboard')}</b><div className="muted" style={{ fontSize: 12 }}>{L('يعمل بقواعد محددة', 'Works with defined rules')}</div></div>
        <div style={{ display: 'flex', gap: 4 }}><button type="button" className="btn btn-sm btn-ghost" onClick={() => { setMsgs([]); last.current = null; }} disabled={!msgs.length}>{L('جديد', 'New')}</button><button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label={L('إغلاق', 'Close')}>×</button></div>
      </div>
      <div className="st-assist__body" aria-live="polite">
        {!msgs.length && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="muted" style={{ fontSize: 13 }}>{L('أجيب بالمرشحات النشطة الآن، وأعرض الأرقام الداعمة. ويمكن متابعة السؤال («وماذا عن الرياض؟»).', 'I answer with the filters that are active now and show the supporting figures. You can follow up (“and Riyadh?”).')}</div>
            {prompts.map((p) => <button key={p.ar} type="button" className="sr-suggest__btn" onClick={() => send(p[ar ? 'ar' : 'en'])}>{p[ar ? 'ar' : 'en']}</button>)}
          </div>
        )}
        {msgs.map((m, i) => m.role === 'user' ? <div key={i} className="st-msg-user">{m.text}</div> : (
          <div key={i} className="st-msg-ai">
            {m.error && <div className="rv-callout rv-callout--bad" role="alert">{L('تعذّر الحساب: ', 'Could not compute: ')}{m.error}</div>}
            {m.a && <>
              <b>{m.a.title}</b>
              {m.a.applied?.length > 0 && <div className="sr-changes">{m.a.applied.map((c, k) => <span key={k} className="sr-chip sr-chip--changed">{c}</span>)}<small className="muted">{L('طُبّق على مرشحات اللوحة.', 'Applied to the dashboard filters.')}</small></div>}
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.a.text}</div>
              {m.a.facts?.length > 0 && <div className="rv-insight__ev">{m.a.facts.map((f, k) => <span key={k}>{f.k}: <b dir="ltr">{f.v}</b></span>)}</div>}
              {m.a.table && <div className="st-table-wrap"><table className="table"><thead><tr>{m.a.table.headers.map((h, k) => <th key={k}>{h}</th>)}</tr></thead><tbody>{m.a.table.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} dir={j === 0 ? 'auto' : 'ltr'}>{c}</td>)}</tr>)}</tbody></table></div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {m.a.drill && (m.a.drill.to.startsWith('#') ? <a className="btn btn-sm btn-ghost" href={m.a.drill.to} onClick={onClose}>{m.a.drill.label}</a> : <Link className="btn btn-sm btn-ghost" to={m.a.drill.to}>{m.a.drill.label} {ar ? '←' : '→'}</Link>)}
                {m.a.actions?.map((ac, k) => <button key={k} type="button" className="btn btn-sm" onClick={() => onAction(ac)}>{ac.label}</button>)}
              </div>

            </>}
          </div>
        ))}
        {busy && <div className="sr-progress" role="status"><span className="sr-spin" aria-hidden="true" /> {L('أحسب من بيانات المرشحات الحالية…', 'Computing from the current filters…')}</div>}
        <div ref={endRef} />
      </div>
      <div className="st-assist__foot">
        {msgs.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[L('وماذا عن الرياض؟', 'And Riyadh?'), L('اعرض ملخصاً تنفيذياً', 'Show an executive summary')].map((t) => <button key={t} type="button" className="sr-suggest__btn sr-suggest__btn--sm" disabled={busy} onClick={() => send(t === L('اعرض ملخصاً تنفيذياً', 'Show an executive summary') ? L('جهّز ملخصًا تنفيذيًا للاجتماع', 'Prepare an executive summary for the meeting') : L('وماذا عن أمانة الرياض فقط؟', 'And what about Riyadh Amanah only?'))}>{t}</button>)}</div>}
        <div className="sr-composer">
          <textarea ref={ta} rows={1} className="sr-composer__input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} aria-label={L('اكتب سؤالك', 'Type your question')} placeholder={L('اسأل عن الفجوات أو المقارنة أو السيناريوهات…', 'Ask about gaps, comparison or scenarios…')} />
          <button type="button" className="sr-composer__btn" onClick={() => send(input)} disabled={!input.trim() || busy} aria-label={L('إرسال', 'Send')}>{ar ? '↰' : '➤'}</button>
        </div>
      </div>
    </aside>
  );
}
