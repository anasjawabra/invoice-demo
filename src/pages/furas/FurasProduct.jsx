import React from 'react';
import { Link } from 'react-router-dom';
import { useL } from '../../utils/bi';
import { useAsync } from '../../utils/useAsync';
import { furas } from '../../api/furasClient';
import { DatasetBanner, LimitsPanel, FurasOverview, NA } from '../../components/furas/FurasParts';

// The Furas product page in FURAS DATASET MODE: the contract and payment facts of the exports. Invoice-based KPIs need invoices, which the exports do not contain.
export default function FurasProduct() {
  const { L } = useL();
  const { data: S } = useAsync(() => furas.summary(), []);
  return (
    <div className="rv-page">
      <div className="page-head"><div>
        <h1 className="page-title">{L('Furas — investment contracts and payment schedule', 'فرص — العقود الاستثمارية وجدول الدفعات')} <span className="rv-badge rv-badge--sm rv-badge--ok">{L('Furas exports (local)', 'تصديرات فرص (محلية)')}</span></h1>
        <div className="page-sub">{L('What the six exports contain about contracts and payments, as stored.', 'ما تحويه التصديرات الستة عن العقود والدفعات كما هي.')} <Link to="/contracts">{L('Open the contract numbers', 'افتح أرقام العقود')}</Link></div>
      </div></div>
      <DatasetBanner S={S} />
      <LimitsPanel S={S} />
      <FurasOverview S={S} />
      <section className="rp-section"><h2 className="rp-h2">{L('Invoice-based indicators', 'مؤشرات الفواتير')}</h2>
        <div className="rp-limit">{L('Billed, collected, uncollected, collection rate, challenges and the largest uncollected invoices are computed from invoices. The exports contain no invoices.', 'المفوتر والمحصّل وغير المحصّل ونسبة التحصيل والتحديات وأكبر الفواتير غير المحصّلة تُحسب من الفواتير، والتصديرات لا تحوي فواتير.')} <NA /></div>
      </section>
    </div>
  );
}
