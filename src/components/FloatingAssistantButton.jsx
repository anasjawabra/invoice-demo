import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';

export default function FloatingAssistantButton() {
  const { t } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();

  if (loc.pathname.startsWith('/assistant')) return null;

  return (
    <button type="button" className="floating-assistant" onClick={() => nav('/assistant')}>
      {t('dash_float_assistant')}
    </button>
  );
}
