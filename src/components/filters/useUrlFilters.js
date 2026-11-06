// useUrlFilters — filter state kept in the URL search params (replace history, other params preserved, defaults omitted) so a detail page and the browser back button return to the same filters.
//   const { values, setValues, reset } = useUrlFilters({ keys: ['amanah','status'], defaults: { amanah: 'all', status: 'all' } });
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseUrlFilters, serializeUrlFilters } from './filterLogic';

export default function useUrlFilters({ keys, defaults = {} }) {
  const [sp, setSp] = useSearchParams();
  const search = sp.toString();
  const values = useMemo(() => parseUrlFilters(search, keys, defaults), [search, keys.join('|'), JSON.stringify(defaults)]); // eslint-disable-line react-hooks/exhaustive-deps
  const setValues = useCallback((patch) => {
    setSp((cur) => { const next = { ...parseUrlFilters(cur.toString(), keys, defaults), ...patch }; const s = serializeUrlFilters(cur.toString(), next, keys, defaults); return new URLSearchParams(s); }, { replace: true });
  }, [setSp, keys.join('|'), JSON.stringify(defaults)]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = useCallback(() => setValues(defaults), [setValues, JSON.stringify(defaults)]); // eslint-disable-line react-hooks/exhaustive-deps
  return { values, setValues, reset };
}
