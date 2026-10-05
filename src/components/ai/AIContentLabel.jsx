import React from 'react';
import { ArtificialIntelligence04Icon } from '@hugeicons/core-free-icons';
import { useI18n } from '../../context/I18nContext';
import UIIcon from '../UIIcon';

const COPY = {
  generated: {
    en: 'AI-generated',
    zh: 'AI 生成',
    ar: 'تم إنشاؤه بالذكاء الاصطناعي'
  },
  refining: {
    en: 'AI refining',
    zh: 'AI 正在优化',
    ar: 'جارٍ التحسين باستخدام الذكاء الاصطناعي'
  }
};

export default function AIContentLabel({ state = 'generated', className = '' }) {
  const { lang } = useI18n();
  const label = COPY[state]?.[lang] || COPY[state]?.en || COPY.generated.en;
  return (
    <span className={`ai-content-label ${className}`.trim()} aria-label={label}>
      <UIIcon icon={ArtificialIntelligence04Icon} size={16} />
      <span>{label}</span>
    </span>
  );
}
