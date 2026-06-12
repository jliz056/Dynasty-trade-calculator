import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Link } from 'react-router-dom';
import { Asset } from '../types';
import { usePlayerValues } from '../hooks/usePlayerValues';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { saveTrade } from '../services/trades';
import LeagueSettingsBar from '../components/LeagueSettingsBar';
import TradeSide from '../components/TradeSide';
import TradeVerdict, { evaluateTrade } from '../components/TradeVerdict';

const COLOR_A = '#38bdf8';
const COLOR_B = '#a855f7';

export default function Calculator() {
  const { assets, loading, error } = usePlayerValues();
  const { settings } = useSettings();
  const { user } = useAuth();

  const [sideAIds, setSideAIds] = useState<number[]>([]);
  const [sideBIds, setSideBIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // Load a trade handed off from the recommendations page, if any.
  useEffect(() => {
    if (assets.length === 0) return;
    const raw = localStorage.getItem('dtc-pending-trade');
    if (!raw) return;
    localStorage.removeItem('dtc-pending-trade');
    try {
      const pending = JSON.parse(raw) as { a: number[]; b: number[] };
      const valid = new Set(assets.map((x) => x.id));
      setSideAIds(pending.a.filter((id) => valid.has(id)));
      setSideBIds(pending.b.filter((id) => valid.has(id)));
    } catch {
      // ignore malformed handoff data
    }
  }, [assets]);

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const sideA = sideAIds.map((id) => assetMap.get(id)).filter((a): a is Asset => !!a);
  const sideB = sideBIds.map((id) => assetMap.get(id)).filter((a): a is Asset => !!a);
  const excludeIds = new Set([...sideAIds, ...sideBIds]);

  const totalA = sideA.reduce((s, a) => s + a.value, 0);
  const totalB = sideB.reduce((s, a) => s + a.value, 0);

  const suggestions = useMemo(() => {
    const diff = Math.abs(totalA - totalB);
    if (diff === 0 || assets.length === 0) return [];
    return assets
      .filter((a) => !excludeIds.has(a.id) && a.value <= diff * 1.1)
      .sort((x, y) => Math.abs(x.value - diff) - Math.abs(y.value - diff))
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalA, totalB, assets, sideAIds, sideBIds]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const verdict = evaluateTrade(totalA, totalB, 'Team A', 'Team B');
      const toSaved = (a: Asset) => ({
        id: a.id,
        name: a.name,
        position: a.position,
        team: a.team,
        value: a.value,
        sleeperId: a.sleeperId,
      });
      await saveTrade({
        userId: user.uid,
        createdAt: Date.now(),
        settings,
        sideA: sideA.map(toSaved),
        sideB: sideB.map(toSaved),
        totalA,
        totalB,
        verdict: verdict.text,
      });
      setSnackbar('Trade saved to your history');
    } catch {
      setSnackbar('Failed to save trade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box sx={{ textAlign: 'center', pt: 2 }}>
        <Typography variant="h4" gutterBottom>
          Dynasty Trade Calculator
        </Typography>
        <Typography color="text.secondary">
          Live dynasty values from real trades, updated daily via FantasyCalc
        </Typography>
      </Box>

      <LeagueSettingsBar />

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TradeSide
                title="Team A Receives"
                accentColor={COLOR_A}
                selected={sideA}
                allAssets={assets}
                excludeIds={excludeIds}
                onAdd={(a) => setSideAIds((prev) => [...prev, a.id])}
                onRemove={(id) => setSideAIds((prev) => prev.filter((x) => x !== id))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TradeSide
                title="Team B Receives"
                accentColor={COLOR_B}
                selected={sideB}
                allAssets={assets}
                excludeIds={excludeIds}
                onAdd={(a) => setSideBIds((prev) => [...prev, a.id])}
                onRemove={(id) => setSideBIds((prev) => prev.filter((x) => x !== id))}
              />
            </Grid>
          </Grid>

          <TradeVerdict
            totalA={totalA}
            totalB={totalB}
            labelA="Team A"
            labelB="Team B"
            colorA={COLOR_A}
            colorB={COLOR_B}
            suggestions={suggestions}
          />

          {(sideA.length > 0 || sideB.length > 0) && (
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<RestartAltIcon />}
                onClick={() => {
                  setSideAIds([]);
                  setSideBIds([]);
                }}
              >
                Clear
              </Button>
              {user ? (
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={saving || sideA.length === 0 || sideB.length === 0}
                  onClick={handleSave}
                >
                  {saving ? 'Saving…' : 'Save trade'}
                </Button>
              ) : (
                <Button variant="contained" component={Link} to="/login">
                  Sign in to save trades
                </Button>
              )}
            </Stack>
          )}
        </>
      )}

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Stack>
  );
}
