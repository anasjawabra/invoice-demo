import React, { useState } from 'react';
import { RecordLink as Link } from '../../utils/returnContext';
import { invoicePath, contractPath, orderPath } from '../../utils/paths';
import { useL } from '../../utils/bi';
import { ASSUMPTIONS } from '../../data/sourceAssumptions';

const ROLE = {
  primary: { ar: 'مرجع الحالة والتحصيل', en: 'Status & collection' }, items: { ar: 'بنود الإيراد', en: 'Revenue lines' }, amanah: { ar: 'الأمانة', en: 'Amanah' },
  'activity-source': { ar: 'نظام النشاط', en: 'Activity system' }, violation: { ar: 'المخالفة', en: 'Violation' }, contract: { ar: 'العقد', en: 'Contract' },
  enforcement: { ar: 'التنفيذ', en: 'Enforcement' }, settlement: { ar: 'التسوية', en: 'Settlement' }
};
const cell = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(v));

// The original-source view of ONE unified invoice: which systems carry it, the original column names, the related records and the assumptions applied.
export default function SourceRecordSection({ sr }) {
  const { L, B, ar, sar } = useL();
  const [open, setOpen] = useState({});
  if (!sr) return null;
  const ids = sr.assumptions || [];
  return (
    <div className="idd-section" data-testid="source-record">
      <div className="idd-section__head">
        <div className="idd-section__title">{L('Source record and links', 'السجل المصدري والروابط')} <span className="rv-badge rv-badge--sm rv-badge--demo">{L('Demo data', 'بيانات تجريبية')}</span></div>
        <div className="idd-section__sub">{L('Revenue source (activity) is separate from the supplying system and from the import version. One unified invoice, counted once.', 'مصدر الإيراد (النشاط) منفصل عن النظام المورّد وعن نسخة الاستيراد. فاتورة موحدة واحدة تُحتسب مرة.')}</div>
      </div>
      <div className="rv-kvgrid">
        <div className="rv-kv"><span className="rv-kv__k">{L('Revenue source', 'مصدر الإيراد')}</span><span className="rv-kv__v">{sr.sourceLabel ? B(sr.sourceLabel) : sr.family} · {ar ? sr.item.ar : sr.item.en}</span></div>
        <div className="rv-kv"><span className="rv-kv__k">{L('Supplying system', 'النظام المورّد')}</span><span className="rv-kv__v" dir="auto">{sr.providingSystem}</span></div>
        <div className="rv-kv"><span className="rv-kv__k">{L('Import version', 'نسخة الاستيراد')}</span><span className="rv-kv__v" dir="ltr">v{sr.importVersion}</span></div>
        <div className="rv-kv"><span className="rv-kv__k">{L('Record level', 'مستوى السجل')}</span><span className="rv-kv__v" dir="auto">{sr.level ? B(sr.level) : '—'}</span></div>
      </div>
      <p className="rv-sec-sub" style={{ marginTop: 6 }}>{B(sr.linkSummary)}</p>

      <div className="rv-table-wrap" tabIndex={0}><table className="rv-table" style={{ minWidth: 0 }}>
        <thead><tr><th>{L('System', 'النظام')}</th><th>{L('Dataset', 'المجموعة')}</th><th>{L('Role', 'الدور')}</th><th>{L('Key field', 'حقل الربط')}</th><th>{L('Key', 'المفتاح')}</th><th>{L('Version', 'النسخة')}</th></tr></thead>
        <tbody>{sr.links.map((l, k) => (
          <tr key={k} className={l.present === false ? 'muted' : ''}>
            <td>{l.system}</td><td dir="ltr">{l.dataset}</td><td>{ROLE[l.role] ? B(ROLE[l.role]) : l.role}</td><td dir="ltr">{l.keyField}</td>
            <td dir="ltr">{cell(l.key)}{l.present === false ? ` · ${L('not found', 'غير موجود')}` : ''}{l.note ? <div className="muted" style={{ fontSize: 12 }} dir="auto">{B(l.note)}</div> : null}</td>
            <td dir="ltr">v{l.importVersion}</td>
          </tr>))}</tbody>
      </table></div>

      {sr.related.map((x, k) => (
        <div key={k} className="rv-callout" style={{ marginTop: 6 }}>
          <b>{B(x.label)}</b>
          {x.invoiceId && <> · <Link to={invoicePath(x.invoiceId)} dir="ltr">{x.invoiceId}</Link></>}
          {x.deedNo && <> · <span dir="ltr">{x.deedNo}</span></>}
          {x.note && <div>{B(x.note)}</div>}
          {x.invoices && (
            <ul className="rv-list" style={{ marginTop: 4 }}>{x.invoices.map((v) => <li key={v.id}><Link to={invoicePath(v.id)} dir="ltr">{v.id}</Link> · {v.share}% · <span dir="ltr">{sar(v.amount)}</span>{v.current ? ` · ${L('this invoice', 'هذه الفاتورة')}` : ''}</li>)}</ul>
          )}
        </div>
      ))}
      {(sr.notes || []).map((n, k) => <div key={k} className="rv-callout rv-callout--warn" style={{ marginTop: 6 }}>{B(n)}</div>)}

      {sr.views.map((v) => (
        <div key={v.id} style={{ marginTop: 10 }}>
          <button type="button" className="btn btn-sm btn-ghost btn-wrap" aria-expanded={!!open[v.id]} onClick={() => setOpen((o) => ({ ...o, [v.id]: !o[v.id] }))}>
            {open[v.id] ? '▾' : '▸'} <span dir="ltr">{v.id}</span> — {B(v.title)} <span className="muted" dir="ltr">({v.table} · {v.fields.length})</span>
          </button>
          {open[v.id] && (
            <div className="rv-table-wrap" tabIndex={0}><table className="rv-table" style={{ minWidth: 0 }}>
              <thead><tr><th dir="ltr">{L('Original column', 'العمود الأصلي')}</th><th>{L('Meaning', 'المعنى')}</th><th>{L('Value', 'القيمة')}</th></tr></thead>
              <tbody>{v.fields.map((f) => <tr key={f.n}><td dir="ltr"><code>{f.n}</code></td><td dir="auto">{B(f.l)}</td><td dir="auto">{cell(f.v)}</td></tr>)}</tbody>
            </table></div>
          )}
        </div>
      ))}

      {sr.revenueLines?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button type="button" className="btn btn-sm btn-ghost btn-wrap" aria-expanded={!!open.__lines} onClick={() => setOpen((o) => ({ ...o, __lines: !o.__lines }))}>{open.__lines ? '▾' : '▸'} ENT_REVENUES — {L('Incorta revenue lines', 'بنود الإيراد في إنكورتا')} ({sr.revenueLines.length})</button>
          {open.__lines && (
            <div className="rv-table-wrap" tabIndex={0}><table className="rv-table" style={{ minWidth: 0 }}>
              <thead><tr><th dir="ltr">DETAIL_ID</th><th dir="ltr">ACCOUNT_NO</th><th>GFS</th><th className="num" dir="ltr">DETAIL_AMOUNT</th><th className="num" dir="ltr">TOTAL_AMOUNT</th><th>{L('Status', 'الحالة')}</th></tr></thead>
              <tbody>{sr.revenueLines.map((l) => <tr key={l.DETAIL_ID}><td dir="ltr">{l.DETAIL_ID}</td><td dir="ltr">{l.ACCOUNT_NO}</td><td dir="auto">{l.GFS_MAIN_CODE} · {l.GFS_NAME}</td><td className="num" dir="ltr">{sar(l.DETAIL_AMOUNT)}</td><td className="num muted" dir="ltr">{sar(l.TOTAL_AMOUNT)}</td><td>{l.PAYMENT_STATUS}</td></tr>)}</tbody>
            </table></div>
          )}
          <small className="muted">{L('TOTAL_AMOUNT repeats on every line (it is the invoice total, counted once); the sum of DETAIL_AMOUNT equals the invoice value.', 'يتكرر TOTAL_AMOUNT على كل بند (هو إجمالي الفاتورة ويُحتسب مرة)؛ ومجموع DETAIL_AMOUNT يساوي قيمة الفاتورة.')}</small>
        </div>
      )}

      {ids.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12 }}>{L(`Demo assumptions applied (${ids.length})`, `الافتراضات التجريبية المطبقة (${ids.length})`)}</summary>
          <ul className="rv-list" style={{ fontSize: 12 }}>{ASSUMPTIONS.filter((a) => ids.includes(a.id)).map((a) => <li key={a.id}><b dir="ltr">{a.id}</b> — <span dir="auto">{B(a.text)}</span></li>)}</ul>
          <small className="muted">{L('Not ministry-approved rules; editable in src/data/sourceAssumptions.js.', 'ليست قواعد معتمدة من الوزارة؛ وقابلة للتعديل في src/data/sourceAssumptions.js.')}</small>
        </details>
      )}
    </div>
  );
}
