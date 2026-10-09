// Store lifecycle: generate the world for the current Riyadh date (or an override), append the hand-anchored fixtures, keep the
// store in memory. When the calendar day rolls over the next request regenerates ONLY the new day's worth of movements — the
// generator is deterministic, so earlier history is identical by construction.
import { riyadhToday } from '../src/data/clock.js';
import { buildLedger, ANCHOR_ENFORCEMENT_SEED } from '../src/data/revenueLedger.js';
import { generateWorld } from './world.js';
import { appendRecord } from './fixtures.js';
import { ENTITIES } from '../src/data/catalog.js';

const stores = new Map();
const RESERVE = 6000; // room for fixtures and uploaded rows

// Demo size. «compact» (default): ~900 synthetic invoice records in total — fewer, proportionally larger invoices that keep the
// billion-scale totals and every financial relationship; «full»: the ≈1.6M-record stress/performance world (DEMO_SIZE=full or ?size=full).
export const DEMO_SIZES = { compact: 0.0003, full: 1 };
export const defaultSize = () => (typeof process !== 'undefined' && process.env?.DEMO_SIZE === 'full' ? 'full' : 'compact');
export const sizeOf = (s) => (s === 'full' || s === 'compact' ? s : defaultSize());

export function loadStore(today, { scale, size, withFixtures = true } = {}) {
  const sz = sizeOf(size);
  if (scale == null) scale = DEMO_SIZES[sz];
  const key = `${today}|${scale}|${withFixtures}`;
  if (stores.has(key)) return stores.get(key);
  const base = generateWorld(today, { scale });
  // a store must not be mutated across calls with different fixture sets, so fixtures are appended to a shallow clone of the metadata only once
  const st = base; // generateWorld caches per (today, scale): fixtures are appended once here
  if (withFixtures && !st.fixtureLoaded) {
    st.reserve(RESERVE);
    const anchors = buildLedger({ today, enforcement: ANCHOR_ENFORCEMENT_SEED });
    for (const rec of anchors) appendRecord(st, rec);
    st.fixtureLoaded = true;
  }
  st.meta.size = scale >= 1 ? 'full' : 'compact';
  stores.set(key, st);
  if (stores.size > 3) stores.delete(stores.keys().next().value);
  return st;
}

export function currentStore(override, size) {
  const today = override && /^\d{4}-\d{2}-\d{2}$/.test(override) ? override : riyadhToday();
  return loadStore(today, { size });
}
export { ENTITIES };
