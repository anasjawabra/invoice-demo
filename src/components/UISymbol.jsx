import React from 'react';
import { ArrowLeftDoubleIcon, ArrowRightDoubleIcon, Tick02Icon, Cancel01Icon, Alert02Icon, ArrowDown01Icon, ArrowUp01Icon, ArrowLeft01Icon, ArrowRight01Icon, MinusSignIcon, HelpCircleIcon, ArrowRight01Icon as ChevronIcon, InformationCircleIcon, RefreshIcon, Attachment01Icon, StopIcon, AiChat02Icon } from '@hugeicons/core-free-icons';
import UIIcon from './UIIcon';
const icons = { first: ArrowLeftDoubleIcon, last: ArrowRightDoubleIcon, check: Tick02Icon, close: Cancel01Icon, warning: Alert02Icon, down: ArrowDown01Icon, up: ArrowUp01Icon, left: ArrowLeft01Icon, right: ArrowRight01Icon, minus: MinusSignIcon, help: HelpCircleIcon, expand: ChevronIcon, info: InformationCircleIcon, refresh: RefreshIcon, attach: Attachment01Icon, stop: StopIcon, assistant: AiChat02Icon };
export default function UISymbol({ name, size = 16 }) {
  return <UIIcon icon={icons[name] || HelpCircleIcon} size={size} className={name === 'expand' ? 'ui-expand-icon' : ''} />;
}
