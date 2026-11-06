import React from 'react';
import useGate from '../../components/access/useGate';
import { Link, useParams } from 'react-router-dom';
import { useL } from '../../utils/bi';
import { useAsync } from '../../utils/useAsync';
import { furas, furasUnavailable } from '../../api/furasClient';
import FurasUnavailable from './FurasUnavailable';
import { RecordState } from '../../components/record/RecordPage';
import { Chip, Icon, NaCell } from '../../components/furas/FurasUI';
import { stored, storedText } from '../../data/furasLabels';
import { installmentsCsvRows } from '../../data/furasExport';
import { downloadCsv } from './FurasContracts';

const FLAG = { out_of_range: ['to validate (out of range)', 'للتحقق (خارج النطاق)'], epoch: ['to validate (1970)', 'للتحقق (1970)'], hijri_like: ['to validate (Hijri-like year, not converted)', 'للتحقق (سنة تشبه الهجرية، دون تحويل)'], after_extract: ['to validate (after the extract date)', 'للتحقق (بعد تاريخ الاستخراج)'], unreadable: ['unreadable', 'غير مقروء'] };
const DATE_FLAG_KEY = { awardingDate: 'awardingdate', signingDate: 'signingdate', startDate: 'startdate', endDate: 'enddate' };
// The contract fields, grouped. Each is its own stored field: they are never converted into one another (a total, an annual amount and a VAT-inclusive amount are different things).
const GROUPS = [
  { g: ['Contract', 'العقد'], rows: [['opportunityNumber', 'Opportunity number', 'رقم الفرصة'], ['opportunityName', 'Opportunity name', 'اسم الفرصة'], ['contractType', 'Service type', 'نوع الخدمة']] },
  { g: ['Statuses (kept separate)', 'الحالات (منفصلة)'], rows: [['status', 'Contract status — approval (as stored)', 'حالة العقد — الاعتماد (كما هي)'], ['rentalStatus', 'Execution status', 'حالة التنفيذ'], ['renewalStatus', 'Renewal status', 'حالة التجديد']] },
  { g: ['Dates', 'التواريخ'], rows: [['awardingDate', 'Awarding', 'الترسية'], ['signingDate', 'Signing', 'التوقيع'], ['startDate', 'Start', 'البداية'], ['endDate', 'End', 'النهاية'], ['handoverPlanned', 'Handover (planned)', 'التسليم (المخطط)'], ['handoverActual', 'Handover (actual)', 'التسليم (الفعلي)']] },
  { g: ['Values (SAR)', 'القيم (ريال)'], rows: [['contractValue', 'Contract value — total (VAT basis not stated)', 'قيمة العقد — الإجمالية (أساس الضريبة غير محدد)', 'money'], ['annualValue', 'Annual value', 'القيمة السنوية', 'money'], ['valueWithVat', 'Total value including VAT', 'القيمة الإجمالية شاملة الضريبة', 'money'], ['calculatedValue', 'Calculated value (system-computed)', 'القيمة المحسوبة (من النظام)', 'money'], ['durationMonths', 'Duration in months', 'المدة بالأشهر'], ['term', 'Term (as stored)', 'المدة (كما هي)']] },
  { g: ['Location', 'الموقع'], rows: [['municipality', 'Amanah (source)', 'الأمانة (المصدر)'], ['subMunicipality', 'Sub-municipality', 'البلدية الفرعية']] },
  { g: ['Renewal', 'التجديد'], rows: [['primaryLink', 'Original contract', 'العقد الأصلي'], ['renewalLink', 'Renewal contract', 'عقد التجديد']] }
];
const empty = (v) => v == null || v === '';
const STORED_FIELD = { contractType: 'type', status: 'status', rentalStatus: 'rental', renewalStatus: 'renewal' };
const todayIso = () => new Date().toISOString().slice(0, 10);

// One contract NUMBER: its information, investor, the actual installments (Payment rows) and the contract-level invoice references. Nothing is generated; an unavailable value says so.
export default function FurasContract() {
  const { no: raw } = useParams(); const no = decodeURIComponent(raw || '');
  const { L, B, ar, count, sar } = useL();
  const xg = useGate('export.contracts'); // the CSV needs contracts.export
  const { data: c, loading, error } = useAsync(() => furas.contract(no), [no]);
  const { data: S, error: sErr } = useAsync(() => furas.summary(), []);
  if (furasUnavailable(sErr) || furasUnavailable(error)) return <FurasUnavailable />;
  if (!c) return <div className="fu-page"><nav className="fu-crumb" aria-label="breadcrumb"><Link to="/contracts">{L('Investment contracts', 'العقود الاستثمارية')}</Link> › <span dir="ltr">{no}</span></nav><RecordState loading={loading && !error} error={error && error.status !== 404 ? error : null} notFound={!loading && error?.status === 404} kind={L('Contract', 'العقد')} /></div>;

  const recs = c.records; const multi = recs.length > 1; const today = todayIso();
  const date = (v, flag) => (empty(v) ? <NaCell /> : <><span dir="ltr">{v}</span>{flag && <> <Chip tone="warn" icon="alert">{B({ en: FLAG[flag][0], ar: FLAG[flag][1] })}</Chip></>}</>);
  const link = (v) => (v == null ? <NaCell /> : !v.resolved ? (v.outsideSubset ? <Chip tone="warn" icon="alert" title={L('The link points to a record that exists in the full export but was not included in this subset.', 'الرابط يشير إلى سجل موجود في التصدير الكامل لكنه غير مضمَّن في هذه العيّنة.')}>{L('related record outside this subset', 'سجل مرتبط خارج هذه العيّنة')}</Chip> : L('target record not found', 'السجل المستهدف غير موجود')) : v.selfReference ? <Chip tone="warn" icon="alert">{L('points to itself — to review', 'يشير إلى نفسه — للمراجعة')}</Chip> : <span dir="ltr">{v.contractNumber}{v.sameContractNumber ? ` (${L('same number', 'الرقم نفسه')})` : ''}</span>);
  const cell = (r, k, kind) => {
    const v = r[k];
    if (k === 'municipality') return v ? <>{v.sourceName}{v.flag && <> <Chip tone="warn" icon="alert">{L('entity scope to be confirmed', 'نطاق الجهة بانتظار التأكيد')}</Chip></>}</> : <NaCell />;
    if (k === 'renewalLink' || k === 'primaryLink') return link(v);
    if (DATE_FLAG_KEY[k]) return date(v, r.dateFlags[DATE_FLAG_KEY[k]]);
    if (k.startsWith('handover')) return date(v);
    if (empty(v)) return <NaCell />;
    if (STORED_FIELD[k]) { const s = stored(STORED_FIELD[k], v, ar); return <span dir="auto" title={s.translated ? s.raw : undefined}>{s.text}</span>; }
    if (kind === 'money') return <span dir="ltr">{sar(v)}</span>;
    return <span dir="auto">{String(v)}</span>;
  };
  const allEmpty = (k) => recs.every((r) => empty(r[k]));
  const groups = GROUPS.map((gr) => ({ ...gr, rows: gr.rows.filter(([k]) => !allEmpty(k)) })).filter((gr) => gr.rows.length);
  const absent = GROUPS.flatMap((gr) => gr.rows).filter(([k]) => allEmpty(k)).map(([, en, arb]) => B({ en, ar: arb }));
  const uniq = (k) => [...new Set(recs.map((r) => r[k]).filter((x) => !empty(x)))];
  const chips = (arr, kind) => (arr.length ? <span className="fu-chips">{arr.map((x) => <Chip key={x} tone={arr.length > 1 ? 'warn' : 'value'} title={stored(kind, x, ar).translated ? x : undefined}>{storedText(kind, x, ar)}</Chip>)}</span> : <NaCell full />);
  const names = uniq('opportunityName'); const amanahs = [...new Map(recs.filter((r) => r.municipality).map((r) => [r.municipality.code, r.municipality])).values()];
  const label = ([, en, arb]) => B({ en, ar: arb });
  const diff = (k) => multi && new Set(recs.map((r) => JSON.stringify(r[k]))).size > 1;

  // installments, grouped by the opportunity their Payment row names; a row names ONE opportunity, so it is listed once
  const pays = c.payments.rows; const byOpp = [...new Set(pays.map((p) => p.opportunityNumber))];
  const showOppHeader = byOpp.length > 1;
  const upcoming = (p) => !p.dateFlags.dueDate && p.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) && p.dueDate > today;
  const amt = (v) => (v == null ? <NaCell /> : <span dir="ltr">{sar(v)}</span>);
  const bills = c.bills;

  return (
    <div className="fu-page">
      <nav className="fu-crumb" aria-label="breadcrumb"><Link to="/contracts">{L('Investment contracts', 'العقود الاستثمارية')}</Link> <span aria-hidden="true">›</span> <span dir="ltr">{c.contractNumber}</span></nav>
      <header className="fu-hero">
        <div className="fu-hero__top">
          <h1 dir="ltr">{c.contractNumber}</h1>
          {chips(uniq('rentalStatus'), 'rental')}
        </div>
        <dl className="fu-hero__facts">
          <div><dt>{L('Opportunity name', 'اسم الفرصة')}</dt><dd>{names.length ? names.map((n) => <div key={n}><bdi>{n}</bdi></div>) : <NaCell full />}</dd></div>
          <div><dt>{L('Amanah (source)', 'الأمانة (المصدر)')}</dt><dd>{amanahs.length ? amanahs.map((m) => <div key={m.code}>{m.sourceName}</div>) : <NaCell full />}</dd></div>
          <div><dt>{L('Investor (masked)', 'المستثمر (مقنّع)')}</dt><dd>{c.investor.ids.length ? c.investor.ids.map((i) => <div key={i.masked} dir="ltr">{i.masked}</div>) : <NaCell full />}</dd></div>
        </dl>
        {c.scope && c.scope.hiddenRecords > 0 && <div className="fu-callout fu-callout--info" role="note"><Icon name="info" /><span>{L(`Approved contracts only: ${c.scope.hiddenRecords} other record${c.scope.hiddenRecords > 1 ? 's' : ''} with this number ${c.scope.hiddenRecords > 1 ? 'have' : 'has'} another status and ${c.scope.hiddenRecords > 1 ? 'are' : 'is'} not shown.`, `العقود المعتمدة فقط: ${c.scope.hiddenRecords} سجل آخر بهذا الرقم بحالة مختلفة وغير معروض.`)}</span></div>}
      </header>

      <section className="fu-sec" aria-labelledby="h-info">
        <div className="fu-sec__head"><h2 id="h-info">{L('Contract information', 'بيانات العقد')}</h2></div>
        {multi && <p className="fu-sub" style={{ margin: 0 }}>{L(`${c.recordCount} records carry this number; fields that differ are marked and no record is chosen as current.`, `${c.recordCount} سجلات تحمل هذا الرقم؛ تُعلَّم الحقول المختلفة ولا يُختار سجل حالي.`)}</p>}
        {multi ? (
          <div className="fu-matrix-wrap" tabIndex={0} role="region" aria-label={L('Records side by side', 'السجلات جنباً إلى جنب')}>
            <table className="fu-matrix">
              <thead><tr><th scope="col">{L('Field', 'الحقل')}</th>{recs.map((r, i) => <th key={i} scope="col">{L(`Record ${i + 1}`, `السجل ${i + 1}`)}{r.opportunityNumber && <span className="fu-rec" dir="ltr">{r.opportunityNumber}</span>}</th>)}</tr></thead>
              <tbody>{groups.map((gr) => (<React.Fragment key={gr.g[0]}>
                <tr className="fu-group"><th colSpan={recs.length + 1} scope="colgroup">{B({ en: gr.g[0], ar: gr.g[1] })}</th></tr>
                {gr.rows.map((row) => <tr key={row[0]} className={diff(row[0]) ? 'is-diff' : ''}><th scope="row">{label(row)}{diff(row[0]) && <span className="fu-sr"> — {L('differs between records', 'يختلف بين السجلات')}</span>}</th>{recs.map((r, i) => <td key={i}>{cell(r, row[0], row[3])}</td>)}</tr>)}
              </React.Fragment>))}</tbody>
            </table>
          </div>
        ) : (
          <div className="fu-info">{groups.map((gr) => (
            <div key={gr.g[0]} className="fu-info__group"><h3>{B({ en: gr.g[0], ar: gr.g[1] })}</h3>
              <dl className="fu-kv">{gr.rows.map((row) => <div key={row[0]}><dt>{label(row)}</dt><dd>{cell(recs[0], row[0], row[3])}</dd></div>)}</dl></div>))}</div>
        )}
        {absent.length > 0 && <div className="fu-absent"><NaCell full /><span>{L('for ' + (multi ? 'every record' : 'this record') + ':', (multi ? 'في كل سجل' : 'في هذا السجل') + ':')}</span>{absent.map((a) => <Chip key={a} tone="muted">{a}</Chip>)}</div>}
      </section>

      <section className="fu-sec" aria-labelledby="h-inv">
        <div className="fu-sec__head"><h2 id="h-inv">{L('Investor', 'المستثمر')}</h2></div>
        <dl className="fu-kv">
          <div><dt>{L('Investor name', 'اسم المستثمر')}</dt><dd><NaCell full /></dd></div>
          {c.investor.ids.map((i, k) => <div key={i.masked}><dt>{L('Investor ID (masked)', 'رقم المستثمر (مقنّع)')}{c.investor.ids.length > 1 ? ` ${k + 1}` : ''}</dt><dd><span dir="ltr">{i.masked}</span>{!i.found && <> <Chip tone="warn" icon="alert">{L('investor record not found', 'سجل المستثمر غير موجود')}</Chip></>}</dd></div>)}
        </dl>
      </section>

      <section className="fu-sec" aria-labelledby="h-pay">
        <div className="fu-sec__head"><h2 id="h-pay">{L('Installments', 'الدفعات')} <span className="fu-count">{c.payments.rowsInExtract}</span></h2>
          {pays.length > 0 && <button type="button" className="fu-toggle" disabled={!xg.allowed} title={xg.reason || undefined} onClick={() => downloadCsv(`${c.contractNumber}-${ar ? 'الدفعات' : 'installments'}.csv`, installmentsCsvRows(pays, ar))}><Icon name="table" /> {L('Export CSV', 'تصدير CSV')}</button>}</div>
        {pays.length ? (
          <div className="fu-tablewrap"><table className="fu-pay" aria-label={L('Installments', 'الدفعات')}>
            <thead><tr><th>{L('Batch', 'الدفعة')}</th><th>{L('Type', 'النوع')}</th><th>{L('Due date', 'الاستحقاق')}</th><th>{L('Invoice date', 'تاريخ الفاتورة')}</th><th className="num">{L('Payable', 'المستحق')}</th><th className="num">{L('Paid', 'المسدد')}</th><th className="num">{L('Outstanding', 'المتبقي')}</th><th>{L('Status (as stored)', 'الحالة (كما هي)')}</th></tr></thead>
            <tbody>{byOpp.map((o) => (
              <React.Fragment key={String(o)}>
                {showOppHeader && <tr className="fu-group"><th colSpan={8} scope="colgroup">{L('Opportunity', 'الفرصة')} <span dir="ltr">{o ?? '—'}</span></th></tr>}
                {pays.filter((p) => p.opportunityNumber === o).map((p, i) => (
                  <tr key={`${o}-${i}`} className={upcoming(p) ? 'is-future' : undefined}>
                    <td data-label={L('Batch', 'الدفعة')}><b dir="ltr">{p.batchNumber ?? '—'}</b><small dir="ltr">{[p.batchYear, p.batchMonths ? `${p.batchMonths} ${ar ? 'شهر' : 'mo'}` : null, p.batchEndDate ? `→ ${p.batchEndDate}` : null].filter(Boolean).join(' · ')}</small></td>
                    <td data-label={L('Type', 'النوع')}>{p.paymentType || <NaCell />}<small>{p.method || ''}</small></td>
                    <td data-label={L('Due date', 'الاستحقاق')}>{date(p.dueDate, p.dateFlags.dueDate)}{upcoming(p) && <small>{L('Upcoming', 'قادمة')}</small>}</td>
                    <td data-label={L('Invoice date', 'تاريخ الفاتورة')}>{date(p.invoiceDate, p.dateFlags.invoiceDate)}</td>
                    <td className="num" data-label={L('Payable', 'المستحق')} dir="ltr">{amt(p.payable)}{p.vatAmount != null && <small>{L('VAT', 'الضريبة')} {sar(p.vatAmount)}</small>}</td>
                    <td className="num" data-label={L('Paid', 'المسدد')} dir="ltr">{amt(p.paid)}</td>
                    <td className="num" data-label={L('Outstanding', 'المتبقي')} dir="ltr">{amt(p.outstanding)}</td>
                    <td data-label={L('Status', 'الحالة')}>{p.status ? <Chip title={stored('payStatus', p.status, ar).translated ? p.status : undefined}>{storedText('payStatus', p.status, ar)}</Chip> : <NaCell />}{p.paymentDate && <small>{L('Payment date', 'تاريخ السداد')} {date(p.paymentDate, p.dateFlags.paymentDate)}</small>}</td>
                  </tr>))}
              </React.Fragment>))}</tbody>
          </table>
          <div className="fu-legend"><NaCell /> {L('= Not available in the current data. Payable is the amount payable for the batch, not a collected amount; paid and outstanding are shown only where the batch fields are filled, and an empty value is never read as unpaid. VAT is a separate stored field and is not added to the payable amount.', '= غير متاح في البيانات الحالية. المستحق هو المبلغ المستحق للدفعة وليس مبلغاً محصَّلاً؛ ويُعرض المسدد والمتبقي فقط حيث تُملأ حقول الدفعة، ولا تُعدّ القيمة الفارغة غير مسددة. الضريبة حقل مخزَّن منفصل ولا تُضاف إلى المستحق.')}</div></div>
        ) : <div className="fu-callout" role="note"><Icon name="info" /><span>{L('No installment rows for this contract in the available data. That is not evidence that none exist.', 'لا صفوف دفعات لهذا العقد في البيانات المتاحة. وهذا ليس دليلاً على عدم وجودها.')}</span></div>}
      </section>

      <section className="fu-sec" aria-labelledby="h-bills">
        <div className="fu-sec__head"><h2 id="h-bills">{L('Invoices', 'الفواتير')}</h2></div>
        {bills.refs.length > 0 ? (
          <ul className="fu-bills">{bills.refs.map((b) => <li key={b.number}><span dir="ltr">{b.number}</span><span className="muted">{b.views.join(' · ')}</span></li>)}</ul>
        ) : bills.numbersNotRetained > 0 ? (
          <p className="fu-sub" style={{ margin: 0 }}>{L(`${bills.numbersNotRetained} bill reference${bills.numbersNotRetained > 1 ? 's' : ''} exist on this contract's workflow cases, but bill numbers are not kept in this subset.`, `يوجد ${bills.numbersNotRetained} مرجع فاتورة في حالات سير عمل هذا العقد، لكن أرقام الفواتير غير محفوظة في هذه العيّنة.`)}</p>
        ) : (
          <p className="fu-sub" style={{ margin: 0 }}>{L('No linked invoice found in the available data.', 'لا توجد فاتورة مرتبطة في البيانات المتاحة.')}</p>
        )}
        <p className="fu-note">{L('Contract-level references, listed once. Installment link unavailable: the installment rows carry no invoice number.', 'مراجع على مستوى العقد، تُعرض مرة واحدة. ربط الدفعة بالفاتورة غير متاح: صفوف الدفعات لا تحمل رقم فاتورة.')}</p>
      </section>
    </div>
  );
}
