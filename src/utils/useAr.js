// Arabic-first inline bilingual helper for the newer screens: L(arabic, english). (The older useL().L is English-first.)
import { useCallback } from 'react';
import { useL } from './bi';
import { localize, localizedObject } from './zh';

export function useAr() {
  const base = useL();
  const L = useCallback((a, e) => (base.ar ? a : localize(e, base.lang)), [base.ar, base.lang]);
  const B = useCallback((o) => localizedObject(o, base.lang), [base.lang]);
  return { ...base, L, B };
}
