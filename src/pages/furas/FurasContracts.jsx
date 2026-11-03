import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useL } from '../../utils/bi';
import { useAsync } from '../../utils/useAsync';
import { furas, furasUnavailable } from '../../api/furasClient';
import FurasUnavailable from './FurasUnavailable';
import FurasDecisionRoom from './FurasDecisionRoom';
import Pager from '../../components/Pager';
import { RecordState } from '../../components/record/RecordPage';
import { contractPath } from '../../utils/paths';
import { DatasetBanner, LimitsPanel, IntegrityChecks, FurasOverview } from '../../components/furas/FurasParts';
import { Chip, Icon, NaCell, StatStrip, Tabs } from '../../components/furas/FurasUI';
import { stored, storedOption, storedText, LITERAL_NOTE } from '../../data/furasLabels';

const EMPTY = { q: '', type: '', status: '', municipality: '', shape: '', severalRecords: false, conflicting: false, inPaymentExtract: false };
const PS = 25;
const CONFLICT_LABEL = { status: ['status', 'الحالة'], value: ['contract value', 'قيمة العقد'], annual: ['annual value', 'القيمة السنوية'], type: ['service type', 'نوع الخدمة'], endDate: ['end date', 'تاريخ النهاية'], municipality: ['Amanah', 'الأمانة'] };

// «Investment contracts» in FURAS DATASET MODE. The task comes first: find a contract NUMBER and open it. Evidence (coverage, limits, checks) sits one tab away.
export default function FurasContracts() {
  const { L, B, ar, count, sar } = useL();
  const nav = useNavigate(); const [sp, setSp] = useSearchParams();
  const tab = ['overview', 'limits', 'requests'].includes(sp.get('tab')) ? sp.get('tab') : 'contracts';
  const setTab = (k) => setSp(k === 'contracts' ? {} : { tab: k }, { replace: true });
  const [f, setF] = useState(EMPTY); const [page, setPage] = useState(0);
  const upd = (patch) => { setF((x) => ({ ...x, ...patch })); setPage(0); };
  const { data: S, error: sErr } = useAsync(() => furas.summary(), []);
  const body = useMemo(() => ({ q: f.q, page, pageSize: PS, filter: { type: f.type, status: f.status, municipality: f.municipality, shape: f.shape, severalRecords: f.severalRecords, conflicting: f.conflicting, inPaymentExtract: f.inPaymentExtract } }), [f, page]);
  const { data: list, loading, error } = useAsync(() => (tab === 'contracts' ? furas.contracts(body) : Promise.resolve(null)), [body, tab]);
  const active = [f.q && { k: 'q', label: `“${f.q}”` }, f.type && { k: 'type', label: storedText('type', f.type, ar) }, f.status && { k: 'status', label: storedText('status', f.status, ar) }, f.municipality && { k: 'municipality', label: S?.contracts.byMunicipality.find((m) => m.code === f.municipality)?.sourceName || f.municipality },
    f.shape && { k: 'shape', label: SHAPE[f.shape] },
    f.severalRecords && { k: 'severalRecords', label: L('Several records', 'عدة سجلات') }, f.conflicting && { k: 'conflicting', label: L('Conflicting records', 'سجلات متعارضة') }, f.inPaymentExtract && { k: 'inPaymentExtract', label: L('In the payment extract', 'في مستخرج الدفعات') }].filter(Boolean);
  const reset = (k) => upd({ [k]: EMPTY[k] });
  const SHAPE = { single: L('Single record', 'سجل واحد'), versions: L('One opportunity, several records', 'فرصة واحدة بعدة سجلات'), multi: L('Several opportunities', 'عدة فرص') };
  const c = S?.contracts; const p = S?.payments;
  const chips = (arr, kind) => (arr.length ? <span className="fu-chips" title={arr.map((x) => stored(kind, x.value, false).raw + (x.n ? ` ×${x.n}` : '')).join(' · ')}>{arr.slice(0, 2).map((x) => <Chip key={x.value} title={stored(kind, x.value, ar).translated ? x.value : undefined}>{storedText(kind, x.value, ar)}{x.n ? ` ×${x.n}` : ''}</Chip>)}{arr.length > 2 && <Chip tone="muted">+{arr.length - 2}</Chip>}</span> : <NaCell />);
  if (furasUnavailable(sErr) || furasUnavailable(error)) return <FurasUnavailable />;
  return (
    <div className="fu-page">
      <header className="fu-head"><div>
        <h1 className="fu-title">{L('Investment contracts', 'العقود الاستثمارية')} <Chip tone="ok">{L('Furas exports', 'تصديرات فرص')}</Chip></h1>
        <p className="fu-sub">{L('Contract numbers as recorded in the exports. A number can carry several records, and the data does not say which one is current.', 'أرقام العقود كما هي مسجّلة في التصديرات. قد يحمل الرقم عدة سجلات، ولا تحدد البيانات أيها الحالي.')}</p>
      </div></header>
      <DatasetBanner S={S} />
      {(sErr || error) && !S && <RecordState error={sErr || error} onRetry={() => window.location.reload()} kind={L('Contracts', 'العقود')} />}
      {S && <StatStrip items={[
        { label: L('Contract records', 'سجلات العقود'), value: count(c.records), sub: L('rows of the Contract view', 'صفوف عرض العقود') },
        { label: L('Distinct contract numbers', 'أرقام العقود المميزة'), value: count(c.distinctNumbers), sub: L('provisional count', 'عدّ مؤقت'), title: L('A number is not a record key, so this is not a count of current contracts.', 'الرقم ليس مفتاح سجل، فهذا ليس عدّاً للعقود الحالية.') },
        { label: L('Numbers with several records', 'أرقام لها عدة سجلات'), value: count(c.numbersWithSeveralRecords), sub: L(`${count(c.shapes.multi)} several opportunities · ${count(c.shapes.versions)} one opportunity · tap to filter`, `${count(c.shapes.multi)} عدة فرص · ${count(c.shapes.versions)} فرصة واحدة · اضغط للتصفية`), tone: 'warn', onClick: () => { setTab('contracts'); upd({ severalRecords: !f.severalRecords }); }, active: f.severalRecords },
        { label: L('Payment rows in the extract', 'صفوف الدفعات في المستخرج'), value: count(p.rows), sub: L(`${count(p.distinctNumbers)} numbers · limited sample · tap to filter`, `${count(p.distinctNumbers)} رقماً · عيّنة محدودة · اضغط للتصفية`), onClick: () => { setTab('contracts'); upd({ inPaymentExtract: !f.inPaymentExtract }); }, active: f.inPaymentExtract }
      ]} />}
      <Tabs label={L('Sections', 'الأقسام')} value={tab} onChange={setTab} tabs={[{ key: 'contracts', label: L('Contract numbers', 'أرقام العقود'), hint: c ? count(c.distinctNumbers) : null }, { key: 'overview', label: L('Dataset overview', 'نظرة على البيانات') }, { key: 'limits', label: L('Limits and checks', 'الحدود والفحوص') }, { key: 'requests', label: L('Data requests', 'طلبات البيانات') }]} />

      {tab === 'contracts' && (
        <div role="tabpanel" id="fu-panel-contracts" aria-labelledby="fu-tab-contracts" style={{ display: 'grid', gap: 12 }}>
          <div className="fu-tools" role="search">
            <div className="fu-tools__row">
              <label className="fu-search"><Icon name="search" /><span className="fu-sr">{L('Search a contract number', 'ابحث برقم العقد')}</span><input type="search" value={f.q} onChange={(e) => upd({ q: e.target.value })} placeholder={L('Search a contract number…', 'ابحث برقم العقد…')} dir="ltr" autoComplete="off" /></label>
              <select className="fu-select" aria-label={L('Service type', 'نوع الخدمة')} value={f.type} onChange={(e) => upd({ type: e.target.value })}><option value="">{L('All service types', 'كل أنواع الخدمة')}</option>{S?.contracts.byType.map((x) => <option key={x.value} value={x.value}>{storedOption('type', x.value, ar)}</option>)}</select>
              <select className="fu-select" aria-label={L('Status (as stored)', 'الحالة (كما هي)')} value={f.status} onChange={(e) => upd({ status: e.target.value })}><option value="">{L('All statuses', 'كل الحالات')}</option>{S?.contracts.byStatus.map((x) => <option key={x.value} value={x.value}>{storedOption('status', x.value, ar)}</option>)}</select>
              <select className="fu-select" aria-label={L('Structure', 'البنية')} value={f.shape} onChange={(e) => upd({ shape: e.target.value })}><option value="">{L('All structures', 'كل البنى')}</option>{['single', 'versions', 'multi'].map((k) => <option key={k} value={k}>{SHAPE[k]}{c ? ` (${count(c.shapes[k])})` : ''}</option>)}</select>
              <select className="fu-select" aria-label={L('Amanah (source)', 'الأمانة (المصدر)')} value={f.municipality} onChange={(e) => upd({ municipality: e.target.value })}><option value="">{L('All Amanahs', 'كل الأمانات')}</option>{S?.contracts.byMunicipality.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.sourceName}</option>)}</select>
            </div>
            <div className="fu-tools__row" role="group" aria-label={L('Quick filters', 'تصفية سريعة')}>
              <button type="button" className="fu-toggle" aria-pressed={f.severalRecords} onClick={() => upd({ severalRecords: !f.severalRecords })}><Icon name="layers" /> {L('Several records', 'عدة سجلات')}</button>
              <button type="button" className="fu-toggle" aria-pressed={f.conflicting} onClick={() => upd({ conflicting: !f.conflicting })}><Icon name="alert" /> {L('Conflicting records', 'سجلات متعارضة')}</button>
              <button type="button" className="fu-toggle" aria-pressed={f.inPaymentExtract} onClick={() => upd({ inPaymentExtract: !f.inPaymentExtract })}><Icon name="table" /> {L('In the payment extract', 'في مستخرج الدفعات')}</button>
            </div>
            <div className="fu-tools__meta">
              <span role="status" aria-live="polite"><b>{list ? count(list.total) : '…'}</b> {L('contract numbers', 'رقم عقد')}{active.length > 0 && <> · {L('filtered', 'بعد التصفية')}</>}</span>
              {active.length > 0 && <span className="fu-chips">{active.map((a) => <button key={a.k} type="button" className="fu-chip fu-chip--info" style={{ cursor: 'pointer' }} onClick={() => reset(a.k)} aria-label={L(`Remove filter ${a.label}`, `إزالة الفلتر ${a.label}`)}>{a.label} <Icon name="x" /></button>)}<button type="button" className="fu-link" onClick={() => { setF(EMPTY); setPage(0); }}>{L('Clear all', 'مسح الكل')}</button></span>}
            </div>
          </div>

          <div className="fu-list" role="table" aria-label={L('Contract numbers', 'أرقام العقود')} aria-busy={loading}>
            <div className="fu-list__head" role="row">
              {[L('Contract number', 'رقم العقد'), L('Service type', 'نوع الخدمة'), L('Status (as stored)', 'الحالة (كما هي)'), L('Amanah (source)', 'الأمانة (المصدر)'), L('Contract value', 'قيمة العقد'), L('Signals', 'إشارات')].map((h, i) => <div key={h} role="columnheader" style={i === 4 ? { textAlign: 'end' } : undefined}>{h}</div>)}
            </div>
            {!list && loading && Array.from({ length: 8 }, (_, i) => <div key={i} className="fu-skel" aria-hidden="true" />)}
            {list?.rows.map((r) => {
              const conflictKeys = Object.keys(r.conflicts).filter((k) => r.conflicts[k]);
              return (
                <div key={r.no} className="fu-row" role="row" onClick={(e) => { if (!e.target.closest('a')) nav(contractPath(r.no)); }}>
                  <div role="cell" data-col="no" className="fu-cell"><Link className="fu-no" to={contractPath(r.no)} dir="ltr">{r.no}</Link>{r.shape !== 'single' && <> <Chip tone="info" icon="layers" title={SHAPE[r.shape]}>{r.shape === 'multi' ? L(`${r.opportunities} opportunities · ${r.records} records`, `${r.opportunities} فرص · ${r.records} سجلات`) : L(`1 opportunity · ${r.records} records`, `فرصة واحدة · ${r.records} سجلات`)}</Chip></>}</div>
                  <div role="cell" data-col="type" className="fu-cell">{chips(r.types.map((t) => ({ value: t.value })), 'type')}</div>
                  <div role="cell" data-col="status" className="fu-cell">{chips(r.statuses.map((s) => ({ value: s.value, n: r.statuses.length > 1 ? s.records : 0 })), 'status')}</div>
                  <div role="cell" data-col="amanah" className="fu-cell">{r.municipalities.length ? r.municipalities.map((m) => <span key={m.code} style={{ display: 'block' }}><bdi>{m.sourceName}</bdi><small dir="ltr">{m.code}</small></span>) : <NaCell />}</div>
                  <div role="cell" data-col="value" className="fu-cell fu-cell--num" dir="ltr">{r.contractValue.state === 'none' ? <NaCell /> : r.contractValue.state === 'conflict' ? <Chip tone="warn" icon="alert" title={L('Records disagree; no value is chosen', 'السجلات متعارضة؛ ولا تُختار قيمة')}>{L(`${r.contractValue.distinct} values`, `${r.contractValue.distinct} قيم`)}</Chip> : sar(r.contractValue.value)}</div>
                  <div role="cell" data-col="signals" className="fu-cell"><span className="fu-chips">
                    {conflictKeys.length > 0 && <Chip tone="warn" icon="alert" title={L('Records differ on: ', 'تختلف السجلات في: ') + conflictKeys.map((k) => B({ en: CONFLICT_LABEL[k][0], ar: CONFLICT_LABEL[k][1] })).join(ar ? '، ' : ', ')}>{L('Differ', 'متعارضة')}</Chip>}
                    {r.paymentRowsInExtract > 0 && <Chip tone="info" icon="table" title={L('Payment rows for this number in the limited extract', 'صفوف دفعات لهذا الرقم في المستخرج المحدود')}>{count(r.paymentRowsInExtract)}</Chip>}
                    {conflictKeys.length === 0 && r.paymentRowsInExtract === 0 && <span className="fu-na fu-dot">·</span>}
                  </span></div>
                </div>);
            })}
            {list && !list.rows.length && <div className="fu-empty"><b>{L('No contract number matches.', 'لا رقم عقد مطابق.')}</b><div>{L('Try fewer filters or a shorter search.', 'جرّب تصفية أقل أو بحثاً أقصر.')}</div>{active.length > 0 && <button type="button" className="fu-link" onClick={() => { setF(EMPTY); setPage(0); }}>{L('Clear all filters', 'مسح كل الفلاتر')}</button>}</div>}
            <div className="fu-legend"><NaCell /> {L('= Not available in the current data. “×n” after a status = n records with that status. Values are as stored; nothing is generated.', `= غير متاح في البيانات الحالية. «×n» بعد الحالة = n سجلاً بهذه الحالة. القيم كما هي؛ ولا يُولَّد شيء. ${LITERAL_NOTE.ar}`)}</div>
          </div>
          <Pager page={page} total={list?.total || 0} size={PS} onPage={setPage} />
        </div>)}

      {tab === 'overview' && <div role="tabpanel" id="fu-panel-overview" aria-labelledby="fu-tab-overview" style={{ display: 'grid', gap: 16 }}>{S ? <FurasOverview S={S} /> : <div className="muted" role="status">{L('Reading the local exports…', 'جارٍ قراءة التصديرات المحلية…')}</div>}</div>}
      {tab === 'requests' && <div role="tabpanel" id="fu-panel-requests" aria-labelledby="fu-tab-requests"><FurasDecisionRoom embedded /></div>}
      {tab === 'limits' && S && (
        <div role="tabpanel" id="fu-panel-limits" aria-labelledby="fu-tab-limits" className="fu-grid" style={{ alignItems: 'start' }}>
          <section className="fu-card"><h2>{L('What these exports support — and what they do not', 'ما تدعمه هذه التصديرات — وما لا تدعمه')}</h2><LimitsPanel S={S} /></section>
          <section className="fu-card"><h2>{L('Integrity checks computed from the files', 'فحوص السلامة المحسوبة من الملفات')}</h2><IntegrityChecks S={S} /></section>
        </div>)}
    </div>
  );
}
