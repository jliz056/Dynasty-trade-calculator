import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { useSettings } from '../context/SettingsContext';
import PositionChip from '../components/PositionChip';
import { Position } from '../types';
import {
  BacktestMetric,
  CrossSiteRow,
  DivergenceRow,
  fetchBacktestMetrics,
  fetchCrossSiteComparison,
  fetchDivergence,
  hasSupabase,
  MARKET_SOURCES,
  SOURCE_LABELS,
} from '../services/dynastyData';

const HORIZON_HINTS: Record<number, string> = {
  1: 'next season',
  2: 'in 2 seasons',
  3: 'in 3 seasons',
};

function MetricCard({ metric }: { metric: BacktestMetric }) {
  return (
    <Paper sx={{ p: 2.5, flex: 1, minWidth: 200 }}>
      <Typography variant="overline" color="text.secondary">
        +{metric.horizon} yr ({HORIZON_HINTS[metric.horizon] ?? ''})
      </Typography>
      <Typography variant="h4" fontWeight={800} color="primary.main">
        {(metric.spearman * 100).toFixed(0)}%
      </Typography>
      <Typography variant="caption" color="text.secondary">
        rank correlation with reality
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
        <Box>
          <Typography variant="body2" fontWeight={700}>
            ±{metric.medianAbsError.toFixed(0)} pts
          </Typography>
          <Typography variant="caption" color="text.secondary">
            median error
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" fontWeight={700}>
            {(metric.coverage * 100).toFixed(0)}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            in range (target 50%)
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" fontWeight={700}>
            {metric.n.toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            tested
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function DivergenceTable({
  rows,
  buy,
}: {
  rows: DivergenceRow[];
  buy: boolean;
}) {
  return (
    <Paper sx={{ p: 2, flex: 1, minWidth: 300 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        {buy ? (
          <TrendingUpIcon color="success" fontSize="small" />
        ) : (
          <TrendingDownIcon color="error" fontSize="small" />
        )}
        <Typography variant="subtitle1" fontWeight={700}>
          {buy ? 'Buy targets' : 'Sell candidates'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {buy ? 'model >> market' : 'market >> model'}
        </Typography>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Player</TableCell>
            <TableCell align="right">Model</TableCell>
            <TableCell align="right">Market</TableCell>
            <TableCell align="right">Edge</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.playerId}>
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PositionChip position={r.position as Position} />
                  <Typography variant="body2" fontWeight={600}>
                    {r.name}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell align="right">#{r.modelRank}</TableCell>
              <TableCell align="right">#{r.marketRank}</TableCell>
              <TableCell align="right">
                <Chip
                  size="small"
                  color={buy ? 'success' : 'error'}
                  variant="outlined"
                  label={`${r.rankEdge > 0 ? '+' : ''}${r.rankEdge}`}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

export default function Model() {
  const { settings, updateSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<BacktestMetric[]>([]);
  const [divergence, setDivergence] = useState<DivergenceRow[]>([]);
  const [crossSite, setCrossSite] = useState<CrossSiteRow[]>([]);

  useEffect(() => {
    if (!hasSupabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      fetchBacktestMetrics(),
      fetchDivergence(settings),
      fetchCrossSiteComparison(settings),
    ])
      .then(([m, d, c]) => {
        setMetrics(m);
        setDivergence(d);
        setCrossSite(c);
      })
      .catch(() => setError('Could not load model data.'))
      .finally(() => setLoading(false));
  }, [settings]);

  const horizonCards = useMemo(
    () => metrics.filter((m) => m.scope === 'ALL'),
    [metrics],
  );
  const positionRows = useMemo(
    () => metrics.filter((m) => m.scope !== 'ALL' && m.horizon === 1),
    [metrics],
  );
  const buys = useMemo(
    () =>
      [...divergence]
        .filter((r) => r.marketRank <= 150)
        .sort((a, b) => b.rankEdge - a.rankEdge)
        .slice(0, 10),
    [divergence],
  );
  const sells = useMemo(
    () =>
      // modelRank <= 300 keeps devy prospects out: the baseline model ranks
      // players with no NFL production near the bottom, which is a blind
      // spot, not a sell signal.
      [...divergence]
        .filter((r) => r.marketRank <= 150 && r.modelRank <= 300)
        .sort((a, b) => a.rankEdge - b.rankEdge)
        .slice(0, 10),
    [divergence],
  );

  if (!hasSupabase) {
    return (
      <Alert severity="info" sx={{ mt: 4 }}>
        The model dashboard requires Supabase — set <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_ANON_KEY</code> in your .env file.
      </Alert>
    );
  }

  return (
    <Box sx={{ pt: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Model dashboard
          </Typography>
          <Typography color="text.secondary">
            Our projection engine vs reality and vs the market
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={settings.numQbs === 2 ? 'sf' : '1qb'}
          onChange={(_, v) => v && updateSettings({ numQbs: v === 'sf' ? 2 : 1 })}
        >
          <ToggleButton value="1qb">1QB</ToggleButton>
          <ToggleButton value="sf">Superflex</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Stack spacing={4}>
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
              How reliable is the model?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Backtested on 2015-2024: projections were rebuilt using only data
              available at the time, then compared to what actually happened
              ({horizonCards.reduce((s, m) => s + m.n, 0).toLocaleString()} projections
              tested).
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              {horizonCards.map((m) => (
                <MetricCard key={m.horizon} metric={m} />
              ))}
            </Stack>
            {positionRows.length > 0 && (
              <Paper sx={{ mt: 2, p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Next-season accuracy by position
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Position</TableCell>
                      <TableCell align="right">Rank correlation</TableCell>
                      <TableCell align="right">Median error</TableCell>
                      <TableCell align="right">Tested</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {positionRows.map((m) => (
                      <TableRow key={m.scope}>
                        <TableCell>
                          <PositionChip position={m.scope as Position} />
                        </TableCell>
                        <TableCell align="right">
                          {(m.spearman * 100).toFixed(0)}%
                        </TableCell>
                        <TableCell align="right">
                          ±{m.medianAbsError.toFixed(0)} pts
                        </TableCell>
                        <TableCell align="right">{m.n.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
              Where we disagree with the market
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Our board vs the latest FantasyCalc snapshot. Edge = market rank
              minus our rank.
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <DivergenceTable rows={buys} buy />
              <DivergenceTable rows={sells} buy={false} />
            </Stack>
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
              Rankings across sites
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Latest snapshot from each source, stored daily in our own database.
            </Typography>
            <Paper sx={{ p: 2, overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Player</TableCell>
                    <TableCell align="right">Our model</TableCell>
                    {MARKET_SOURCES.map((s) => (
                      <TableCell key={s} align="right">
                        {SOURCE_LABELS[s]}
                      </TableCell>
                    ))}
                    <TableCell align="right">Spread</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {crossSite.slice(0, 50).map((row) => {
                    const ranks = Object.values(row.ranks);
                    const spread = ranks.length > 1 ? Math.max(...ranks) - Math.min(...ranks) : 0;
                    return (
                      <TableRow key={row.playerId}>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <PositionChip position={row.position as Position} />
                            <Typography variant="body2" fontWeight={600}>
                              {row.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.team ?? 'FA'}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          {row.modelRank ? `#${row.modelRank}` : '—'}
                        </TableCell>
                        {MARKET_SOURCES.map((s) => (
                          <TableCell key={s} align="right">
                            {row.ranks[s] ? `#${row.ranks[s]}` : '—'}
                          </TableCell>
                        ))}
                        <TableCell align="right">
                          {spread >= 12 ? (
                            <Tooltip title="Sites disagree strongly on this player">
                              <Chip
                                size="small"
                                color="warning"
                                variant="outlined"
                                label={spread}
                              />
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {spread}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
