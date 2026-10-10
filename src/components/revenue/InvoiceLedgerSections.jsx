import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue } from '../../context/RevenueContext';
import { useL } from '../../utils/bi';
import { CATEGORY_LABELS, exclusionRecordsOf, ruleById } from '../../data/revenueMetrics';
import { RULE_APPROVAL_LABEL } from '../../data/ruleRegistry';
import { REVENUE_SOURCES } from '../../data/revenueLedger';
import { riyadhToday } from '../../data/clock';
import { invoiceEnforcement } from '../../data/orderMatching';
import { OrderStatusChip, PayStatusChip } from './EnforcementUI';

const Row = ({ k, children }) => (<div className="rv-kv"><span className="rv-kv__k">{k}</span><span className="rv-kv__v" dir="auto">{children}</span></div>);

function downloadReview(rec, der, cls, notes, L) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    ['Invoice review report (demo data)', ''],
    ['Invoice number', rec.id], ['SADAD number', rec.sadadNo || ''], ['Subscription number', rec.subscriptionNo || ''], ['Contract', rec.co || ''], ['Violation number', rec.violationNumber || ''],
    ['Amanah', rec.amanahEn], ['Municipality', rec.municipalityEn || ''], ['Source', rec.revenueSource], ['Scope', rec.scopeType || ''],
    ['Gross billed (SAR)', der.gross], ['Exclusions (SAR)', der.exclusionsTotal], ['Net billed (SAR)', der.net], ['VAT (declared/derived)', rec.vatAmount ?? ''], ['Collected (SAR)', der.collected], ['Uncollected (SAR)', der.outstanding],
    ['Raw status (Tahseel)', rec.statusRawTahseel || ''], ['Raw status (Efaa)', rec.statusRawEfaa || ''], ['Unified state', cls?.primary || ''],
    ['CR number', rec.crNo || ''], ['CR status (raw)', rec.crStatusRaw || ''],
    ['Exclusion reasons', exclusionRecordsOf(rec).map((e) => `${e.ruleId}:${e.reviewStatus}`).join(' | ')],
    ['Notes', (notes || []).map((n) => `${n.at} ${n.by}: ${n.text}`).join(' | ')],
    ['Generated for review', riyadhToday()]
  ];
  const blob = new Blob([`﻿${lines.map((r) => r.map(esc).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `invoice-review-${rec.id}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// All the revenue-ledger facts about ONE invoice: identifiers and source, items, amounts, raw vs unified state, timeline, exclusion
// reasons with evidence, contract/execution/CR, matching detail and the invoice's effect on the indicators.
// `reasons` = the exclusion reasons in force (rule ids, primary first); `card` = the invoice's contract card (or null).
export default function InvoiceLedgerSections({ rec, der, cls, reasons, card, onClose }) {
  const rev = useRevenue();
  const { L, B, ar, short, sar } = useL();
  const [text, setText] = useState('');
  const { canReview, snapshot } = rev;
  const notes = rev.notes?.[rec.id] || [];
  const records = exclusionRecordsOf(rec);
  const myPay = card?.schedule?.find((p) => p.invoiceNo === rec.id);
  const decide = (ruleId, decision) => rev.decideExclusion(rec.id, decision, '', ruleId);
  const enf = invoiceEnforcement(rec.id, rev.cases);

  const timeline = [
    { date: rec.issueDate, text: L('Invoice issued', 'صدرت الفاتورة') },
    { date: rec.dueDate, text: L('Due date', 'تاريخ الاستحقاق') },
    ...rec.payments.map((p) => ({ date: p.date, text: `${L('Payment', 'دفعة')} ${sar(p.amount)} (${p.channel})` })),
    ...(rec.cancelled ? [{ date: rec.cancelled.date, text: L('Cancelled in the source', 'أُلغيت في المصدر') }] : []),
    ...records.filter((e) => e.reviewDate).map((e) => ({ date: e.reviewDate, text: `${e.ruleId}: ${e.reviewStatus === 'approved' ? L('exclusion approved', 'اعتُمد الاستبعاد') : e.reviewStatus}` })),
    ...(rec.enforcementLinks || []).map((l) => ({ date: null, text: `${L('Enforcement', 'تنفيذ')} ${l.enforceNum} (${l.status})` })),
    ...notes.map((n) => ({ date: n.at, text: `${L('Note', 'ملاحظة')}: ${n.text}` }))
  ].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));

  return (
    <>
      <div className="idd-section">
        <div className="idd-section__head"><div className="idd-section__title">{L('Identifiers and source', 'المعرفات والمصدر')}</div></div>
        <div className="rv-kvgrid">
          <Row k={L('Invoice no. (text)', 'رقم الفاتورة (نص)')}><span dir="ltr">{rec.id}</span></Row>
          <Row k={L('SADAD no. (text)', 'رقم سداد (نص)')}><span dir="ltr">{rec.sadadNo || '—'}</span></Row>
          <Row k={L('Subscription no. (text)', 'رقم الاشتراك (نص)')}><span dir="ltr">{rec.subscriptionNo || '—'}</span> <small className="muted">{L('not assumed equal to the invoice no.', 'لا يُفترض أنه يساوي رقم الفاتورة')}</small></Row>
          <Row k={L('Violation no.', 'رقم المخالفة')}><span dir="ltr">{rec.violationNumber || '—'}</span></Row>
          <Row k={L('Source report', 'التقرير المصدر')}>{rec.sourcePlatform} · {(rec.scopeType || 'central') === 'internal' ? L('internal', 'داخلي') : L('central', 'مركزي')}</Row>
          <Row k={L('Revenue source · item', 'مصدر الإيراد · البند')}>{B(REVENUE_SOURCES[rec.revenueSource])}{rec.revenueItem ? ` · ${ar ? rec.revenueItem.ar : rec.revenueItem.en}` : ''}</Row>
          <Row k={L('Amanah · municipality', 'الأمانة · البلدية')}>{ar ? rec.amanahAr : rec.amanahEn}{rec.municipalityEn ? ` · ${ar ? rec.municipalityAr : rec.municipalityEn}` : ''}{rec.amanahLinkage === 'makeen_unmatched' && <span className="rv-tag rv-tag--warn">{L('not found in Makeen', 'غير موجودة في مكين')}</span>}{rec.amanahLinkage === 'makeen_matched' && <span className="rv-tag rv-tag--ok">{L('Amanah from Makeen', 'الأمانة من مكين')}</span>}</Row>
          <Row k={L('Data provenance', 'مصدر السجل')}>{rec.provenance.kind === 'demo' ? L('Demo data', 'بيانات تجريبية') : rec.provenance.kind === 'uploaded' ? L(`Uploaded: ${rec.provenance.file}`, `مرفوعة: ${rec.provenance.file}`) : rec.provenance.kind}</Row>
        </div>
      </div>

      <div className="idd-section">
        <div className="idd-section__head"><div className="idd-section__title">{L('Items and amount', 'البنود والمبلغ')}</div></div>
        <div className="rv-table-wrap" tabIndex={0}><table className="rv-table" style={{ minWidth: 0 }}>
          <thead><tr><th className="num">#</th><th>{L('Item', 'البند')}</th><th className="num">{L('Amount', 'المبلغ')}</th></tr></thead>
          <tbody>
            {(rec.lineItems || []).map((li) => <tr key={li.no}><td className="num">{li.no}</td><td dir="auto">{li.name}</td><td className="num" dir="ltr">{sar(li.amount)}</td></tr>)}
            <tr><td /><td><b>{L('Sum of items', 'مجموع البنود')}</b></td><td className="num" dir="ltr"><b>{sar((rec.lineItems || []).reduce((s, l) => s + l.amount, 0))}</b></td></tr>
            <tr><td /><td><b>{L('Invoice value (header, counted once)', 'قيمة الفاتورة (الرأس، تُحتسب مرة)')}</b></td><td className="num" dir="ltr"><b>{sar(rec.grossAmount)}</b></td></tr>
          </tbody>
        </table></div>
        <div className="rv-kvgrid" style={{ marginTop: 8 }}>
          <Row k={L('VAT (shown apart)', 'الضريبة (منفصلة)')}><span dir="ltr">{sar(rec.vatAmount || 0)}</span> <small className="muted">{rec.vatKnown ? L('declared by the source', 'مُصرَّح بها من المصدر') : L('derived at 15% — not declared', 'مشتقة بنسبة 15% — غير مُصرَّح بها')}</small></Row>
          <Row k={L('Gross billed (before exclusions)', 'إجمالي المفوتر (قبل الاستبعادات)')}><span dir="ltr">{sar(der.gross)}</span></Row>
          <Row k={L('Exclusions (cancelled or rule-excluded, once)', 'الاستبعادات (ملغى أو بقاعدة، مرة واحدة)')}><span dir="ltr">{sar(der.exclusionsTotal)}</span></Row>
          <Row k={L('Net billed', 'صافي المفوتر')}><span dir="ltr">{sar(der.net)}</span></Row>
          <Row k={L('Collected (within net billed)', 'المحصّل (ضمن صافي المفوتر)')}><span dir="ltr">{sar(der.collected)}</span></Row>
          <Row k={L('Uncollected', 'غير المحصّل')}><span dir="ltr">{sar(der.outstanding)}</span></Row>
          <Row k={L('Due date · age', 'الاستحقاق · العمر')}><span dir="ltr">{rec.dueDate}</span>{der.outstanding > 0 ? (der.daysOverdue > 0 ? ` · ${der.daysOverdue} ${L('days overdue', 'يوماً متأخرة')}` : ` · ${L('not yet due (not arrears)', 'لم يحن (ليست متأخرات)')}`) : ''}</Row>
        </div>
        {rec.amountCheck?.status === 'conflict' && <div className="rv-callout rv-callout--bad" style={{ marginTop: 8 }}>{L(`Items do not add up to the invoice value (difference ${sar(Math.abs(rec.amountCheck.difference))}). Not corrected; metrics use the header amount.`, `البنود لا تطابق قيمة الفاتورة (الفرق ${sar(Math.abs(rec.amountCheck.difference))}). لم يُصحَّح؛ وتستخدم المؤشرات مبلغ الرأس.`)}</div>}
      </div>

      <div className="idd-section">
        <div className="idd-section__head"><div className="idd-section__title">{L('Raw status and unified state', 'الحالة الخام والحالة الموحدة')}</div></div>
        <div className="rv-kvgrid">
          <Row k={L('Raw status — Tahseel', 'الحالة الخام — تحصيل')}>{rec.statusRawTahseel || '—'}</Row>
          <Row k={L('Raw status — Efaa', 'الحالة الخام — إيفاء')}>{rec.statusRawEfaa || '—'}{rec.statusRawEfaa && rec.statusRawTahseel && rec.statusRawEfaa !== rec.statusRawTahseel && <span className="rv-tag rv-tag--warn">{L('differs — both kept', 'مختلفة — تُحفظ الحالتان')}</span>}</Row>
          <Row k={L('Unified state', 'الحالة الموحدة')}><span className={`rv-cat rv-cat--${cls.primary}`}>{cls.primary === 'collected' ? L('Collected', 'محصّلة') : B(CATEGORY_LABELS[cls.primary])}</span></Row>
        </div>
      </div>

      <div className="idd-section">
        <div className="idd-section__head"><div className="idd-section__title">{L('Timeline', 'التسلسل الزمني')}</div></div>
        <ol className="rv-timeline">{timeline.map((e, i) => <li key={i}><span dir="ltr" className="muted">{e.date || '—'}</span> {e.text}</li>)}</ol>
      </div>

      <div className="idd-section">
        <div className="idd-section__head"><div className="idd-section__title">{L('Exclusion reasons and evidence', 'أسباب الاستبعاد والأدلة')}</div></div>
        {der.cancelled && <div className="rv-callout rv-callout--warn" style={{ marginBottom: 6 }}>{L('This invoice is cancelled in the source: its amount is deducted once, as cancelled. Any exclusion reason below is kept as evidence only.', 'هذه الفاتورة ملغاة في المصدر: يُخصم مبلغها مرة واحدة كملغى. وأي سبب استبعاد أدناه يبقى دليلاً فقط.')}</div>}
        {records.length ? records.map((ex) => {
          const rule = ruleById(ex.ruleId);
          const isPrimary = !der.cancelled && reasons[0] === ex.ruleId;
          const effective = reasons.includes(ex.ruleId);
          return (
            <div key={ex.ruleId} style={{ fontSize: 13, display: 'grid', gap: 4, padding: '8px 0', borderTop: '1px dashed var(--line)' }}>
              <div><b>{ex.category.replace(/_/g, ' ')}</b> · <span dir="ltr">{ex.ruleId} v{ex.ruleVersion}</span> {rule && <span className={`rv-badge rv-badge--sm ${rule.approval === 'approved' ? 'rv-badge--good' : 'rv-badge--warn'}`}>{B(RULE_APPROVAL_LABEL[rule.approval])}</span>}
                {isPrimary && <span className="rv-tag rv-tag--ok">{L('primary reason', 'السبب الرئيسي')}</span>}
                {effective && !isPrimary && !der.cancelled && <span className="rv-tag">{L('secondary — not deducted again', 'ثانوي — لا يُخصم ثانية')}</span>}
                — {ex.reviewStatus === 'approved' ? L('approved', 'معتمد') : ex.reviewStatus === 'rejected' ? L('rejected', 'مرفوض') : L('pending: stays in net billed', 'معلّق: يبقى في صافي المفوتر')}</div>
              <div dir="auto"><b>{L('Evidence', 'الدليل')}:</b> {B(ex.evidence)}</div>
              {ex.sources?.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{ex.sources.map((x) => `${x.system} › ${x.field} = ${x.value}`).join(' · ')}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm btn-primary" disabled={!canReview || ex.reviewStatus === 'approved'} onClick={() => decide(ex.ruleId, 'approved')}>{L('Approve', 'اعتماد')}</button>
                <button type="button" className="btn btn-sm" disabled={!canReview || ex.reviewStatus === 'rejected'} onClick={() => decide(ex.ruleId, 'rejected')}>{L('Reject', 'رفض')}</button>
                {!canReview && <span className="muted" style={{ fontSize: 12 }}>{L('Read-only role', 'دور للقراءة فقط')}</span>}
              </div>
            </div>
          );
        }) : <div className="muted" style={{ fontSize: 12 }}>{L('No exclusion record on this invoice.', 'لا يوجد سجل استبعاد على هذه الفاتورة.')}</div>}
      </div>

      <div className="idd-section">
        <div className="idd-section__head"><div className="idd-section__title">{L('Contract, execution and commercial registration', 'العقد والتنفيذ والسجل التجاري')}</div></div>
        <div className="rv-kvgrid">
          <Row k={L('Contract', 'العقد')}>{rec.co ? <Link to={`/contracts?no=${rec.co}`} dir="ltr" onClick={onClose}>{rec.co}</Link> : rec.contract.status === 'unmatched' ? L('Contract not matched (not “no contract”)', 'لم تتم مطابقة العقد (وليس «بدون عقد»)') : rec.contract.status === 'confirmed_none' ? L('No contract — confirmed by Furas', 'بدون عقد — مؤكد من فرص') : '—'}</Row>
          <Row k={L('Installment', 'الدفعة')}>{myPay ? `${myPay.no} / ${card.schedule.length}` : '—'}</Row>
          <Row k={L('Objection', 'الاعتراض')}>{rec.objection ? <span dir="ltr">{rec.objection.ref} · {L('open', 'مفتوح')}</span> : L('None', 'لا يوجد')}</Row>
          <Row k={L('Payment status', 'حالة السداد')}><PayStatusChip status={der.payStatus} /><small className="muted"> · {L('separate from the enforcement status', 'منفصلة عن حالة الإنفاذ')}</small></Row>
          <Row k={L('Enforcement orders', 'أوامر الإنفاذ')}>
            {enf.confirmed.length ? enf.confirmed.map((o) => (
              <div key={o.enforceNum}><Link to={`/sanad-orders/${o.enforceNum}`} dir="ltr" onClick={onClose}>{o.enforceNum}</Link> <OrderStatusChip status={o.orderStatus} /> <small className="muted">{L('confirmed link', 'رابط مؤكد')}</small></div>
            )) : rec.executionNo ? <Link to={`/sanad-orders/${rec.executionNo}`} dir="ltr" onClick={onClose}>{rec.executionNo}</Link> : L('No confirmed enforcement order (absence of the feed is not proof of none)', 'لا يوجد أمر إنفاذ مؤكد (غياب التغذية ليس دليلاً على عدم الوجود)')}
            {enf.proposed.map((o) => (
              <div key={`p-${o.enforceNum}`}><Link to={`/sanad-orders/${o.enforceNum}`} dir="ltr" onClick={onClose}>{o.enforceNum}</Link> <span className="rv-tag rv-tag--warn">{L('proposed link — awaiting review, no effect yet', 'رابط مقترح — بانتظار المراجعة، بلا أثر بعد')}</span></div>
            ))}
          </Row>
          <Row k={L('CR number (text)', 'رقم السجل التجاري (نص)')}><span dir="ltr">{rec.crNo || '—'}</span>{rec.crEvidence && <small className="muted"> · {rec.crEvidence.method === 'ocr' ? `OCR ${Math.round(rec.crEvidence.confidence * 100)}%` : L('structured', 'بيانات منظمة')} · {rec.crEvidence.source}</small>}</Row>
          <Row k={L('CR View status (raw)', 'حالة CR View (خام)')}><span dir="ltr">{rec.crStatusRaw || '—'}</span>{rec.crStatusRaw && rec.crStatusRaw !== 'Active' && <span className="rv-tag rv-tag--warn">{L('evidence, not an exclusion', 'دليل وليس استبعاداً')}</span>}</Row>
          <Row k={L('Missing mandatory fields', 'حقول إلزامية ناقصة')}>{rec.missingFields.length ? rec.missingFields.join(', ') : L('None', 'لا يوجد')}</Row>
        </div>
      </div>

      <div className="idd-section">
        <div className="idd-section__head"><div className="idd-section__title">{L('Effect on the indicators', 'أثر الفاتورة على المؤشرات')}</div></div>
        <div className="rv-kvgrid">
          <Row k={L('Gross billed', 'إجمالي المفوتر')}><span dir="ltr">+{sar(rec.grossAmount)}</span></Row>
          <Row k={L('Cancelled', 'الملغى')}><span dir="ltr">{der.cancelled ? `−${sar(der.cancelledAmount)}` : '0'}</span></Row>
          <Row k={L('Excluded (primary reason only)', 'المستبعد (السبب الرئيسي فقط)')}><span dir="ltr">{der.excluded ? `−${sar(der.exclusionAmount)}` : '0'}</span></Row>
          <Row k={L('Net billed', 'صافي المفوتر')}><span dir="ltr">{sar(der.net)}</span></Row>
          <Row k={L('Net uncollected', 'الرصيد القائم')}><span dir="ltr">{sar(der.outstanding)}</span>{der.outstanding > 0 && snapshot.stock.netUncollected > 0 && <small className="muted"> · {(der.outstanding / snapshot.stock.netUncollected * 100).toFixed(1)}% {L('of the net uncollected in scope', 'من الرصيد القائم في النطاق')}</small>}</Row>
          <Row k={L('Counted once', 'تُحتسب مرة واحدة')}>{L('Multiple items, reasons or registrations never repeat this invoice in a total.', 'تعدد البنود أو الأسباب أو السجلات لا يكرر هذه الفاتورة في أي إجمالي.')}</Row>
        </div>
      </div>

      <div className="idd-section">
        <div className="idd-section__head"><div className="idd-section__title">{L('Analyst notes and review report', 'ملاحظات المحلل وتقرير المراجعة')}</div></div>
        {notes.length > 0 && <ul className="rv-list" style={{ marginBottom: 8 }}>{notes.map((n, i) => <li key={i}><span dir="ltr" className="muted">{n.at}</span> <b>{n.by}</b> — <span dir="auto">{n.text}</span></li>)}</ul>}
        <div className="rv-form">
          <input id="inv_note" className="input" style={{ flex: '1 1 240px' }} placeholder={L('Document an observation about this invoice', 'وثّق ملاحظة عن هذه الفاتورة')} aria-label={L('Note', 'ملاحظة')} value={text} onChange={(e) => setText(e.target.value)} disabled={!canReview} />
          <button type="button" className="btn btn-sm btn-primary" disabled={!canReview || !text.trim()} onClick={() => { rev.addNote(rec.id, text.trim()); setText(''); }}>{L('Add note', 'إضافة ملاحظة')}</button>
          <button type="button" className="btn btn-sm" onClick={() => downloadReview(rec, der, cls, notes, L)}>{L('Export review report (CSV)', 'استخراج تقرير المراجعة (CSV)')}</button>
        </div>
        <small className="muted">{L('Notes live in this solution only; no source system is changed.', 'تبقى الملاحظات في هذه المنصة فقط؛ ولا يتغير أي نظام مصدري.')}</small>
      </div>
    </>
  );
}
