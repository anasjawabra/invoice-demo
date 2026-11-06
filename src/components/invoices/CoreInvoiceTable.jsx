// CoreInvoiceTable — the simple, core table of the Collected and Uncollected lists (rendered by InvoiceListTable for modes «collected» and «uncollected»).
//   Collected   : invoice (+ biller) · Amanah / municipality · billed party · collected amount · payment status · details
//   Uncollected : invoice (+ biller) · Amanah / municipality · product · unpaid amount · payment status (+ a separate exclusion badge) · days overdue · priority · details
// Everything else (exclusion reason, source and origin, dates, next step, tags) sits in an expandable detail row. On a phone every row is a small card of the core fields.
import React, { useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { useL } from '../../utils/bi';
import { fmtDateText } from '../../data/clock';
import { ORIGIN_AR, ORIGIN_EN } from '../../data/iim';
import { REVENUE_SOURCES } from '../../data/revenueLedger';
import { PayStatusChip } from '../revenue/EnforcementUI';
import { PriorityBadge, ExclusionBadge } from './Badges';

const TAG_LABEL = {
  partial: { ar: 'مدفوعة جزئياً', en: 'partly paid' }, overdue: { ar: 'متأخرة', en: 'overdue' }, amount_conflict: { ar: 'تعارض مبلغ', en: 'amount conflict' },
  contract_unmatched: { ar: 'عقد غير مطابق', en: 'contract not matched' }, contract_unlinked: { ar: 'عقد غير مرتبط', en: 'contract not linked' }, missing_fields: { ar: 'بيانات ناقصة', en: 'missing fields' },
  exclusion_pending: { ar: 'استبعاد قيد المراجعة', en: 'exclusion pending' }, enforcement_candidate: { ar: 'مرشّحة لأمر تنفيذ', en: 'enforcement candidate' }, multi_reason: { ar: 'أكثر من سبب استبعاد', en: 'several exclusion reasons' },
  also_excluded_reason: { ar: 'سبب استبعاد إضافي', en: 'also meets another exclusion reason' }, efaa_status: { ar: 'حالة إيفاء', en: 'Efaa status' }
};
export const unpaidOf = (r) => (Number(r.outstanding) || 0) + (Number(r.exclusionAmount) || 0);

function Detail({ k, children }) { return children == null || children === '' ? null : <div className="il-dl__row"><dt>{k}</dt><dd>{children}</dd></div>; }

function DetailRow({ r, mode, colSpan, id }) {
  const { L, ar, sar } = useL(); const { lang } = useI18n(); const d = (x) => fmtDateText(x, ar ? 'ar' : 'en');
  const origin = r.origin ? (ar ? ORIGIN_AR : ORIGIN_EN)[r.origin] : null; const src = REVENUE_SOURCES[r.source];
  const tags = (r.tags || []).filter((t) => TAG_LABEL[t] && t !== 'partial' && t !== 'overdue');
  const next = r.nextStep ? (ar ? r.nextStep.ar : r.nextStep.en) : null;
  return (
    <tr className="il-detail" id={id}>
      <td colSpan={colSpan}>
        <dl className="il-dl">
          {mode === 'uncollected' && r.exclusionReason && <Detail k={L('Exclusion reason', 'سبب الاستبعاد')}>{ar ? r.exclusionReason.reasonAr : r.exclusionReason.reasonEn}{r.exclusionReason.sourceAr ? <span className="muted"> — {ar ? r.exclusionReason.sourceAr : r.exclusionReason.sourceEn}</span> : null}</Detail>}
          {mode === 'uncollected' && r.exclusionAmount > 0 && <Detail k={L('Excluded amount', 'المبلغ المستبعد')}><span dir="ltr">{sar(r.exclusionAmount)}</span></Detail>}
          {mode === 'uncollected' && r.outstanding > 0 && <Detail k={L('Net unpaid', 'صافي غير المحصّل')}><span dir="ltr">{sar(r.outstanding)}</span></Detail>}
          <Detail k={L('Product', 'المنتج')}>{ar ? r.productAr : r.productEn}{r.invoiceKindAr ? ` — ${r.invoiceKindAr}` : ''}</Detail>
          <Detail k={L('Revenue source', 'مصدر الإيراد')}>{src ? (ar ? src.ar : src.en) : r.source}</Detail>
          <Detail k={L('Supplying system', 'النظام المُورِّد')}>{r.platform}</Detail>
          <Detail k={L('Invoice origin', 'مصدر الفاتورة')}>{origin}</Detail>
          <Detail k={L('Revenue item', 'بند الإيراد')}>{ar ? r.itemAr : r.itemEn}</Detail>
          <Detail k={L('Invoice amount', 'مبلغ الفاتورة')}><span dir="ltr">{sar(r.gross)}</span></Detail>
          {mode === 'uncollected' && r.collected > 0 && <Detail k={L('Collected so far', 'المحصّل حتى الآن')}><span dir="ltr">{sar(r.collected)}</span></Detail>}
          {mode === 'collected' && r.outstanding > 0 && <Detail k={L('Still unpaid', 'المتبقي غير مسدّد')}><span dir="ltr">{sar(r.outstanding)}</span></Detail>}
          <Detail k={L('Issue date', 'تاريخ الإصدار')}><span dir="ltr">{d(r.issueDate)}</span></Detail>
          <Detail k={L('Due date', 'تاريخ الاستحقاق')}><span dir="ltr">{d(r.dueDate)}</span></Detail>
          {mode === 'collected' && <Detail k={L('Source status', 'حالة المصدر')}>{r.statusRawTahseel}{r.statusRawEfaa && r.statusRawEfaa !== r.statusRawTahseel ? ` · ${L('Efaa', 'إيفاء')}: ${r.statusRawEfaa}` : ''}</Detail>}
          {mode === 'uncollected' && next && <Detail k={L('Next step', 'الخطوة التالية')}>{next}</Detail>}
          {tags.length > 0 && <Detail k={L('Flags', 'ملاحظات')}>{tags.map((t) => <span key={t} className="rv-tag">{ar ? TAG_LABEL[t].ar : TAG_LABEL[t].en}</span>)}</Detail>}
          {r.uploaded && <Detail k={L('Record', 'السجل')}><span className="rv-tag">{L('uploaded', 'مرفوع')}</span></Detail>}
        </dl>
      </td>
    </tr>
  );
}

export default function CoreInvoiceTable({ rows, loading, sort, onSort, onOpen, mode, highlightId, sortable, ariaLabel }) {
  const { lang } = useI18n(); const { L, ar, sar } = useL();
  const [openId, setOpenId] = useState(null);
  const unpaid = mode === 'uncollected';
  const viewLabel = L('View details', 'عرض التفاصيل');
  const th = (label, key, cls) => {
    const k = sortable[key]; const active = k && sort.key === k;
    return (
      <th className={cls} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        {k ? <button type="button" className="rv-link il-th" onClick={() => onSort(k)}>{label}<span aria-hidden="true">{active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span></button> : label}
      </th>
    );
  };
  const colCount = unpaid ? 8 : 6;
  const amanah = (r) => (ar ? r.amanahAr || r.amanahEn : r.amanahEn || r.amanahAr);
  return (
    <div className="table-wrap il-tablewrap" tabIndex={0} aria-busy={loading}>
      <table className="table il-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {th(L('Invoice', 'الفاتورة'), 'id')}
            <th>{L('Amanah · municipality', 'الأمانة · البلدية')}</th>
            <th>{unpaid ? L('Product', 'المنتج') : L('Billed party', 'الجهة المفوترة')}</th>
            {th(unpaid ? `${L('Unpaid', 'غير المحصّل')} (${L('SAR', 'ريال')})` : `${L('Collected', 'المحصّل')} (${L('SAR', 'ريال')})`, unpaid ? 'unpaid' : 'collected', 'il-num')}
            <th>{L('Payment status', 'حالة السداد')}</th>
            {unpaid && th(L('Days overdue', 'أيام التأخر'), 'age', 'il-num')}
            {unpaid && th(L('Priority', 'الأولوية'), 'priority')}
            <th><span className="sr-only">{viewLabel}</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const open = openId === r.id; const did = `il-d-${String(r.id).replace(/[^\w-]/g, '_')}`;
            return (
              <React.Fragment key={r.id}>
                <tr className={`row-clickable il-row${open ? ' is-open' : ''}`} onClick={() => onOpen(r)} style={highlightId === r.id ? { background: 'rgba(21, 112, 239, 0.08)' } : undefined}>
                  <td className="il-c-id" data-label={L('Invoice', 'الفاتورة')}>
                    <button type="button" className="rv-link il-id" dir="ltr" onClick={(e) => { e.stopPropagation(); onOpen(r); }} aria-label={`${viewLabel}: ${r.id}`}>{r.id}</button>
                    <div className="muted il-sub" dir="auto">{L('Biller', 'المفوتر')} {r.billerId} · {ar ? r.billerAr : r.billerEn}</div>
                  </td>
                  <td data-label={L('Amanah · municipality', 'الأمانة · البلدية')}>{amanah(r)}{r.municipalityEn && <div className="muted il-sub">{ar ? r.municipalityAr : r.municipalityEn}</div>}</td>{/* the municipality line only when the source names one (mapped); not specified / issued directly → the Amanah alone, nothing repeated */}
                  <td data-label={unpaid ? L('Product', 'المنتج') : L('Billed party', 'الجهة المفوترة')}>{unpaid ? (ar ? r.productAr : r.productEn) : (ar ? r.payerAr : r.payerEn)}</td>
                  <td className="il-num il-c-amt" dir="ltr" data-label={unpaid ? L('Unpaid', 'غير المحصّل') : L('Collected', 'المحصّل')}>{sar(unpaid ? unpaidOf(r) : r.collected)}</td>
                  <td className="il-c-stat" data-label={L('Payment status', 'حالة السداد')}>
                    <PayStatusChip status={r.payStatus} />
                    {unpaid && (r.exclusionReason || r.exclusionAmount > 0) && <ExclusionBadge reason={r.exclusionReason} />}
                  </td>
                  {unpaid && <td className="il-num" dir="ltr" data-label={L('Days overdue', 'أيام التأخر')}>{r.daysOverdue > 0 ? r.daysOverdue : '—'}</td>}
                  {unpaid && <td data-label={L('Priority', 'الأولوية')}><PriorityBadge priority={r.priority} /></td>}
                  <td className="row-view il-c-act">
                    <button type="button" className="il-more" aria-expanded={open} aria-controls={did} onClick={(e) => { e.stopPropagation(); setOpenId(open ? null : r.id); }}>
                      {open ? L('Less', 'إخفاء') : L('More', 'المزيد')}<span aria-hidden="true" className="il-more__chev">{open ? '▴' : '▾'}</span>
                    </button>
                    <span className="row-view__link">{viewLabel}<span className="row-view__chev" aria-hidden="true">›</span></span>
                  </td>
                </tr>
                {open && <DetailRow r={r} mode={mode} colSpan={colCount} id={did} />}
              </React.Fragment>
            );
          })}
          {!rows.length && loading && Array.from({ length: 5 }, (_, i) => <tr key={`s${i}`} className="il-skelrow" aria-hidden="true"><td colSpan={colCount}><div className="il-skel il-skel--row" /></td></tr>)}
          {!rows.length && !loading && <tr><td colSpan={colCount}><div className="rv-empty">{L('No invoices match these filters.', 'لا توجد فواتير مطابقة لهذه التصفية.')}</div></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
