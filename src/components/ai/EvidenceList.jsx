import React from 'react';
import { useI18n } from '../../context/I18nContext';
import { L } from './util';

/**
 * EvidenceList — labelled evidence rows.
 * Props:
 *  - rows: [{ label: {zh,en,ar}|string, value: {zh,en,ar}|string, tone?: 'danger'|'warn'|'ok' }]
 */
export default function EvidenceList({ rows = [] }) {
  const { lang } = useI18n();
  if (!rows.length) return null;
  return (
    <div className="evidence-list">
      {rows.map((r, i) => (
        <div className="evidence-row" key={i}>
          <span className="evidence-row__label">{L(r.label, lang)}</span>
          <span className={`evidence-row__value${r.tone ? ` evidence-row__value--${r.tone}` : ''}`}>
            {L(r.value, lang)}
          </span>
        </div>
      ))}
    </div>
  );
}
