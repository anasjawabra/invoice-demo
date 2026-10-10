import { useEffect, useRef, useState } from 'react';

// Runs an async loader whenever `deps` change and ignores stale results (the loader receives an AbortSignal).
// Returns { data, loading, error }. `data` keeps the previous value while a new one loads (no flash of empty UI).
export function useAsync(loader, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    const ac = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(() => loader(ac.signal))
      .then((data) => { if (id === seq.current) setState({ data, loading: false, error: null }); })
      .catch((error) => { if (id === seq.current && error?.name !== 'AbortError') setState((s) => ({ ...s, loading: false, error })); });
    return () => ac.abort();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
