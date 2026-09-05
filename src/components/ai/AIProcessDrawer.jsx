import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../context/I18nContext';
import { L } from './util';
import Typewriter from './Typewriter';
import AgentThinking from './AgentThinking';
import EvidenceList from './EvidenceList';
import TraceBlock from './TraceBlock';
import { AGENTS } from '../../data/mock';

/* Full localized agent name for an internal agent id. */
function agentName(id, lang) {
  const a = AGENTS.find((x) => x.id === id);
  if (!a) return '';
  if (lang === 'ar') return a.nameAr;
  if (lang === 'zh') return a.name;
  return a.nameEn;
}

/* ---------------------------------------------------------------- Legacy step
   Backward-compatible renderer for the original title/detail/rows/confidence
   step shape (kept so existing bundles that were not migrated still work). */
function LegacyStep({ step, lang, running, done, onDone }) {
  let cls = 'ai-step';
  if (step.blocked) cls += ' ai-step--blocked';
  else if (done) cls += ' ai-step--done';
  else if (running) cls += ' ai-step--running';

  const detail = L(step.detail, lang);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Any running step with NO streaming detail auto-advances after a short beat
  // so the timeline never stalls on the spinner.
  const autoAdvance = running && !done && !step.blocked && !detail;
  useEffect(() => {
    if (!autoAdvance) return undefined;
    const id = window.setTimeout(() => onDoneRef.current?.(), 700);
    return () => window.clearTimeout(id);
  }, [autoAdvance]);

  return (
    <div className={cls}>
      <div className="ai-step__tag">{step.agent ? agentName(step.agent, lang) : '•'}</div>
      <div className="ai-step__title">
        <span>{L(step.title, lang)}</span>
        {step.blocked ? <span className="badge badge--red">HITL</span> : null}
      </div>

      {step.handoff ? (
        <div className="ai-step__handoff">↳ {L(step.handoff, lang)}</div>
      ) : null}

      <div className="ai-step__detail">
        {running && !done ? (
          detail ? <Typewriter text={detail} onDone={onDone} /> : <AgentThinking />
        ) : (
          <span>{detail}</span>
        )}
      </div>

      {done || step.blocked ? (
        <>
          {step.rows?.length ? (
            <div className="ai-step__rows">
              <EvidenceList rows={step.rows} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Block step
   A typed-block step: streams its ordered `blocks[]` sequentially, then calls
   onDone. Blocks stream via TraceBlock which guarantees each one resolves. */
function BlockStep({ step, lang, running, done, onDone }) {
  const blocks = step.blocks || [];
  const [idx, setIdx] = useState(running ? 0 : blocks.length);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Reset streaming whenever this step becomes the active/running one.
  useEffect(() => {
    setIdx(running ? 0 : blocks.length);
  }, [running, blocks.length]);

  // When all blocks have streamed in, advance the drawer.
  useEffect(() => {
    if (running && idx >= blocks.length) {
      const id = window.setTimeout(() => onDoneRef.current?.(), 120);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [running, idx, blocks.length]);

  let cls = 'ai-step ai-step--blocks';
  if (step.blocked) cls += ' ai-step--blocked';
  else if (done) cls += ' ai-step--done';
  else if (running) cls += ' ai-step--running';

  const visible = running ? Math.min(idx + 1, blocks.length) : blocks.length;

  return (
    <div className={cls}>
      <div className="ai-step__tag">{step.agent ? agentName(step.agent, lang) : '•'}</div>
      <div className="ai-step__title">
        <span>{L(step.title, lang)}</span>
        {step.blocked ? <span className="badge badge--red">HITL</span> : null}
      </div>

      {step.handoff ? (
        <div className="ai-step__handoff">↳ {L(step.handoff, lang)}</div>
      ) : null}

      <div className="trace-blocks">
        {blocks.slice(0, visible).map((b, j) => (
          <TraceBlock
            key={j}
            block={b}
            running={running && j === idx}
            done={!running || j < idx}
            onDone={() => setIdx((n) => (n === j ? n + 1 : n))}
          />
        ))}
      </div>
    </div>
  );
}

function Step(props) {
  return props.step.blocks?.length ? <BlockStep {...props} /> : <LegacyStep {...props} />;
}

/**
 * AIProcessDrawer — THE core reusable "AI Analysis Process" panel.
 * Right-side slide-in (LEFT when RTL). Renders optional stat cards, a
 * sequentially-streamed reasoning timeline (legacy steps OR typed-block
 * traces), and a highlighted conclusion.
 *
 * Props:
 *  - open, onClose
 *  - data: { title, subtitle, agentTag, stats[], steps[], conclusion }
 */
export default function AIProcessDrawer({ open, onClose, data }) {
  const { t, lang } = useI18n();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open) setActive(0);
  }, [open, data]);

  const onEsc = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onEsc]);

  if (!open || !data) return null;

  const steps = data.steps || [];
  const stepsDone = active >= steps.length;
  const conclusion = data.conclusion;
  const cTone = conclusion?.tone ? ` ai-conclusion--${conclusion.tone}` : '';

  return createPortal(
    <>
      <div className="ai-drawer-overlay" onClick={onClose} />
      <aside className="ai-drawer ai-drawer--wide" role="dialog" aria-modal="true" aria-label={L(data.title, lang) || t('ai_drawer_title')}>
        <div className="ai-drawer__head">
          <div style={{ minWidth: 0 }}>
            <div className="ai-drawer__title">
              {data.agentTag ? <span className="badge badge--teal">{agentName(data.agentTag, lang)}</span> : null}
              <span>{L(data.title, lang) || t('ai_drawer_title')}</span>
            </div>
            {data.subtitle ? <div className="ai-drawer__sub">{L(data.subtitle, lang)}</div> : null}
          </div>
          <button type="button" className="ai-drawer__close" onClick={onClose} aria-label={t('close')}>
            ×
          </button>
        </div>

        <div className="ai-drawer__body">
          {data.stats?.length ? (
            <div className="ai-drawer__stats">
              {data.stats.map((s, i) => (
                <div className="ai-stat" key={i}>
                  <b>{s.value}</b>
                  <span>{L(s.label, lang)}</span>
                </div>
              ))}
            </div>
          ) : null}

          {steps.length ? (
            <div className="ai-timeline">
              {steps.slice(0, active + 1).map((step, i) => (
                <Step
                  key={i}
                  step={step}
                  lang={lang}
                  running={i === active}
                  done={i < active || step.blocked}
                  onDone={() => setActive((a) => (a === i ? a + 1 : a))}
                />
              ))}
            </div>
          ) : null}

          {stepsDone && conclusion ? (
            <div className={`ai-conclusion${cTone}`}>
              <div className="ai-conclusion__label">{t('ai_conclusion')}</div>
              <div className="ai-conclusion__text">{L(conclusion.text, lang)}</div>
              {conclusion.action ? (
                <div className="ai-conclusion__action">
                  <b>{t('ai_recommendation')}: </b>{L(conclusion.action, lang)}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    </>,
    document.body
  );
}
