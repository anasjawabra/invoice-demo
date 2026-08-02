import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../components/Toast';
import { fmtMoney, INVOICES, PIPELINE } from '../data/mock';

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

  const [scenario, setScenario] = useState(null); // normal | fraud | dup | taxfail
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const [done, setDone] = useState(false);
  const [fileName, setFileName] = useState('');

  const timers = useRef([]);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };
  }, []);

  const inv = useMemo(() => {
    if (!scenario) return null;
    return pickInvoice(scenario);
  }, [scenario]);

  const result = useMemo(() => {
    if (!scenario) return null;
    if (scenario === 'fraud') {
      return { title: t('sc_fraud_title'), desc: t('sc_fraud_desc'), hitl: t('sc_fraud_hitl') };
    }
    if (scenario === 'dup') {
      return { title: t('sc_dup_title'), desc: t('sc_dup_desc'), hitl: t('sc_dup_hitl') };
    }
    if (scenario === 'taxfail') {
      return { title: t('sc_taxfail_title'), desc: t('sc_taxfail_desc'), hitl: t('sc_taxfail_hitl') };
    }
    return { title: t('sc_normal_title'), desc: t('sc_normal_desc'), hitl: null };
  }, [scenario, t]);

  const skipAfter = useMemo(() => {
    // duplicate scenario stops at A1
    if (scenario === 'dup') return 0;
    return null;
  }, [scenario]);

  const canNavigateApprovals = scenario === 'fraud' || scenario === 'taxfail' || scenario === 'normal';

  function resetRun(nextScenario, nextFileName = '') {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    setScenario(nextScenario);
    setFileName(nextFileName);
    setRunning(false);
    setDone(false);
    setStep(-1);
  }

  function run(nextScenario, nextFileName = '') {
    resetRun(nextScenario, nextFileName);
    toast.info(t('proc_toast_start'));
    setRunning(true);

    const total = PIPELINE.length;
    const stop = nextScenario === 'dup' ? 0 : total - 1;

    for (let i = 0; i <= stop; i++) {
      const tm = setTimeout(() => {
        setStep(i);
        if (i === stop) {
          setRunning(false);
          setDone(true);
          toast.success(`${t('proc_toast_done')}${pickInvoice(nextScenario).id}`);
        }
      }, 900 + i * 900);
      timers.current.push(tm);
    }
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('process')}</div>
          <div className="page-sub">{t('proc_sub')}</div>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14 }}>{t('proc_title')}</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{t('proc_up_p')}</div>

            <div
              className="card"
              style={{
                marginTop: 12,
                padding: 16,
                borderStyle: 'dashed',
                background: 'rgba(255,255,255,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
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
                      const sc = scenarioFromFilename(f.name);
                      run(sc, f.name);
                    }}
                  />
                </label>
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 12 }}>{t('proc_sample')}</span>
              <button type="button" className="btn btn-sm" onClick={() => run('normal', 'invoice_normal_alrajhi.pdf')}>
                {t('sample_normal')}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => run('fraud', 'invoice_fraud_neom.pdf')}>
                {t('sample_fraud')}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => run('dup', 'invoice_duplicate_gulf.pdf')}>
                {t('sample_dup')}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => run('taxfail', 'invoice_taxfail_aramco.pdf')}>
                {t('sample_taxfail')}
              </button>
            </div>
          </div>

          <div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 900 }}>{t('pipe_title')}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{t('pipe_sub')}</div>
              <div className="hr" />
              <div className="pipeline">
                {PIPELINE.map((s, idx) => {
                  const isSkip = skipAfter != null && idx > skipAfter;
                  const isRunning = running && idx === step;
                  const isDone = (done && !isSkip && idx <= step) || (!running && done && idx <= step);

                  let cls = 'pipe-step';
                  if (isSkip) cls += ' pipe-step--skip';
                  else if (isRunning) cls += ' pipe-step--running';
                  else if (isDone) cls += ' pipe-step--done';

                  return (
                    <div key={s.agent} className={cls}>
                      <b>
                        {s.agent} · {T(s, 'name')}
                      </b>
                      <p>{T(s, 'hint')}</p>
                      <div style={{ marginTop: 10 }}>
                        {isSkip ? (
                          <span className="badge">{t('pipe_skip')}</span>
                        ) : isRunning ? (
                          <span className="badge badge--teal">{t('pipe_running')}</span>
                        ) : isDone ? (
                          <span className="badge badge--green">✓</span>
                        ) : (
                          <span className="badge">{t('pipe_ready')}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {inv && result ? (
        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>{result.title}</div>
              <div className="muted" style={{ marginTop: 8, lineHeight: 1.7, fontSize: 13 }}>{result.desc}</div>
              {result.hitl ? (
                <div className="card" style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>HITL</div>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>{result.hitl}</div>
                </div>
              ) : null}

              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {canNavigateApprovals ? (
                  <button className="btn btn-primary" type="button" onClick={() => nav('/approvals')}>
                    {t('btn_go_apv')}
                  </button>
                ) : null}
                <button className="btn" type="button" onClick={() => nav('/risk')}>
                  {t('btn_go_risk')}
                </button>
                <button className="btn" type="button" onClick={() => nav('/invoices')}>
                  {t('btn_go_inv')}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
              <div
                className="risk-ring"
                style={{
                  '--p': inv.risk,
                  '--ring-color': ringColor(inv.risk)
                }}
              >
                <span>{inv.risk}</span>
              </div>
              <div className="muted" style={{ fontSize: 12, textAlign: 'end' }}>
                {inv.id}
                <br />
                {T(inv, 'entity')}
                <br />
                {fmtMoney(inv.amount)} {inv.currency}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
