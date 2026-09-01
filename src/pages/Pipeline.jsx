import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../components/Toast';
import { fmtMoney, INVOICES } from '../data/mock';
import { OCR_SAMPLES } from '../data/aiProcess';
import IngestAnimation from '../components/ai/IngestAnimation';
import OcrExtraction from '../components/ai/OcrExtraction';
import PipelineFlow from '../components/ai/PipelineFlow';

/* UC-01 business rules: 50MB cap + accepted formats (SCR-01 field 2). */
const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT_EXT = ['.pdf', '.docx', '.xml', '.xlsx', '.xls'];

/* SCR-01 field 3: invoice source options. */
const SOURCE_OPTIONS = ['Tahseel', 'Makeen', 'Efaa', 'Sanad', 'Email', 'Manual'];

function scenarioFromFilename(name = '') {
  const n = name.toLowerCase();
  if (n.includes('fraud') || n.includes('neom')) return 'fraud';
  if (n.includes('dup') || n.includes('duplicate') || n.includes('gulf')) return 'dup';
  if (n.includes('tax') || n.includes('taxfail') || n.includes('aramco')) return 'taxfail';
  return 'normal';
}

function pickInvoice(tag) {
  return INVOICES.find((x) => x.tag === tag) || INVOICES[0];
}

function ringColor(score) {
  if (score >= 80) return 'var(--red)';
  if (score >= 60) return 'var(--orange)';
  if (score >= 40) return 'var(--gold)';
  return 'var(--green)';
}

export default function Pipeline() {
  const { t, T, lang } = useI18n();
  const toast = useToast();
  const nav = useNavigate();

  const [scenario, setScenario] = useState(null);
  const [fileName, setFileName] = useState('');
  const runKey = useRef(0);
  const [, force] = useState(0);

  // SCR-01 ingestion form state: source select, low-confidence field
  // correction (UC-01 alt. b) and supplementary registration fields (10/11/12).
  const [source, setSource] = useState('Manual');
  const [fixDone, setFixDone] = useState(false);
  const [fixVals, setFixVals] = useState({});
  const [extra, setExtra] = useState({ contract: '', type: 'auto', note: '' });

  const inv = useMemo(() => (scenario ? pickInvoice(scenario) : null), [scenario]);

  const result = useMemo(() => {
    if (!scenario) return null;
    if (scenario === 'fraud') return { title: t('sc_fraud_title'), desc: t('sc_fraud_desc'), hitl: t('sc_fraud_hitl') };
    if (scenario === 'dup') return { title: t('sc_dup_title'), desc: t('sc_dup_desc'), hitl: t('sc_dup_hitl') };
    if (scenario === 'taxfail') return { title: t('sc_taxfail_title'), desc: t('sc_taxfail_desc'), hitl: t('sc_taxfail_hitl') };
    return { title: t('sc_normal_title'), desc: t('sc_normal_desc'), hitl: null };
  }, [scenario, t]);

  const canNavigateApprovals = scenario === 'fraud' || scenario === 'taxfail' || scenario === 'normal';

  function run(nextScenario, nextFileName = '') {
    runKey.current += 1;
    setScenario(nextScenario);
    setFileName(nextFileName);
    setFixDone(false);
    setFixVals({});
    force((n) => n + 1);
    toast.info(t('proc_toast_start'));
  }

  /* UC-01: validate size + extension before accepting the file. */
  function onFile(f) {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.warning(t('upload_too_big'));
      return;
    }
    const ext = `.${f.name.split('.').pop().toLowerCase()}`;
    if (!ACCEPT_EXT.includes(ext)) {
      toast.warning(t('upload_bad_format'));
      return;
    }
    run(scenarioFromFilename(f.name), f.name);
  }

  const lowConfFields = useMemo(() => (
    scenario ? (OCR_SAMPLES[scenario]?.fields || []).filter((f) => f.low) : []
  ), [scenario]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('process')}</div>
          <div className="page-sub">{t('proc_sub')}</div>
        </div>
        <span className="badge badge--indigo" title={t('persona_main')}>{t('persona_officer')}</span>
      </div>

      {/* Upload + sample scenarios */}
      <div className="card card-pad">
        <div style={{ fontWeight: 900, fontSize: 14 }}>{t('proc_title')}</div>
        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{t('proc_up_p')}</div>

        <div className="card" style={{ marginTop: 12, padding: 16, borderStyle: 'dashed' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 900 }}>{t('proc_up_h3')}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                {fileName ? `Selected: ${fileName}` : 'PDF / DOCX / XML / Excel'}
              </div>
            </div>
            <label className="btn btn-primary" style={{ height: 40 }}>
              Upload
              <input
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.docx,.xml,.xlsx,.xls"
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12 }}>{t('proc_sample')}</span>
          <button type="button" className="btn btn-sm" onClick={() => run('normal', 'invoice_normal_alrajhi.pdf')}>{t('sample_normal')}</button>
          <button type="button" className="btn btn-sm" onClick={() => run('fraud', 'invoice_fraud_neom.pdf')}>{t('sample_fraud')}</button>
          <button type="button" className="btn btn-sm" onClick={() => run('dup', 'invoice_duplicate_gulf.pdf')}>{t('sample_dup')}</button>
          <button type="button" className="btn btn-sm" onClick={() => run('taxfail', 'invoice_taxfail_aramco.pdf')}>{t('sample_taxfail')}</button>
          <span style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('upload_source')}</span>
          <select
            className="select"
            style={{ width: 170 }}
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              if (e.target.value !== 'Manual') toast.info(`${t('upload_source_pull')}${e.target.value}`);
            }}
            aria-label={t('upload_source')}
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'Email' ? (lang === 'zh' ? '邮件' : lang === 'ar' ? 'البريد' : 'Email') : s === 'Manual' ? (lang === 'zh' ? '手工上传' : lang === 'ar' ? 'رفع يدوي' : 'Manual upload') : s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Low-confidence field correction (UC-01 alt. b) */}
      {scenario && lowConfFields.length > 0 && !fixDone ? (
        <div className="card card-pad" style={{ borderColor: 'var(--gold, #C08700)' }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>{t('ocr_fix_title')}</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{t('ocr_fix_sub')}</div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {lowConfFields.map((f) => {
              const key = f.key?.en || String(f.key);
              return (
                <div key={key} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="badge badge--gold" style={{ minWidth: 150 }}>{key} · {f.confidence}%</span>
                  <input
                    className="input"
                    style={{ flex: 1, minWidth: 180 }}
                    dir="ltr"
                    value={fixVals[key] ?? f.val}
                    onChange={(e) => setFixVals((prev) => ({ ...prev, [key]: e.target.value }))}
                    aria-label={key}
                  />
                </div>
              );
            })}
            <div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setFixDone(true);
                  toast.success(`${t('ocr_fix_done')}${fileName || scenario}`);
                }}
              >
                {t('ocr_fix_confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Supplementary registration (SCR-01 fields 10/11/12) */}
      {scenario ? (
        <div className="card card-pad">
          <div style={{ fontWeight: 900, fontSize: 13 }}>{t('extra_info_title')}</div>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>{t('extra_contract')}</div>
              <input className="input" dir="ltr" value={extra.contract} onChange={(e) => setExtra((p) => ({ ...p, contract: e.target.value }))} placeholder="SANAD-CT-2231" aria-label={t('extra_contract')} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>{t('extra_type')}</div>
              <select className="select" value={extra.type} onChange={(e) => setExtra((p) => ({ ...p, type: e.target.value }))} aria-label={t('extra_type')}>
                <option value="auto">{t('type_auto')}</option>
                <option value="contractor">{lang === 'zh' ? '承包商' : lang === 'ar' ? 'مقاول' : 'Contractor'}</option>
                <option value="supplier">{lang === 'zh' ? '供应商' : lang === 'ar' ? 'مورد' : 'Supplier'}</option>
                <option value="gov">{lang === 'zh' ? '政府机构' : lang === 'ar' ? 'جهة حكومية' : 'Government entity'}</option>
              </select>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>{t('extra_note')}</div>
              <input className="input" value={extra.note} onChange={(e) => setExtra((p) => ({ ...p, note: e.target.value }))} aria-label={t('extra_note')} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toast.success(t('extra_saved'))}>
              {t('extra_save')}
            </button>
          </div>
        </div>
      ) : null}

      {/* Multi-source ingest animation */}
      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 10 }}>
          <div>
            <div className="page-title" style={{ fontSize: 15 }}>{t('ingest_title')}</div>
            <div className="page-sub">{t('ingest_sub')}</div>
          </div>
        </div>
        <IngestAnimation runKey={runKey.current} />
      </div>

      {/* OCR extraction (only after a scenario is selected) */}
      {scenario ? (
        <div className="card card-pad">
          <OcrExtraction scenario={scenario} runKey={runKey.current} />
        </div>
      ) : null}

      {/* Multi-agent pipeline flow */}
      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 10 }}>
          <div>
            <div className="page-title" style={{ fontSize: 15 }}>{t('pipe_title')}</div>
            <div className="page-sub">{t('pipe_sub')}</div>
          </div>
        </div>
        {scenario ? (
          <PipelineFlow scenario={scenario} runKey={runKey.current} />
        ) : (
          <div className="muted" style={{ fontSize: 12 }}>{t('proc_sample')}</div>
        )}
      </div>

      {/* Result summary */}
      {inv && result ? (
        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>{result.title}</div>
              <div className="muted" style={{ marginTop: 8, lineHeight: 1.7, fontSize: 13 }}>{result.desc}</div>
              {result.hitl ? (
                <div className="banner banner--gold card" style={{ marginTop: 12 }}>
                  <div>
                    <b>HITL</b>
                    <p>{result.hitl}</p>
                  </div>
                  <span className="badge badge--gold">HITL</span>
                </div>
              ) : null}

              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {canNavigateApprovals ? (
                  <button className="btn btn-primary" type="button" onClick={() => nav('/approvals')}>{t('btn_go_apv')}</button>
                ) : null}
                <button className="btn" type="button" onClick={() => nav('/risk')}>{t('btn_go_risk')}</button>
                <button className="btn" type="button" onClick={() => nav('/invoices')}>{t('btn_go_inv')}</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
              <div className="risk-ring" style={{ '--p': inv.risk, '--ring-color': ringColor(inv.risk) }}>
                <span>{inv.risk}</span>
              </div>
              <div className="muted" style={{ fontSize: 12, textAlign: 'end' }}>
                {inv.id}<br />{T(inv, 'entity')}<br />{fmtMoney(inv.amount)} {inv.currency}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
