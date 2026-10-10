import { useEffect, useRef } from 'react';

// Writes `value` with `save` ONLY after it has changed from the value the page started with (a user action), never on mount.
// Loading a page must not rewrite stored records (no silent schema "upgrades", no re-saving identical data).
export function usePersistOnChange(value, save) {
  const initial = useRef(value);
  useEffect(() => { if (value !== initial.current) save(value); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
}
