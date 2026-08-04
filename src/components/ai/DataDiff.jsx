import React from 'react';
import { useI18n } from '../../context/I18nContext';
import { L } from './util';

/**
 * DataDiff — before/after field-normalization diff (raw → standardized).
 * Props:
 *  - rows: [{ label?: {zh,en,ar}|string, raw: string, std: string }]
 */
export default function DataDiff({ rows = [] }) {
  const { lang } = useI18n();
  if (!rows.length) return null;
  return (
    <div className="data-diff">
      {rows.map((r, i) => (
        <div key={i}>
          {r.label != null ? (
            <div className="ocr-field__key" style={{ marginBottom: 4 }}>{L(r.label, lang)}</div>
          ) : null}
          <div className="data-diff__row">
            <span className="data-diff__raw">{r.raw}</span>
            <span className="data-diff__arrow" aria-hidden="true">→</span>
            <span className="data-diff__std">{r.std}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
