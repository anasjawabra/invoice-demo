// The approved relationships made visible: gross billed splits into exclusions + net billed; net billed splits into collected + uncollected.
// Both bars share ONE scale (share of gross billed) and the second bar sits under the "net billed" segment, so collected and uncollected
// read as parts of net billed and exclusions as a deduction from gross — never as independent totals.
import React from 'react';
import { useL, ratioText } from '../../utils/bi';
import { unitOfValues } from '../../utils/money';

export default function FinancialRelations({ totals: T }) {
  const { L, ar, money, sar } = useL();
  const u = unitOfValues([T.gross, T.exclusions, T.net, T.collected, T.outstanding]); // the five amounts share ONE unit
  const short = (v) => money(v, u);
  if (!(T.gross > 0)) return <div className="rv-na">{L('Gross billed is zero for this selection — the relationships are not available.', 'إجمالي المفوتر صفر لهذا الاختيار — العلاقات غير متاحة.')}</div>;
  const p = (v) => `${Math.max(0, (v / T.gross) * 100)}%`;
  const Seg = ({ cls, w, title, amount, extra }) => (
    <div className={`rv-rel__seg rv-rel__seg--${cls}`} style={{ width: p(w), flex: 'none' }} title={`${title}: ${sar(amount)}`}>
      {w / T.gross >= 0.07 && title ? <><span>{title}</span><small dir="ltr">{short(amount)}{extra ? ` · ${extra}` : ''}</small></> : null}
    </div>
  );
  const canc = T.cancelled; const rules = Math.max(0, T.exclusions - T.cancelled);
  return (
    <div className="rv-rel" role="group" aria-label={L('Financial relationships', 'العلاقات المالية')}>
      <div className="rv-rel__cap"><span>{L('Gross billed', 'إجمالي المفوتر')} <b dir="ltr">{short(T.gross)}</b> = {L('exclusions', 'الاستبعادات')} <b dir="ltr">{short(T.exclusions)}</b> + {L('net billed', 'صافي المفوتر')} <b dir="ltr">{short(T.net)}</b></span></div>
      <div className="rv-rel__row">
        {T.exclusions > 0 && <Seg cls="cancel" w={canc} title={L('Cancelled', 'ملغى')} amount={canc} />}
        {T.exclusions > 0 && <Seg cls="excl" w={rules} title={L('Approved rules', 'قواعد معتمدة')} amount={rules} />}
        <Seg cls="net" w={T.net} title={L('Net billed', 'صافي المفوتر')} amount={T.net} />
      </div>
      <div className="rv-rel__row" aria-label={L('Net billed splits into collected and uncollected', 'صافي المفوتر = المحصّل + غير المحصّل')}>
        {T.exclusions > 0 && <Seg cls="gap" w={T.exclusions} title="" amount={T.exclusions} />}
        <Seg cls="coll" w={T.collected} title={L('Collected', 'المحصّل')} amount={T.collected} extra={ratioText(T.collectedOverNet, ar)} />
        <Seg cls="unc" w={T.outstanding} title={L('Uncollected', 'غير المحصّل')} amount={T.outstanding} />
      </div>
      <div className="rv-rel__cap">
        <span>{L('Net billed', 'صافي المفوتر')} <b dir="ltr">{short(T.net)}</b> = {L('collected', 'المحصّل')} <b dir="ltr">{short(T.collected)}</b> + {L('uncollected', 'غير المحصّل')} <b dir="ltr">{short(T.outstanding)}</b></span>
        <span>{L('Collection rate', 'نسبة التحصيل')} <b dir="ltr">{ratioText(T.collectedOverNet, ar)}</b></span>
        <span>{L('Exclusion rate', 'نسبة الاستبعاد')} <b dir="ltr">{ratioText(T.exclusionRate, ar)}</b></span>
      </div>
    </div>
  );
}
