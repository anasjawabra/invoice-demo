import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';

/** Shared renderer for interface icons. Decorative by default; icon-only
 * controls keep their accessible name on the parent button via aria-label. */
export default function UIIcon({ icon, size = 20, strokeWidth = 1.75, ...props }) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      color="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}
