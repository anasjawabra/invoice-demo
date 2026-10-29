import React from 'react';
import { DashboardSquare01Icon, Invoice01Icon, Shield01Icon, Settings01Icon, ChartLineData01Icon, AiChat02Icon, File01Icon, Analytics01Icon, Target02Icon, Notification01Icon, Sun03Icon, Moon02Icon, Add01Icon } from '@hugeicons/core-free-icons';
import UIIcon from './UIIcon';

const icons = { dashboard: DashboardSquare01Icon, invoices: Invoice01Icon, risk: Shield01Icon, settings: Settings01Icon, collection: ChartLineData01Icon, assistant: AiChat02Icon, 'smart-reports': File01Icon, 'what-if': Analytics01Icon, 'decision-room': Target02Icon, bell: Notification01Icon, sun: Sun03Icon, moon: Moon02Icon };

export default function AppIcon({ name }) {
  return <UIIcon icon={icons[name] || Add01Icon} size={18} />;
}
