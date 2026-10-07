import React from 'react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { useI18n } from '../context/I18nContext';
import UIIcon from './UIIcon';

export default function DirectionalIcon({ direction = 'forward', size = 16, ...props }) {
  const { isRtl } = useI18n();
  const pointsLeft = direction === 'forward' ? isRtl : !isRtl;

  return (
    <UIIcon
      icon={pointsLeft ? ArrowLeft01Icon : ArrowRight01Icon}
      size={size}
      {...props}
    />
  );
}
