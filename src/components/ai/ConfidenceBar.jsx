import React from 'react';
import { confTone } from './util';

/**
 * ConfidenceBar — a 0-100 score/confidence bar in brand colors.
 * Props:
 *  - label: localized string
 *  - value: 0-100 number
 *  - suffix: string appended to the value (default '%')
 */
export default function ConfidenceBar({ label, value = 0, suffix = '%' }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="conf-bar">
      {label != null ? (
        <div className="conf-bar__head">
          <span className="conf-bar__label">{label}</span>
          <span className="conf-bar__val">{v}{suffix}</span>
        </div>
      ) : null}
      <div className="conf-bar__track" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <div className={`conf-bar__fill ${confTone(v)}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
