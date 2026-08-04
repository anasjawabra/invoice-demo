import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { L } from './util';
import { INGEST_SOURCES } from '../../data/aiProcess';

const TOTAL = INGEST_SOURCES.reduce((s, x) => s + x.count, 0);

/**
 * IngestAnimation — invoices flowing in from 6 sources into a unified queue,
 * then "standardized to unified format". Re-runs whenever `runKey` changes.
 */
export default function IngestAnimation({ runKey }) {
  const { t, lang } = useI18n();
  const [active, setActive] = useState(-1);
  const [count, setCount] = useState(0);
  const [normalized, setNormalized] = useState(false);
  const timers = useRef([]);

  useEffect(() => {
    timers.current.forEach((x) => clearInterval(x) || clearTimeout(x));
    timers.current = [];
    setActive(-1);
    setCount(0);
    setNormalized(false);

    // Highlight each source in sequence
    INGEST_SOURCES.forEach((_, i) => {
      timers.current.push(setTimeout(() => setActive(i), 250 + i * 260));
    });

    // Tick the unified-queue counter up to TOTAL
    let c = 0;
    const step = Math.ceil(TOTAL / 40);
    const iv = setInterval(() => {
      c = Math.min(TOTAL, c + step);
      setCount(c);
      if (c >= TOTAL) clearInterval(iv);
    }, 45);
    timers.current.push(iv);

    timers.current.push(setTimeout(() => { setActive(-1); setNormalized(true); }, 250 + INGEST_SOURCES.length * 260 + 300));

    return () => {
      timers.current.forEach((x) => { clearInterval(x); clearTimeout(x); });
      timers.current = [];
    };
  }, [runKey]);

  return (
    <div className="ingest-board">
      <div className="ingest-sources">
        {INGEST_SOURCES.map((s, i) => (
          <div key={s.id} className={`ingest-source${active === i ? ' ingest-source--active' : ''}`}>
            <b>{L(s.name, lang)}</b>
            <span>{s.count.toLocaleString('en-US')}</span>
          </div>
        ))}
      </div>

      <div className="ingest-arrow" aria-hidden="true">→</div>

      <div className="ingest-queue">
        <div className="ingest-queue__count">{count.toLocaleString('en-US')}</div>
        <div className="ingest-queue__label">{t('ingest_queue')}</div>
        {normalized ? (
          <div className="ingest-chip">✓ {t('ingest_unified')} · {t('ingest_normalized')}</div>
        ) : null}
      </div>
    </div>
  );
}
