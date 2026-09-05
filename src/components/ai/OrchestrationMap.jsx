import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { AGENTS } from '../../data/mock';
import { ORCH_MESSAGES, ORCH_LATENCY } from '../../data/aiProcess';
import OrchestrationLog from './OrchestrationLog';

const SUB_AGENTS = AGENTS.filter((a) => a.id !== 'orch');

// Derive queued → running → done from the messages revealed so far:
//  - an agent that has SENT a message is done
//  - an agent that has (only) RECEIVED a message is running
//  - otherwise queued
function agentStatus(id, revealed) {
  let received = false;
  for (const m of revealed) {
    if (m.from === id) return 'done';
    if (m.to === id) received = true;
  }
  return received ? 'running' : 'queued';
}

/**
 * OrchestrationMap — a LIVE multi-agent orchestration graph. The orchestrator
 * dispatches to the 11 specialist agents; edges light up as "messages" flow,
 * each node shows a live status chip (queued → running → done) plus a
 * per-agent metric (calls / avg latency / accuracy), and an inter-agent
 * message log scrolls the handoff payloads. Some steps report back to the
 * orchestrator in PARALLEL when they trigger a HITL breakpoint.
 * Bounded + replayable via the Replay button. GOV-SA light theme.
 */
export default function OrchestrationMap() {
  const { t, T } = useI18n();
  const [running, setRunning] = useState(false);
  const [cursor, setCursor] = useState(-1); // last-revealed message index
  const [played, setPlayed] = useState(false);
  const timers = useRef([]);

  function clearTimers() {
    timers.current.forEach((x) => clearTimeout(x));
    timers.current = [];
  }
  useEffect(() => clearTimers, []);

  function play() {
    clearTimers();
    setRunning(true);
    setPlayed(true);
    setCursor(-1);
    ORCH_MESSAGES.forEach((_, i) => {
      timers.current.push(setTimeout(() => setCursor(i), 260 + i * 1050));
    });
    timers.current.push(
      setTimeout(() => setRunning(false), 260 + ORCH_MESSAGES.length * 1050)
    );
  }

  const revealed = useMemo(
    () => (cursor >= 0 ? ORCH_MESSAGES.slice(0, cursor + 1) : []),
    [cursor]
  );

  // Agents touched by the in-flight message (both ends light up → parallel edges).
  const liveTags = running && cursor >= 0
    ? [ORCH_MESSAGES[cursor].from, ORCH_MESSAGES[cursor].to].filter((x) => x !== 'orch')
    : [];

  const a0Done = played && !running;

  return (
    <div className="card card-pad orch-map">
      <div className="page-head" style={{ marginBottom: 4 }}>
        <div>
          <div className="page-title" style={{ fontSize: 16 }}>{t('orch_title')}</div>
          <div className="page-sub">{t('orch_sub')}</div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={play} disabled={running}>
          {running ? t('orch_running') : played ? t('orch_replay') : t('orch_run')}
        </button>
      </div>

      <div className={`orch-hub${running ? ' orch-hub--live' : ''}`}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>{T(AGENTS[0], 'name')}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>
            {t('a0_note')}
          </div>
        </div>
        <span className={`orch-chip orch-chip--${running ? 'running' : a0Done ? 'done' : 'queued'}`}>
          {running ? t('orch_running') : a0Done ? t('orch_done') : t('orch_queued')}
        </span>
      </div>

      <div className="orch-lane">
        {SUB_AGENTS.map((a) => {
          const status = played ? agentStatus(a.id, revealed) : 'queued';
          const on = liveTags.includes(a.id);
          const lat = ORCH_LATENCY[a.id];
          return (
            <div key={a.id} className={`orch-agent orch-agent--${status}${on ? ' orch-agent--active' : ''}`}>
              {on ? <span className="orch-agent__pulse" /> : null}
              <div className="orch-agent__topline">
                <span className={`orch-chip orch-chip--${status}`}>
                  {status === 'done' ? t('orch_done') : status === 'running' ? t('orch_running') : t('orch_queued')}
                </span>
              </div>
              <div className="orch-agent__name">{T(a, 'name')}</div>
              <div className="orch-agent__metrics">
                <span title={t('orch_metric_calls')}>⚙ {a.calls.toLocaleString('en-US')}</span>
                <span title={t('orch_metric_latency')} dir="ltr">◷ {lat}ms</span>
                <span title={t('orch_metric_acc')}>✓ {a.acc}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <OrchestrationLog messages={revealed} activeIndex={running ? cursor : -1} />
    </div>
  );
}
