import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// DATA MODE: «demo» = the generated demo world (always available) · «furas» = the six local Furas exports (server/furasData.js).
// Furas mode exists only when the local data service reports the exports (never on a deployment); the choice is kept in this browser.
const KEY = 'ib_data_mode';
const Ctx = createContext({ available: false, mode: 'demo', isFuras: false, setMode: () => {} });

export function DataModeProvider({ children }) {
  const [available, setAvailable] = useState(false);
  const [mode, setModeRaw] = useState(() => { try { return window.localStorage.getItem(KEY) === 'furas' ? 'furas' : 'demo'; } catch { return 'demo'; } });
  useEffect(() => {
    let on = true;
    fetch('/api/furas/status').then((r) => r.json()).then((j) => { if (on) setAvailable(!!j?.available); }).catch(() => { if (on) setAvailable(false); });
    return () => { on = false; };
  }, []);
  const setMode = useCallback((m) => { const v = m === 'furas' ? 'furas' : 'demo'; setModeRaw(v); try { window.localStorage.setItem(KEY, v); } catch { /* the choice is only a convenience */ } }, []);
  const value = useMemo(() => ({ available, mode: available ? mode : 'demo', isFuras: available && mode === 'furas', setMode }), [available, mode, setMode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useDataMode = () => useContext(Ctx);
