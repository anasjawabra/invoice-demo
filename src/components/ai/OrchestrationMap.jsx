import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { AGENTS } from '../../data/mock';
import { ORCH_TASKS } from '../../data/aiProcess';
import { L } from './util';

const SUB_AGENTS = AGENTS.filter((a) => a.id !== 'A0');

// Which agent tags are "lit" while a given task is routing (both ends of A?→A?).
function agentsOfTask(task) {
  return (task.route.match(/A\d/g) || []).filter((tag) => tag !== 'A0');
}

/**
 * OrchestrationMap — A0 orchestrator dispatching to A1..A6 with an animated,
 * step-by-step task routing stream and HITL breakpoints. GOV-SA light theme.
 */
export default function OrchestrationMap() {
  const { t, T, lang, isRtl } = useI18n();
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(-1); // index into ORCH_TASKS
  const timers = useRef([]);

  function clearTimers() {
    timers.current.forEach((x) => clearTimeout(x));
    timers.current = [];
  }

  function play() {
    clearTimers();
    setRunning(true);
    setActive(-1);
    ORCH_TASKS.forEach((_, i) => {
      timers.current.push(setTimeout(() => setActive(i), 300 + i * 1100));
    });
    timers.current.push(
      setTimeout(() => setRunning(false), 300 + ORCH_TASKS.length * 1100)
    );
  }

  useEffect(() => clearTimers, []);

  const activeTags = active >= 0 ? agentsOfTask(ORCH_TASKS[active]) : [];
  const visibleTasks = active >= 0 ? ORCH_TASKS.slice(0, active + 1) : [];

  return (
    <div className="card card-pad orch-map">
      <div className="page-head" style={{ marginBottom: 4 }}>
        <div>
          <div className="page-title" style={{ fontSize: 16 }}>{t('orch_title')}</div>
          <div className="page-sub">{t('orch_sub')}</div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={play}
          disabled={running}
        >
          {running ? t('orch_running') : t('orch_run')}
        </button>
      </div>

      <div className="orch-hub">
        <span className="orch-hub__badge">A0</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>{T(AGENTS[0], 'name')}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>
            {t('a0_note')}
          </div>
        </div>
      </div>

      <div className="orch-lane">
        {SUB_AGENTS.map((a) => {
          const on = activeTags.includes(a.id);
          return (
            <div key={a.id} className={`orch-agent${on ? ' orch-agent--active' : ''}`}>
              {on ? <span className="orch-agent__pulse" /> : null}
              <div className="orch-agent__tag">{a.id}</div>
              <div className="orch-agent__name">{T(a, 'name')}</div>
              <div
                className="orch-agent__status"
                style={{ color: on ? 'var(--primary)' : 'var(--txt-mute)' }}
              >
                {on ? t('pipe_running') : t('online')}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid" style={{ gap: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 12, color: 'var(--txt-mute)' }}>
          {t('orch_tasks')}
        </div>
        {visibleTasks.length === 0 ? (
          <div className="muted" style={{ fontSize: 12 }}>{t('orch_sub')}</div>
        ) : (
          visibleTasks.map((task, i) => (
            <div key={task.route} className={`orch-task${task.hitl ? ' orch-task--hitl' : ''}`}>
              <span className="orch-task__route">{isRtl ? task.route.split(' ').reverse().join(' ') : task.route}</span>
              <span style={{ color: task.hitl ? '#8A5A00' : 'var(--txt)' }}>{L(task.text, lang)}</span>
              {i === active && running ? <span className="orch-agent__pulse" style={{ position: 'static', marginInlineStart: 'auto' }} /> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
