// A CSV download link gated by the MODULE that owns the list (export has no separate permission; a read-only role may export): allowed → a normal download link; not allowed → a disabled control that SAYS why (never silently inert).
import React from 'react';
import { useAccess } from '../../context/AuthContext';
import { useAr } from '../../utils/useAr';
import { exportGate } from '../../data/accessModel';

/** { allowed, reason } for the CSV export of a list filtered by `filters` (reason is already in the page language) */
export function useExportGate(filters) {
  const access = useAccess(); const { L } = useAr();
  const g = exportGate(access, filters || {});
  return { allowed: g.allowed, reason: g.reason ? L(g.reason.ar, g.reason.en) : null };
}
export default function ExportLink({ filters, href, className = 'btn btn-sm', children, ...rest }) {
  const g = useExportGate(filters);
  if (g.allowed) return <a className={className} href={href} download {...rest}>{children}</a>;
  return <span className={`${className} is-disabled`} aria-disabled="true" role="link" tabIndex={0} title={g.reason} data-reason={g.reason} {...rest}>{children}</span>;
}
