import React from 'react';
import { useI18n } from '../../context/I18nContext';

function timeSaved(manualMin, agentSec) {
  const savedMin = manualMin - agentSec / 60;
  const pct = Math.round((savedMin / manualMin) * 100);
  return pct;
}

/**
 * EfficiencyStat — a compact "Manual baseline vs Agent" comparison that makes
 * the value explicit: time, cost and error-rate side by side, with a headline
 * "saved" figure. Tri-lingual and RTL-safe (uses a two-column grid that mirrors).
 *
 * Props:
 *  - data: { manualMin, agentSec, manualCost, manualErr, agentErr }
 */
export default function EfficiencyStat({ data }) {
  const { t } = useI18n();
  if (!data) return null;
  const pct = timeSaved(data.manualMin, data.agentSec);

  return (
    <div className="eff">
      <div className="eff__head">
        <span className="eff__title">{t('eff_title')}</span>
        <span className="eff__saved">−{pct}% {t('eff_time')}</span>
      </div>
      <div className="eff__grid">
        <div className="eff__col eff__col--manual">
          <div className="eff__col-tag">{t('eff_manual')}</div>
          <div className="eff__metric"><i>{t('eff_time')}</i><b dir="ltr">~{data.manualMin} min</b></div>
          <div className="eff__metric"><i>{t('eff_cost')}</i><b dir="ltr">SAR {data.manualCost}</b></div>
          <div className="eff__metric"><i>{t('eff_error')}</i><b dir="ltr">{data.manualErr}%</b></div>
        </div>
        <div className="eff__arrow" aria-hidden="true">→</div>
        <div className="eff__col eff__col--agent">
          <div className="eff__col-tag eff__col-tag--agent">{t('eff_agent')}</div>
          <div className="eff__metric"><i>{t('eff_time')}</i><b dir="ltr">{data.agentSec} sec</b></div>
          <div className="eff__metric"><i>{t('eff_cost')}</i><b dir="ltr">~SAR 0</b></div>
          <div className="eff__metric"><i>{t('eff_error')}</i><b dir="ltr">{data.agentErr}%</b></div>
        </div>
      </div>
    </div>
  );
}
