import React from 'react';
import { Link } from 'react-router-dom';
import { useL } from '../../utils/bi';
import { useDataMode } from '../../context/DataModeContext';
import { NA } from '../../components/furas/FurasParts';

// A page built on generated invoices, targets or enforcement orders, opened while the Furas dataset mode is selected.
export default function FurasUnavailable() {
  const { L } = useL(); const dm = useDataMode();
  return (
    <div className="rv-page"><div className="rp-state" role="status">
      <h1 className="page-title" style={{ fontSize: 22 }}><NA /></h1>
      <p>{L('This page is built from generated invoices, collection targets or enforcement orders. The Furas exports contain none of them, so nothing is shown here in Furas dataset mode.', 'هذه الصفحة مبنية على فواتير وأهداف تحصيل وأوامر تنفيذ مُولَّدة. التصديرات لا تحوي أياً منها، فلا يُعرض شيء هنا في وضع بيانات فرص.')}</p>
      <p>{L('Available in this mode:', 'المتاح في هذا الوضع:')} <Link to="/contracts">{L('Contracts', 'العقود')}</Link> · <Link to="/products/foras">{L('Furas product', 'منتج فرص')}</Link> · <Link to="/decisions">{L('Decision room', 'غرفة القرارات')}</Link></p>
      <button type="button" className="btn btn-sm btn-primary" onClick={() => dm.setMode('demo')}>{L('Switch to the generated demo', 'التبديل إلى العرض المُولَّد')}</button>
    </div></div>
  );
}
