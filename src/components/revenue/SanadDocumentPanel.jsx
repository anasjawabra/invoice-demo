import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useL } from '../../utils/bi';
import { useAuth } from '../../context/AuthContext';
import { useRevenue } from '../../context/RevenueContext';
import { recordSanadDocument } from './useOrderWork';
import { Info } from './SectionNav';
import SanadDocumentPreview from './SanadDocumentPreview';
import SanadDocumentReview from './SanadDocumentReview';
import { browserStore, reviewField } from '../../data/sanadDocs/store';
import { loadCatalog } from '../../data/sanadDocs/catalog';
import { SCENARIO_DOCS } from '../../data/sanadDocs/scenarios';
import { currentDoc, attachScenarioDoc, attachUpload, runExtraction, readDocBytes, reviewRows, countRows } from '../../data/sanadDocs/service';
import { getProvider, DEFAULT_PROVIDER_ID } from '../../data/sanadDocs/extraction';
import { SIM_LABEL, SIM_EXPLAIN, DOC_MARK, DOC_MARK_EN, MISSING_DOC_FLAG, SECTION_TITLE, EXTRACT_ACTION, STATE_LABEL, ERROR_LABEL } from '../../data/sanadDocs/labels';
import '../../styles/sanad-docs.css';
import { displayName } from '../../utils/identity';

const PAGE_DELAY_MS = 600; // lets the reader follow the page-by-page progress; part of the simulation, not a measure of any engine
const MAX_BYTES = 15 * 1024 * 1024;

// «مستند سند» — the document of a Sanad record: attach (upload any file or pick a synthetic scenario document), preview / download, simulated extraction, side-by-side review.
// The UI talks only to the extraction interface (data/sanadDocs/extraction.js): a real OCR provider registered there replaces the simulation without changes here.
export default function SanadDocumentPanel({ order, onState = null, optional = false }) {
  const { L, B } = useL();
  const { user } = useAuth() || {};
  const rev = useRevenue();
  const store = useMemo(() => browserStore(), []);
  const orderId = order?.enforceNum;
  const by = displayName(user, 'ar'); const canReview = !!by && rev.canDo.enforcementReview; const canUpload = !!by && rev.canDo.enforcementUpload; // review → enforcement.review (field review, sending numbers to the order review); documents → enforcement.upload (attach, replace, extract)
  const [catalog, setCatalog] = useState(null); const [doc, setDoc] = useState(undefined); const [ex, setEx] = useState(null); const [reviews, setReviews] = useState({});
  const [run, setRun] = useState({ status: 'idle' }); const [attachOpen, setAttachOpen] = useState(false); const [pick, setPick] = useState(''); const [msg, setMsg] = useState(null);
  const [fed, setFed] = useState(null); const [showPreview, setShowPreview] = useState(false); const [pg, setPg] = useState(1); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const reload = useCallback(async () => {
    const cat = await loadCatalog(); const d = await currentDoc(store, orderId, cat); const e = d ? await store.getExtraction(orderId) : null;
    const good = e && d && e.sha256 === d.sha256 ? e : null; const r = good && good.status === 'completed' ? await store.getReviews(orderId, d.sha256) : {};
    if (!alive.current) return; setCatalog(cat); setDoc(d || null); setEx(good); setReviews(r);
  }, [store, orderId]);
  useEffect(() => { setRun({ status: 'idle' }); setMsg(null); setFed(null); setAttachOpen(false); setShowPreview(false); setPg(1); setDoc(undefined); reload(); }, [orderId, reload]);

  const rows = useMemo(() => (ex?.status === 'completed' ? reviewRows(ex, reviews, order) : []), [ex, reviews, order]);
  const counts = useMemo(() => countRows(rows), [rows]);
  const state = !doc ? 'missing' : !ex ? 'attached' : ex.status === 'failed' ? 'failed' : counts.decided === 0 ? 'extracted' : counts.pending > 0 ? 'under_review' : 'reviewed';
  useEffect(() => { onState?.(doc === undefined ? 'loading' : state); }, [doc, state]); // eslint-disable-line react-hooks/exhaustive-deps -- the page shows the same state in its header
  const recordedKey = (d) => SCENARIO_DOCS.find((s) => s.id === d.scenarioId)?.recordKey;

  const attach = async (fn) => { setMsg(null); const r = await fn(); if (!r.ok) setMsg({ bad: true, t: L('The browser could not store the document.', 'تعذّر على المتصفح حفظ المستند.') }); else { setAttachOpen(false); setPick(''); setRun({ status: 'idle' }); setShowPreview(false); setPg(1); } await reload(); };
  const onFile = (file, input) => {
    if (!file) return; if (file.size > MAX_BYTES) { setMsg({ bad: true, t: L('The file is larger than 15 MB.', 'حجم الملف أكبر من 15 ميغابايت.') }); return; }
    attach(async () => attachUpload(store, orderId, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }, { by: by || null, catalog })).finally(() => { if (input) input.value = ''; });
  };
  const startExtraction = async () => {
    if (!doc) return; setMsg(null); setRun({ status: 'running', page: 0, total: 0 });
    const res = await runExtraction(store, { orderId, record: order, providerId: DEFAULT_PROVIDER_ID, delayMs: PAGE_DELAY_MS, catalog, by: by || null, onPage: (page, total) => alive.current && setRun({ status: 'running', page, total }) });
    if (!alive.current) return;
    if (res.status === 'failed' && res.error?.retryable === false) { setRun({ status: 'unsupported', error: res.error }); return; }
    setRun({ status: 'idle' });
    if (res.status === 'completed' && res.simulated) { // the extraction flows into the order's review (step 3) through the existing pipeline; nothing is linked until a reviewer confirms
      const d = await currentDoc(store, orderId, catalog); const fedRes = d ? await recordSanadDocument({ order, rev, doc: { ...d, orderId }, pages: res.pages }) : { ok: false };
      if (alive.current) setFed(fedRes);
    }
    await reload();
  };
  const onReview = async (fieldKey, action, { value, note }) => {
    const r = await reviewField(store, { orderId, extraction: ex, fieldKey, action, value, note, by });
    if (r.ok) setReviews(await store.getReviews(orderId, doc.sha256));
    return r;
  };
  const inOrder = !!doc && (order.docs || []).some((d) => d.id === doc.sha256);
  const sendToReview = async () => { const r = await recordSanadDocument({ order, rev, doc: { ...doc, orderId }, pages: ex.pages }); setFed(r); };
  const download = async () => {
    if (doc.url && !doc.bytes) { const a = document.createElement('a'); a.href = doc.url; a.download = doc.name; document.body.appendChild(a); a.click(); a.remove(); return; }
    const u = URL.createObjectURL(new Blob([await readDocBytes(doc)], { type: doc.type || 'application/octet-stream' })); const a = document.createElement('a'); a.href = u; a.download = doc.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  };

  const st = STATE_LABEL[state]; const provider = getProvider(DEFAULT_PROVIDER_ID); const chosen = SCENARIO_DOCS.find((s) => s.id === pick);
  const wrongRecord = chosen && chosen.recordKey !== orderId;
  const known = doc && (doc.recognised || doc.source === 'scenario');
  const busy = run.status === 'running';

  const attachControls = (
    <div className="sd-attach">
      <div className="sd-attach__grid">
        <div className="sd-attach__box">
          <b style={{ fontSize: 13 }}>{L('Upload a file', 'رفع ملف')}</b>
          <label>{L('PDF, Word (.docx) or image', 'PDF أو Word (.docx) أو صورة')}
            <input className="input" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.tif,.tiff" disabled={!canUpload} onChange={(e) => onFile(e.target.files?.[0], e.target)} aria-label={L('Upload a Sanad document', 'رفع مستند سند')} />
          </label>
          <Info>{L('Any uploaded file is kept and can be previewed, but the simulation reads NOTHING from it unless it is exactly one of the synthetic documents below.', 'يُحفظ أي ملف مرفوع ويمكن معاينته، لكن المحاكاة لا تقرأ منه شيئاً ما لم يكن بالضبط أحد المستندات التجريبية أدناه.')}</Info>
        </div>
        <div className="sd-attach__box">
          <b style={{ fontSize: 13 }}>{L('Pick a synthetic scenario document', 'اختيار مستند تجريبي من السيناريوهات')}</b>
          <label>{L('Document', 'المستند')}
            <select className="input" value={pick} disabled={!canUpload} onChange={(e) => setPick(e.target.value)} aria-label={L('Synthetic scenario document', 'مستند سيناريو تجريبي')}>
              <option value="">{L('— choose —', '— اختر —')}</option>
              {SCENARIO_DOCS.map((s) => <option key={s.id} value={s.id}>{`${s.n} · ${B(s.title)} (${s.recordKey})`}</option>)}
            </select>
          </label>
          {wrongRecord && <div className="rp-warn" role="alert" style={{ fontSize: 12 }}>{L(`This synthetic document belongs to record ${chosen.recordKey}. Attached to this record it will show conflicts with the Sanad data.`, `هذا المستند التجريبي يخص السجل ${chosen.recordKey}. إرفاقه بهذا السجل سيُظهر تعارضات مع بيانات سند.`)}</div>}
          <div><button type="button" className="btn btn-sm btn-primary" disabled={!pick || !canUpload} onClick={() => attach(() => attachScenarioDoc(store, orderId, pick, { by: by || null, catalog }))}>{L('Attach the document', 'إرفاق المستند')}</button></div>
        </div>
      </div>
    </div>
  );

  const chipCls = state === 'missing' ? 'rv-tag--warn' : st.cls; // a missing document needs attention (amber); red is kept for conflicts and failures
  return (
    <div className="ed-step" id="sanad-document">
      <div className="ed-step__head">
        <span className="ed-step__n" aria-hidden="true">{L('1–2', '١–٢')}</span><h3>{B(SECTION_TITLE)}</h3>
        {doc !== undefined && <span className={`rv-tag ${chipCls}`} data-testid="sanad-doc-state">{B(st)}</span>}
      </div>
      <div className="sd-sim" role="note"><b>{B(SIM_LABEL)}</b><Info>{B(SIM_EXPLAIN)}</Info></div>
      {doc === undefined && <div role="status" className="muted">{L('Loading…', 'جارٍ التحميل…')}</div>}
      {(!canUpload || !canReview) && doc !== undefined && <div className="rp-limit" data-testid="doc-denied">{L(`Your role cannot do everything here (attaching, extracting and reviewing documents). ${rev.gates['enforcement.upload'].reason?.en || ''}`, `دورك لا يتيح كل الإجراءات هنا (إرفاق المستندات واستخراجها ومراجعتها). ${rev.gates['enforcement.upload'].reason?.ar || ''}`)}</div>}

      {doc === null && (
        <div className={`sd-missing${optional ? ' sd-missing--optional' : ''}`}>
          <div className="sd-missing__flag" role={optional ? 'note' : 'alert'}>⚑ {B(MISSING_DOC_FLAG)}<span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{L('The record stays visible; attach a document to continue.', 'يبقى السجل ظاهراً؛ أرفق مستنداً للمتابعة.')}</span></div>
          {attachControls}
        </div>
      )}

      {doc && (
        <div className="sd-doc">
          <div className="sd-row"><span className="sd-doc__name" dir="ltr">{doc.name}</span>
            {known ? <span className="rv-tag rv-tag--warn">{L(DOC_MARK_EN, DOC_MARK)}</span> : <span className="rv-tag">{L('Uploaded file — not a scenario document', 'ملف مرفوع — ليس مستنداً تجريبياً من السيناريوهات')}</span>}
            {doc.source === 'scenario' && doc.virtual && <span className="rv-tag">{L('supplied with the record', 'مرفق مع السجل')}</span>}
            {recordedKey(doc) && recordedKey(doc) !== orderId && <span className="rv-tag rv-tag--bad">{L(`belongs to ${recordedKey(doc)}`, `يخص ${recordedKey(doc)}`)}</span>}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>SHA-256 <span dir="ltr">{doc.sha256.slice(0, 16)}…</span>{doc.size != null && <> · <span dir="ltr">{Math.round(doc.size / 1024)} KB</span></>}{doc.attachedBy && <> · {L('attached by', 'أرفقه')} {doc.attachedBy}</>}</div>
          <div className="sd-row">
            <button type="button" className="btn btn-sm btn-primary" disabled={!canUpload || busy || state === 'extracted' || state === 'under_review' || state === 'reviewed'} onClick={startExtraction}>
              {state === 'failed' ? L('Retry extraction', 'إعادة المحاولة') : B(EXTRACT_ACTION)}</button>
            <button type="button" className="btn btn-sm" onClick={() => setShowPreview((x) => !x)}>{showPreview ? L('Hide preview', 'إخفاء المعاينة') : L('Preview', 'معاينة')}</button>
            <button type="button" className="btn btn-sm" onClick={download}>{L('Download', 'تنزيل')}</button>
            <button type="button" className="btn btn-sm" disabled={!canUpload || busy} onClick={() => setAttachOpen((x) => !x)}>{L('Replace the document', 'استبدال المستند')}</button>
            <span className="sd-tag-sim">{B(SIM_LABEL)}</span>
          </div>
          {attachOpen && attachControls}
          {busy && (
            <div className="sd-progress" role="status" aria-live="polite">
              <span>{B(SIM_LABEL)} — {run.total ? L(`Extracting data — page ${run.page} of ${run.total}`, `جارٍ استخراج البيانات — الصفحة ${run.page} من ${run.total}`) : L('Extracting data — starting…', 'جارٍ استخراج البيانات — بدء المعالجة…')}</span>
              <progress max={run.total || 1} value={run.page || 0} />
            </div>
          )}
          {run.status === 'unsupported' && (
            <div className="sd-notice sd-notice--warn" role="alert"><b>{B(SIM_LABEL)}</b><div>{B(ERROR_LABEL.not_a_scenario_document)}</div><div className="muted" style={{ fontSize: 12 }}>{L('No value was extracted and nothing was stored as an extraction.', 'لم تُستخرج أي قيمة ولم يُحفظ أي استخراج.')}</div></div>
          )}
          {state === 'failed' && !busy && (
            <div className="sd-notice sd-notice--bad" role="alert"><b>{L(`Extraction failed (attempt ${ex.attempts})`, `فشل الاستخراج (المحاولة ${ex.attempts})`)}</b>
              <div>{B(ex.error?.message) || B(ERROR_LABEL[ex.error?.code]) || B(ERROR_LABEL.provider_error)}</div>
              <div className="muted" style={{ fontSize: 12 }}>{L('Press «Retry extraction». The attempt number is kept: the next attempt is attempt', 'اضغط «إعادة المحاولة». رقم المحاولة محفوظ: المحاولة التالية هي رقم')} <span dir="ltr">{ex.attempts + 1}</span>.</div></div>
          )}
          {fed && (
            <div className={`sd-notice ${fed.ok ? '' : 'sd-notice--warn'}`} role="status">
              {fed.ok ? <>{L(`${fed.refs} invoice number(s) were sent to the order's review table (step 3 below). Nothing is linked and no invoice changes until a reviewer confirms.`, `أُرسل ${fed.refs} رقم فاتورة إلى جدول مراجعة الأمر (الخطوة ٣ أدناه). لا يُربط شيء ولا تتغير أي فاتورة حتى يؤكد المراجع.`)} <a href="#review">{L('Go to the review', 'الانتقال إلى المراجعة')}</a></>
                : L('The extraction was kept here but could not be sent to the order review (read-only role or storage error).', 'حُفظ الاستخراج هنا لكن تعذّر إرساله إلى مراجعة الأمر (دور للقراءة فقط أو خطأ تخزين).')}
            </div>
          )}
          {showPreview && state !== 'extracted' && state !== 'under_review' && state !== 'reviewed' && <SanadDocumentPreview doc={doc} page={pg} onPage={setPg} />}
          {ex?.status === 'completed' && (
            <div className="sd-row" style={{ fontSize: 12 }}>
              <span className="rv-tag rv-tag--ok">{L(`Extraction completed (attempt ${ex.attempts})`, `اكتمل الاستخراج (المحاولة ${ex.attempts})`)}</span>
              <span className="muted">{provider ? B(provider.label) : ex.providerId}</span>
              {ex.simulated && !inOrder && canReview && <button type="button" className="btn btn-sm" onClick={sendToReview}>{L('Send the invoice numbers to the order review', 'إرسال أرقام الفواتير إلى مراجعة الأمر')}</button>}
              <span className="muted">{L(`${counts.pending} awaiting a decision · ${counts.decided} decided · ${counts.conflicts} conflict(s) · ${counts.missing} not found`, `${counts.pending} بانتظار قرار · ${counts.decided} تم البتّ فيها · ${counts.conflicts} تعارض · ${counts.missing} غير موجود`)}</span>
            </div>
          )}
        </div>
      )}
      {msg && <div role="status" className={msg.bad ? 'rp-bad' : 'rp-ok'}>{msg.t}</div>}
      {doc && ex?.status === 'completed' && <SanadDocumentReview order={order} doc={doc} extraction={ex} reviews={reviews} canReview={canReview} onReview={onReview} />}
      {doc && ex?.status === 'completed' && <div className="muted" style={{ fontSize: 12 }}>{L('A decision here records what a reviewer decided about the document value. It does not change the source Sanad record.', 'القرار هنا يسجّل ما قرره المراجع بشأن قيمة المستند، ولا يغيّر سجل سند المصدر.')}</div>}
    </div>
  );
}
