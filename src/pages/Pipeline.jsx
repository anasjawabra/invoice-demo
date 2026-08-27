import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../components/Toast';
import { fmtMoney, INVOICES } from '../data/mock';
import IngestAnimation from '../components/ai/IngestAnimation';
import OcrExtraction from '../components/ai/OcrExtraction';
import PipelineFlow from '../components/ai/PipelineFlow';

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
  const { t, T } = useI18n();
  const toast = useToast();
  const nav = useNavigate();

  const [scenario, setScenario] = useState(null);
  const [fileName, setFileName] = useState('');
  const runKey = useRef(0);
  const [, force] = useState(0);

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
    force((n) => n + 1);
    toast.info(t('proc_toast_start'));
  }

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
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  run(scenarioFromFilename(f.name), f.name);
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
        </div>
      </div>

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
