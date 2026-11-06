// The ONE percentage colour scale shared by the Dashboard's revenue analysis, the invoice record and the product page: EVERY percentage uses the same four colours — red < 40 % · orange 40–<60 % · yellow 60–<80 % ·
// green 80 % and above (there is no tier above 100 %: the target is reached). (Formerly `EntityMap.jsx`, renamed in the cleanup phase: the planning map it once hosted is gone; the geographic map component `../revenue/ProvinceMap` + data/ksaProvinces.js stays for the Dashboard.)
import React from 'react';
import { PCT_COLORS_4, COLLECTION_RATE_BANDS } from '../../data/regional/collectionBands';

// ONE palette and ONE set of cuts: these four colours and 40 / 60 / 80 ARE the collection-performance bands of the /insights regional view (data/regional/collectionBands.js COLLECTION_RATE_BANDS) — there is no blue anywhere.
export const PCT_COLORS = [...PCT_COLORS_4];
export const PCT_CUTS = COLLECTION_RATE_BANDS.cuts.map((c) => c / 100); // [0.4, 0.6, 0.8]
export const pctColor = (_kind, v) => (Number.isFinite(v) ? PCT_COLORS[PCT_CUTS.filter((c) => v >= c).length] : null);
export const PctBadge = ({ kind, v, text }) => { const c = pctColor(kind, v); return <span dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{c && <i aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: c, display: 'inline-block', border: '1px solid rgba(0,0,0,.15)' }} />}{text}</span>; };
