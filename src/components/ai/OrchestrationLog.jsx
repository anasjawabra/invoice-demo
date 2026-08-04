import React, { useEffect, useRef } from 'react';
import { useI18n } from '../../context/I18nContext';
import { L } from './util';

/**
 * OrchestrationLog — a scrolling inter-agent message log (A?→A? with a realistic
 * handoff payload summary). Auto-scrolls to the newest entry. HITL and parallel
 * handoffs are visually tagged. Tri-lingual + RTL-safe (route direction is
 * mirrored for RTL).
 *
 * Props:
 *  - messages: revealed ORCH_MESSAGES slice
 *  - activeIndex: index of the message currently "in flight" (adds a pulse)
 */
export default function OrchestrationLog({ messages, activeIndex }) {
  const { t, lang, isRtl } = useI18n();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  return (
    <div className="orch-log">
      <div className="orch-log__head">{t('orch_log')}</div>
      <div className="orch-log__scroll">
        {messages.length === 0 ? (
          <div className="orch-log__empty">{t('orch_sub')}</div>
        ) : (
          messages.map((m, i) => {
            const arrow = isRtl ? '←' : '→';
            const route = `${m.from} ${arrow} ${m.to}`;
            return (
              <div
                key={i}
                className={`orch-msg${m.hitl ? ' orch-msg--hitl' : ''}${i === activeIndex ? ' orch-msg--live' : ''}`}
              >
                <span className="orch-msg__route" dir="ltr">{route}</span>
                <span className="orch-msg__text">{L(m.text, lang)}</span>
                <span className="orch-msg__tags">
                  {m.parallel ? <span className="orch-msg__tag orch-msg__tag--par">∥ {t('orch_parallel')}</span> : null}
                  {m.hitl ? <span className="orch-msg__tag orch-msg__tag--hitl">HITL</span> : null}
                </span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
