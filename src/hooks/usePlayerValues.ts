import { useEffect, useState } from 'react';
import { Asset } from '../types';
import { fetchValues } from '../services/fantasycalc';
import { useSettings } from '../context/SettingsContext';

interface PlayerValuesState {
  assets: Asset[];
  loading: boolean;
  error: string | null;
}

export function usePlayerValues(): PlayerValuesState {
  const { settings } = useSettings();
  const [state, setState] = useState<PlayerValuesState>({
    assets: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetchValues(settings)
      .then((assets) => {
        if (!cancelled) setState({ assets, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ assets: [], loading: false, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [settings]);

  return state;
}
