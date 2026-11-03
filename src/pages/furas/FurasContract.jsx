import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useL } from '../../utils/bi';
import { useAsync } from '../../utils/useAsync';
import { furas } from '../../api/furasClient';
import { RecordState } from '../../components/record/RecordPage';
import { DatasetBanner, UnavailableChips } from '../../components/furas/FurasParts';
import { Chip, Icon, NaCell } from '../../components/furas/FurasUI';
import { stored, storedText } from '../../data/furasLabels';

const FLAG = { out_of_range: ['to validate (out of range)', 'للتحقق (خارج النطاق)'], epoch: ['to validate (1970)', 'للتحقق (1970)'], hijri_like: ['to validate (Hijri-like year, not converted)', 'للتحقق (سنة تشبه الهجرية، دون تحويل)'], after_extract: ['to validate (after the extract date)', 'للتحقق (بعد تاريخ الاستخراج)'], unreadable: ['unreadable', 'غير مقروء'] };
const DATE_FLAG_KEY = { awardingDate: 'awardingdate', signingDate: 'signingdate', startDate: 'startdate', endDate: 'enddate' };
// the record fields, grouped; every field exists in the exports (nothing is derived)
const GROUPS = [
  { g: ['Identity', 'الهوية'], rows: [['opportunityNumber', 'Opportunity number', 'رقم الفرصة'], ['investorId', 'Investor (masked)', 'المستثمر (مقنّع)']] },
  { g: ['Classification', 'التصنيف'], rows: [['contractType', 'Service type', 'نوع الخدمة'], ['status', 'Status (as stored)', 'الحالة (كما هي)'], ['rentalStatus', 'Rental status', 'حالة التأجير'], ['renewalStatus', 'Renewal status', 'حالة التجديد']] },
  { g: ['Dates', 'التواريخ'], rows: [['awardingDate', 'Awarding', 'الترسية'], ['signingDate', 'Signing', 'التوقيع'], ['startDate', 'Start', 'البداية'], ['endDate', 'End', 'النهاية'], ['handoverPlanned', 'Handover (planned)', 'التسليم (المخطط)'], ['handoverActual', 'Handover (actual)', 'التسليم (الفعلي)']] },
  { g: ['Values', 'القيم'], rows: [['contractValue', 'Contract value', 'قيمة العقد', 'money'], ['calculatedValue', 'Calculated value', 'القيمة المحسوبة', 'money'], ['annualValue', 'Annual value', 'القيمة السنوية', 'money'], ['valueWithVat', 'Value with VAT', 'القيمة شاملة الضريبة', 'money'], ['term', 'Term (as stored)', 'المدة (كما هي)'], ['durationMonths', 'Duration in months', 'المدة بالأشهر']] },
  { g: ['Location', 'الموقع'], rows: [['municipality', 'Amanah (source)', 'الأمانة (المصدر)'], ['subMunicipality', 'Sub-municipality', 'البلدية الفرعية']] },
  { g: ['Links', 'الروابط'], rows: [['renewalLink', 'Renewal link', 'رابط التجديد']] }
];
// the Databank column each field is read from (Contract view); shown beside the label so the page can be checked against the schema
const COL = { opportunityNumber: 'OPPORTUNITYNUMBER', investorId: 'INVESTORID', contractType: 'CONTRACTTYPE', status: 'OPPORTUNITYSTATUS', rentalStatus: 'RENTALSTATUS', renewalStatus: 'RENEWALSTATUS', awardingDate: 'AWARDINGDATE', signingDate: 'SIGNINGDATE', startDate: 'STARTDATE', endDate: 'ENDDATE',
  handoverPlanned: 'DATEOFSITEHANDOVER', handoverActual: 'DATEOFSITEHANDOVERACTUAL', contractValue: 'CONTRACTVALUE', calculatedValue: 'CALCULATEDCONTRACTVALUE', annualValue: 'ANNUALCONTRACTVALUE', valueWithVat: 'TOTALCONTRACTVALUEWITHVAT', term: 'CONTRACTTERM',
  durationMonths: 'CONTRACTDURATIONMONTHS', municipality: 'MUNICIPALITYID', subMunicipality: 'SUBMUNICIPALITY', renewalLink: 'RENEWEDCONTRACTID', recordKey: 'PZINSKEY' };
const empty = (v) => v == null || v === '';
const STORED_FIELD = { contractType: 'type', status: 'status', rentalStatus: 'rental', renewalStatus: 'renewal' };

// One contract NUMBER in FURAS DATASET MODE: the records that carry it side by side (differences lit), the payment rows of the capped extract listed once, and what the exports cannot say.
export default function FurasContract() {
  const { no: raw } = useParams(); const no = decodeURIComponent(raw || '');
  const { L, B, ar, count, sar } = useL();
  const [onlyDiff, setOnlyDiff] = useState(false);
  const { data: c, loading, error } = useAsync(() => furas.contract(no), [no]);
  const { data: S } = useAsync(() => furas.summary(), []);
  if (!c) return <div className="fu-page"><nav className="fu-crumb" aria-label="breadcrumb"><Link to="/contracts">{L('Contracts', 'العقود')}</Link> › <span dir="ltr">{no}</span></nav><RecordState loading={loading && !error} error={error && error.status !== 404 ? error : null} notFound={!loading && error?.status === 404} kind={L('Contract number', 'رقم العقد')} backTo={{ path: '/contracts', label: L('Back to the contracts', 'العودة إلى العقود') }} /></div>;

  const recs = c.records; const multi = recs.length > 1; const opps = c.groups;
  const shapeText = c.shape === 'single' ? L('One record carries this number.', 'سجل واحد يحمل هذا الرقم.') : c.shape === 'versions' ? L('Several records carry this number, all under one opportunity number: the same opportunity is stored more than once.', 'عدة سجلات تحمل هذا الرقم كلها تحت رقم فرصة واحد: الفرصة نفسها مخزّنة أكثر من مرة.') : L('The records that carry this number belong to different opportunity numbers.', 'السجلات التي تحمل هذا الرقم تنتمي إلى أرقام فرص مختلفة.');
  const keyOf = (k) => GROUPS.flatMap((g) => g.rows).find((r) => r[0] === k);
  const labelOf = (k) => { const r = keyOf(k); return r ? B({ en: r[1], ar: r[2] }) : k; };
  // differences WITHIN an opportunity (versions of it) and BETWEEN opportunities are different findings; the record key and the opportunity number always differ and are left out
  const fieldKeys = GROUPS.flatMap((g) => g.rows).map((r) => r[0]).filter((k) => k !== 'opportunityNumber');
  const withinKeys = fieldKeys.filter((k) => opps.some((g) => g.recordIndexes.length > 1 && new Set(g.recordIndexes.map((i) => JSON.stringify(recs[i][k]))).size > 1));
  const betweenKeys = opps.length > 1 ? fieldKeys.filter((k) => new Set(opps.map((g) => JSON.stringify([...new Set(g.recordIndexes.map((i) => JSON.stringify(recs[i][k])))].sort()))).size > 1) : [];
  const hasVersions = opps.some((g) => g.recordIndexes.length > 1);
  const date = (v, flag) => (empty(v) ? <NaCell /> : <><span dir="ltr">{v}</span>{flag && <> <Chip tone="warn" icon="alert">{B({ en: FLAG[flag][0], ar: FLAG[flag][1] })}</Chip></>}</>);
  const cell = (r, k, kind) => {
    const v = r[k];
    if (k === 'municipality') return v ? <>{v.sourceName}<span className="fu-rec">{v.code}{v.flag && <> <Chip tone="warn" icon="alert">{L('entity scope to be confirmed', 'نطاق الجهة بانتظار التأكيد')}</Chip></>}</span></> : <NaCell />;
    if (k === 'renewalLink') return v == null ? <NaCell /> : !v.resolved ? (v.outsideSubset ? <Chip tone="warn" icon="alert" title={L('The link points to a record that exists in the full export but was not included in this subset.', 'الرابط يشير إلى سجل موجود في التصدير الكامل لكنه غير مضمَّن في هذه العيّنة.')}>{L('related record outside this subset', 'سجل مرتبط خارج هذه العيّنة')}</Chip> : L('target record not found', 'السجل المستهدف غير موجود')) : v.selfReference ? <Chip tone="warn" icon="alert">{L('points to itself — to review', 'يشير إلى نفسه — للمراجعة')}</Chip> : <span dir="ltr">{v.contractNumber}{v.sameContractNumber ? ` (${L('same number', 'الرقم نفسه')})` : ''}</span>;
    if (DATE_FLAG_KEY[k]) return date(v, r.dateFlags[DATE_FLAG_KEY[k]]);
    if (k.startsWith('handover')) return date(v);
    if (empty(v)) return <NaCell />;
    if (STORED_FIELD[k]) { const s = stored(STORED_FIELD[k], v, ar); return <span dir="auto" title={s.translated ? s.raw : undefined}>{s.text}{s.translated && <span className="fu-rec" dir="ltr">{s.raw}</span>}</span>; }
    if (kind === 'money') return <span dir="ltr">{sar(v)}</span>;
    return <span dir="auto">{String(v)}</span>;
  };
  const allEmpty = (k) => recs.every((r) => empty(r[k]));
  const absent = []; const groups = GROUPS.map((gr) => ({ ...gr, rows: gr.rows.filter(([k, en, arb]) => { if (allEmpty(k)) { absent.push(B({ en, ar: arb })); return false; } return true; }) })).filter((gr) => gr.rows.length);
  const uniq = (k) => [...new Set(recs.map((r) => r[k]).filter((x) => !empty(x)))];
  const types = uniq('contractType'); const statuses = uniq('status'); const amanahs = [...new Map(recs.filter((r) => r.municipality).map((r) => [r.municipality.code, r.municipality])).values()];
  const ch = (arr, warn, kind) => (arr.length ? <span className="fu-chips">{arr.map((x) => <Chip key={x} tone={warn ? 'warn' : 'value'} title={stored(kind, x, ar).translated ? x : undefined}>{storedText(kind, x, ar)}</Chip>)}</span> : <NaCell full />);

  return (
    <div className="fu-page">
      <nav className="fu-crumb" aria-label="breadcrumb"><Link to="/contracts">{L('Contracts', 'العقود')}</Link> <span aria-hidden="true">›</span> <span dir="ltr">{c.contractNumber}</span></nav>
      <header className="fu-hero">
        <div className="fu-hero__top">
          <h1 dir="ltr">{c.contractNumber}</h1>
          <Chip tone={multi ? 'info' : 'value'} icon="layers" title={shapeText}>{c.shape === 'single' ? L('Single record', 'سجل واحد') : c.shape === 'versions' ? L(`1 opportunity · ${c.recordCount} records`, `فرصة واحدة · ${c.recordCount} سجلات`) : L(`${c.opportunityCount} opportunities · ${c.recordCount} records`, `${c.opportunityCount} فرص · ${c.recordCount} سجلات`)}</Chip>
          <Chip tone="warn" icon="alert" title={L('The data has no created / version column', 'لا يوجد عمود إنشاء أو إصدار في البيانات')}>{L('Current record not determined', 'السجل الحالي غير محدد')}</Chip>
        </div>
        <dl className="fu-hero__facts">
          <div><dt>{L('Service type', 'نوع الخدمة')}</dt><dd>{ch(types, types.length > 1, 'type')}</dd></div>
          <div><dt>{L('Status (as stored)', 'الحالة (كما هي)')}</dt><dd>{ch(statuses, statuses.length > 1, 'status')}</dd></div>
          <div><dt>{L('Amanah (source)', 'الأمانة (المصدر)')}</dt><dd>{amanahs.length ? amanahs.map((m) => <div key={m.code}>{m.sourceName} <span className="muted" dir="ltr">{m.code}</span></div>) : <NaCell full />}</dd></div>
          <div><dt>{L('Payment rows in the extract', 'صفوف الدفعات في المستخرج')}</dt><dd><b dir="ltr">{count(c.payments.rowsInExtract)}</b> <span className="muted">{L('limited sample', 'عيّنة محدودة')}</span></dd></div>
          <div><dt>{L('Case rows', 'صفوف الحالات')}</dt><dd><b dir="ltr">{count(c.caseRows.count)}</b></dd></div>
        </dl>
        {multi && (withinKeys.length > 0 || betweenKeys.length > 0) && <div className="fu-callout" role="note"><Icon name="alert" /><span>
          {withinKeys.length > 0 && <span style={{ display: 'block' }}><b>{L('Within one opportunity (versions):', 'داخل الفرصة الواحدة (إصدارات):')}</b> {L('differ on ', 'تختلف في ')}{withinKeys.map(labelOf).join(ar ? '، ' : ', ')}.</span>}
          {betweenKeys.length > 0 && <span style={{ display: 'block' }}><b>{L('Between opportunities:', 'بين الفرص:')}</b> {L('differ on ', 'تختلف في ')}{betweenKeys.map(labelOf).join(ar ? '، ' : ', ')}.</span>}
          <span style={{ display: 'block' }}>{L('No record is chosen as current and contract values are never summed across records.', 'ولا يُختار سجل حالي ولا تُجمع قيم العقد بين السجلات.')}</span></span></div>}
      </header>
      <DatasetBanner S={S} />
      <nav className="fu-nav" aria-label={L('On this page', 'في هذه الصفحة')}>
        <a href="#structure">{L('Structure', 'البنية')}</a><a href="#records">{L('Records', 'السجلات')}</a><a href="#payments">{L('Payment rows', 'صفوف الدفعات')}</a><a href="#cases">{L('Case rows', 'صفوف الحالات')}</a><a href="#na">{L('Not available', 'غير متاح')}</a>
      </nav>

      <section className="fu-sec" id="structure" aria-labelledby="h-structure">
        <div className="fu-sec__head"><h2 id="h-structure">{L('Structure of this number', 'بنية هذا الرقم')}</h2></div>
        <p className="fu-sub" style={{ margin: 0 }}>{shapeText} {L('Records are grouped by opportunity number; the contract number itself is not a record key.', 'تُجمَّع السجلات حسب رقم الفرصة؛ ورقم العقد نفسه ليس مفتاح سجل.')}</p>
        <ol className="fu-tree" aria-label={L('Opportunities and records', 'الفرص والسجلات')}>
          <li className="fu-tree__root"><span className="fu-tree__label">{L('Contract number', 'رقم العقد')} <b dir="ltr">{c.contractNumber}</b><span className="fu-col" dir="ltr">CONTRACTNUMBER</span></span>
            <ol>{opps.map((g, gi) => (
              <li key={gi}><a className="fu-tree__label" href={`#opp-${gi}`}>{L('Opportunity', 'الفرصة')} {g.opportunityNumber == null ? <i>{L('(no opportunity number)', '(بلا رقم فرصة)')}</i> : <b dir="ltr">{g.opportunityNumber}</b>}<span className="fu-count">{g.recordIndexes.length}</span></a>
                <ol>{g.recordIndexes.map((ri) => <li key={ri}><span className="fu-tree__rec">{L(`Record ${ri + 1}`, `السجل ${ri + 1}`)} <span className="fu-rec" dir="ltr">{recs[ri].recordKey}</span> {recs[ri].status ? <Chip title={stored('status', recs[ri].status, ar).translated ? recs[ri].status : undefined}>{storedText('status', recs[ri].status, ar)}</Chip> : <NaCell />}</span></li>)}</ol>
              </li>))}</ol>
          </li>
        </ol>
      </section>

      <section className="fu-sec" id="records" aria-labelledby="h-records">
        <div className="fu-sec__head"><h2 id="h-records">{L('Contract records by opportunity', 'سجلات العقد حسب الفرصة')} <span className="fu-count">{c.recordCount}</span></h2>
          {hasVersions && <button type="button" className="fu-toggle" aria-pressed={onlyDiff} onClick={() => setOnlyDiff((v) => !v)}>{L('Show only differences', 'أظهر الفروق فقط')}</button>}</div>
        {opps.map((g, gi) => {
          const rs = g.recordIndexes.map((i) => ({ r: recs[i], i })); const m = rs.length > 1;
          const gDiff = (k) => m && new Set(rs.map(({ r }) => JSON.stringify(r[k]))).size > 1;
          const body = groups.map((gr) => ({ ...gr, rows: gr.rows.filter(([k]) => k !== 'opportunityNumber' && (!onlyDiff || gDiff(k))) })).filter((gr) => gr.rows.length);
          const label = ([k, en, arb]) => <>{B({ en, ar: arb })}{COL[k] && <span className="fu-col" dir="ltr">{COL[k]}</span>}</>;
          return (
            <article className="fu-opp" id={`opp-${gi}`} key={gi} aria-labelledby={`h-opp-${gi}`}>
              <header className="fu-opp__head">
                <h3 id={`h-opp-${gi}`}>{L('Opportunity', 'الفرصة')} {g.opportunityNumber == null ? <i>{L('(no opportunity number)', '(بلا رقم فرصة)')}</i> : <span dir="ltr">{g.opportunityNumber}</span>}</h3>
                <Chip tone={m ? 'info' : 'value'} icon="layers" title={m ? L('The same opportunity stored more than once; the data does not say which version is current.', 'الفرصة نفسها مخزّنة أكثر من مرة؛ ولا تحدد البيانات أي إصدار هو الحالي.') : undefined}>{m ? L(`${rs.length} records (versions)`, `${rs.length} سجلات (إصدارات)`) : L('1 record', 'سجل واحد')}</Chip>
              </header>
              {m ? (
                <div className="fu-matrix-wrap" tabIndex={0} role="region" aria-label={L('Records of this opportunity side by side', 'سجلات هذه الفرصة جنباً إلى جنب')}>
                  <table className="fu-matrix">
                    <thead><tr><th scope="col">{L('Field', 'الحقل')}</th>{rs.map(({ r, i }) => <th key={i} scope="col">{L(`Record ${i + 1}`, `السجل ${i + 1}`)}<span className="fu-rec" dir="ltr">{r.recordKey}</span></th>)}</tr></thead>
                    <tbody>{body.map((gr) => (<React.Fragment key={gr.g[0]}>
                      <tr className="fu-group"><th colSpan={rs.length + 1} scope="colgroup">{B({ en: gr.g[0], ar: gr.g[1] })}</th></tr>
                      {gr.rows.map((row) => { const [k, , , kind] = row; return <tr key={k} className={gDiff(k) ? 'is-diff' : ''}><th scope="row">{label(row)}{gDiff(k) && <span className="fu-sr"> — {L('differs between records', 'يختلف بين السجلات')}</span>}</th>{rs.map(({ r, i }) => <td key={i}>{cell(r, k, kind)}</td>)}</tr>; })}
                    </React.Fragment>))}
                      {onlyDiff && !body.length && <tr><td colSpan={rs.length + 1} className="fu-empty">{L('The records of this opportunity do not differ on any field.', 'لا تختلف سجلات هذه الفرصة في أي حقل.')}</td></tr>}</tbody>
                  </table>
                </div>
              ) : (
                <dl className="fu-kv">
                  <div><dt>{L('Record key', 'مفتاح السجل')}<span className="fu-col" dir="ltr">{COL.recordKey}</span></dt><dd dir="ltr">{rs[0].r.recordKey}</dd></div>
                  {groups.flatMap((gr) => gr.rows).filter(([k]) => k !== 'opportunityNumber').map((row) => <div key={row[0]}><dt>{label(row)}</dt><dd>{cell(rs[0].r, row[0], row[3])}</dd></div>)}
                </dl>
              )}
            </article>);
        })}
        {absent.length > 0 && <div className="fu-absent"><NaCell full /><span>{L('for ' + (multi ? 'every record' : 'this record') + ':', (multi ? 'في كل سجل' : 'في هذا السجل') + ':')}</span>{absent.map((a) => <Chip key={a} tone="muted">{a}</Chip>)}</div>}
      </section>

      <section className="fu-sec" id="payments" aria-labelledby="h-pay">
        <div className="fu-sec__head"><h2 id="h-pay">{L('Payment rows in the limited extract', 'صفوف الدفعات في المستخرج المحدود')} <span className="fu-count">{c.payments.rowsInExtract}</span></h2></div>
        <div className="fu-callout fu-callout--info" role="note"><Icon name="info" /><span>{L('Each row is listed once and is never joined to the contract values above. These are the rows the extract holds for this number — not a complete schedule — so there is no “n of N”, no total, and no collected or unpaid amount. Amounts are the scheduled values as stored.', 'يُعرض كل صف مرة واحدة ولا يُربط بقيم العقد أعلاه. هذه الصفوف التي يحملها المستخرج لهذا الرقم — وليست جدولاً كاملاً — فلا «دفعة س من ص» ولا إجمالي ولا مبلغ محصّل أو غير مسدّد. المبالغ هي القيم المجدولة كما هي.')}</span></div>
        {c.payments.rowsInExtract ? (
          <div className="fu-tablewrap"><table className="fu-pay" aria-label={L('Payment rows', 'صفوف الدفعات')}>
            <thead><tr><th>{L('Batch', 'الدفعة')}</th><th>{L('Status (as stored)', 'الحالة (كما هي)')}</th><th>{L('Type · frequency', 'النوع · الدورية')}</th><th>{L('Due date', 'الاستحقاق')}</th><th>{L('Invoice date', 'تاريخ الفاتورة')}</th><th>{L('Payment date', 'تاريخ السداد')}</th><th className="num">{L('Scheduled amount', 'المبلغ المجدول')}</th><th className="num">{L('Balance (as stored)', 'الرصيد (كما هو)')}</th><th>{L('Opportunity', 'الفرصة')}</th></tr></thead>
            <tbody>{c.payments.rows.map((p, i) => (
              <tr key={i}>
                <td data-label={L('Batch', 'الدفعة')}><b dir="ltr">{p.batchNumber ?? '—'}</b><small dir="ltr">{p.batchYear ?? ''}</small></td>
                <td data-label={L('Status', 'الحالة')}>{p.status ? <Chip title={stored('payStatus', p.status, ar).translated ? p.status : undefined}>{storedText('payStatus', p.status, ar)}</Chip> : <NaCell />}</td>
                <td data-label={L('Type · frequency', 'النوع · الدورية')}>{p.paymentType || <NaCell />}<small>{p.method || ''}</small></td>
                <td data-label={L('Due date', 'الاستحقاق')}>{date(p.dueDate, p.dateFlags.dueDate)}</td>
                <td data-label={L('Invoice date', 'تاريخ الفاتورة')}>{date(p.invoiceDate, p.dateFlags.invoiceDate)}</td>
                <td data-label={L('Payment date', 'تاريخ السداد')}>{date(p.paymentDate, p.dateFlags.paymentDate)}</td>
                <td className="num" data-label={L('Scheduled amount', 'المبلغ المجدول')} dir="ltr">{p.amount == null ? <NaCell /> : sar(p.amount)}</td>
                <td className="num" data-label={L('Balance', 'الرصيد')} dir="ltr">{p.balance == null ? <NaCell /> : sar(p.balance)}</td>
                <td data-label={L('Opportunity', 'الفرصة')} dir="ltr">{p.opportunityNumber || <NaCell />}{p.recordsWithSameOpportunity > 1 && <small><Chip tone="warn">{L(`matches ${p.recordsWithSameOpportunity} records`, `يطابق ${p.recordsWithSameOpportunity} سجلات`)}</Chip></small>}{p.recordsWithSameOpportunity === 0 && <small><Chip tone="warn">{L('no record with this number', 'لا سجل بهذا الرقم')}</Chip></small>}</td>
              </tr>))}</tbody>
          </table><div className="fu-legend"><NaCell /> {L('= Not available in the current data', '= غير متاح في البيانات الحالية')}</div></div>
        ) : <div className="fu-callout" role="note"><Icon name="info" /><span>{L('No payment row for this number in the extract. That is not evidence that none exists: the extract is a limited sample.', 'لا صف دفعات لهذا الرقم في المستخرج. وهذا ليس دليلاً على عدم وجود دفعات: المستخرج عيّنة محدودة.')}</span></div>}
      </section>

      <section className="fu-sec" id="cases" aria-labelledby="h-cases">
        <div className="fu-sec__head"><h2 id="h-cases">{L('Case rows', 'صفوف الحالات')} <span className="fu-count">{c.caseRows.count}</span></h2></div>
        <p className="fu-sub" style={{ margin: 0 }}>{L('Workflow cases (ContractManagement) that name this contract number or one of its opportunity numbers. They are cases, not payments or invoices.', 'حالات سير عمل (ContractManagement) تذكر رقم العقد أو أحد أرقام فرصه. هي حالات وليست دفعات أو فواتير.')}</p>
        {c.caseRows.byLabel.length ? <span className="fu-chips">{c.caseRows.byLabel.map((x) => <Chip key={String(x.value)} tone="value">{x.value || <NaCell />} · <span dir="ltr">{count(x.rows)}</span></Chip>)}</span> : <span className="muted">{L('None in the exports.', 'لا شيء في التصديرات.')}</span>}
      </section>

      <section className="fu-sec" id="na" aria-labelledby="h-na">
        <div className="fu-sec__head"><h2 id="h-na">{L('Not available in the current data', 'غير متاح في البيانات الحالية')}</h2></div>
        <UnavailableChips />
      </section>
    </div>
  );
}
