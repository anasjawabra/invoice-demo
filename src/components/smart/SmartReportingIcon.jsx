import React from 'react';
import { AiChat02Icon, Analytics01Icon, ChartLineData01Icon, ChartColumnIcon, File01Icon, Clock01Icon, Search01Icon, Add01Icon, ArrowUp02Icon, ArrowRight01Icon, ArrowDown01Icon, Attachment01Icon, Download01Icon, Cancel01Icon, Tick02Icon, StopIcon, InformationCircleIcon, Shield01Icon, PencilEdit02Icon, Delete02Icon, RefreshIcon, FilterHorizontalIcon, Database01Icon } from '@hugeicons/core-free-icons';
import UIIcon from '../UIIcon';

const icons = { assistant: AiChat02Icon, analysis: Analytics01Icon, trend: ChartLineData01Icon, compare: ChartColumnIcon, file: File01Icon, history: Clock01Icon, search: Search01Icon, add: Add01Icon, send: ArrowUp02Icon, arrow: ArrowRight01Icon, down: ArrowDown01Icon, attach: Attachment01Icon, download: Download01Icon, close: Cancel01Icon, check: Tick02Icon, stop: StopIcon, info: InformationCircleIcon, shield: Shield01Icon, edit: PencilEdit02Icon, delete: Delete02Icon, refresh: RefreshIcon, filter: FilterHorizontalIcon, data: Database01Icon };

export default function SmartReportingIcon({ name, ...props }) {
  return <UIIcon icon={icons[name] || InformationCircleIcon} {...props} />;
}
