// The invoice page's own building blocks: a money panel (amounts and how much of the net billed is collected), a payment panel (the payment date, how it
// compares with the due date, and a timeline from issue to the reference date), grouped facts, and an in-page section navigation.
import React from 'react';
import { daysBetween } from '../../data/revenueLedger';
import { useL } from '../../utils/bi';
import { fmtDateText } from '../../data/clock';
import { pctColor } from '../strategic/EntityMap';

const pc = (v) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;

// amounts first: net billed, collected and remaining as ONE bar, with gross and exclusions as the small print that explains the net
export function MoneyPanel({ der, sar, L }) {
  const net = der.net; const share = net > 0 ? Math.min(der.collected / net, 1) : 0;
  const late = der.outstanding > 0 && der.daysOverdue > 0;
  return (
    <section className="ip-card ip-money" aria-label={L('Financial summary', 'الملخص المالي')}>
      <h2 className="ip-h">{L('Financial summary', 'الملخص المالي')}</h2>
      <div className="ip-money__row">
        <div><span className="ip-k">{L('Net billed', 'صافي المفوتر')}</span><b className="ip-big" dir="ltr">{sar(net)}</b></div>
        <div><span className="ip-k">{L('Collected', 'المحصّل')}</span><b className="ip-big" dir="ltr">{sar(der.collected)}</b></div>
        <div><span className="ip-k">{L('Remaining balance', 'الرصيد المتبقي')}</span><b className={`ip-big${late ? ' ip-bad' : ''}`} dir="ltr">{sar(der.outstanding)}</b></div>
      </div>
      <div className="ip-bar" role="img" aria-label={L(`Collected ${pc(share)} of net billed`, `المحصّل ${pc(share)} من صافي المفوتر`)}>
        <i className="ip-bar__paid" style={{ width: `${share * 100}%`, background: pctColor('share', share) || undefined }} />{net > 0 && share < 1 && <i className={`ip-bar__left${late ? ' ip-bar__left--late' : ''}`} style={{ width: `${(1 - share) * 100}%` }} />}
      </div>
      <div className="ip-bar__cap"><span>{L('Collected', 'المحصّل')} <b dir="ltr">{pc(share)}</b></span>{net > 0 && <span>{L('Remaining', 'المتبقي')} <b dir="ltr">{pc(1 - share)}</b></span>}</div>
      <dl className="ip-sub">
        <div><dt>{L('Gross billed', 'إجمالي المفوتر')}</dt><dd dir="ltr">{sar(der.gross)}</dd></div>
        <div><dt>{L('Exclusions', 'الاستبعادات')}</dt><dd dir="ltr">{sar(der.exclusionsTotal)}</dd></div>
        {der.overpayment > 0 && <div><dt>{L('Paid above billed', 'مدفوع فوق المفوتر')}</dt><dd dir="ltr">{sar(der.overpayment)}</dd></div>}
      </dl>
    </section>
  );
}

// the payment date, stated plainly first; then the dates that explain it and a timeline of the invoice's life
export function PaymentPanel({ pf, rec, today, ar, sar, L }) {
  const dt = (d) => fmtDateText(d, ar ? 'ar' : 'en');
  const days = (n) => L(`${n} day${n === 1 ? '' : 's'}`, `${n} ${n === 1 ? 'يوم' : n === 2 ? 'يومان' : n >= 3 && n <= 10 ? 'أيام' : 'يوماً'}`);
  const off = (n) => (n < 0 ? L(`${days(-n)} before the due date`, `قبل الاستحقاق بـ ${days(-n)}`) : n > 0 ? L(`${days(n)} after the due date`, `بعد الاستحقاق بـ ${days(n)}`) : L('on the due date', 'في يوم الاستحقاق'));
  let head; let tone; let line;
  if (pf.state === 'settled') { head = L(`Fully paid on ${dt(pf.settled)}`, `سُدّدت بالكامل في ${dt(pf.settled)}`); tone = pf.settledOffset > 0 ? 'late' : 'ok'; line = `${off(pf.settledOffset)}${pf.daysFromIssue != null ? ` · ${L(`${days(pf.daysFromIssue)} after issue`, `بعد ${days(pf.daysFromIssue)} من الإصدار`)}` : ''}`; }
  else if (pf.state === 'partial') { head = L(`Partly paid — last payment ${dt(pf.last)}`, `سُدّدت جزئياً — آخر دفعة ${dt(pf.last)}`); tone = pf.daysOverdue > 0 ? 'late' : 'warn'; line = `${L('Remaining', 'المتبقي')} ${sar(pf.remaining)}${pf.daysOverdue > 0 ? ` · ${L(`overdue ${days(pf.daysOverdue)}`, `متأخرة ${days(pf.daysOverdue)}`)}` : ''}`; }
  else if (pf.state === 'unpaid') { head = L(`No payment up to ${dt(today)}`, `لا يوجد سداد حتى ${dt(today)}`); tone = pf.daysOverdue > 0 ? 'late' : 'neutral'; line = pf.daysOverdue > 0 ? L(`Overdue ${days(pf.daysOverdue)}`, `متأخرة ${days(pf.daysOverdue)} عن الاستحقاق`) : L(`Due in ${days(pf.daysToDue)}`, `تستحق بعد ${days(pf.daysToDue)}`); }
  else { head = pf.state === 'cancelled' ? L('Cancelled — not counted for collection', 'ملغاة — لا تُحتسب للتحصيل') : L('Excluded — not counted for collection', 'مستبعدة — لا تُحتسب للتحصيل'); tone = 'neutral'; line = pf.count ? L(`${pf.count} payment(s) are recorded and shown below, but they are not counted as collected.`, `سُجّلت ${pf.count} دفعة وتظهر أدناه، لكنها لا تُحتسب محصّلة.`) : L('No payment is recorded.', 'لا توجد دفعات مسجلة.'); }

  // timeline: issue → due → payments → reference date, placed by date
  const marks = [{ d: rec.issueDate, t: 'issue' }, { d: rec.dueDate, t: 'due' }, ...pf.rows.map((r) => ({ d: r.date, t: 'pay', r })), { d: today, t: 'ref' }].filter((m) => m.d);
  const min = rec.issueDate; const max = [today, pf.last, rec.dueDate].filter(Boolean).sort().pop();
  const span = Math.max(daysBetween(min, max), 1); const at = (d) => Math.min(Math.max((daysBetween(min, d) / span) * 100, 0), 100);
  const endDate = pf.state === 'settled' ? pf.settled : today;
  const lateFrom = rec.dueDate && endDate > rec.dueDate && (pf.state !== 'settled' || pf.settledOffset > 0) && pf.state !== 'cancelled' && pf.state !== 'excluded';
  return (
    <section className="ip-card ip-pay" aria-label={L('Payment date', 'تاريخ السداد')}>
      <h2 className="ip-h">{L('Payment date', 'تاريخ السداد')}</h2>
      <div className={`ip-pay__head ip-pay__head--${tone}`} role="status"><b>{head}</b><span>{line}</span></div>
      <div className="ip-track" aria-hidden="true">
        <i className="ip-track__line" />
        <i className="ip-track__seg ip-track__seg--life" style={{ insetInlineStart: 0, width: `${at(rec.dueDate)}%` }} />
        {lateFrom && <i className="ip-track__seg ip-track__seg--late" style={{ insetInlineStart: `${at(rec.dueDate)}%`, width: `${Math.max(at(endDate) - at(rec.dueDate), 0)}%` }} />}
        {marks.map((m, i) => <i key={i} className={`ip-mark ip-mark--${m.t}`} style={{ insetInlineStart: `${at(m.d)}%` }} title={`${{ issue: L('Issued', 'الإصدار'), due: L('Due', 'الاستحقاق'), pay: L('Payment', 'دفعة'), ref: L('Reference date', 'تاريخ المرجع') }[m.t]}: ${dt(m.d)}${m.r ? ` · ${sar(m.r.amount)}` : ''}`} />)}
      </div>
      <ul className="ip-legend">
        <li><i className="ip-mark ip-mark--issue" /> {L('Issued', 'الإصدار')} <b>{dt(rec.issueDate)}</b></li>
        <li><i className="ip-mark ip-mark--due" /> {L('Due', 'الاستحقاق')} <b>{dt(rec.dueDate)}</b></li>
        {pf.first && <li><i className="ip-mark ip-mark--pay" /> {L('First payment', 'أول دفعة')} <b>{dt(pf.first)}</b></li>}
        {pf.last && pf.last !== pf.first && <li><i className="ip-mark ip-mark--pay" /> {pf.state === 'settled' ? L('Last payment', 'آخر دفعة') : L('Last payment', 'آخر دفعة')} <b>{dt(pf.last)}</b></li>}
        {pf.settled && <li><i className="ip-mark ip-mark--paid" /> {L('Fully paid', 'تاريخ السداد الكامل')} <b>{dt(pf.settled)}</b></li>}
        <li><i className="ip-mark ip-mark--ref" /> {L('Reference date', 'تاريخ المرجع')} <b>{dt(today)}</b></li>
      </ul>
    </section>
  );
}

// grouped facts: every fact belongs to ONE group so the eye knows where to look
export function InfoGroups({ groups }) {
  return (
    <div className="ip-groups">
      {groups.map((g) => (
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
