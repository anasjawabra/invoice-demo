import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { PIPELINE } from '../../data/mock';
import { PIPELINE_WORK, SCENARIO_STALL, SCENARIO_PENDING, NODE_DRAWERS } from '../../data/aiProcess';
import { L } from './util';
import Typewriter from './Typewriter';
import AgentThinking from './AgentThinking';
import AIProcessDrawer from './AIProcessDrawer';

function Node({ step, idx, scenario, status, onOpen, hasDrawer }) {
  const { t, T, lang } = useI18n();
  const [thinking, setThinking] = useState(true);
  const work = (PIPELINE_WORK[scenario] || [])[idx] || {};

  useEffect(() => {
    if (status === 'running') {
      setThinking(true);
      const tm = setTimeout(() => setThinking(false), 520);
      return () => clearTimeout(tm);
    }
    setThinking(false);
    return undefined;
  }, [status, idx]);

  const cls = `pipe-node pipe-node--${status}`;
  const showConclusion = status === 'done' || status === 'blocked' || (status === 'running' && !thinking);
  const conclusion = L(work.conclusion, lang);

  return (
    <div className={cls}>
      <div className="pipe-node__head">
        <span className="pipe-node__tag">{String(idx + 1).padStart(2, '0')}</span>
        {status === 'blocked' ? <span className="badge badge--red">{t('node_blocked')}</span>
          : status === 'done' ? <span className="badge badge--green">✓</span>
          : status === 'running' ? <span className="badge badge--teal">{t('pipe_running')}</span>
          : <span className="badge">{t('node_pending')}</span>}
      </div>
      <div className="pipe-node__name">{T(step, 'name')}</div>
      <div className="pipe-node__hint">{T(step, 'hint')}</div>

      {idx >= 1 && work.handoff && status !== 'pending' ? (
        <div className="pipe-node__handoff">↳ {L(work.handoff, lang)}</div>
      ) : null}

      <div className="pipe-node__work">
        {status === 'running' && thinking ? (
          <AgentThinking label={`${step.agent} · ${t('ai_thinking')}`} />
        ) : showConclusion && conclusion ? (
          status === 'running' ? <Typewriter text={conclusion} /> : <span>{conclusion}</span>
        ) : null}
      </div>

      {hasDrawer && (status === 'done' || status === 'blocked') ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onOpen}>
          {t('ai_process_btn')}
        </button>
      ) : null}
    </div>
  );
}

/**
 * PipelineFlow — the 11-agent chain with sequential loading→typewriter,
 * data handoff, scenario-based stalling, and per-node AIProcessDrawer.
 */
export default function PipelineFlow({ scenario, runKey }) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState(-1);
  const [finished, setFinished] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const timers = useRef([]);

  const stall = SCENARIO_STALL[scenario];
  const lastNode = stall == null ? PIPELINE.length - 1 : stall;
  const nodeDrawers = NODE_DRAWERS[scenario] || {};

  useEffect(() => {
    timers.current.forEach((x) => clearTimeout(x));
    timers.current = [];
    if (!scenario) return undefined;
    setStep(-1);
    setFinished(false);
    setDrawer(null);

    for (let i = 0; i <= lastNode; i++) {
      timers.current.push(setTimeout(() => setStep(i), 400 + i * 1300));
    }
    timers.current.push(setTimeout(() => setFinished(true), 400 + (lastNode + 1) * 1300));

    return () => {
      timers.current.forEach((x) => clearTimeout(x));
      timers.current = [];
    };
  }, [runKey, scenario, lastNode]);

  function status(i) {
    if (i < step) return 'done';
    if (i === step) {
      if (!finished) return 'running';
      return stall != null && i === stall ? 'blocked' : 'done';
    }
    return 'pending';
  }

  if (!scenario) return null;

  const pending = stall != null ? SCENARIO_PENDING[scenario] : null;

  return (
    <div>
      <div className="pipe-flow">
        {PIPELINE.map((s, i) => (
          <Node
            key={s.agent}
            step={s}
            idx={i}
            scenario={scenario}
            status={status(i)}
            hasDrawer={!!nodeDrawers[s.agent]}
            onOpen={() => setDrawer(nodeDrawers[s.agent])}
          />
        ))}
      </div>

      {finished && pending ? (
        <div className="card" style={{ marginTop: 12, padding: 12, borderColor: 'rgba(175,8,24,0.30)', background: 'rgba(175,8,24,0.04)' }}>
          <div style={{ fontWeight: 900, fontSize: 12, color: 'var(--danger)' }}>{t('node_pending_action')}</div>
          <div className="muted" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>{L(pending, lang)}</div>
        </div>
      ) : null}

      <AIProcessDrawer open={!!drawer} onClose={() => setDrawer(null)} data={drawer} />
    </div>
  );
}
