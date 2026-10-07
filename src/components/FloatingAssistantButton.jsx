import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Chatting01Icon } from '@hugeicons/core-free-icons';
import { useI18n } from '../context/I18nContext';
import UIIcon from './UIIcon';

export default function FloatingAssistantButton() {
  const { t } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();

  if (loc.pathname.startsWith('/assistant')) return null;

  return (
    <button
      type="button"
      className="floating-assistant"
      aria-label={t('dash_float_assistant')}
      data-tooltip={t('dash_float_assistant')}
      onClick={() => nav('/assistant')}
    >
      <UIIcon icon={Chatting01Icon} size={22} />
    </button>
  );
}
