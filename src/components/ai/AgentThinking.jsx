import React from 'react';
import { useI18n } from '../../context/I18nContext';

/**
 * AgentThinking — a government-clean "AI is working" indicator.
 * Props:
 *  - label: localized string (already resolved) or falls back to a default
 *  - variant: 'dots' (default) | 'spinner'
 */
export default function AgentThinking({ label, variant = 'dots' }) {
  const { t } = useI18n();
  const text = label || t('ai_thinking');

  return (
    <span className="ai-thinking" role="status" aria-live="polite">
      {variant === 'spinner' ? (
        <span className="ai-spinner" aria-hidden="true" />
      ) : (
        <span className="ai-thinking__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      <span>{text}</span>
    </span>
  );
}
