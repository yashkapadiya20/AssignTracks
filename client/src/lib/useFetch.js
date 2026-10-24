import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Loads `path` on mount (and when it changes). `reload` refetches without showing the loading state.
export function useFetch(path) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const data = await api(path);
      setState({ data, loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [path]);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    reload();
  }, [reload]);

  return { ...state, reload };
}
