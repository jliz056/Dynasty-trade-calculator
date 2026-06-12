import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { DEFAULT_SETTINGS, LeagueSettings } from '../types';

const STORAGE_KEY = 'dtc-league-settings';

interface SettingsContextValue {
  settings: LeagueSettings;
  updateSettings: (patch: Partial<LeagueSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSettings(): LeagueSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // fall through to defaults
  }
  return DEFAULT_SETTINGS;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<LeagueSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (patch: Partial<LeagueSettings>) =>
    setSettings((prev) => ({ ...prev, ...patch }));

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
