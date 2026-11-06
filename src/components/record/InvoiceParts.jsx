// The invoice page's own building blocks: the compact financial summary, grouped facts, and an in-page section navigation.
import React from 'react';
import { useL } from '../../utils/bi';
import { fmtDateText } from '../../data/clock';
import { pctColor } from '../strategic/PctScale';
import { EXCLUSION_REASON_OF_RULE } from '../../data/iim';

const pc = (v) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;

// The compact financial summary at the top of the invoice page: invoice amount, collected amount and the remaining unpaid amount (net of nothing else: exclusions, cancellation and overpayment are stated apart),
// with the issue, due and payment dates beside them. The statuses (payment / enforcement / review) are in the header and are never repeated here.
export function InvoiceSummary({ der, rec, im, pf, sar, L, ar }) {
  const value = der.gross; const share = value > 0 ? Math.min(der.collected / value, 1) : 0;
  const unpaid = der.excluded ? der.exclusionAmount : der.outstanding; // the unpaid part of the invoice as the source states it: an excluded invoice is still unpaid — the exclusion only takes it out of the collectible base
  const late = unpaid > 0 && der.daysOverdue > 0;
  const date = (d) => (d ? fmtDateText(d, ar ? 'ar' : 'en') : '—');
  const ex = im?.exclusion;
  return (
    <section className="ip-card is-sum" aria-label={L('Financial summary', 'الملخص المالي')}>
      <dl className="is-sum__row">
        <div><dt>{L('Invoice amount', 'مبلغ الفاتورة')}</dt><dd dir="ltr">{sar(value)}</dd></div>
        <div><dt>{L('Collected', 'المحصّل')}</dt><dd dir="ltr">{sar(der.collected)}</dd></div>
        <div className={unpaid > 0 ? (late ? 'is-bad' : '') : ''}><dt>{L('Remaining unpaid', 'المتبقي غير المسدد')}</dt><dd dir="ltr">{sar(unpaid)}</dd>{der.excluded && <dd className="ex-banner__s">{L('excluded from the collectible base', 'مستبعد من القابل للتحصيل')}</dd>}</div>
        <div><dt>{L('Issue date', 'تاريخ الإصدار')}</dt><dd dir="ltr">{date(rec.issueDate)}</dd></div>
        <div><dt>{L('Due date', 'تاريخ الاستحقاق')}</dt><dd dir="ltr">{date(rec.dueDate)}</dd></div>
        <div><dt>{L('Payment date', 'تاريخ السداد')}</dt><dd dir="ltr">{date(im?.paidDate)}</dd></div>
      </dl>
      <div className="ip-bar" role="img" aria-label={L(`Collected ${pc(share)} of the invoice amount`, `المحصّل ${pc(share)} من مبلغ الفاتورة`)}>
        <i className="ip-bar__paid" style={{ width: `${share * 100}%`, background: pctColor('share', share) || undefined }} />{value > 0 && share < 1 && <i className={`ip-bar__left${late ? ' ip-bar__left--late' : ''}`} style={{ width: `${(1 - share) * 100}%` }} />}
      </div>
      {(der.overpayment > 0 || der.cancelled) && <dl className="ip-sub">
        {der.cancelled && <div><dt>{L('Cancelled in the source', 'ملغاة في المصدر')}</dt><dd>{L('yes', 'نعم')}</dd></div>}
        {der.overpayment > 0 && <div><dt>{L('Paid above the invoice amount', 'مدفوع فوق مبلغ الفاتورة')}</dt><dd dir="ltr">{sar(der.overpayment)}</dd></div>}
      </dl>}
    </section>
  );
}

// «سبب الاستبعاد» — ONE compact banner on an excluded invoice (the same invoice page as every other invoice): the effective reason, the amount excluded beside the original invoice amount,
// and the other applicable reasons on demand. It states that the payment status is unchanged; the evidence and the history stay in the sections below.
export function ExclusionBanner({ der, im, reasons, uploadedFile, sar, L, ar }) {
  const ex = im?.exclusion; if (!ex || !(der.exclusionsTotal > 0)) return null;
  const others = (reasons || []).filter((id) => id !== ex.ruleId).map((id) => EXCLUSION_REASON_OF_RULE[id]).filter(Boolean);
  return (
    <section className="ip-card ex-banner" aria-label={L('Exclusion reason', 'سبب الاستبعاد')}>
      <div className="ex-banner__main">
        <div><span className="ex-banner__k">{L('Exclusion reason', 'سبب الاستبعاد')}</span><b className="ex-banner__v">{ar ? ex.reasonAr : ex.reasonEn}</b></div>
        <div><span className="ex-banner__k">{L('Excluded amount', 'المبلغ المستبعد')}</span><b className="ex-banner__v" dir="ltr">{sar(der.exclusionsTotal)}</b><span className="ex-banner__s">{L('of the invoice amount', 'من مبلغ الفاتورة')} <span dir="ltr">{sar(der.gross)}</span></span></div>
        {ex.sourceAr && <div><span className="ex-banner__k">{L('Source of the exclusion', 'مصدر الاستبعاد')}</span><b className="ex-banner__v">{ar ? ex.sourceAr : ex.sourceEn}</b>{uploadedFile && <span className="ex-banner__s" dir="ltr">{uploadedFile}</span>}</div>}
      </div>
      <div className="ex-banner__note">{L('The exclusion does not change the payment status; the invoice stays as the source states it.', 'الاستبعاد لا يغيّر حالة السداد؛ وتبقى الفاتورة كما يذكرها المصدر.')}</div>
      {others.length > 0 && (
        <details className="ex-more">
          <summary>{L(`${others.length} other applicable reason(s)`, `${others.length} سبب آخر منطبق`)}</summary>
          <ul>{others.map((r) => <li key={r.ruleId}>{ar ? r.ar : r.en}</li>)}</ul>
          <div className="muted" style={{ fontSize: 12 }}>{L('The amount is excluded once, under the effective reason above.', 'يُستبعد المبلغ مرة واحدة تحت السبب الفعلي أعلاه.')}</div>
        </details>
      )}
    </section>
  );
}

export function InfoGroups({ groups }) {
  return (
    <div className="ip-groups">
      {groups.filter((g) => g && g.items.some(Boolean)).map((g) => (
        <section key={g.title} className="ip-card ip-group" aria-label={g.title}>
          <h2 className="ip-h">{g.title}</h2>
          <dl className="ip-dl">{g.items.filter(Boolean).map((x, i) => <div key={i}><dt>{x.k}</dt><dd dir={x.ltr ? 'ltr' : 'auto'}>{x.v}</dd></div>)}</dl>
        </section>
      ))}
    </div>
  );
}

// in-page navigation: jump to a section instead of scrolling a long page
export function SectionNav({ items, label }) {
  return (
    <nav className="ip-nav" aria-label={label}>
      {items.filter(Boolean).map((x) => <a key={x.id} href={`#${x.id}`} onClick={(e) => { const el = document.getElementById(x.id); if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (el.tagName === 'SECTION') el.querySelector('details')?.setAttribute('open', ''); } }}>{x.label}{x.count != null ? <span className="rp-count">{x.count}</span> : null}</a>)}
    </nav>
  );
}
