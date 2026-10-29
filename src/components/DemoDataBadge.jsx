import React from 'react';
import { useI18n } from '../context/I18nContext';

// Shared "this figure is illustrative, not real" marker — every card sourced
// from decisionRoomDemoData.js (or the Illustrative 2026 Baseline) renders
// this so the distinction between real invoice data and demo-sourced/
// illustrative data is visible on screen, not just in source comments.
export default function DemoDataBadge({ style }) {
  const { t } = useI18n();
  return (
    <span className="badge badge--gold" title={t('dr_demo_badge_title')} style={style}>
      {t('dr_demo_badge')}
    </span>
  );
}
