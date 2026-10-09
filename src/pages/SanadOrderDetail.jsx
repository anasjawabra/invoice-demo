import { useAsync } from '../utils/useAsync';
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { MetricTile, ProvenanceBadge } from '../components/revenue/RevenueUI';
import { caseSummary } from '../data/enforcementMatching';
import { extractReferences } from '../data/enforcementMatching';

const EVIDENCE = {
  ref_invoice_id: { en: 'Invoice id found in document', ar: 'معرّف الفاتورة موجود في المستند' },
  ref_violation_number: { en: 'Violation number found', ar: 'رقم المخالفة موجود' },
  ref_contract: { en: 'Contract reference found', ar: 'مرجع العقد موجود' },
  ref_debtor_id: { en: 'Debtor id found', ar: 'هوية المدين موجودة' },
  ref_fragment: { en: 'Numeric fragment matches (weak)', ar: 'تطابق جزء رقمي (ضعيف)' },
  reference_match: { en: 'Reference match', ar: 'تطابق مرجعي' },
  amount_exact: { en: 'Amount identical', ar: 'المبلغ مطابق' },
  amount_near: { en: 'Amount within tolerance', ar: 'المبلغ ضمن التسامح' },
  same_amanah: { en: 'Same Amanah', ar: 'نفس الأمانة' }
};
const CONFLICT = {
  different_amanah: { en: 'Different Amanah', ar: 'أمانة مختلفة' },
  invoice_already_collected: { en: 'Invoice already collected — would double count', ar: 'الفاتورة محصّلة بالفعل — قد تُحتسب مرتين' },
  invoice_excluded: { en: 'Invoice is excluded', ar: 'الفاتورة مستبعدة' },
  invoice_issued_after_case: { en: 'Invoice issued after the case opened', ar: 'الفاتورة صدرت بعد فتح القضية' },
  already_linked_to_other_case: { en: 'Already linked to another case', ar: 'مربوطة بقضية أخرى' }
};
const VERDICT = {
  strong: { en: 'One strong candidate', ar: 'مرشح قوي واحد' },
  ambiguous: { en: 'Ambiguous — several plausible candidates', ar: 'ملتبس — عدة مرشحين محتملين' },
  weak: { en: 'Weak evidence', ar: 'دليل ضعيف' },
  conflicting: { en: 'Candidates conflict with the data', ar: 'المرشحون يتعارضون مع البيانات' },
  none: { en: 'No candidate reached the evidence threshold', ar: 'لم يبلغ أي مرشح عتبة الدليل' }
};

export default function SanadOrderDetail() {
  const { enforceNum } = useParams();
  const nav = useNavigate();
  const rev = useRevenue();
  const { L, B, short, ar, sar } = useL();
  const c = rev.cases.find((x) => x.enforceNum === enforceNum);
  const linkIds = (c?.links || []).slice(0, 20).map((l) => l.invoiceId);
  // amounts of the invoices already linked to this case (at most 20 are looked up, one record each)
  const { data: linked } = useAsync(() => Promise.all(linkIds.map((id) => rev.data.invoice(id).then((d) => [id, d.rec.grossAmount]).catch(() => [id, null]))).then((e) => new Map(e)), [rev.data, linkIds.join('|')]);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [match, setMatch] = useState(null);
  const [notes, setNotes] = useState({});
  const [msg, setMsg] = useState(null);

  const sum = useMemo(() => (c ? caseSummary(c) : null), [c]);

  if (!c) {
    return (
      <div className="rv-page">
        <div className="page-head"><h1 className="page-title">{L('Enforcement case not found', 'قضية الإنفاذ غير موجودة')}</h1></div>
        <Link className="btn btn-sm" to="/sanad-orders">{L('Back to the enforcement workspace', 'العودة إلى مساحة عمل الإنفاذ')}</Link>
      </div>
    );
  }

  const docText = `${fileName ? `${fileName}\n` : ''}${text}`;
  const refs = extractReferences(docText);

  const run = () => {
    const { promise, duplicate } = rev.startAnalysis('enforcement', { enforceNum, text: docText }, { origin: 'enforcement', followsGlobal: false, scope: { from: '2000-01-01', to: rev.cfg.cutoff, amanah: 'all', source: 'all' } });
    if (duplicate) return;
    promise.then((final) => {
      if (['completed', 'completed_with_limitations'].includes(final.status) && final.out?.match) setMatch({ ...final.out.match, text: docText, key: final.dataVersion });
    });
  };

  const propose = () => {
    if (!match?.candidates?.length) return;
    rev.proposeEnforcementLinks(enforceNum, match.text);
    setMsg({ ok: true, text: L('Candidates added to the review queue below. They do not count until a reviewer confirms them.', 'أُضيف المرشحون إلى قائمة المراجعة أدناه. ولا يُحتسبون قبل أن يؤكدهم مراجع.') });
  };

  const review = (invoiceId, decision) => {
    const res = rev.reviewEnforcementLink({ enforceNum, invoiceId, decision, note: notes[invoiceId] || '' });
    if (res.ok) setMsg({ ok: true, text: L('Decision recorded in this solution (history kept). No source system was changed.', 'سُجّل القرار في هذه المنصة (مع حفظ السجل). لم يتغير أي نظام مصدر.') });
    else setMsg({ ok: false, text: { no_permission: L('Read-only role: you cannot review links.', 'دور للقراءة فقط: لا يمكنك مراجعة الروابط.'), note_required_for_conflict: L('This candidate conflicts with the data — a written justification is required to confirm it.', 'هذا المرشح يتعارض مع البيانات — يلزم مبرر مكتوب لتأكيده.'), note_required_for_ambiguous: L('Several candidates are open for this case — a written reason is required to confirm one of them.', 'يوجد عدة مرشحين لهذه القضية — يلزم سبب مكتوب لتأكيد أحدهم.') }[res.error] || L('Could not record the decision.', 'تعذّر تسجيل القرار.') });
  };

  const open = c.links.filter((l) => l.status === 'candidate');

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title" dir="ltr">{c.enforceNum}</h1>
          <div className="page-sub">{c.system === 'sanad' ? 'Sanad' : c.system === 'white_lands' ? L('White-lands file', 'ملف الأراضي البيضاء') : 'Efaa'} · {c.amanahEn} · {L('case amount', 'مبلغ القضية')} {sar(c.amount)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ProvenanceBadge kind="demo" />
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/sanad-orders')}>{L('All cases', 'كل القضايا')}</button>
        </div>
      </div>

      <div className="rv-tiles">
        <MetricTile label={L('Case state', 'حالة القضية')} value={{ linked: L('Linked', 'مربوطة'), candidate: L('Candidate', 'مرشح'), ambiguous: L('Ambiguous', 'ملتبس'), unresolved: L('Unresolved', 'غير محسومة') }[sum.state]} />
        <MetricTile label={L('Confirmed links', 'روابط مؤكدة')} value={sum.confirmed} />
        <MetricTile label={L('Allocated to invoices', 'الموزع على الفواتير')} value={short(sum.allocated)} sub={L('Only for an exact one-to-one pair', 'فقط لزوج مطابق تماماً')} />
        <MetricTile label={L('Unallocated', 'غير موزع')} value={short(sum.unallocated)} sub={L('Reported separately; invoices are counted once at their own balance', 'يُعرض منفصلاً؛ وتُحتسب كل فاتورة مرة واحدة برصيدها')} />
      </div>

      <div className="card card-pad">
        <h3 className="rv-sec-title">{L('1 · Find candidate invoices', '1 · إيجاد الفواتير المرشحة')}</h3>
        <p className="rv-sec-sub">{L('Structured data (amount, Amanah, status) is always used. Add document text to extract invoice ids, contract references and SADAD/violation numbers. This demo has no OCR engine: paste text, or attach a file whose NAME contains references (simulated).', 'تُستخدم البيانات المهيكلة (المبلغ والأمانة والحالة) دائماً. أضف نص مستند لاستخراج معرّفات الفواتير ومراجع العقود وأرقام سداد/المخالفات. لا يوجد محرك OCR في هذا العرض: الصق نصاً أو أرفق ملفاً يحتوي اسمه مراجع (محاكاة).')}</p>
        <div className="rv-form">
          <label>{L('Attach file (name is read only)', 'إرفاق ملف (يُقرأ اسمه فقط)')}
            <input className="input" type="file" onChange={(e) => { setFileName(e.target.files?.[0]?.name || ''); e.target.value = ''; }} aria-label={L('Attach document', 'إرفاق مستند')} />
          </label>
          <label style={{ flex: 1, minWidth: 260 }}>{L('Document text (simulated OCR)', 'نص المستند (OCR محاكى)')}
            <textarea className="input" style={{ height: 70, paddingBlock: 8 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. referral for INV-2026-0000650 / CT-2026-0087" dir="ltr" />
          </label>
          <button type="button" className="btn btn-primary btn-sm" onClick={run}>{L('Find matches', 'إيجاد المطابقات')}</button>
        </div>
        {(refs.invoiceIds.length + refs.coRefs.length + refs.longNumbers.length + refs.shortNumbers.length) > 0 && (
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }} dir="ltr">
            {L('References extracted', 'المراجع المستخرجة')}: {[...refs.invoiceIds, ...refs.coRefs, ...refs.longNumbers, ...refs.shortNumbers].join(', ')}
          </div>
        )}

        {match && (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <div className={`rv-callout ${match.verdict === 'strong' ? '' : 'rv-callout--warn'}`}><b>{B(VERDICT[match.verdict])}</b> — {L('every candidate still needs human review before it counts.', 'كل مرشح ما زال يحتاج مراجعة بشرية قبل أن يُحتسب.')}{match.oneToMany ? ` ${L('The document references several invoices (one-to-many).', 'يشير المستند إلى عدة فواتير (واحد إلى متعدد).')}` : ''}</div>
            {match.candidates.length > 0 && (
              <div className="rv-table-wrap"><table className="rv-table" style={{ minWidth: 700 }}>
                <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th className="num">{L('Score', 'الدرجة')}</th><th className="num">{L('Outstanding', 'المتبقي')}</th><th className="num">{L('Amount diff', 'فرق المبلغ')}</th><th>{L('Evidence', 'الأدلة')}</th><th>{L('Conflicts', 'التعارضات')}</th></tr></thead>
                <tbody>{match.candidates.map((m) => (
                  <tr key={m.invoiceId}>
                    <td><Link to={`/invoices?id=${m.invoiceId}`} dir="ltr">{m.invoiceId}</Link></td>
                    <td className="num">{m.score}</td>
                    <td className="num" dir="ltr">{sar(m.invoiceOutstanding)}</td>
                    <td className="num">{m.amountDiffPct}%</td>
                    <td>{m.evidence.map((e) => <span key={e} className="rv-tag">{B(EVIDENCE[e] || { en: e, ar: e })}</span>)}</td>
                    <td>{m.conflicts.length ? m.conflicts.map((e) => <span key={e} className="rv-tag rv-tag--bad">{B(CONFLICT[e] || { en: e, ar: e })}</span>) : '—'}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
            <div><button type="button" className="btn btn-sm btn-primary" disabled={!match.candidates.length || !rev.canReview} onClick={propose}>{L('Add candidates to the review queue', 'إضافة المرشحين إلى قائمة المراجعة')}</button> {!rev.canReview && <span className="muted">{L('Read-only role', 'دور للقراءة فقط')}</span>}</div>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <h3 className="rv-sec-title">{L('2 · Review queue and confirmed links', '2 · قائمة المراجعة والروابط المؤكدة')}</h3>
        {msg && <div className={`rv-callout ${msg.ok ? '' : 'rv-callout--bad'}`} role="status" style={{ marginBottom: 8 }}>{msg.text}</div>}
        {open.length > 1 && <div className="rv-callout rv-callout--warn" style={{ marginBottom: 8 }}>{L('Several candidates are open — this case is ambiguous. Confirming one needs a written reason; leave it unresolved if the evidence is insufficient.', 'عدة مرشحين مفتوحين — هذه القضية ملتبسة. تأكيد أحدهم يحتاج سبباً مكتوباً؛ اتركها غير محسومة إن كان الدليل غير كافٍ.')}</div>}
        {c.links.length ? (
          <div className="rv-table-wrap"><table className="rv-table" style={{ minWidth: 760 }}>
            <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Status', 'الحالة')}</th><th className="num">{L('Allocated', 'الموزع')}</th><th>{L('Evidence / conflicts', 'الأدلة / التعارضات')}</th><th>{L('Reviewer', 'المراجع')}</th><th>{L('Action', 'إجراء')}</th></tr></thead>
            <tbody>{c.links.map((l) => {
              const grossOf = linked?.get(l.invoiceId);
              return (
                <tr key={l.invoiceId}>
                  <td><Link to={`/invoices?id=${l.invoiceId}`} dir="ltr">{l.invoiceId}</Link><div className="muted" style={{ fontSize: 12 }}>{grossOf != null ? sar(grossOf) : ''}</div></td>
                  <td><span className={`rv-cat ${l.status === 'confirmed' ? 'rv-cat--enforcement' : l.status === 'rejected' ? 'rv-cat--excluded' : 'rv-cat--partial'}`}>{{ confirmed: L('Confirmed', 'مؤكد'), candidate: L('Candidate', 'مرشح'), rejected: L('Rejected', 'مرفوض') }[l.status]}</span></td>
                  <td className="num" dir="ltr">{l.allocated ? sar(l.allocated) : L('unallocated', 'غير موزع')}</td>
                  <td>{(l.evidence || []).map((e) => <span key={e} className="rv-tag">{B(EVIDENCE[e] || { en: e, ar: e })}</span>)}{(l.conflicts || []).map((e) => <span key={e} className="rv-tag rv-tag--bad">{B(CONFLICT[e] || { en: e, ar: e })}</span>)}</td>
                  <td style={{ fontSize: 12 }}>{l.reviewedBy ? `${l.reviewedBy} · ${l.reviewedAt || ''}` : '—'}{l.reviewNote ? <div className="muted" dir="auto">{l.reviewNote}</div> : null}</td>
                  <td style={{ minWidth: 200 }}>
                    {l.status === 'candidate' ? (
                      <>
                        <input className="input" style={{ width: '100%', padding: '5px 8px', marginBottom: 5 }} placeholder={L('Reason (required for conflicts / ambiguity)', 'السبب (مطلوب عند التعارض/الالتباس)')} aria-label={L('Review reason', 'سبب المراجعة')} value={notes[l.invoiceId] || ''} onChange={(e) => setNotes({ ...notes, [l.invoiceId]: e.target.value })} disabled={!rev.canReview} />
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button type="button" className="btn btn-sm btn-primary" disabled={!rev.canReview} onClick={() => review(l.invoiceId, 'confirmed')}>{L('Confirm', 'تأكيد')}</button>
                          <button type="button" className="btn btn-sm" disabled={!rev.canReview} onClick={() => review(l.invoiceId, 'rejected')}>{L('Reject', 'رفض')}</button>
                        </div>
                      </>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="rv-empty">{L('No links yet. This case stays unresolved until candidates are found and reviewed.', 'لا توجد روابط بعد. تبقى القضية غير محسومة حتى يُعثر على مرشحين وتتم مراجعتهم.')}</div>}

        {(c.history || []).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h4 className="rv-sec-title" style={{ fontSize: 13 }}>{L('Review history', 'سجل المراجعة')}</h4>
            <ul className="res__list res__list--plain">{c.history.map((h, i) => <li key={i} dir="auto"><span dir="ltr">{h.at}</span> · {h.action}{h.invoiceId ? ` · ${h.invoiceId}` : ''} · {h.by}{h.note ? ` — ${h.note}` : ''}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}
