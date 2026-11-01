// Loaded by the dev-only access regression to exercise action guards directly.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../../src/context/AuthContext';
import { RevenueProvider, useRevenue } from '../../src/context/RevenueContext';

function Probe() {
  const rev = useRevenue();
  useEffect(() => {
    let active = true;
    (async () => {
      const before = sessionStorage.getItem('ib_rev_cfg4');
      const errors = [];
      for (const action of [() => rev.commitUpload({ accepted: [], rejected: [] }), () => rev.clearUploads()]) {
        try { await action(); errors.push('allowed'); } catch (e) { errors.push(e.message); }
      }
      rev.setRuleEnabled('DUP-1', false); rev.setCrStatuses(['fake']); rev.setGraceDays(999); rev.setCollectionsAsOf('2000-01-01'); rev.resetConfig();
      const note = rev.addNote('probe', 'must not persist');
      const legacy = rev.enforcement.restoreLegacy('probe', 'outside');
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (active) window.__accessProbe = { errors, before, after: sessionStorage.getItem('ib_rev_cfg4'), note, legacy };
    })();
    return () => { active = false; };
  }, []);
  return null;
}
export function mountProbe(container) {
  const root = createRoot(container);
  root.render(<AuthProvider><RevenueProvider><Probe /></RevenueProvider></AuthProvider>);
  return () => root.unmount();
}
