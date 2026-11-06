import React, { useEffect, useMemo, useState } from 'react';
import useGate from '../../components/access/useGate';
import { Link, useNavigate } from 'react-router-dom';
import { useL } from '../../utils/bi';
import { useAsync } from '../../utils/useAsync';
import { furas, furasUnavailable } from '../../api/furasClient';
import FurasUnavailable from './FurasUnavailable';
import Pager from '../../components/Pager';
import { RecordState } from '../../components/record/RecordPage';
import { contractPath } from '../../utils/paths';
import { readListMemory, writeListMemory, useShouldRestore } from '../../utils/returnContext';
import { LocalFilterToolbar, useUrlFilters } from '../../components/filters';
import { contractFields, contractFilterBody, sanitizeValues, CONTRACT_KEYS, CONTRACT_DEFAULTS } from '../../components/filters/localPages';
import { Chip, Icon, NaCell } from '../../components/furas/FurasUI';
import { stored, storedOption, storedText } from '../../data/furasLabels';
import { contractsCsvRows, csvText } from '../../data/furasExport';

const PS = 25;
export const downloadCsv = (name, rows) => { const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };

// «Investment contracts»: one row per contract NUMBER (a number is not a record key). Number, opportunity name, investor, status, dates and the contract value with its meaning.
export default function FurasContracts() {
  const { L, ar, count, sar } = useL();
  const nav = useNavigate();
  const restore = useShouldRestore(); const mem = useMemo(() => readListMemory('furas-contracts', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const xg = useGate('export.contracts'); // the CSV needs contracts.export
  const [page, setPage] = useState(mem.page ?? 0);
  useEffect(() => { writeListMemory('furas-contracts', { page }); }, [page]);
  const { data: S, error: sErr } = useAsync(() => furas.summary(), []);
  const scoped = S ? !!S.dataset.scope : true; // approved contracts only: the stored contract status is then one value, so it is not offered as a filter
  // every filter lives in the URL (Back / return from a contract restores it); only the options the data really supports are offered
  const fields = useMemo(() => contractFields({
    scoped, amanahs: (S?.contracts.byMunicipality || []).map((m) => ({ code: m.code, name: m.sourceName })),
    rentals: (S?.contracts.byRental || []).map((x) => ({ value: x.value, label: storedOption('rental', x.value, ar) })),
    types: (S?.contracts.byType || []).map((x) => ({ value: x.value, label: storedOption('type', x.value, ar) })),
    statuses: (S?.contracts.byStatus || []).map((x) => ({ value: x.value, label: storedOption('status', x.value, ar) }))
  }), [S, scoped, ar]);
  const url = useUrlFilters({ keys: CONTRACT_KEYS, defaults: CONTRACT_DEFAULTS });
  const f = useMemo(() => sanitizeValues(fields, url.values), [fields, url.values]);
  const setF = (patch) => { url.setValues(patch); setPage(0); };
  const filter = useMemo(() => contractFilterBody(f, scoped), [f, scoped]);
  const body = useMemo(() => ({ q: f.q, page, pageSize: PS, filter }), [f.q, page, filter]);
  const { data: list, loading, error } = useAsync(() => furas.contracts(body), [body]);
  const exportAll = async () => { const all = await furas.contracts({ q: f.q, all: true, filter }); downloadCsv(ar ? 'العقود-الاستثمارية.csv' : 'investment-contracts.csv', contractsCsvRows(all.rows, ar)); };
  const qChip = f.q.trim() ? [{ key: 'q', label: L('Search', 'بحث'), value: f.q.trim(), onRemove: () => setF({ q: '' }) }] : [];
  if (furasUnavailable(sErr) || furasUnavailable(error)) return <FurasUnavailable />;
  const sub = S?.dataset.subset;
  const money = (x) => (x.state === 'single' ? <span dir="ltr">{sar(x.value)}</span> : x.state === 'conflict' ? <Chip tone="warn" icon="alert" title={L('The records of this number disagree; no value is chosen', 'سجلات هذا الرقم متعارضة؛ ولا تُختار قيمة')}>{L('Records differ', 'سجلات متعارضة')}</Chip> : <NaCell />);
  const date = (x) => (x.state === 'single' ? <><span dir="ltr">{x.value}</span>{x.flag && <> <Chip tone="warn" icon="alert" title={L('Shown as stored; the year looks implausible and is to be validated (nothing is converted)', 'تُعرض كما هي؛ السنة تبدو غير معقولة وتحتاج تحققاً (دون تحويل)')}>{L('to validate', 'للتحقق')}</Chip></>}</> : x.state === 'differs' ? <Chip tone="warn" icon="alert" title={L('The records of this number disagree', 'سجلات هذا الرقم متعارضة')}>{L('Records differ', 'سجلات متعارضة')}</Chip> : <NaCell />);
  return (
    <div className="fu-page">
      <header className="fu-head"><div>
        <h1 className="fu-title">{L('Investment contracts', 'العقود الاستثمارية')}{sub && <Chip tone="warn" icon="alert" title={L(`A scenario subset of ${sub.contracts} contract numbers chosen to cover cases, not a sample of Furas: counts and values describe only these contracts.`, `عيّنة سيناريوهات من ${sub.contracts} رقم عقد لتغطية الحالات، وليست عيّنة ممثِّلة لفرص: الأعداد والقيم تخص هذه العقود فقط.`)}>{L('Scenario subset', 'عيّنة سيناريوهات')}</Chip>}</h1>
        <p className="fu-sub">{L('Approved contracts, one row per contract number. Open a contract to see its investor and installments.', 'العقود المعتمدة، صف لكل رقم عقد. افتح العقد لعرض المستثمر والدفعات.')}</p>
      </div></header>
      {(sErr || error) && !S && <RecordState error={sErr || error} onRetry={() => window.location.reload()} kind={L('Contracts', 'العقود')} />}

      <LocalFilterToolbar fields={fields} values={f} onChange={setF} onClear={() => { url.setValues(CONTRACT_DEFAULTS); setPage(0); }} extraChips={qChip} label={L('Filters', 'التصفية')}
        search={{ value: f.q, onChange: (x) => setF({ q: x }), label: L('Search', 'بحث'), placeholder: L('Contract no., opportunity no. or name', 'رقم العقد أو الفرصة أو الاسم') }}
        actions={<button type="button" className="fu-toggle" onClick={exportAll} disabled={!list?.total || !xg.allowed} title={xg.reason || undefined}><Icon name="table" /> {L('Export CSV', 'تصدير CSV')}</button>}
        resultCount={<><b>{list ? count(list.total) : '…'}</b> {L('contracts', 'عقد')}</>} />

      <div className="fu-list" role="table" aria-label={L('Investment contracts', 'العقود الاستثمارية')} aria-busy={loading}>
        <div className="fu-list__head" role="row">
          {[L('Contract number', 'رقم العقد'), L('Opportunity name', 'اسم الفرصة'), L('Investor', 'المستثمر'), L('Status', 'الحالة'), L('Start → end', 'البداية ← النهاية'), L('Contract value', 'قيمة العقد')].map((h, i) => <div key={h} role="columnheader" style={i === 5 ? { textAlign: 'end' } : undefined}>{h}</div>)}
        </div>
        {!list && loading && Array.from({ length: 8 }, (_, i) => <div key={i} className="fu-skel" aria-hidden="true" />)}
        {list?.rows.map((r) => (
          <div key={r.no} className="fu-row" role="row" onClick={(e) => { if (!e.target.closest('a')) nav(contractPath(r.no)); }}>
            <div role="cell" data-col="no" className="fu-cell"><Link className="fu-no" to={contractPath(r.no)} dir="ltr">{r.no}</Link>
              {r.opportunities > 1 && <small>{L(`${r.opportunities} opportunities`, `${r.opportunities} فرص`)}</small>}</div>
            <div role="cell" data-col="name" className="fu-cell">{r.name.state === 'none' ? <NaCell /> : <bdi>{r.name.value}</bdi>}{r.name.state === 'several' && <small>{L(`+${r.name.distinct - 1} more`, `+${r.name.distinct - 1} أخرى`)}</small>}</div>
            <div role="cell" data-col="investor" className="fu-cell">{r.investors.length ? <><span dir="ltr">{r.investors[0].masked}</span>{r.investors.length > 1 && <small>{L(`+${r.investors.length - 1} more`, `+${r.investors.length - 1} أخرى`)}</small>}{r.investors.some((i) => !i.found) && <small>{L('Investor record not found', 'سجل المستثمر غير موجود')}</small>}</> : <NaCell />}</div>
            <div role="cell" data-col="status" className="fu-cell">{r.executionStatuses.length ? <span className="fu-chips">{r.executionStatuses.slice(0, 2).map((s) => <Chip key={s.value} title={stored('rental', s.value, ar).translated ? s.value : undefined}>{storedText('rental', s.value, ar)}</Chip>)}</span> : <NaCell />}
              {!S?.dataset.scope && r.statuses.length > 0 && <small>{r.statuses.map((s) => storedText('status', s.value, ar)).join(' · ')}</small>}</div>
            <div role="cell" data-col="dates" className="fu-cell">{date(r.start)}<small>{r.end.state === 'single' || r.end.state === 'differs' ? <>→ {date(r.end)}</> : <>→ <NaCell /></>}</small></div>
            <div role="cell" data-col="value" className="fu-cell fu-cell--num" dir="ltr">{money(r.contractValue)}
              {r.annualValue.state !== 'none' && <small>{L('Annual', 'سنوياً')} {r.annualValue.state === 'single' ? sar(r.annualValue.value) : L('records differ', 'سجلات متعارضة')}</small>}
              {r.valueWithVat.state !== 'none' && <small>{L('Incl. VAT', 'شاملة الضريبة')} {r.valueWithVat.state === 'single' ? sar(r.valueWithVat.value) : L('records differ', 'سجلات متعارضة')}</small>}</div>
          </div>))}
        {list && !list.rows.length && <div className="fu-empty"><b>{L('No contract matches.', 'لا عقد مطابق.')}</b><div>{L('Try fewer filters or a shorter search.', 'جرّب تصفية أقل أو بحثاً أقصر.')}</div><button type="button" className="fu-link" onClick={() => { url.setValues(CONTRACT_DEFAULTS); setPage(0); }}>{L('Clear filters', 'مسح الفلاتر')}</button></div>}
        <div className="fu-legend"><NaCell /> {L('= Not available in the current data. Contract value is the stored total (its VAT basis is not stated); the annual value and the value including VAT are separate stored fields and are not added to it. When the records of a number disagree, no value is chosen.', '= غير متاح في البيانات الحالية. قيمة العقد هي الإجمالي المخزَّن (أساس الضريبة غير محدد)، والقيمة السنوية والقيمة شاملة الضريبة حقلان مخزَّنان منفصلان ولا تُضافان إليه. عند تعارض سجلات الرقم لا تُختار قيمة.')}</div>
      </div>
      <Pager page={page} total={list?.total || 0} size={PS} onPage={setPage} />
    </div>
  );
}
