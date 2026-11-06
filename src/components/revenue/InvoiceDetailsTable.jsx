import React from 'react';
import { useL } from '../../utils/bi';
import { RecordLink } from '../../utils/returnContext';
import { invoicePath } from '../../utils/paths';
import { ORIGIN_AR, ORIGIN_EN } from '../../data/iim';
import { SOURCE_LABEL, PayStatusChip } from './EnforcementUI';
import { amanahName } from '../../data/catalog';

const KIND_AR = { occupancy: 'إشغالات (إفصاح من المكلف)', differences: 'فروقات (ناتجة عن التدقيق)' }; // as the invoice list names them

// The basic facts of invoices, as the order page shows them for its linked invoices: invoice and Sadad number, issuing entity (biller), Amanah / municipality, invoice type, revenue source / item / product,
// dates, amounts and status. `rows` are order-match candidates (server/orderMatch.js summary).
export default function InvoiceDetailsTable({ rows }) {
  const { L, B, ar, sar } = useL();
  return (
    <div className="rp-tablewrap" tabIndex={0}><table className="ed-inv" aria-label={L('Linked invoices', 'الفواتير المرتبطة')}>
      <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Issuing entity · Amanah', 'الجهة المصدرة · الأمانة')}</th><th>{L('Invoice type · revenue source', 'نوع الفاتورة · مصدر الإيراد')}</th><th>{L('Dates', 'التواريخ')}</th><th className="num">{L('Amounts', 'المبالغ')}</th><th>{L('Status', 'الحالة')}</th></tr></thead>
      <tbody>{rows.map((k) => {
        const muni = ar ? k.municipalityAr : k.municipalityEn; const scope = k.scopeType ? (ar ? ORIGIN_AR[k.scopeType] : ORIGIN_EN[k.scopeType]) : null;
        return (
          <tr key={k.invoiceId}>
            <td><RecordLink to={invoicePath(k.invoiceId)} dir="ltr"><b>{k.invoiceId}</b></RecordLink> <RecordLink className="rv-link" to={invoicePath(k.invoiceId)}>{L('View the invoice', 'عرض الفاتورة')}</RecordLink>
              {k.sadadNo && <div className="muted" style={{ fontSize: 12 }}>{L('Sadad', 'سداد')} <span dir="ltr">{k.sadadNo}</span></div>}
              <div className="muted" style={{ fontSize: 12 }}><span dir="auto">{B(k.payerName)}</span></div></td>
            <td>{k.billerAr ? <div><b>{ar ? k.billerAr : k.billerEn}</b> <span className="muted" dir="ltr">({k.billerId})</span></div> : <span className="muted">—</span>}
              <div className="muted" style={{ fontSize: 12 }}>{k.amanahEn ? amanahName(k.amanahEn, ar) : '—'}{muni ? ` · ${muni}` : ''}</div></td>
            <td>{scope && <span className="rv-tag">{scope}</span>}{k.invoiceKind && <span className="rv-tag" style={{ marginInlineStart: 4 }}>{ar ? KIND_AR[k.invoiceKind] : k.invoiceKind}</span>}
              <div style={{ fontSize: 13 }}>{B(SOURCE_LABEL[k.source] || { en: k.source || '', ar: k.source || '' })}{k.itemAr ? <span className="muted"> · {ar ? k.itemAr : k.itemEn}</span> : null}</div>
              <div className="muted" style={{ fontSize: 12 }}>{k.productAr ? `${L('Product', 'المنتج')}: ${ar ? k.productAr : k.productEn}` : ''}{k.gfsCode ? ` · ${L('Revenue account', 'حساب الإيراد')} ${k.gfsCode}` : ''}{k.platform ? ` · ${k.platform}` : ''}</div></td>
            <td dir="ltr" style={{ fontSize: 12 }}>{k.issueDate && <div>{L('Issued', 'الإصدار')} {k.issueDate}</div>}{k.dueDate && <div>{L('Due', 'الاستحقاق')} {k.dueDate}</div>}{k.daysOverdue > 0 && k.outstanding > 0 ? <div className="muted">{k.daysOverdue} {L('days overdue', 'يوم تأخير')}</div> : null}</td>
            <td className="num" dir="ltr">{sar(k.grossAmount ?? 0)}<div className="muted" style={{ fontSize: 12 }}>{L('collected', 'محصّل')} {sar(k.collected || 0)}<br />{L('remaining', 'المتبقي')} {sar(k.outstanding || 0)}</div></td>
            <td><PayStatusChip status={k.paymentStatus} />{k.excluded && !k.cancelled && <div style={{ marginBlockStart: 3 }}><span className="rv-tag rv-tag--ok">{L('Excluded: linked to a confirmed enforcement order', 'مستبعدة: مرتبطة بأمر تنفيذ مؤكد')}</span></div>}{(k.sourceCancelled || k.cancelled) && <div style={{ marginBlockStart: 3 }}><span className="rv-tag rv-tag--bad">{L('cancelled in the source', 'ملغاة في المصدر')}</span></div>}{k.enfConflict && <div style={{ marginBlockStart: 3 }}><span className="rv-tag rv-tag--bad">{L('Source/enforcement conflict — review required', 'تعارض بين المصدر والتنفيذ — يحتاج مراجعة')}</span></div>}</td>
          </tr>
        );
      })}</tbody>
    </table></div>
  );
}
