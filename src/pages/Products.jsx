import React, { useMemo } from 'react';
import { RecordLink as Link } from '../utils/returnContext';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { ScopeBar } from '../components/revenue/RevenueUI';
import { PctBadge } from '../components/strategic/EntityMap';
import { PRODUCT_GROUPS } from '../data/iim';
import { groupId, groupName, groupTotals, mainChallenge } from '../data/productInsights';

// إدارة المنتجات (IIM-24): one card per billing product — figures from the shared KPI module and the main challenge in one line; each card opens the product.
export default function Products() {
  const rev = useRevenue(); const { snapshot } = rev; const { L, ar, lang, short, count } = useL();
  const targetRate = rev.targets?.collectionRate?.value ?? 0.6;
  const cards = useMemo(() => PRODUCT_GROUPS.map((keys) => ({ keys, id: groupId(keys), t: groupTotals(snapshot.byProduct, keys) })).filter((c) => c.t.count > 0), [snapshot]);
  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Product management', 'إدارة المنتجات')}</h1>
          <div className="page-sub">{L('Each billing product with its figures and its main challenge. Open a product for its challenges and invoices.', 'كل منتج فوترة بأرقامه وأهم تحدٍّ فيه. افتح المنتج لتحدياته وفواتيره.')}</div>
        </div>
      </div>
      <ScopeBar hideStatus />
      <div className="prod-grid">
        {cards.map((c) => (
          <Link key={c.id} to={`/products/${c.id}`} className="card card-pad prod-card" aria-label={groupName(c.keys, lang)}>
            <h2 className="prod-card__name">{groupName(c.keys, lang)}</h2>
            <dl className="prod-card__dl">
              <div><dt>{L('Billed', 'المفوتر')}</dt><dd dir="ltr">{short(c.t.gross)}</dd></div>
              <div><dt>{L('Collected', 'المحصّل')}</dt><dd dir="ltr">{short(c.t.collected)}</dd></div>
              <div><dt>{L('Uncollected', 'غير المحصّل')}</dt><dd dir="ltr">{short(c.t.uncollectedTotal)}</dd></div>
              <div><dt>{L('Collection rate', 'نسبة التحصيل')}</dt><dd>{c.t.rate == null ? '—' : <PctBadge kind="share" v={c.t.rate} text={`${(c.t.rate * 100).toFixed(1)}%`} />}</dd></div>
            </dl>
            <p className="prod-card__challenge"><b>{L('Main challenge', 'أهم تحدٍّ')}:</b> {mainChallenge(c.t, { targetRate, L })}</p>
            <small className="muted">{count(c.t.count)} {L('invoices', 'فاتورة')}</small>
          </Link>
        ))}
        {!cards.length && <div className="rv-empty">{L('No invoices in this selection.', 'لا فواتير في هذا الاختيار.')}</div>}
      </div>
      {ar && <p className="muted" style={{ fontSize: 12 }}>تجمع بطاقة «تبغ وإيواء» المنتجين معًا؛ ويبقيان منفصلين في فلتر اسم المنتج.</p>}
    </div>
  );
}
