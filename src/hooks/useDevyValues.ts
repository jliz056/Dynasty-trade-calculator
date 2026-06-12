import { useEffect, useState } from 'react';
import { DevyPlayer, fetchDevyValues } from '../services/ktcDevy';
import { useSettings } from '../context/SettingsContext';

interface DevyValuesState {
  players: DevyPlayer[];
  loading: boolean;
  error: string | null;
}

export function useDevyValues(enabled: boolean): DevyValuesState {
  const { settings } = useSettings();
  const [state, setState] = useState<DevyValuesState>({
    players: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetchDevyValues(settings)
      .then((players) => {
        if (!cancelled) setState({ players, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ players: [], loading: false, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [settings, enabled]);

  return state;
}
