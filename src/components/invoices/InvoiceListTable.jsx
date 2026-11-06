import React from 'react';
import { useI18n } from '../../context/I18nContext';
import { useL } from '../../utils/bi';
import { CATEGORY_LABELS } from '../../data/revenueMetrics';
import { pickBi } from '../../data/revenueInsights';
import { PayStatusChip } from '../revenue/EnforcementUI';
import { fmtDateText } from '../../data/clock';
import { ORIGIN_EN } from '../../data/iim';
import CoreInvoiceTable from './CoreInvoiceTable';

// THE invoice list table: one presentation for the collected-invoice register and the exclusion register (and any list that follows),
// so a column, a status badge, a sort or a row action is changed once. Server-side sorting and paging stay with the page that owns the request.
//   mode «library»  — the invoice register: amount · uncollected · days past due, with the collection-state badge
//   mode «collected» / «uncollected» — the redesigned core tables of the two lists (CoreInvoiceTable: core columns + an expandable detail row; «uncollected» adds days overdue and the High / Medium / Low priority)
//   mode «excluded» — the same columns, with the payment status kept as the source states it (an exclusion never changes it), the invoice amount apart from the AMOUNT EXCLUDED, and the exclusion reason
export const SORTABLE = { id: 'id', issue: 'issue', gross: 'gross', outstanding: 'outstanding', age: 'daysOverdue', excluded: 'exclusionAmount', collected: 'collected', priority: 'priority', unpaid: 'uncollected' };

export default function InvoiceListTable({ rows, loading, sort, onSort, onOpen, mode = 'library', highlightId, ariaLabel = 'Invoice library' }) {
  const { t, lang } = useI18n();
  const bi = useL();
  if (mode === 'collected' || mode === 'uncollected') return <CoreInvoiceTable rows={rows} loading={loading} sort={sort} onSort={onSort} onOpen={onOpen} mode={mode} highlightId={highlightId} sortable={SORTABLE} ariaLabel={ariaLabel} />;
  const excludedMode = mode === 'excluded';
  const viewLabel = bi.L('View details', 'عرض التفاصيل');
  const th = (label, key) => (
    <th aria-sort={sort.key === SORTABLE[key] ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="rv-link" style={{ font: 'inherit', fontWeight: 700 }} onClick={() => onSort(SORTABLE[key])}>{label}{sort.key === SORTABLE[key] ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
    </th>
  );
  const colCount = excludedMode ? 11 : 13;
  return (
    <div className="table-wrap" tabIndex={0} aria-busy={loading}>
      <table className="table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {th(t('th_id'), 'id')}
            <th>{t('th_beneficiary')}</th>
            <th>{t('th_amanah')}</th>
            <th>{bi.L('Product', 'اسم المنتج')}</th>
            {!excludedMode && <th>{bi.L('Origin', 'مصدر الفاتورة')}</th>}
            {!excludedMode && <th>{bi.L('Revenue item', 'بند الإيراد')}</th>}
            {!excludedMode && <th>{bi.L('Raw status', 'الحالة الخام')}</th>}
            <th>{excludedMode ? bi.L('Payment status', 'حالة السداد') : t('th_collection_status')}</th>
            {th(`${excludedMode ? bi.L('Invoice amount', 'مبلغ الفاتورة') : t('th_amount')} (${bi.L('SAR', 'ريال')})`, 'gross')}
            {excludedMode
              ? th(`${bi.L('Excluded amount', 'المبلغ المستبعد')} (${bi.L('SAR', 'ريال')})`, 'excluded')
              : th(`${bi.L('Uncollected', 'غير المحصّل')} (${bi.L('SAR', 'ريال')})`, 'outstanding')}
            {excludedMode && <th>{bi.L('Exclusion reason', 'سبب الاستبعاد')}</th>}
            {th(bi.L('Issue date', 'تاريخ الإصدار'), 'issue')}
            {!excludedMode && <th>{bi.L('Due date', 'تاريخ الاستحقاق')}</th>}
            {!excludedMode && th(bi.L('Days past due', 'أيام التأخر بعد الاستحقاق'), 'age')}
            <th><span className="sr-only">{viewLabel}</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="row-clickable" onClick={() => onOpen(r)} style={highlightId === r.id ? { background: 'rgba(21, 112, 239, 0.08)' } : undefined}>
              <td style={{ fontWeight: 700 }} dir="ltr"><button type="button" className="rv-link" onClick={(e) => { e.stopPropagation(); onOpen(r); }} aria-label={`${viewLabel}: ${r.id}`}>{r.id}</button><div className="muted" style={{ fontSize: 11, fontWeight: 400 }} dir="auto">{bi.L('Biller', 'المفوتر')} {r.billerId} · {bi.ar ? r.billerAr : r.billerEn}</div>{r.uploaded ? <span className="rv-tag" style={{ marginInlineStart: 6 }}>{lang === 'ar' ? 'مرفوع' : 'uploaded'}</span> : null}</td>
              <td>{lang === 'ar' ? r.payerAr : r.payerEn}</td>
              <td>{lang === 'ar' ? r.amanahAr || r.amanahEn : r.amanahEn || r.amanahAr}{r.entityType === 'entity' && <span className="muted"> ({lang === 'ar' ? r.entityTypeAr : 'entity'})</span>}{r.municipalityEn && <div className="muted" style={{ fontSize: 12 }}>{lang === 'ar' ? r.municipalityAr : r.municipalityEn} · {r.scopeType === 'internal' ? bi.L('internal', 'داخلي') : bi.L('central', 'مركزي')}</div>}</td>
              <td>{bi.ar ? r.productAr : r.productEn}{r.invoiceKindAr && <div className="muted" style={{ fontSize: 11 }}>{r.invoiceKindAr}</div>}</td>
              {!excludedMode && <td>{bi.ar ? r.originAr : (ORIGIN_EN[r.origin])}</td>}
              {!excludedMode && <td>{bi.ar ? r.itemAr : r.itemEn}</td>}
              {!excludedMode && <td style={{ fontSize: 12 }}>{r.statusRawTahseel || '—'}{r.statusRawEfaa && r.statusRawEfaa !== r.statusRawTahseel && <div className="muted">{bi.L('Efaa', 'إيفاء')}: {r.statusRawEfaa}</div>}</td>}
              <td>
                {excludedMode ? <PayStatusChip status={r.payStatus} /> : <span className={`rv-cat rv-cat--${r.cls}`}>{r.cls === 'collected' ? (lang === 'ar' ? 'محصّلة' : 'Collected') : pickBi(CATEGORY_LABELS[r.cls], lang)}</span>}
                {r.enforcement >= 2 && <span className={`rv-tag${r.enforcement === 3 ? ' rv-tag--warn' : ''}`} style={{ marginInlineStart: 4 }} title={bi.L('Enforcement is a separate dimension: it does not change the payment state', 'الإنفاذ بُعد منفصل: لا يغيّر حالة السداد')}>{r.enforcement === 2 ? bi.L('order not closed', 'أمر غير مغلق') : r.enforcement === 3 ? bi.L('order on hold', 'أمر معلّق') : bi.L('referred before', 'سبقت إحالتها')}</span>}
                {r.tags.includes('amount_conflict') && <span className="rv-tag rv-tag--bad" style={{ marginInlineStart: 4 }}>{lang === 'ar' ? 'تعارض مبلغ' : 'amount conflict'}</span>}
                {r.tags.includes('contract_unmatched') && <span className="rv-tag rv-tag--warn" style={{ marginInlineStart: 4 }}>{lang === 'ar' ? 'عقد غير مطابق' : 'contract not matched'}</span>}
                {r.tags.includes('exclusion_pending') && <span className="rv-tag" style={{ marginInlineStart: 4 }}>{lang === 'ar' ? 'استبعاد قيد المراجعة' : 'exclusion pending'}</span>}
                {excludedMode && r.enfConflict && <span className="rv-tag rv-tag--bad" style={{ marginInlineStart: 4 }} title={bi.L('Cancelled in the source yet referred to enforcement — review', 'ملغاة في المصدر ومحالة للتنفيذ — تحتاج مراجعة')}>{bi.L('source / enforcement conflict', 'تعارض المصدر والإنفاذ')}</span>}
              </td>
              <td dir="ltr">{bi.sar(r.gross)}{!excludedMode && r.exclusions > 0 && <div className="muted" style={{ fontSize: 12 }}>{bi.L('excl.', 'استبعاد')} {bi.sar(r.exclusions)} · {bi.L('net', 'صافي')} {bi.sar(r.net)}</div>}{excludedMode && r.collected > 0 && <div className="muted" style={{ fontSize: 12 }}>{bi.L('collected', 'محصّل')} {bi.sar(r.collected)}</div>}</td>
              {excludedMode
                ? <td dir="ltr">{bi.sar(r.exclusionAmount)}</td>
                : <td dir="ltr">{bi.sar(r.outstanding)}{r.collected > 0 && <div className="muted" style={{ fontSize: 12 }}>{bi.L('collected', 'محصّل')} {bi.sar(r.collected)}</div>}</td>}
              {excludedMode && (
                <td>
                  {r.exclusionReason ? <b style={{ fontWeight: 600 }}>{bi.ar ? r.exclusionReason.reasonAr : r.exclusionReason.reasonEn}</b> : '—'}
                  {r.exclusionReasons?.length > 1 && (
                    <details className="ex-more" onClick={(e) => e.stopPropagation()}>
                      <summary>{bi.L(`+${r.exclusionReasons.length - 1} more`, `+${r.exclusionReasons.length - 1} أخرى`)}</summary>
                      <ul>{r.exclusionReasons.filter((x) => !x.primary).map((x) => <li key={x.ruleId}>{bi.ar ? x.reasonAr : x.reasonEn}</li>)}</ul>
                    </details>
                  )}
                </td>
              )}
              <td dir="ltr" title={r.issueDate}>{fmtDateText(r.issueDate, lang === 'ar' ? 'ar' : 'en')}</td>
              {!excludedMode && <td dir="ltr" title={r.dueDate}>{fmtDateText(r.dueDate, lang === 'ar' ? 'ar' : 'en')}</td>}
              {!excludedMode && <td dir="ltr">{r.daysOverdue > 0 ? r.daysOverdue : '—'}</td>}
              <td className="row-view">
                <span className="row-view__link">{viewLabel}<span className="row-view__chev" aria-hidden="true">›</span></span>
              </td>
            </tr>
          ))}
          {!rows.length && !loading && <tr><td colSpan={colCount}><div className="rv-empty">{excludedMode ? bi.L('No excluded invoices match this view.', 'لا توجد فواتير مستبعدة مطابقة لهذا العرض.') : bi.L('No invoices match these filters.', 'لا توجد فواتير مطابقة لهذه التصفية.')}</div></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
