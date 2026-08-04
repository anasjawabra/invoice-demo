import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { L } from './util';
import { OCR_SAMPLES } from '../../data/aiProcess';
import DataDiff from './DataDiff';
import AgentThinking from './AgentThinking';

/**
 * OcrExtraction — an invoice "document" panel with fields extracted one-by-one
 * (staggered) WITH per-field confidence, plus a raw → standardized diff.
 * Re-runs whenever `runKey` changes. `scenario` selects the sample.
 */
export default function OcrExtraction({ scenario = 'normal', runKey }) {
  const { t, lang } = useI18n();
  const sample = OCR_SAMPLES[scenario] || OCR_SAMPLES.normal;
  const [shown, setShown] = useState(0);
  const timers = useRef([]);

  useEffect(() => {
    timers.current.forEach((x) => clearTimeout(x));
    timers.current = [];
    setShown(0);
    sample.fields.forEach((_, i) => {
      timers.current.push(setTimeout(() => setShown((n) => Math.max(n, i + 1)), 350 + i * 240));
    });
    return () => {
      timers.current.forEach((x) => clearTimeout(x));
      timers.current = [];
    };
  }, [runKey, scenario]);

  const done = shown >= sample.fields.length;

  return (
    <div>
      <div className="page-head" style={{ marginBottom: 10 }}>
        <div>
          <div className="page-title" style={{ fontSize: 15 }}>{t('ocr_title')}</div>
          <div className="page-sub">{t('ocr_sub')}</div>
        </div>
        {!done ? <AgentThinking variant="spinner" label={`A1 · ${t('ai_thinking')}`} /> : <span className="badge badge--green">✓</span>}
      </div>

      <div className="ocr-board">
        <div className="ocr-doc">
          {!done ? <div className="ocr-doc__scan" /> : null}
          <div className="ocr-doc__title">{sample.docTitle}</div>
          <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.8 }}>
            {sample.fields.slice(0, shown).map((f) => (
              <div key={L(f.key, lang)}>{L(f.key, lang)}: <b style={{ color: 'var(--txt-dim)' }}>{f.val}</b></div>
            ))}
          </div>
        </div>

        <div>
          <div className="ocr-fields">
            {sample.fields.map((f, i) => (
              <div key={L(f.key, lang)} className={`ocr-field${i < shown ? ' ocr-field--in' : ''}`}>
                <div>
                  <div className="ocr-field__key">{L(f.key, lang)}</div>
                  <div className="ocr-field__val">{f.val}</div>
                </div>
                <div className="ocr-field__meta">
                  <span className={`ocr-conf ${f.low ? 'ocr-conf--low' : 'ocr-conf--ok'}`}>{f.confidence}%</span>
                </div>
              </div>
            ))}
          </div>

          {done ? (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{t('ocr_diff')}</div>
              <DataDiff rows={sample.diff} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
