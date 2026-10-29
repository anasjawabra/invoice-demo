import React from 'react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { useI18n } from '../context/I18nContext';
import UIIcon from './UIIcon';

export default function DirectionalIcon({ back = false, size = 16 }) {
  const { isRtl } = useI18n();
  return <UIIcon icon={(back ? !isRtl : isRtl) ? ArrowLeft01Icon : ArrowRight01Icon} size={size} />;
}
