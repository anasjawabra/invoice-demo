// The ONE compact filter context of the dashboard and the Decision Room: the platform toolbar bound to the shared revenue scope (src/components/filters).
// <FilterChips page="dashboard" /> (default) or page="decisions" — the configuration comes from FILTER_PAGES. Name kept so existing imports still work.
import React from 'react';
import { useRevenue } from '../../context/RevenueContext';
import { DEFAULT_CONFIG } from '../../data/revenueMetrics';
import { useAr } from '../../utils/useAr';
import ScopeFilters from '../filters/ScopeFilters';
import { FILTER_PAGES } from '../filters/filterConfig';

export default function FilterChips({ page = 'dashboard', ...rest }) {
  const rev = useRevenue(); const { L } = useAr();
  // F-20: the calculation settings (grace days, collection basis, CR statuses, rules) change every figure — say so when they are not the defaults
  const cfgChanged = (() => { const c = rev.cfg || {}; const J = JSON.stringify; return c.graceDays !== DEFAULT_CONFIG.graceDays || c.collectionsAsOf !== DEFAULT_CONFIG.collectionsAsOf || J(c.crStatuses) !== J(DEFAULT_CONFIG.crStatuses) || J(c.rules) !== J(DEFAULT_CONFIG.rules); })();
  const cfg = FILTER_PAGES[page] || FILTER_PAGES.dashboard;
  return <ScopeFilters {...cfg} {...rest} footer={cfgChanged ? <div className="ft-notice" role="note">{L('إعدادات الاحتساب معدّلة عن الافتراضي', 'Calculation settings differ from the defaults')}</div> : null} />;
}
