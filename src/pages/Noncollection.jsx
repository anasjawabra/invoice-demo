import React, { useEffect, useMemo, useState } from 'react';
import { useAsync } from '../utils/useAsync';
import Pager from '../components/Pager';
import { RecordLink as Link, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { invoicePath, contractPath, orderPath } from '../utils/paths';
import { useRevenue } from '../context/RevenueContext';
import { useL, ratioText } from '../utils/bi';
import { ScopeBar, MetricTile, ProvenanceBadge } from '../components/revenue/RevenueUI';
import { CATEGORY_LABELS, NONCOLLECTION_CATEGORIES, EXCLUSION_RULE_SET_VERSION, ruleById } from '../data/revenueMetrics';
import { registryRows, RULE_APPROVAL_LABEL } from '../data/ruleRegistry';
import { orderCompleteness } from '../data/orderMatching';
import { CompletenessMarks } from '../components/revenue/EnforcementUI';
import { REVENUE_SOURCES } from '../data/revenueLedger';

const TAG_LABEL = {
  partial: { en: 'partial payment', ar: 'دفعة جزئية' },
  overdue: { en: 'past due', ar: 'متأخرة' },
  source_cancelled: { en: 'source status: cancelled', ar: 'حالة المصدر: ملغاة' },
  amount_conflict: { en: 'amount conflict', ar: 'تعارض مبلغ' },
  contract_unlinked: { en: 'contract not linked', ar: 'عقد غير مرتبط' },
  contract_unverified: { en: 'contract link unverified', ar: 'ربط العقد غير مُتحقق' },
  missing_fields: { en: 'missing mandatory field', ar: 'حقل إلزامي ناقص' },
  enforcement_candidate: { en: 'enforcement link pending', ar: 'رابط إنفاذ معلق' },
  overpaid: { en: 'overpaid', ar: 'مدفوع زيادة' },
  contract_unmatched: { en: 'contract not matched (not "no contract")', ar: 'لم تتم مطابقة العقد (وليس «بدون عقد»)' },
  cancelled_but_enforced: { en: 'cancelled in source but enforcement-linked: counted uncollected', ar: 'ملغاة في المصدر ومرتبطة بتنفيذ: تُحتسب غير محصلة' },
  status_differs_efaa_tahseel: { en: 'Tahseel ≠ Efaa status', ar: 'حالة تحصيل ≠ حالة إيفاء' },
  also_excluded_reason: { en: 'also has an exclusion reason (deducted once, as cancelled)', ar: 'لها سبب استبعاد أيضاً (تُخصم مرة كملغاة)' },
  multi_reason: { en: 'several exclusion reasons (one primary)', ar: 'عدة أسباب استبعاد (سبب رئيسي واحد)' }
};

const REVIEW_LABEL = {
  approved: { en: 'Approved', ar: 'معتمد' },
  pending: { en: 'Pending review', ar: 'بانتظار المراجعة' },
  rejected: { en: 'Rejected', ar: 'مرفوض' },
  rule_applied: { en: 'Rule applied', ar: 'مطبّق بقاعدة' }
};

function ReviewerText({ r }) {
  const { B } = useL();
  if (!r) return <span className="muted">—</span>;
  return <span>{typeof r === 'string' ? r : B(r)}</span>;
}

export default function Noncollection() {
  const rev = useRevenue();
  const { snapshot, cfg, canReview, decisions, cases } = rev;
  const { L, B, ar, short, lang, count, sar } = useL();
  const restore = useShouldRestore(); const mem = useMemo(() => readListMemory('noncollection', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [filter, setFilter] = useState(mem.filter ?? 'all');
  const [note, setNote] = useState({});
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(mem.page ?? 0);
  const [regPage, setRegPage] = useState(mem.regPage ?? 0);
  const PS = 25;
  const scopeReq = useMemo(() => ({ from: rev.scopeEff.from, to: rev.scopeEff.to, amanah: rev.scopeEff.amanah, source: rev.scopeEff.source, scopeType: rev.scopeEff.scopeType, muni: rev.scopeEff.muni, status: rev.scopeEff.status }), [rev.scopeEff]);
  const resetKey = JSON.stringify([filter, scopeReq, rev.dataVersion]); const lastReset = React.useRef(resetKey);
  useEffect(() => { if (lastReset.current !== resetKey) { lastReset.current = resetKey; setPage(0); setRegPage(0); } }, [resetKey]); // only a real change of the filters / data returns to page 1 (not a re-render, not a return from a record)
  useEffect(() => { writeListMemory('noncollection', { filter, page, regPage }); }, [filter, page, regPage]);

  // server-side pages: invoice states and the exclusion register (with its evidence records) are paged by the data service
  const { data: states } = useAsync(() => rev.data.list(scopeReq, { filters: { state: filter === 'all' ? 'noncollected' : filter }, page, pageSize: PS, sort: { key: 'outstanding', dir: 'desc' } }), [rev.data, scopeReq, filter, page]);
  const { data: reg } = useAsync(() => rev.data.list(scopeReq, { filters: { rule: 'any' }, withExclusions: true, page: regPage, pageSize: 15, sort: { key: 'gross', dir: 'desc' } }), [rev.data, scopeReq, regPage]);
  const rows = states?.rows || [];
  useRestoreScroll(rows.length > 0);
  const register = reg?.rows || [];
  const registry = useMemo(() => registryRows(snapshot, cfg), [snapshot, cfg]);
  const [regOpen, setRegOpen] = useState(mem.regOpen ?? false);
  useEffect(() => { writeListMemory('noncollection', { filter, page, regPage, regOpen }); }, [filter, page, regPage, regOpen]);
  const T = snapshot.totals;
  const openInvoices = NONCOLLECTION_CATEGORIES.filter((c) => c !== 'excluded').reduce((n, c) => n + snapshot.noncollection[c].count, 0);

  const decide = (id, decision, ruleId) => {
    const res = rev.decideExclusion(id, decision, note[`${id}|${ruleId}`] || '', ruleId);
    setMsg(res.ok ? { ok: true, text: L(`Decision recorded in this solution's analytical layer for ${id}. No source system was changed.`, `سُجّل القرار في الطبقة التحليلية لهذه المنصة للفاتورة ${id}. لم يتغير أي نظام مصدر.`) } : { ok: false, text: L('You do not have permission to review exclusions (read-only role).', 'ليست لديك صلاحية مراجعة الاستبعادات (دور للقراءة فقط).') });
  };

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Noncollection & exclusions', 'عدم التحصيل والاستبعادات')}</h1>
          <div className="page-sub">{L('Separates why money is outstanding (state of each invoice) from what is excluded from the KPI denominator. Exclusion is not uncollectibility.', 'يفصل بين سبب بقاء المبلغ متبقياً (حالة كل فاتورة) وما يُستبعد من مقام المؤشر. الاستبعاد ليس عدم قابلية للتحصيل.')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => rev.startAnalysis('noncollection', {}, { origin: 'noncollection' })}>{L('Analyze reasons for noncollection', 'تحليل أسباب عدم التحصيل')}</button>
          <button type="button" className="btn btn-sm" onClick={() => rev.startAnalysis('exclusions', {}, { origin: 'noncollection' })}>{L('Review exclusions', 'مراجعة الاستبعادات')}</button>
        </div>
      </div>

      <ScopeBar />

      <div className="rv-tiles">
        <MetricTile metric="uncollected" label={L('Uncollected (net billed − collected)', 'غير المحصّل (صافي المفوتر − المحصّل)')} value={short(T.outstanding)} sub={L(`${count(openInvoices)} invoices`, `${count(openInvoices)} فاتورة`)} />
        <MetricTile metric="cancelled" label={L('Cancelled in the source', 'الملغى في المصدر')} value={short(T.cancelled)} sub={L(`${count(T.cancelledCount)} invoices · deducted once${T.overlapCount ? ` · ${T.overlapCount} overlap an exclusion reason` : ''}`, `${count(T.cancelledCount)} فاتورة · تُخصم مرة${T.overlapCount ? ` · ${T.overlapCount} تتداخل مع سبب استبعاد` : ''}`)} />
        <MetricTile metric="netUncollected" label={L('Net uncollected (standing balance)', 'الرصيد القائم')} value={short(snapshot.stock.netUncollected)} sub={L(`Overdue ${short(snapshot.stock.overdue)} · not yet due ${short(snapshot.stock.notYetDue)}`, `متأخر ${short(snapshot.stock.overdue)} · لم يحن ${short(snapshot.stock.notYetDue)}`)} />
        <MetricTile metric="exclusions" label={L('Exclusions (cancelled + rule-based)', 'الاستبعادات (ملغى + وفق قواعد)')} value={short(T.exclusions)} sub={L(`${count(T.excludedCount + T.cancelledCount)} invoices · rules ${short(T.exclusionsRules)} + cancelled ${short(T.cancelled)}`, `${count(T.excludedCount + T.cancelledCount)} فاتورة · قواعد ${short(T.exclusionsRules)} + ملغى ${short(T.cancelled)}`)} />
        <MetricTile metric="collectedOverNet" label={L('Collected ÷ net billed', 'المحصّل ÷ صافي المفوتر')} value={ratioText(T.collectedOverNet, ar)} sub={L('Collected ÷ net billed × 100', 'المحصّل ÷ صافي المفوتر × 100')} />
      </div>

      <div className="card card-pad">
        <h2 className="rv-sec-title">{L('Invoice states', 'حالات الفواتير')}</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }} role="group" aria-label={L('Filter by state', 'تصفية حسب الحالة')}>
          <button type="button" className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('all')} aria-pressed={filter === 'all'}>{L('All', 'الكل')}</button>
          {NONCOLLECTION_CATEGORIES.map((c) => (
            <button key={c} type="button" className={`btn btn-sm ${filter === c ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(c)} aria-pressed={filter === c}>
              {B(CATEGORY_LABELS[c])} · {count(snapshot.noncollection[c].count)}
            </button>
          ))}
        </div>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table">
            <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Amanah · source', 'الأمانة · المصدر')}</th><th>{L('State', 'الحالة')}</th><th className="num">{L('Amount (SAR)', 'المبلغ (ريال)')}</th><th className="num">{L('Days overdue', 'أيام التأخر')}</th><th>{L('Signals', 'الإشارات')}</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((r) => (
                <tr key={r.id}>
                  <td><Link to={invoicePath(r.id)} dir="ltr">{r.id}</Link></td>
                  <td>{lang === 'ar' ? r.amanahAr : r.amanahEn} · {ar ? REVENUE_SOURCES[r.source].ar : REVENUE_SOURCES[r.source].en}</td>
                  <td><span className={`rv-cat rv-cat--${r.cls}`}>{B(CATEGORY_LABELS[r.cls])}</span></td>
                  <td className="num" dir="ltr">{sar(r.cls === 'excluded' ? r.exclusionAmount : r.cls === 'cancelled' ? r.cancelledAmount : r.outstanding)}</td>
                  <td className="num">{r.cls === 'excluded' ? '—' : r.daysOverdue}</td>
                  <td>{r.tags.filter((t) => TAG_LABEL[t] && t !== r.cls).map((t) => <span key={t} className={`rv-tag${['amount_conflict', 'missing_fields'].includes(t) ? ' rv-tag--bad' : ''}`}>{B(TAG_LABEL[t])}</span>)}</td>
                </tr>
              )) : <tr><td colSpan={6}><div className="rv-empty">{L('No invoices in this state for the selected scope.', 'لا توجد فواتير بهذه الحالة ضمن النطاق المحدد.')}</div></td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={states?.total ?? 0} size={PS} onPage={setPage} label={L('Invoice states', 'حالات الفواتير')} />
      </div>

      <details className="card card-pad rv-more">
        <summary><h2 className="rv-sec-title" style={{ display: 'inline' }}>{L('Exclusion register', 'سجل الاستبعادات')}</h2></summary>
        <p className="rv-sec-sub">{L('Each exclusion keeps its rule, evidence, review state, reviewer, effective period and reassessment status. Only APPROVED exclusions under ENABLED rules reduce net billed. Review decisions update this solution\'s analytical layer only.', 'يحتفظ كل استبعاد بقاعدته ودليله وحالة مراجعته والمراجع وفترة السريان وحالة إعادة التقييم. فقط الاستبعادات المعتمدة وفق قواعد مفعّلة تخفض صافي المفوتر. وتحدّث قرارات المراجعة الطبقة التحليلية لهذه المنصة فقط.')}</p>
        {msg && <div className={`rv-callout ${msg.ok ? '' : 'rv-callout--bad'}`} role="status" style={{ marginBottom: 8 }}>{msg.text}</div>}
        {!canReview && <div className="rv-callout rv-callout--warn" style={{ marginBottom: 8 }}>{L('Your role is read-only: you can inspect exclusions but not approve or reject them.', 'دورك للقراءة فقط: يمكنك الاطلاع على الاستبعادات دون اعتمادها أو رفضها.')}</div>}
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table">
            <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Category · rule', 'الفئة · القاعدة')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Evidence', 'الدليل')}</th><th>{L('Review', 'المراجعة')}</th><th>{L('Effective · reassessment', 'السريان · إعادة التقييم')}</th><th>{L('Action', 'إجراء')}</th></tr></thead>
            <tbody>
              {register.length ? register.flatMap((d0) => {
                const d = { ...d0, rec: { id: d0.id } };
                const records = d0.exclusions || [];
                const primaryId = d0.primaryRuleId;
                return records.map((ex, idx) => {
                  const rule = ruleById(ex.ruleId);
                  const isPrimary = d0.excluded && ex.ruleId === primaryId;
                  const effective = (d0.reasonRules || []).includes(ex.ruleId);
                  const hist = decisions[d.rec.id]?.byRule?.[ex.ruleId]?.history || [];
                  const unapproved = rule?.approval !== 'approved';
                  return (
                    <tr key={`${d.rec.id}-${ex.ruleId}`}>
                      <td>{idx === 0 ? <Link to={invoicePath(d.rec.id)} dir="ltr">{d.rec.id}</Link> : <span className="muted">↳</span>}{idx === 0 && records.length > 1 && <span className="rv-tag" style={{ marginInlineStart: 6 }}>{records.length} {L('reasons', 'أسباب')}</span>}</td>
                      <td>{ex.category.replace(/_/g, ' ')} · <span dir="ltr">{ex.ruleId} v{ex.ruleVersion}</span>
                        {unapproved && <span className="rv-badge rv-badge--sm rv-badge--warn" style={{ marginInlineStart: 6 }}>{B(RULE_APPROVAL_LABEL.unapproved)}</span>}
                        <div className="muted" style={{ fontSize: 12 }}>
                          {d.cancelled ? L('Invoice is CANCELLED: deducted once as cancelled — this reason is kept as evidence only', 'الفاتورة ملغاة: تُخصم مرة واحدة كملغاة — يبقى هذا السبب دليلاً فقط')
                            : isPrimary ? L('PRIMARY reason — reduces net billed (counted once)', 'السبب الرئيسي — يخفض صافي المفوتر (يُحتسب مرة)')
                              : effective ? L('Secondary reason — evidence only, not deducted again', 'سبب ثانوي — دليل فقط ولا يُخصم ثانية')
                                : L('Does NOT reduce net billed (not approved, rule off or status not accepted)', 'لا يخفض صافي المفوتر (غير معتمد أو القاعدة معطّلة أو الحالة غير مقبولة)')}
                        </div></td>
                      <td className="num" dir="ltr">{idx === 0 ? sar(d.billedAfterAdj) : ''}</td>
                      <td dir="auto" style={{ maxWidth: 260 }}>{B(ex.evidence)}{ex.sources?.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{ex.sources.map((x) => `${x.system}: ${x.field} = ${x.value}`).join(' · ')}</div>}</td>
                      <td><span className={`rv-cat ${ex.reviewStatus === 'approved' ? 'rv-cat--not_due' : ex.reviewStatus === 'rejected' ? 'rv-cat--overdue' : 'rv-cat--partial'}`}>{B(REVIEW_LABEL[ex.reviewStatus] || REVIEW_LABEL.pending)}</span><div style={{ fontSize: 12 }} className="muted"><ReviewerText r={ex.reviewer} /> {ex.reviewDate ? <span dir="ltr">· {ex.reviewDate}</span> : null}{hist.length > 0 ? ` · ${hist.length} ${L('decision(s)', 'قرار')}` : ''}</div></td>
                      <td style={{ fontSize: 12 }}><span dir="ltr">{ex.effectiveFrom || '—'} → {ex.effectiveTo || L('open', 'مفتوح')}</span><div className="muted">{ex.reassessment === 'scheduled_annual' ? L('Reassess annually', 'إعادة تقييم سنوية') : L('Reassessment not started', 'لم تبدأ إعادة التقييم')}</div></td>
                      <td>
                        <input className="input" style={{ width: '100%', padding: '5px 8px', marginBottom: 5 }} placeholder={L('Review note', 'ملاحظة المراجعة')} aria-label={L('Review note', 'ملاحظة المراجعة')} value={note[`${d.rec.id}|${ex.ruleId}`] || ''} onChange={(e) => setNote({ ...note, [`${d.rec.id}|${ex.ruleId}`]: e.target.value })} disabled={!canReview} />
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button type="button" className="btn btn-sm btn-primary" disabled={!canReview || ex.reviewStatus === 'approved'} onClick={() => decide(d.rec.id, 'approved', ex.ruleId)}>{L('Approve', 'اعتماد')}</button>
                          <button type="button" className="btn btn-sm" disabled={!canReview || ex.reviewStatus === 'rejected'} onClick={() => decide(d.rec.id, 'rejected', ex.ruleId)}>{L('Reject', 'رفض')}</button>
                          <button type="button" className="btn btn-sm btn-ghost" disabled={!canReview || ex.reviewStatus === 'pending'} onClick={() => decide(d.rec.id, 'pending', ex.ruleId)}>{L('Reopen', 'إعادة فتح')}</button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              }) : <tr><td colSpan={7}><div className="rv-empty">{L('No exclusion records in this scope.', 'لا توجد سجلات استبعاد في هذا النطاق.')}</div></td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={regPage} total={reg?.total ?? 0} size={15} onPage={setRegPage} label={L('Exclusion register', 'سجل الاستبعادات')} />
      </details>

      <div className="card card-pad">
        <div className="rv-card__head">
          <div>
            <h2 className="rv-sec-title">{L('Exclusion rule registry', 'سجل قواعد الاستبعاد')}</h2>
            <p className="rv-sec-sub">{L('Each rule is versioned and configurable. A report name alone never becomes an automatic rule. Rules marked “غير معتمدة” still run when enabled, but every figure they move is labelled unapproved.', 'كل قاعدة مُرقَّمة وقابلة للضبط. واسم التقرير وحده لا يتحول إلى قاعدة آلية. القواعد الموسومة «غير معتمدة» تعمل عند تفعيلها لكن كل رقم تؤثر فيه يُوسم غير معتمد.')}</p>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRegOpen((v) => !v)} aria-expanded={regOpen}>{regOpen ? L('Hide details', 'إخفاء التفاصيل') : L('Show full definitions', 'عرض التعريفات الكاملة')}</button>
        </div>
        {snapshot.unapprovedRulesApplied.length > 0 && <div className="rv-callout rv-callout--warn" style={{ marginBottom: 8 }}><b>{B(RULE_APPROVAL_LABEL.unapproved)}</b> — {L(`${short(T.exclusionsUnapproved)} of the ${short(T.exclusions)} excluded rests on unapproved rules (${snapshot.unapprovedRulesApplied.join(', ')}). Approved-rule exclusions: ${short(T.exclusionsApproved)}.`, `${short(T.exclusionsUnapproved)} من ${short(T.exclusions)} مستبعد يستند إلى قواعد غير معتمدة (${snapshot.unapprovedRulesApplied.join('، ')}). استبعاد القواعد المعتمدة: ${short(T.exclusionsApproved)}.`)}</div>}
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table">
            <thead><tr>
              <th>{L('On', 'تفعيل')}</th><th>{L('Code · reason', 'الرمز · السبب')}</th><th>{L('Approval', 'الاعتماد')}</th><th className="num">{L('Priority', 'الأولوية')}</th>
              <th className="num">{L('Primary', 'رئيسي')}</th><th className="num">{L('Secondary', 'ثانوي')}</th><th className="num">{L('Pending', 'معلّق')}</th><th className="num">{L('Amount', 'المبلغ')}</th>
              {regOpen && (<><th>{L('Definition', 'التعريف')}</th><th>{L('Source · required fields', 'المصدر · الحقول المطلوبة')}</th><th>{L('Effective', 'السريان')}</th><th>{L('Scope', 'النطاق')}</th><th>{L('Evidence', 'الأدلة')}</th><th>{L('Effect on metrics', 'الأثر على المؤشرات')}</th><th>{L('Review owner', 'مسؤول المراجعة')}</th></>)}
            </tr></thead>
            <tbody>
              {registry.map((r) => (
                <tr key={r.id}>
                  <td><input type="checkbox" aria-label={`${r.id}`} checked={r.enabled} disabled={r.locked || !canReview} onChange={(e) => rev.setRuleEnabled(r.id, e.target.checked)} />{r.locked && <span className="rv-tag" style={{ marginInlineStart: 4 }}>{L('locked', 'مقفلة')}</span>}</td>
                  <td><b dir="ltr">{r.id}</b> · {B(r.label)} <span className="rv-tag">{{ stated_in_meeting: L('stated in meeting', 'مذكور في الاجتماع'), proposed: L('proposed', 'مقترح'), unresolved: L('unresolved', 'غير محسوم'), not_an_exclusion: L('not an exclusion', 'ليس استبعاداً') }[r.basis]}</span></td>
                  <td><span className={`rv-badge rv-badge--sm ${r.approval === 'approved' ? 'rv-badge--good' : 'rv-badge--warn'}`}>{B(RULE_APPROVAL_LABEL[r.approval])}</span></td>
                  <td className="num" dir="ltr">{r.locked ? '—' : r.priority}</td>
                  <td className="num">{r.primaryCount}</td><td className="num">{r.secondaryCount}</td><td className="num">{r.pendingCandidates}</td><td className="num">{r.primaryAmount ? short(r.primaryAmount) : '—'}</td>
                  {regOpen && (<>
                    <td style={{ fontSize: 12 }} dir="auto">{B(r.definition)}<div className="muted">{B(r.note)}</div></td>
                    <td style={{ fontSize: 12 }} dir="auto">{(r.sources || []).map((x) => B(x)).join(' · ')}<div className="muted">{(r.fields || []).join('، ')}</div></td>
                    <td dir="ltr" style={{ fontSize: 12 }}>{r.effectiveFrom || L('not in force', 'غير سارية')}</td>
                    <td style={{ fontSize: 12 }}>{B(r.scope)}</td>
                    <td style={{ fontSize: 12 }} dir="auto">{B(r.evidence)}</td>
                    <td style={{ fontSize: 12 }} dir="auto">{B(r.effect)}</td>
                    <td style={{ fontSize: 12 }}>{B(r.owner)}</td>
                  </>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rv-form" style={{ marginTop: 10 }}>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 12, fontWeight: 700 }}>{L('CR-1 parameter: raw CR statuses that qualify', 'معامل CR-1: حالات السجل التجاري الخام المؤهلة')}</legend>
            {['Deleted', 'Cancelled', 'Suspended', 'Active'].map((st) => (
              <label key={st} className="rv-inline" style={{ marginInlineEnd: 12 }}>
                <input type="checkbox" checked={(cfg.crStatuses || []).includes(st)} disabled={!canReview || st === 'Active'} onChange={(e) => rev.setCrStatuses(e.target.checked ? [...(cfg.crStatuses || []), st] : (cfg.crStatuses || []).filter((x) => x !== st))} />
                <span dir="ltr">{st}</span>
              </label>
            ))}
          </fieldset>
          <label>{L('Grace days — collection reporting (unresolved; enforcement referral has its own, not set)', 'أيام السماح — تقارير التحصيل (غير محسومة؛ وللإحالة للتنفيذ معيار مستقل غير مُحدَّد)')}
            <input className="input" type="number" min="0" max="120" value={cfg.graceDays} onChange={(e) => rev.setGraceDays(e.target.value)} style={{ width: 110 }} disabled={!canReview} />
          </label>
          <div className="muted" style={{ fontSize: 13, maxWidth: 420 }}>{L('Collected counts payments up to the END of the selected period in every view (approved rule). Collections up to today are shown separately, labelled, on request.', 'يحتسب المحصّل المدفوعات حتى نهاية الفترة المحددة في كل الواجهات (قاعدة معتمدة). أما التحصيل حتى اليوم فيُعرض منفصلاً وبوسمه عند الطلب.')}</div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={rev.resetConfig} disabled={!canReview}>{L('Reset to defaults', 'إعادة الضبط')}</button>
        </div>
      </div>

      <div className="rv-two">
        <div className="card card-pad">
          <h2 className="rv-sec-title">{L('Enforcement linkage', 'ربط الإنفاذ')}</h2>
          <p className="rv-sec-sub">{L('Enforcement is separate from collection: an order — open or closed — never moves an invoice in or out of the uncollected view. Only confirmed links count.', 'الإنفاذ منفصل عن التحصيل: الأمر — مفتوحاً أو مغلقاً — لا يُدخل فاتورة إلى عرض غير المحصّل ولا يُخرجها منه. وتُحتسب الروابط المؤكدة فقط.')}</p>
          {snapshot.stock.enforcement && (
            <ul className="rv-list" aria-label={L('Enforcement counts — unique invoices', 'أعداد الإنفاذ — فواتير فريدة')}>
              {[['inExecution', L('With an order that is not closed', 'لها أمر غير مغلق')], ['closedOnly', L('Referred before, all orders closed', 'سبقت إحالتها، كل الأوامر مغلقة')], ['everReferred', L('Ever referred (the two above)', 'سبقت إحالتها (المجموعتان أعلاه)')]].map(([k, label]) => (
                <li key={k}>{label}: <b>{snapshot.stock.enforcement[k].count}</b> {L('invoices', 'فاتورة')} · <span dir="ltr">{sar(snapshot.stock.enforcement[k].outstanding)}</span> {L('remaining (their payment state is judged on its own)', 'متبقٍ (وتُقيَّم حالة سدادها منفصلة)')}</li>
              ))}
            </ul>
          )}
          <div className="rv-table-wrap" tabIndex={0}>
            <table className="rv-table" style={{ minWidth: 0 }}>
              <thead><tr><th>{L('Order', 'الأمر')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Completeness (three separate states)', 'الاكتمال (ثلاث حالات منفصلة)')}</th></tr></thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.enforceNum}>
                    <td><Link to={orderPath(c.enforceNum)} dir="ltr">{c.enforceNum}</Link></td>
                    <td className="num">{short(c.amount)}</td>
                    <td><CompletenessMarks comp={orderCompleteness(c)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8 }}><Link className="btn btn-sm" to="/enforcement">{L('Open enforcement management', 'فتح إدارة التنفيذ')}</Link></div>
        </div>
      </div>
    </div>
  );
}
