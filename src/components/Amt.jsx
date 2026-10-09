import React from 'react';
import { useL } from '../utils/bi';

// An amount with ONE appropriate unit (number big, unit small) and the exact SAR value in the tooltip.
// `unit` pins a shared unit for a whole table/column (pass the result of useL().unitFor(values)); `exact` shows the full SAR instead.
export default function Amt({ v, unit = 'auto', exact = false, className, style }) {
  const { sar, parts } = useL();
  if (exact) return <span className={className} style={style} dir="ltr">{sar(v)}</span>;
  const p = parts(v, unit);
  return (
    <span className={className} style={style} dir="ltr" title={sar(v)}>
      {p.num}{' '}<small style={{ fontSize: '0.6em', fontWeight: 700, opacity: 0.75, whiteSpace: 'nowrap' }}>{p.label}</small>
    </span>
  );
}
