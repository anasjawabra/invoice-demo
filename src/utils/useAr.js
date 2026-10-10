// Arabic-first inline bilingual helper for the newer screens: L(arabic, english). (The older useL().L is English-first.)
import { useCallback } from 'react';
import { useL } from './bi';

export function useAr() {
  const base = useL();
  const L = useCallback((a, e) => (base.ar ? a : e), [base.ar]);
  const B = useCallback((o) => (o == null ? '' : typeof o === 'string' ? o : (base.ar ? o.ar : o.en) || o.en || ''), [base.ar]);
  return { ...base, L, B };
}
