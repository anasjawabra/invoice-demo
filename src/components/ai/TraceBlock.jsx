import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { L, confTone, riskTone } from './util';
import Typewriter from './Typewriter';
import ToolCallCard from './ToolCallCard';
import ReconciliationTable from './ReconciliationTable';
import TraceChart from './TraceChart';
import { SkeletonBar, SkeletonBlock, SkeletonLine, SkeletonRow } from './Skeleton';
import { RECON } from '../../data/mock';

// How long a block stays in its "running" state before auto-resolving.
// CRITICAL: every block type has a bounded, deterministic resolution so a
// trace can NEVER get stuck on a spinner. Typewriter blocks resolve via their
// own onDone; all others resolve on this timer (a safety fallback also runs).
// Skeleton-bearing types get a slightly longer beat so the shimmer actually
// registers as "the agent is analyzing" rather than a single-frame flash.
function resolveMs(block) {
  if (block.type === 'tool_call') return Math.min(block.latencyMs || 360, 1100);
  if (block.type === 'thought' || block.type === 'observation') return 2600; // safety net; Typewriter usually resolves first
  if (['reconciliation', 'evidence', 'confidence', 'chart', 'decision'].includes(block.type)) return 900;
  return 480;
}

/**
 * TraceBlock — renders ONE typed block of an agent run-trace and guarantees it
 * resolves from "running" to "content" via a single-fire completion callback.
 *
 * Supported block.type:
 *   thought | tool_call | observation | reconciliation | evidence |
 *   confidence | decision | chart
 *
 * Props: { block, running, done, onDone }
 */
export default function TraceBlock({ block, running, done, onDone }) {
  const { t, lang } = useI18n();
  const firedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [phase, setPhase] = useState(running ? 'running' : 'done');
  // Human feedback on a flagged (non-auto) decision — confirming or rejecting
  // it is recorded here so the AI can visibly "learn" from the correction,
  // rather than the trace being a one-way AI-decides / human-acts flow.
  const [feedback, setFeedback] = useState(null);

  const active = running && !done;

  useEffect(() => {
    if (!active) { setPhase('done'); return undefined; }
    setPhase('running');
    firedRef.current = false;
    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      setPhase('done');
      onDoneRef.current?.();
    };
    // Bounded resolution for non-typewriter blocks + universal safety fallback.
    const id = window.setTimeout(fire, resolveMs(block));
    return () => window.clearTimeout(id);
  }, [active, block]);

  const resolved = done || phase === 'done';

  function typewriterDone() {
    if (firedRef.current) return;
    firedRef.current = true;
    setPhase('done');
    onDoneRef.current?.();
  }

  return (
    <div className={`trace-block trace-block--${block.type}`}>
      {renderBody()}
    </div>
  );

  function metaLatency() {
    if (!resolved || block.type === 'tool_call' || !block.latencyMs) return null;
    return <span className="trace-block__lat" dir="ltr">{block.latencyMs}ms</span>;
  }

  function renderBody() {
    switch (block.type) {
      case 'thought':
        return (
          <div className="trace-thought">
            <span className="trace-block__icon" aria-hidden="true">✦</span>
            <div className="trace-thought__text">
              {active ? <Typewriter text={L(block.text, lang)} onDone={typewriterDone} /> : <span>{L(block.text, lang)}</span>}
            </div>
            {metaLatency()}
          </div>
        );

      case 'tool_call':
        return (
          <ToolCallCard
            tool={block.tool}
            request={block.request}
            response={block.response}
            latency={block.latencyMs}
            running={!resolved}
          />
        );

      case 'observation': {
        const tone = block.tone ? ` trace-obs--${block.tone}` : '';
        return (
          <div className={`trace-obs${tone}`}>
            <span className="trace-obs__tag">{t('trace_observation')}</span>
            <div className="trace-obs__text">
              {active ? <Typewriter text={L(block.text, lang)} onDone={typewriterDone} /> : <span>{L(block.text, lang)}</span>}
            </div>
          </div>
        );
      }

      case 'reconciliation': {
        if (!resolved) {
          return (
            <div className="skel-block-group">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          );
        }
        const recon = block.recon || RECON[block.scenario];
        return <ReconciliationTable recon={recon} tolerance={block.tolerance} />;
      }

      case 'evidence': {
        if (!resolved) {
          return (
            <div className="trace-evidence">
              <SkeletonBlock height={54} />
              <SkeletonBlock height={54} />
            </div>
          );
        }
        return (
          <div className="trace-evidence">
            {(block.items || []).map((it, i) => (
              <div className={`trace-cite${it.tone ? ` trace-cite--${it.tone}` : ''}`} key={i}>
                <div className="trace-cite__src">
                  <span className="trace-cite__badge">{t('trace_source')}</span>
                  <span dir="ltr">{L(it.source, lang)}</span>
                </div>
                <div className="trace-cite__detail">{L(it.detail, lang)}</div>
              </div>
            ))}
          </div>
        );
      }

      case 'confidence': {
        if (!resolved) {
          return (
            <div className="trace-conf">
              <div className="trace-conf__bars">
                <SkeletonBar />
                <SkeletonBar />
              </div>
            </div>
          );
        }
        const tone = block.risk ? riskTone(block.value) : confTone(block.value);
        const maxPoints = block.factors?.length
          ? Math.max(...block.factors.map((f) => Math.abs(f.points)), 1)
          : 1;
        return (
          <div className="trace-conf">
            {block.factors?.length ? (
              <div className="trace-conf__bars">
                {block.factors.map((f, i) => {
                  const width = Math.round((Math.abs(f.points) / maxPoints) * 100);
                  return (
                    <div className="trace-conf__bar-row" key={i}>
                      <div className="trace-conf__bar-head">
                        <span>{L(f.label, lang)}</span>
                        <b dir="ltr" style={{ color: tone }}>{f.points >= 0 ? '+' : ''}{f.points}</b>
                      </div>
                      <div className="trace-conf__bar-track">
                        <div className="trace-conf__bar-fill" style={{ width: `${width}%`, background: tone }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      }

      case 'chart': {
        if (!resolved) return <SkeletonBlock height={180} />;
        return <TraceChart chartType={block.chartType} payload={block.payload} />;
      }

      case 'decision': {
        if (!resolved) {
          return (
            <div className="trace-decision">
              <SkeletonLine width="30%" />
              <SkeletonLine width="85%" />
            </div>
          );
        }
        const tone = block.tone || 'ok';
        return (
          <div className={`trace-decision trace-decision--${tone}`}>
            <div className="trace-decision__head">
              <span className="trace-decision__tag">{t('trace_decision')}</span>
              <span className={`trace-decision__gate trace-decision__gate--${block.auto ? 'auto' : 'human'}`}>
                {block.auto ? `✓ ${t('trace_auto')}` : `⚑ ${t('trace_human')}`}
              </span>
            </div>
            <div className="trace-decision__text">{L(block.text, lang)}</div>
            {!block.auto ? (
              feedback ? (
                <div className="trace-decision__feedback trace-decision__feedback--done">
                  {feedback === 'confirmed' ? `✓ ${t('trace_feedback_confirmed')}` : `↺ ${t('trace_feedback_rejected')}`}
                </div>
              ) : (
                <div className="trace-decision__feedback">
                  <span className="trace-decision__feedback-label">{t('trace_feedback_prompt')}</span>
                  <div className="trace-decision__feedback-actions">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setFeedback('confirmed')}>
                      ✓ {t('trace_feedback_confirm')}
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setFeedback('rejected')}>
                      ↺ {t('trace_feedback_reject')}
                    </button>
                  </div>
                </div>
              )
            ) : null}
          </div>
        );
      }

      default:
        return null;
    }
  }
}
