import React, { useMemo } from 'react';
import { RecordLink as Link } from '../utils/returnContext';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { ScopeBar } from '../components/revenue/RevenueUI';
import { PctBadge } from '../components/strategic/EntityMap';
import { PRODUCT_CATALOG, catalogGroups } from '../data/productCatalog';
import { catalogTotals, remainderTotals, mainChallenge } from '../data/productInsights';

// إدارة المنتجات — the catalogue of products and data systems (Balady and the other platforms). Systems that issue invoices show their figures from the shared KPI module and their main challenge; the others are
// supporting data (no invoices of their own) and show what they provide and how far their integration is. The figures are the simulated demo data; the integration status is as listed for the real sources.
const TONE = { ok: 'rv-tag', part: 'rv-tag rv-tag--warn', todo: 'rv-tag rv-tag--bad' };

function Figures({ t, targetRate, L, short, count }) {
  return (
    <>
      <dl className="prod-card__dl">
        <div><dt>{L('Billed', 'المفوتر')}</dt><dd dir="ltr">{short(t.gross)}</dd></div>
        <div><dt>{L('Collected', 'المحصّل')}</dt><dd dir="ltr">{short(t.collected)}</dd></div>
        <div><dt>{L('Uncollected', 'غير المحصّل')}</dt><dd dir="ltr">{short(t.uncollectedTotal)}</dd></div>
        <div><dt>{L('Collection rate', 'نسبة التحصيل')}</dt><dd>{t.rate == null ? '—' : <PctBadge kind="share" v={t.rate} text={`${(t.rate * 100).toFixed(1)}%`} />}</dd></div>
      </dl>
      <p className="prod-card__challenge"><b>{L('Main challenge', 'أهم تحدٍّ')}:</b> {mainChallenge(t, { targetRate, L })}</p>
      <small className="muted">{count(t.count)} {L('invoices', 'فاتورة')}</small>
    </>
  );
}

export default function Products() {
  const rev = useRevenue(); const { snapshot } = rev; const { L, B, short, count } = useL();
  const targetRate = rev.targets?.collectionRate?.value ?? 0.6;
  const groups = useMemo(() => catalogGroups(), []);
  const totals = useMemo(() => Object.fromEntries(PRODUCT_CATALOG.filter((i) => i.filter).map((i) => [i.id, catalogTotals(snapshot, i)])), [snapshot]);
  const rest = useMemo(() => remainderTotals(snapshot, PRODUCT_CATALOG), [snapshot]);
  const card = (it) => {
    const t = totals[it.id]; const inv = it.kind === 'invoices';
    const head = (
      <>
        <h2 className="prod-card__name">{B(it.name)} <span className={inv ? 'rv-tag' : 'rv-tag rv-tag--warn'}>{inv ? L('Invoices', 'فواتير') : L('Supporting data', 'بيانات مساندة')}</span></h2>
        <p className="prod-card__desc" dir="auto">{B(it.desc)}</p>
        {it.status && <p className="prod-card__status"><span className={TONE[it.status.tone]}>{L('Integration', 'الربط')}</span> <span dir="auto">{B(it.status.text)}</span></p>}
        {inv && t && (t.count > 0 ? <Figures t={t} targetRate={targetRate} L={L} short={short} count={count} /> : <small className="muted">{L('No invoices in this selection.', 'لا فواتير في هذا الاختيار.')}</small>)}
      </>
    );
    return inv && t && t.count > 0
      ? <Link key={it.id} to={`/products/${it.id}`} className="card card-pad prod-card" aria-label={B(it.name)}>{head}</Link>
      : <div key={it.id} className="card card-pad prod-card prod-card--static" role="group" aria-label={B(it.name)}>{head}</div>;
  };
  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Product management', 'إدارة المنتجات')}</h1>
          <div className="page-sub">{L('The products and data systems behind the invoices. Systems that issue invoices show their figures and main challenge; the others are supporting data.', 'المنتجات والأنظمة التي تقوم عليها الفواتير. ما يُصدر فواتير يعرض أرقامه وأهم تحدٍّ فيه، وغيره بيانات مساندة.')}</div>
        </div>
      </div>
      <ScopeBar hideStatus />

      <h2 className="h3 prod-section">{L('Balady', 'بلدي')}</h2>
      <div className="prod-grid">{groups.balady.map(card)}</div>

      <h2 className="h3 prod-section">{L('Other platforms and systems', 'منصات وأنظمة أخرى')}</h2>
      <div className="prod-grid">{groups.other.map(card)}</div>

      {rest.count > 0 && (
        <>
          <h2 className="h3 prod-section">{L('Invoices not in a card above', 'فواتير خارج البطاقات أعلاه')}</h2>
          <div className="prod-grid"><div className="card card-pad prod-card prod-card--static" role="group">
            <p className="prod-card__desc">{L('Residential-sector sales and investment invoices issued from the Amanahs\' own systems. Shown so that the cards add up to the whole.', 'مبيعات قطاع الإسكان وفواتير الاستثمار الصادرة من الأنظمة الداخلية للأمانات. تُعرض ليكتمل مجموع البطاقات.')}</p>
            <Figures t={rest} targetRate={targetRate} L={L} short={short} count={count} />
          </div></div>
        </>
      )}
    </div>
  );
}
