import { KSA_PROVINCES } from './ksaProvinces';
import { REVENUE_SOURCES } from './revenueLedger';

// Per-province view of a server snapshot: the Amanahs of each province summed. `rate` is collected ÷ NET billed (same basis as the
// national figure), rounded percent; `rateCalculable` is false when net billed is zero. The Housing sector is not a province.
export function provincesFromSnapshot(snapshot) {
  const amanahBy = new Map(snapshot.byAmanah.map((g) => [g.key, g]));
  return KSA_PROVINCES.map((p) => {
    let count = 0; let gross = 0; let net = 0; let collected = 0; let outstanding = 0; let violationCount = 0; let enforcementCount = 0; const mix = new Map();
    for (const key of p.amanahKeys) {
      const g = amanahBy.get(key); if (!g) continue;
      count += g.count; gross += g.gross; net += g.net; collected += g.collected; outstanding += g.outstanding; violationCount += g.violationCount || 0; enforcementCount += g.enforcementCount || 0;
      for (const [sk, v] of Object.entries(snapshot.byAmanahSource?.[key] || {})) mix.set(sk, (mix.get(sk) || 0) + v);
    }
    const revenue = [...mix.entries()].map(([sk, value]) => ({ code: sk, name: REVENUE_SOURCES[sk]?.zh || sk, nameEn: REVENUE_SOURCES[sk]?.en || sk, nameAr: REVENUE_SOURCES[sk]?.ar || sk, value })).sort((a, b) => b.value - a.value);
    return {
      iso: p.iso, nameEn: p.nameEn, nameAr: p.nameAr, hasData: p.amanahKeys.length > 0,
      count, gross, net, collected, uncollected: outstanding, rate: net > 0 ? Math.round((collected / net) * 100) : 0, rateCalculable: net > 0,
      violationCount, enforcementCount, revenue, dominantRevenue: revenue[0] || null
    };
  }).filter((p) => p.hasData);
}
