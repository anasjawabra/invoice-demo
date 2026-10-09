import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';

export default function FloatingAssistantButton() {
  const { t } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();

  if (loc.pathname.startsWith('/insights') || loc.pathname.startsWith('/planning')) return null; // both management areas have their own conversational entry

  return (
    <button type="button" className="floating-assistant" onClick={() => nav('/insights?view=smart')}>
      {t('dash_float_assistant')}
    </button>
  );
}
