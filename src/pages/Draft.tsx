import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import FastForwardIcon from '@mui/icons-material/FastForward';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { Asset, Position } from '../types';
import { usePlayerValues } from '../hooks/usePlayerValues';
import { useSettings } from '../context/SettingsContext';
import LeagueSettingsBar from '../components/LeagueSettingsBar';
import AssetAvatar from '../components/AssetAvatar';
import PositionChip from '../components/PositionChip';

interface DraftPick {
  overall: number;
  round: number;
  pickInRound: number;
  teamIndex: number;
  assetId: number | null;
}

function buildOrder(teams: number, rounds: number, snake: boolean): DraftPick[] {
  const picks: DraftPick[] = [];
  for (let round = 1; round <= rounds; round++) {
    for (let i = 0; i < teams; i++) {
      const teamIndex = snake && round % 2 === 0 ? teams - 1 - i : i;
      picks.push({
        overall: picks.length + 1,
        round,
        pickInRound: i + 1,
        teamIndex,
        assetId: null,
      });
    }
  }
  return picks;
}

/** Weighted-random auto-pick among the best available to keep mocks realistic. */
function autoPick(available: Asset[]): Asset | null {
  if (available.length === 0) return null;
  const top = available.slice(0, 3);
  const weights = [0.6, 0.25, 0.15].slice(0, top.length);
  const r = Math.random() * weights.reduce((s, w) => s + w, 0);
  let acc = 0;
  for (let i = 0; i < top.length; i++) {
    acc += weights[i];
    if (r <= acc) return top[i];
  }
  return top[0];
}

function pickLabel(pick: DraftPick): string {
  return `${pick.round}.${String(pick.pickInRound).padStart(2, '0')}`;
}

const POSITION_FILTERS: Array<Position | 'ALL'> = ['ALL', 'QB', 'RB', 'WR', 'TE'];

export default function Draft() {
  const { assets, loading, error } = usePlayerValues();
  const { settings } = useSettings();

  const [rounds, setRounds] = useState(3);
  const [snake, setSnake] = useState(false);
  const [userSlot, setUserSlot] = useState(1);
  const [picks, setPicks] = useState<DraftPick[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  const rookies = useMemo(
    () =>
      assets
        .filter((a) => a.yoe === 0 && a.position !== 'PICK')
        .sort((a, b) => b.value - a.value),
    [assets],
  );

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const draftedIds = useMemo(
    () => new Set((picks ?? []).map((p) => p.assetId).filter((id): id is number => id !== null)),
    [picks],
  );
  const available = useMemo(
    () => rookies.filter((r) => !draftedIds.has(r.id)),
    [rookies, draftedIds],
  );

  const boardList = useMemo(() => {
    let list = available;
    if (posFilter !== 'ALL') list = list.filter((a) => a.position === posFilter);
    const q = search.toLowerCase().trim();
    if (q) list = list.filter((a) => a.name.toLowerCase().includes(q));
    return list.slice(0, 50);
  }, [available, posFilter, search]);

  const started = picks !== null;
  const done = started && (current >= picks.length || available.length === 0);
  const onTheClock = started && !done ? picks[current] : null;
  const userOnClock = onTheClock?.teamIndex === userSlot - 1;

  const teamName = (teamIndex: number) =>
    teamIndex === userSlot - 1 ? 'You' : `Team ${teamIndex + 1}`;

  const start = () => {
    setPicks(buildOrder(settings.numTeams, rounds, snake));
    setCurrent(0);
  };

  const reset = () => {
    setPicks(null);
    setCurrent(0);
  };

  const applyPick = (draft: DraftPick[], index: number, asset: Asset): DraftPick[] =>
    draft.map((p, i) => (i === index ? { ...p, assetId: asset.id } : p));

  const draftPlayer = (asset: Asset) => {
    if (!picks || done) return;
    setPicks(applyPick(picks, current, asset));
    setCurrent(current + 1);
  };

  const simulate = (stopAtUser: boolean, simAll = false) => {
    if (!picks) return;
    let nextPicks = picks;
    let i = current;
    const pool = () => rookies.filter((r) => !nextPicks.some((p) => p.assetId === r.id));
    while (i < nextPicks.length) {
      const isUser = nextPicks[i].teamIndex === userSlot - 1;
      if (stopAtUser && isUser) break;
      if (!simAll && !stopAtUser && i > current) break;
      const asset = autoPick(pool());
      if (!asset) break;
      nextPicks = applyPick(nextPicks, i, asset);
      i++;
      if (!simAll && !stopAtUser) break;
    }
    setPicks(nextPicks);
    setCurrent(i);
  };

  const teamTotals = useMemo(() => {
    if (!picks) return [];
    const totals = Array.from({ length: settings.numTeams }, (_, i) => ({
      teamIndex: i,
      total: 0,
    }));
    for (const p of picks) {
      if (p.assetId !== null) {
        totals[p.teamIndex].total += assetMap.get(p.assetId)?.value ?? 0;
      }
    }
    return [...totals].sort((a, b) => b.total - a.total);
  }, [picks, settings.numTeams, assetMap]);

  return (
    <Stack spacing={3}>
      <Box sx={{ pt: 2 }}>
        <Typography variant="h4" gutterBottom>
          Rookie Draft
        </Typography>
        <Typography color="text.secondary">
          Mock your rookie draft with live values for this year's class
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
          <Paper sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              useFlexGap
              flexWrap="wrap"
            >
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  ROUNDS
                </Typography>
                <TextField
                  select
                  size="small"
                  value={rounds}
                  disabled={started}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  sx={{ minWidth: 80 }}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  YOUR PICK
                </Typography>
                <TextField
                  select
                  size="small"
                  value={Math.min(userSlot, settings.numTeams)}
                  disabled={started}
                  onChange={(e) => setUserSlot(Number(e.target.value))}
                  sx={{ minWidth: 90 }}
                >
                  {Array.from({ length: settings.numTeams }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      {i + 1}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  SNAKE
                </Typography>
                <Switch
                  checked={snake}
                  disabled={started}
                  onChange={(e) => setSnake(e.target.checked)}
                />
              </Stack>

              <Box sx={{ flexGrow: 1 }} />

              {!started ? (
                <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={start}>
                  Start mock draft
                </Button>
              ) : (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {!done && (
                    <>
                      <Button
                        variant="outlined"
                        startIcon={<SkipNextIcon />}
                        onClick={() => simulate(false)}
                      >
                        Sim next pick
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<FastForwardIcon />}
                        onClick={() => simulate(true)}
                        disabled={userOnClock}
                      >
                        Sim to my pick
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<DoneAllIcon />}
                        onClick={() => simulate(false, true)}
                      >
                        Sim all
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<RestartAltIcon />}
                    onClick={reset}
                  >
                    Reset
                  </Button>
                </Stack>
              )}
            </Stack>
          </Paper>

          {onTheClock && (
            <Alert
              severity={userOnClock ? 'success' : 'info'}
              icon={false}
              sx={{ fontWeight: 600 }}
            >
              Pick {pickLabel(onTheClock)} — {teamName(onTheClock.teamIndex)} on the clock
              {userOnClock ? ' · choose a player from the board →' : ''}
            </Alert>
          )}

          {done && started && (
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="h6" gutterBottom>
                Draft complete — value by team
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {teamTotals.map((t, i) => (
                  <Chip
                    key={t.teamIndex}
                    label={`#${i + 1} ${teamName(t.teamIndex)} · ${t.total.toLocaleString()}`}
                    color={t.teamIndex === userSlot - 1 ? 'success' : 'default'}
                    variant={t.teamIndex === userSlot - 1 ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            </Paper>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12} md={started ? 7 : 12}>
              {started ? (
                <Paper sx={{ p: 2, maxHeight: 640, overflow: 'auto' }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Draft board
                  </Typography>
                  <Stack spacing={0.75}>
                    {picks.map((p, i) => {
                      const asset = p.assetId !== null ? assetMap.get(p.assetId) : null;
                      const isCurrent = i === current && !done;
                      const isUser = p.teamIndex === userSlot - 1;
                      return (
                        <Stack
                          key={p.overall}
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                          sx={{
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 2,
                            bgcolor: isCurrent
                              ? 'rgba(56, 189, 248, 0.12)'
                              : isUser
                                ? 'rgba(34, 197, 94, 0.07)'
                                : 'transparent',
                            border: isCurrent
                              ? '1px solid rgba(56, 189, 248, 0.4)'
                              : '1px solid transparent',
                          }}
                        >
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            color="text.secondary"
                            sx={{ width: 42 }}
                          >
                            {pickLabel(p)}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ width: 70, color: isUser ? 'success.main' : 'text.secondary' }}
                            fontWeight={isUser ? 700 : 400}
                          >
                            {teamName(p.teamIndex)}
                          </Typography>
                          {asset ? (
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{ flexGrow: 1, minWidth: 0 }}
                            >
                              <AssetAvatar
                                name={asset.name}
                                position={asset.position}
                                sleeperId={asset.sleeperId}
                                size={26}
                              />
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {asset.name}
                              </Typography>
                              <PositionChip position={asset.position} />
                              <Box sx={{ flexGrow: 1 }} />
                              <Typography variant="body2" color="primary.main" fontWeight={700}>
                                {asset.value.toLocaleString()}
                              </Typography>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.disabled">
                              —
                            </Typography>
                          )}
                        </Stack>
                      );
                    })}
                  </Stack>
                </Paper>
              ) : (
                <Alert severity="info">
                  Configure your draft above and hit <strong>Start mock draft</strong>, or browse
                  the rookie big board below.
                </Alert>
              )}
            </Grid>

            <Grid item xs={12} md={started ? 5 : 12}>
              <Paper sx={{ p: 2, maxHeight: 640, overflow: 'auto' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {started ? 'Best available' : 'Rookie big board'}
                  </Typography>
                  <Chip label={`${available.length} rookies`} size="small" variant="outlined" />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={posFilter}
                    onChange={(_, v) => v !== null && setPosFilter(v)}
                  >
                    {POSITION_FILTERS.map((f) => (
                      <ToggleButton key={f} value={f}>
                        {f === 'ALL' ? 'All' : f}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <TextField
                    size="small"
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </Stack>
                <Stack spacing={0.75}>
                  {boardList.map((asset, i) => (
                    <Stack
                      key={asset.id}
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      onClick={() => started && !done && draftPlayer(asset)}
                      sx={{
                        px: 1.5,
                        py: 0.9,
                        borderRadius: 2,
                        bgcolor: 'rgba(148, 163, 184, 0.06)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        cursor: started && !done ? 'pointer' : 'default',
                        '&:hover':
                          started && !done
                            ? { bgcolor: 'rgba(56, 189, 248, 0.12)' }
                            : undefined,
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color="text.secondary"
                        sx={{ width: 24 }}
                      >
                        {posFilter === 'ALL' && !search ? i + 1 : ''}
                      </Typography>
                      <AssetAvatar
                        name={asset.name}
                        position={asset.position}
                        sleeperId={asset.sleeperId}
                        size={32}
                      />
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {asset.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {asset.team ?? '—'} · #{asset.overallRank} overall
                        </Typography>
                      </Box>
                      <PositionChip position={asset.position} />
                      <Typography variant="body2" fontWeight={700} color="primary.main">
                        {asset.value.toLocaleString()}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Stack>
  );
}
