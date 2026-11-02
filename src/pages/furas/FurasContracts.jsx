import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useL } from '../../utils/bi';
import { useAsync } from '../../utils/useAsync';
import { furas } from '../../api/furasClient';
import Pager from '../../components/Pager';
import { RecordState } from '../../components/record/RecordPage';
import { contractPath } from '../../utils/paths';
import { DatasetBanner, LimitsPanel, IntegrityChecks, FurasOverview, NA, Tag } from '../../components/furas/FurasParts';

// «Investment contracts» in FURAS DATASET MODE: one row per DISTINCT contract number, with how many records carry it. Values come from the exports; nothing is generated.
export default function FurasContracts() {
  const { L, ar, count, sar } = useL();
  const [q, setQ] = useState(''); const [page, setPage] = useState(0); const [f, setF] = useState({ type: '', status: '', municipality: '', severalRecords: false, conflicting: false, inPaymentExtract: false });
  const { data: S, error: sErr } = useAsync(() => furas.summary(), []);
  const body = useMemo(() => ({ q, page, pageSize: 25, filter: Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }), [q, page, f]);
  const { data: list, loading, error } = useAsync(() => furas.contracts(body), [body]);
  useEffect(() => setPage(0), [q, f]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <div className="rv-page">
      <div className="page-head"><div>
        <h1 className="page-title">{L('Investment contracts', 'العقود الاستثمارية')} <span className="rv-badge rv-badge--sm rv-badge--ok">{L('Furas exports (local)', 'تصديرات فرص (محلية)')}</span></h1>
        <div className="page-sub">{L('Contract records and the payment rows of the exports, as stored. One row below is one distinct contract number; a number can carry several records and the current record is not determined.', 'سجلات العقود وصفوف الدفعات في التصديرات كما هي. الصف أدناه رقم عقد مميز؛ وقد يحمل الرقم عدة سجلات والسجل الحالي غير محدد.')}</div>
      </div></div>
      {(sErr || error) && !S && <RecordState error={sErr || error} onRetry={() => window.location.reload()} kind={L('Contracts', 'العقود')} />}
      {!S && !sErr && <div className="muted" role="status">{L('Reading the local exports…', 'جارٍ قراءة التصديرات المحلية…')}</div>}
      <DatasetBanner S={S} />
      <LimitsPanel S={S} />
      <FurasOverview S={S} />
      <IntegrityChecks S={S} />
      {S && (
        <section className="rp-section" aria-label={L('Contract numbers', 'أرقام العقود')}>
          <div className="dr-filters" role="search">
            <label className="cg-field" htmlFor="fc-q">{L('Search a contract number', 'ابحث برقم العقد')}<input id="fc-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} dir="ltr" /></label>
            <label className="cg-field" htmlFor="fc-type">{L('Service type', 'نوع الخدمة')}<select id="fc-type" className="input" value={f.type} onChange={set('type')}><option value="">{L('All', 'الكل')}</option>{S.contracts.byType.map((x) => <option key={x.value} value={x.value}>{x.value}</option>)}</select></label>
            <label className="cg-field" htmlFor="fc-status">{L('Status (as stored)', 'الحالة (كما هي)')}<select id="fc-status" className="input" value={f.status} onChange={set('status')}><option value="">{L('All', 'الكل')}</option>{S.contracts.byStatus.map((x) => <option key={x.value} value={x.value}>{x.value}</option>)}</select></label>
            <label className="cg-field" htmlFor="fc-muni">{L('Amanah (source)', 'الأمانة (المصدر)')}<select id="fc-muni" className="input" value={f.municipality} onChange={set('municipality')}><option value="">{L('All', 'الكل')}</option>{S.contracts.byMunicipality.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.sourceName}</option>)}</select></label>
            <label className="cg-field" htmlFor="fc-multi"><span><input id="fc-multi" type="checkbox" checked={f.severalRecords} onChange={set('severalRecords')} /> {L('Several records', 'عدة سجلات')}</span></label>
            <label className="cg-field" htmlFor="fc-conf"><span><input id="fc-conf" type="checkbox" checked={f.conflicting} onChange={set('conflicting')} /> {L('Conflicting records', 'سجلات متعارضة')}</span></label>
            <label className="cg-field" htmlFor="fc-pay"><span><input id="fc-pay" type="checkbox" checked={f.inPaymentExtract} onChange={set('inPaymentExtract')} /> {L('Has payment rows in the extract', 'لها صفوف دفعات في المستخرج')}</span></label>
          </div>
          <div className="muted" role="status" style={{ fontSize: 12 }}>{list ? L(`${count(list.total)} contract numbers`, `${count(list.total)} رقم عقد`) : loading ? L('Loading…', 'جارٍ التحميل…') : ''}</div>
          <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Contract numbers', 'أرقام العقود')}>
            <thead><tr><th>{L('Contract number', 'رقم العقد')}</th><th className="num">{L('Records', 'السجلات')}</th><th>{L('Service type (as stored)', 'نوع الخدمة (كما هو)')}</th><th>{L('Status (as stored)', 'الحالة (كما هي)')}</th><th>{L('Amanah (source)', 'الأمانة (المصدر)')}</th><th className="num">{L('Contract value', 'قيمة العقد')}</th><th className="num">{L('Payment rows in the extract', 'صفوف الدفعات في المستخرج')}</th></tr></thead>
            <tbody>{(list?.rows || []).map((r) => (
              <tr key={r.no}>
                <td><Link to={contractPath(r.no)} dir="ltr"><b>{r.no}</b></Link></td>
                <td className="num" dir="ltr">{count(r.records)}{r.records > 1 && <> <Tag tone="proposed">{L('several', 'متعدد')}</Tag></>}</td>
                <td dir="auto">{r.types.map((t) => t.value).join(' · ') || <NA />}{r.conflicts.type && <> <Tag tone="proposed">{L('differs', 'مختلف')}</Tag></>}</td>
                <td dir="auto">{r.statuses.map((s) => (r.statuses.length > 1 ? `${s.value} (${s.records})` : s.value)).join(' · ') || <NA />}{r.conflicts.status && <> <Tag tone="proposed">{L('differs', 'مختلف')}</Tag></>}</td>
                <td dir="auto">{r.municipalities.map((m) => `${m.code} · ${m.sourceName}`).join(' · ') || <NA />}</td>
                <td className="num" dir="ltr">{r.contractValue.state === 'none' ? <NA /> : r.contractValue.state === 'conflict' ? <Tag tone="proposed">{L(`${r.contractValue.distinct} different values across records`, `${r.contractValue.distinct} قيم مختلفة بين السجلات`)}</Tag> : sar(r.contractValue.value)}</td>
                <td className="num" dir="ltr">{count(r.paymentRowsInExtract)}</td>
              </tr>))}
              {list && !list.rows.length && <tr><td colSpan={7}><div className="rv-empty">{L('No contract number matches.', 'لا رقم عقد مطابق.')}</div></td></tr>}</tbody>
          </table></div>
          <Pager page={page} total={list?.total || 0} size={25} onPage={setPage} />
        </section>
      )}
    </div>
  );
}
