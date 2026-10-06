import React, { useState } from 'react';
import { Delete02Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import UIIcon from './UIIcon';

// Generic labeled range input — reused by every lever in this file and by
// InvoiceCollectionTab's own collection-rate slider, so every "drag to
// adjust an assumption" control in the Planning Room looks and behaves the
// same way.
export function Slider({ label, value, min, max, step = 1, unit = '', onChange }) {
  return (
    <div>
      <label className="muted" style={{ fontSize: 'var(--text-xs)', display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
        <span>{label}</span>
        <span dir="ltr">{value > 0 ? '+' : ''}{value}{unit}</span>
      </label>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}

const SCENARIO_KEYS = ['base', 'conservative', 'optimistic'];

// The 3 core levers + scenario presets + saved-scenario management — the
// single control surface Strategic Targets exposes for every assumption
// that isn't set via TargetCard's absolute-value fields.
export function TargetSliders({
  assumptions, onChange, scenarioKey, onScenarioSelect, onReset,
  savedScenarios, onSaveScenario, onLoadScenario, onDeleteScenario, t
}) {
  const [name, setName] = useState('');
  const patch = (key, value) => onChange({ ...assumptions, [key]: value });

  return (
    <div>
      <div className="grid grid-3" style={{ gap: 'var(--spacing-md)' }}>
        <Slider label={t('cfo_lever_revenue_growth')} value={assumptions.revenueGrowthPct} min={-25} max={25} unit="%" onChange={(v) => patch('revenueGrowthPct', v)} />
        <Slider label={t('cfo_lever_collection_rate')} value={assumptions.collectionRateDelta} min={-30} max={30} unit="pp" onChange={(v) => patch('collectionRateDelta', v)} />
        <Slider label={t('cfo_lever_expense_growth')} value={assumptions.expenseGrowthPct} min={-25} max={25} unit="%" onChange={(v) => patch('expenseGrowthPct', v)} />
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap', marginTop: 'var(--spacing-lg)' }}>
        {SCENARIO_KEYS.map((key) => (
          <button key={key} type="button" className={`btn btn-sm ${scenarioKey === key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onScenarioSelect(key)}>
            {t(`cfo_scenario_${key}`)}
          </button>
        ))}
        <button type="button" className="btn btn-sm btn-ghost" onClick={onReset}>{t('cfo_reset_actual')}</button>
      </div>

      <div className="hr" style={{ margin: 'var(--spacing-xl) 0' }} />

      <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder={t('cfo_scenario_name_placeholder')} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="btn btn-sm btn-primary"
          onClick={() => { if (name.trim()) { onSaveScenario(name.trim()); setName(''); } }}>
          {t('cfo_save_scenario')}
        </button>
      </div>

      {savedScenarios.length > 0 && (
        <div style={{ display: 'grid', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-md)' }}>
          {savedScenarios.map((s) => (
            <div key={s.id} className="pill" style={{ justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
              <span>{s.name}</span>
              <span style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={`${t('cfo_load')}: ${s.name}`} data-tooltip={t('cfo_load')} onClick={() => onLoadScenario(s)}><UIIcon icon={RefreshIcon} size={18} /></button>
                <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={`${t('cfo_delete')}: ${s.name}`} data-tooltip={t('cfo_delete')} onClick={() => onDeleteScenario(s.id)}><UIIcon icon={Delete02Icon} size={18} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="muted" style={{ fontSize: 'var(--text-2xs)', marginTop: 'var(--spacing-md)' }}>{t('cfo_session_note')}</p>
    </div>
  );
}

const CHAPTER_IDS = ['ch1', 'ch2', 'ch3', 'ch4'];

// Per-chapter expense adjustment (on top of the global Expense Growth
// lever) — the 4 standard government-budget chapters from
// decisionRoomDemoData.DEMO_EXPENSE_CHAPTERS.
export function ChapterSliders({ assumptions, onChange, t }) {
  const patchChapter = (id, value) => onChange({ ...assumptions, chapterAdjustments: { ...assumptions.chapterAdjustments, [id]: value } });
  return (
    <div className="grid grid-4" style={{ gap: 'var(--spacing-md)' }}>
      {CHAPTER_IDS.map((id, i) => (
        <Slider key={id} label={t(`cfo_chapter_${i + 1}`)} value={assumptions.chapterAdjustments[id]} min={-30} max={30} unit="%" onChange={(v) => patchChapter(id, v)} />
      ))}
    </div>
  );
}

// A proposed new investment (amount + timing) and a contract-payment
// rephasing control — both real levers on demo-sourced commitment data,
// netted into expected outflows by cfoModel.computeCFOModel.
export function InvestmentInputs({ assumptions, onChange, t }) {
  const patch = (key, value) => onChange({ ...assumptions, [key]: value });
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  return (
    <div className="grid grid-3" style={{ gap: 'var(--spacing-md)' }}>
      <div>
        <label htmlFor="cfo-investment-amount" className="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>{t('cfo_investment_amount')}</label>
        <input id="cfo-investment-amount" className="input" type="number" min="0" value={assumptions.investmentAmount} onChange={(e) => patch('investmentAmount', Math.max(0, Number(e.target.value) || 0))} />
      </div>
      <div>
        <label htmlFor="cfo-investment-timing" className="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>{t('cfo_investment_timing')}</label>
        <input id="cfo-investment-timing" className="input" type="number" min="0" max="24" value={assumptions.investmentTimingMonths} onChange={(e) => patch('investmentTimingMonths', clamp(Number(e.target.value) || 0, 0, 24))} />
      </div>
      <div>
        <label htmlFor="cfo-contract-deferral" className="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>{t('cfo_contract_deferral')}</label>
        <input id="cfo-contract-deferral" className="input" type="number" min="-12" max="12" value={assumptions.contractPaymentDeferralMonths} onChange={(e) => patch('contractPaymentDeferralMonths', clamp(Number(e.target.value) || 0, -12, 12))} />
      </div>
    </div>
  );
}
