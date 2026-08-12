import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SchoolIcon from '@mui/icons-material/School';
import InsightsIcon from '@mui/icons-material/Insights';
import { Position } from '../types';
import { usePlayerValues } from '../hooks/usePlayerValues';
import { useDevyValues } from '../hooks/useDevyValues';
import { useSettings } from '../context/SettingsContext';
import LeagueSettingsBar from '../components/LeagueSettingsBar';
import AssetAvatar from '../components/AssetAvatar';
import PositionChip from '../components/PositionChip';
import DevyPlayerDialog from '../components/DevyPlayerDialog';
import PlayerProfileDialog from '../components/PlayerProfileDialog';
import { DevyPlayer } from '../services/ktcDevy';
import { Asset } from '../types';
import { fetchModelRankings, hasSupabase } from '../services/dynastyData';

type ValueSource = 'market' | 'model';

type TabValue = 'ALL' | Position | 'DEVY';

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: 'ALL', label: 'Overall' },
  { value: 'QB', label: 'QB' },
  { value: 'RB', label: 'RB' },
  { value: 'WR', label: 'WR' },
  { value: 'TE', label: 'TE' },
  { value: 'PICK', label: 'Picks' },
  { value: 'DEVY', label: 'Devy' },
];

function TrendCell({ trend }: { trend: number }) {
  if (trend === 0) return <>—</>;
  const up = trend > 0;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
      {up ? (
        <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
      ) : (
        <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
      )}
      <Typography variant="body2" sx={{ color: up ? 'success.main' : 'error.main' }}>
        {Math.abs(trend).toLocaleString()}
      </Typography>
    </Stack>
  );
}

export default function Rankings() {
  const [tab, setTab] = useState<TabValue>('ALL');
  const [search, setSearch] = useState('');
  const [selectedDevy, setSelectedDevy] = useState<DevyPlayer | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Asset | null>(null);
  const [source, setSource] = useState<ValueSource>('market');
  const [modelAssets, setModelAssets] = useState<Asset[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const { settings } = useSettings();

  const dynasty = usePlayerValues();
  const devy = useDevyValues(tab === 'DEVY');

  useEffect(() => {
    if (source !== 'model' || !hasSupabase) return;
    let cancelled = false;
    setModelLoading(true);
    setModelError(null);
    fetchModelRankings(settings)
      .then((assets) => {
        if (!cancelled) setModelAssets(assets);
      })
      .catch((err: Error) => {
        if (!cancelled) setModelError(err.message);
      })
      .finally(() => {
        if (!cancelled) setModelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, settings]);

  const dynastyRows = useMemo(() => {
    let list = source === 'model' ? modelAssets : dynasty.assets;
    if (tab !== 'ALL' && tab !== 'DEVY') list = list.filter((a) => a.position === tab);
    const q = search.toLowerCase().trim();
    if (q) list = list.filter((a) => a.name.toLowerCase().includes(q));
    return list.slice(0, 200);
  }, [dynasty.assets, modelAssets, source, tab, search]);

  const devyRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return devy.players;
    return devy.players.filter((p) => p.name.toLowerCase().includes(q));
  }, [devy.players, search]);

  const isDevy = tab === 'DEVY';
  const usingModel = source === 'model' && !isDevy;
  const loading = isDevy ? devy.loading : usingModel ? modelLoading : dynasty.loading;
  const error = isDevy ? devy.error : usingModel ? modelError : dynasty.error;
  const showPositionalRank = tab !== 'ALL' && tab !== 'PICK' && !isDevy;

  return (
    <Stack spacing={3}>
      <Box sx={{ pt: 2 }}>
        <Typography variant="h4" gutterBottom>
          Player Rankings
        </Typography>
        <Typography color="text.secondary">
          Dynasty values based on your league settings
        </Typography>
      </Box>

      <LeagueSettingsBar />

      <Paper sx={{ px: 1 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {TABS.map((t) => (
            <Tab
              key={t.value}
              value={t.value}
              label={t.label}
              icon={t.value === 'DEVY' ? <SchoolIcon sx={{ fontSize: 18 }} /> : undefined}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
          ))}
        </Tabs>
      </Paper>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
        <TextField
          size="small"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        {!isDevy && hasSupabase && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={source}
            onChange={(_, v) => v !== null && setSource(v)}
          >
            <ToggleButton value="market">Marché</ToggleButton>
            <ToggleButton value="model">
              <InsightsIcon sx={{ fontSize: 16, mr: 0.5 }} />
              Notre modèle
            </ToggleButton>
          </ToggleButtonGroup>
        )}
        {!isDevy && usingModel && (
          <Chip
            label="baseline_v1 · calculé de nos données NFL 2009-2025"
            size="small"
            variant="outlined"
            color="primary"
          />
        )}
        {!isDevy && (
          <Typography variant="caption" color="text.secondary">
            Click a player for stats, schedule & projections
          </Typography>
        )}
        {isDevy && (
          <>
            <Chip
              label={`Crowdsourced devy values · KeepTradeCut · ${settings.numQbs === 2 ? 'Superflex' : '1QB'}${settings.tePremium > 0 ? ` · TEP +${settings.tePremium}` : ''}`}
              size="small"
              variant="outlined"
              color="secondary"
            />
            <Typography variant="caption" color="text.secondary">
              Click a player for college stats
            </Typography>
          </>
        )}
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {usingModel && tab === 'PICK' && (
        <Alert severity="info">
          Notre modèle ne couvre pas encore les picks — utilise la source «&nbsp;Marché&nbsp;»
          pour les valeurs de picks.
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : isDevy ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60 }}>Rank</TableCell>
                <TableCell>Player</TableCell>
                <TableCell>Pos</TableCell>
                <TableCell>College</TableCell>
                <TableCell align="right">Draft Year</TableCell>
                <TableCell align="right">Trend</TableCell>
                <TableCell align="right">Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {devyRows.map((p) => (
                <TableRow
                  key={p.id}
                  hover
                  onClick={() => setSelectedDevy(p)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Typography fontWeight={700} color="text.secondary">
                      {p.rank}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <AssetAvatar
                        name={p.name}
                        position={p.position}
                        sleeperId={null}
                        size={32}
                      />
                      <Typography fontWeight={600}>{p.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <PositionChip position={p.position} />
                      <Typography variant="caption" color="text.secondary">
                        {p.position}
                        {p.positionalRank}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{p.college ?? '—'}</TableCell>
                  <TableCell align="right">{p.draftYear ?? '—'}</TableCell>
                  <TableCell align="right">
                    <TrendCell trend={p.trend} />
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={700} color="secondary.main">
                      {p.value.toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60 }}>Rank</TableCell>
                <TableCell>Player</TableCell>
                <TableCell>Pos</TableCell>
                <TableCell>Team</TableCell>
                <TableCell align="right">Age</TableCell>
                <TableCell align="right">30-Day Trend</TableCell>
                <TableCell align="right">Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dynastyRows.map((a) => (
                <TableRow
                  key={a.id}
                  hover
                  onClick={() => a.position !== 'PICK' && setSelectedPlayer(a)}
                  sx={{ cursor: a.position !== 'PICK' ? 'pointer' : 'default' }}
                >
                  <TableCell>
                    <Typography fontWeight={700} color="text.secondary">
                      {showPositionalRank ? a.positionRank : a.overallRank}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <AssetAvatar
                        name={a.name}
                        position={a.position}
                        sleeperId={a.sleeperId}
                        size={32}
                      />
                      <Typography fontWeight={600}>{a.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <PositionChip position={a.position} />
                  </TableCell>
                  <TableCell>{a.team ?? '—'}</TableCell>
                  <TableCell align="right">{a.age ? Math.floor(a.age) : '—'}</TableCell>
                  <TableCell align="right">
                    <TrendCell trend={a.trend30Day} />
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={700} color="primary.main">
                      {a.value.toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <DevyPlayerDialog player={selectedDevy} onClose={() => setSelectedDevy(null)} />
      <PlayerProfileDialog
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
    </Stack>
  );
}
