// The expanded analysis of one item — in ONE place, nothing repeated: the question and the finding · the metrics with their comparison basis · four separate blocks
// (verified facts · calculated deviations · unknown causes · proposed review steps) · decision options · one chart · evidence with links · missing information ·
// the disclosed overlap · the follow-up controls and history. Evidence links open the ordinary pages and keep the way back (RecordLink).
import React, { useState } from 'react';
import { useAr } from '../../utils/useAr';
import { shownActor } from '../../utils/actor';
import { RecordLink } from '../../utils/returnContext';
import ReportChart from '../smart/ReportChart';
import { fmtDateText } from '../../data/clock';
import { ACTIONS, FLAGS } from '../../data/decisionStore';
import { fmtSar } from '../../utils/money';
import {
  EVIDENCE_STATUS, FLAG_BUTTONS, FOLLOW_ERRORS, FOLLOW_STATEMENT, PERIOD_BASIS, PROPOSED_NOTE, SECTION_LABELS, followControls, formatValue, historyText
} from './decisionUi';
import { ConditionChip, FlagChip } from './DecisionBadges';

// the audit time in Riyadh time (the app's clock): date in words + HH:MM
const stamp = (at, lang) => {
  const d = new Date(at); if (Number.isNaN(d.getTime())) return String(at || '');
  const day = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Riyadh' }); const hm = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' });
  return `${fmtDateText(day, lang)} ${hm}`;
};

function Block({ kind, title, note, children, empty }) {
  return (
    <section className={`dr-blk dr-blk--${kind}`} aria-label={title}>
      <h4>{title}{note ? <span className="dr-blk__note">{note}</span> : null}</h4>
      {children && React.Children.count(children) ? children : <p className="muted dr-empty">{empty}</p>}
    </section>
  );
}

export function FollowPanel({ it, D }) {
  const { L, B, lang } = useAr();
  const [note, setNote] = useState(''); const [msg, setMsg] = useState(null);
  const fl = it.followUp?.flag || 'none'; const C = followControls(fl, D.canReview);
  const run = (fn, ok) => { const r = fn(it, { note }); if (r.ok) { setNote(''); setMsg({ ok: true, text: ok }); } else setMsg({ ok: false, text: B(FOLLOW_ERRORS[r.error] || { ar: 'تعذّر التنفيذ.', en: 'Could not complete.' }) }); };
  const addNote = () => { const r = D.note(it, note); if (r.ok) { setNote(''); setMsg({ ok: true, text: L('أُضيفت الملاحظة.', 'Note added.') }); } else setMsg({ ok: false, text: B(FOLLOW_ERRORS[r.error] || { ar: 'تعذّر التنفيذ.', en: 'Could not complete.' }) }); };
  const hist = [...(it.followUp?.history || [])].reverse();
  const nid = `dr-note-${it.key.replace(/[^a-z0-9]/gi, '_')}`;
  return (
    <section className="dr-follow" aria-label={L('المتابعة', 'Follow-up')}>
      <h4>{L('المتابعة', 'Follow-up')}</h4>
      <div className="dr-follow__state">
        <span>{L('علامة المتابعة', 'Follow-up flag')}: <FlagChip flag={fl} />{fl === 'none' ? <b>{B(FLAGS.none)}</b> : null}</span>
        <span>{L('حالة المشكلة المالية (من البيانات)', 'Financial condition (from the data)')}: <ConditionChip condition={it.condition} />{it.condition?.since ? <small className="muted"> {L('منذ', 'since')} {fmtDateText(String(it.condition.since).slice(0, 10), lang)}</small> : null}</span>
      </div>
      <p className="dr-follow__stmt" role="note">{B(FOLLOW_STATEMENT)}</p>
      <div className="dr-follow__ctl">
        <label className="dr-follow__note" htmlFor={nid}>{L('ملاحظة (اختيارية)', 'Note (optional)')}
          <input id={nid} className="input" value={note} disabled={!C.note.enabled} onChange={(e) => setNote(e.target.value)} maxLength={400} />
        </label>
        <div className="dr-follow__btns" role="group" aria-label={L('إجراءات المتابعة', 'Follow-up actions')}>
          {C.flag.visible && <button type="button" className="btn btn-sm btn-primary" disabled={!C.flag.enabled} title={C.flag.reason ? B(C.flag.reason) : undefined} onClick={() => run(D.flag, L('وُضعت علامة المتابعة.', 'Flagged for follow-up.'))}>{B(FLAG_BUTTONS.flag)}</button>}
          {C.complete.visible && <button type="button" className="btn btn-sm btn-primary" disabled={!C.complete.enabled} title={C.complete.reason ? B(C.complete.reason) : undefined} onClick={() => run(D.complete, L('سُجّلت المتابعة.', 'Follow-up recorded.'))}>{B(FLAG_BUTTONS.complete)}</button>}
          {C.unflag.visible && <button type="button" className="btn btn-sm btn-ghost" disabled={!C.unflag.enabled} title={C.unflag.reason ? B(C.unflag.reason) : undefined} onClick={() => run(D.unflag, L('أُزيلت علامة المتابعة.', 'Flag removed.'))}>{B(FLAG_BUTTONS.unflag)}</button>}
          <button type="button" className="btn btn-sm btn-ghost" disabled={!C.note.enabled || !note.trim()} onClick={addNote}>{L('إضافة ملاحظة فقط', 'Add the note only')}</button>
        </div>
      </div>
      {!D.canReview && <div className="rv-callout dr-follow__perm" role="note">{B(C.note.reason)}</div>}
      <div className="dr-follow__msg" role="status" aria-live="polite">{msg ? <span className={msg.ok ? 'dr-ok' : 'dr-bad'}>{msg.text}</span> : null}</div>
      <div className="muted dr-follow__local">{L('تُحفظ العلامات والملاحظات على هذا الجهاز في العرض التجريبي.', 'Flags and notes are kept on this device in the demo.')}</div>
      <div className="dr-hist-wrap">
        <b>{L('سجل المتابعة', 'Follow-up history')}</b>
        {hist.length === 0 ? <p className="muted dr-empty">{L('لا سجل بعد: لم توضع علامة على هذا البند.', 'No history yet: this item was never flagged.')}</p> : (
          <ol className="dr-hist">{hist.map((h, i) => (
            <li key={i}>
              <span className="dr-hist__when">{stamp(h.at, lang)}</span>
              <b>{B(ACTIONS[h.action] || { ar: h.action, en: h.action })}</b>
              <span className="muted">{L('سُجّل بواسطة', 'recorded by')} {h.by === 'migration' ? L('الترحيل الآلي', 'automatic migration') : shownActor(h.by)}</span>
              {historyText(h, lang) ? <span className="dr-hist__note">{historyText(h, lang)}</span> : null}
            </li>
          ))}</ol>
        )}
      </div>
    </section>
  );
}

export default function DecisionDetail({ it, D, id, titleOf }) {
  const { L, B, lang } = useAr();
  const trend = it.trend ? D.trend(it) : null;
  const P = it.period || {}; const range = P.from ? `${fmtDateText(P.from, lang)} – ${fmtDateText(P.to, lang)}` : P.to ? fmtDateText(P.to, lang) : '';
  const cmp = it.comparison?.values || [];
  return (
    <div className="dr-an" id={id} role="region" aria-label={L('تحليل البند', 'Item analysis')}>
      <div className="dr-find">
        <p className="dr-find__q"><b>{L('السؤال', 'The question')}:</b> {B(it.question)}</p>
        <p className="dr-find__what">{B(it.what)}</p>
      </div>

      <section className="dr-metrics" aria-label={L('المقاييس وأساس المقارنة', 'Metrics and comparison basis')}>
        <h4>{L('المقاييس وأساس المقارنة', 'Metrics and comparison basis')}</h4>
        <p className="muted dr-basisline">
          {L('أساس القياس', 'Measured on')}: {B(PERIOD_BASIS[it.periodBasis] || { ar: '', en: '' })}{range ? ` · ${range}` : ''} · {L('تاريخ القطع', 'cutoff')} {fmtDateText(it.cutoff, lang)}
          {it.measure?.basis ? <><br />{L('أساس المبلغ', 'Amount basis')}: {B(it.measure.basis)}</> : null}
          {it.comparison?.basis && B(it.comparison.basis) ? <><br />{L('أساس المقارنة', 'Comparison basis')}: {B(it.comparison.basis)}</> : null}
        </p>
        {cmp.length > 0 && <dl className="dr-figs">{cmp.map((v, i) => <div key={i}><dt>{B(v.label)}</dt><dd title={v.unit === 'SAR' ? fmtSar(v.value, lang) : undefined}>{formatValue(v.value, v.unit, lang)}</dd></div>)}</dl>}
      </section>

      <div className="dr-blocks">
        <Block kind="facts" title={B(SECTION_LABELS.facts)} empty={L('لا حقائق موثقة مسجلة.', 'No verified facts recorded.')}>
          {it.facts.length ? <ul>{it.facts.map((f, i) => <li key={i}>{B(f)} {f.evidence ? <span className={`dr-ev-tag dr-ev-tag--${f.evidence}`}>{B(EVIDENCE_STATUS[f.evidence] || { ar: f.evidence, en: f.evidence })}</span> : null}</li>)}</ul> : null}
        </Block>
        <Block kind="calc" title={B(SECTION_LABELS.calculated)} empty={L('لا فروقات محسوبة.', 'No calculated deviations.')}>
          {it.calculated.length ? <ul>{it.calculated.map((c, i) => <li key={i}><span>{B(c.label)}</span> <b title={c.unit === 'SAR' ? fmtSar(c.value, lang) : undefined}>{formatValue(c.value, c.unit, lang)}</b>{c.formula ? <small className="muted dr-formula"> — {B(c.formula)}</small> : null}</li>)}</ul> : null}
        </Block>
        <Block kind="unknown" title={B(SECTION_LABELS.unknown)} empty={L('لا شيء مسجل.', 'Nothing recorded.')}>
          {it.unknown.length ? <ul>{it.unknown.map((u, i) => <li key={i}>{B(u)}</li>)}</ul> : null}
        </Block>
        <Block kind="proposed" title={B(SECTION_LABELS.proposed)} note={B(PROPOSED_NOTE)} empty={L('لا مقترحات.', 'No proposals.')}>
          {it.proposed.length ? <ul>{it.proposed.map((p, i) => <li key={i}>{B(p)}</li>)}</ul> : null}
        </Block>
      </div>

      {it.options.length > 0 && (
        <section className="dr-opts" aria-label={L('خيارات القرار', 'Decision options')}>
          <h4>{L('خيارات القرار وآثارها', 'Decision options and their implications')}<span className="dr-blk__note">{B(PROPOSED_NOTE)}</span></h4>
          <ol>{it.options.map((o, i) => <li key={i}><b>{B(o.title)}</b><div>{B(o.implication)}</div></li>)}</ol>
        </section>
      )}

      {trend && (
        <section className="dr-trend" aria-label={L('الاتجاه', 'Trend')}>
          <ReportChart block={trend} lang={lang} />
        </section>
      )}

      <section className="dr-evid" aria-label={L('الأدلة', 'Evidence')}>
        <h4>{L('الأدلة والسجلات الداعمة', 'Evidence and supporting records')}</h4>
        {it.evidence.length === 0 ? <p className="muted dr-empty">{L('لا روابط أدلة لهذا البند.', 'No evidence links for this item.')}</p> : (
          <ul>{it.evidence.map((e, i) => (
            <li key={i}>
              {e.to ? <RecordLink to={e.to} label={L('غرفة القرارات', 'Decision room')}>{B(e.label)}</RecordLink> : <span>{B(e.label)}</span>}
              {e.count != null ? <small className="muted" dir="ltr"> ({Math.round(e.count).toLocaleString('en-US')})</small> : null}
              <span className={`dr-ev-tag dr-ev-tag--${e.status}`}>{B(EVIDENCE_STATUS[e.status] || { ar: e.status, en: e.status })}</span>
            </li>
          ))}</ul>
        )}
      </section>

      {it.missing.length > 0 && (
        <section className="dr-missing" aria-label={L('معلومات ناقصة', 'Missing information')}>
          <h4>{L('معلومات ناقصة', 'Missing information')}</h4>
          <ul>{it.missing.map((m, i) => <li key={i}>{B(m)}</li>)}</ul>
        </section>
      )}

      {it.overlap.length > 0 && (
        <section className="dr-overlap rv-callout" aria-label={L('تداخل مع بنود أخرى', 'Overlap with other items')}>
          <b>{L('تداخل مع بنود أخرى — لا تُجمع المبالغ', 'Overlaps with other items — the amounts are not added')}</b>
          <ul>{it.overlap.map((o, i) => <li key={i}>{titleOf && titleOf(o.with) ? <b>{B(titleOf(o.with))}: </b> : null}{B(o.note)}</li>)}</ul>
        </section>
      )}

      <FollowPanel it={it} D={D} />
    </div>
  );
}
