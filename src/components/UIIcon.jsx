import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';

/** Decorative icon; the containing control supplies its accessible name. */
export default function UIIcon({ icon, size = 20, className = '', ...props }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.75} className={`ui-icon ${className}`.trim()} aria-hidden="true" focusable="false" {...props} />;
}
