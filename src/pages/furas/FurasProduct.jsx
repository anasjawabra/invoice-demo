import React from 'react';
import { Link } from 'react-router-dom';
import { useL } from '../../utils/bi';
import { useAsync } from '../../utils/useAsync';
import { furas } from '../../api/furasClient';
import { DatasetBanner, LimitsPanel, FurasOverview } from '../../components/furas/FurasParts';
import { Chip, NaCell } from '../../components/furas/FurasUI';

// The Furas product page in FURAS DATASET MODE: the contract and payment facts of the exports. Invoice-based KPIs need invoices, which the exports do not contain.
export default function FurasProduct() {
  const { L } = useL();
  const { data: S } = useAsync(() => furas.summary(), []);
  return (
    <div className="fu-page">
      <header className="fu-head"><div>
        <h1 className="fu-title">{L('Furas — investment contracts and payment schedule', 'فرص — العقود الاستثمارية وجدول الدفعات')} <Chip tone="ok">{L('Furas exports', 'تصديرات فرص')}</Chip></h1>
        <p className="fu-sub">{L('What the six exports contain about contracts and payments, as stored.', 'ما تحويه التصديرات الستة عن العقود والدفعات كما هي.')} <Link to="/contracts">{L('Open the contract numbers', 'افتح أرقام العقود')}</Link></p>
      </div></header>
      <DatasetBanner S={S} />
      <FurasOverview S={S} />
      {S && <section className="fu-card"><h2>{L('What these exports support — and what they do not', 'ما تدعمه هذه التصديرات — وما لا تدعمه')}</h2><LimitsPanel S={S} /></section>}
      <section className="fu-card"><h2>{L('Invoice-based indicators', 'مؤشرات الفواتير')}</h2>
        <p>{L('Billed, collected, uncollected, collection rate, challenges and the largest uncollected invoices are computed from invoices. The exports contain no invoices.', 'المفوتر والمحصّل وغير المحصّل ونسبة التحصيل والتحديات وأكبر الفواتير غير المحصّلة تُحسب من الفواتير، والتصديرات لا تحوي فواتير.')} <NaCell full /></p></section>
    </div>
  );
}
