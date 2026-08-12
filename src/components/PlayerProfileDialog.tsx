import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Asset, Position } from '../types';
import AssetAvatar from './AssetAvatar';
import PositionChip from './PositionChip';
import {
  AnalogProjection,
  fetchAnalogProjection,
  formatBuild,
  hasSupabase,
} from '../services/dynastyData';
import {
  fetchNflSeason,
  fetchPlayerSeasonHistory,
  fetchTeamSchedule,
  NflScheduleGame,
  PlayerSeasonStats,
} from '../services/sleeper';
import { POSITION_COLORS } from '../theme';

interface Props {
  player: Asset | null;
  onClose: () => void;
}

type Panel = 'stats' | 'schedule' | 'projection';

const STAT_FIELDS: Record<
  Exclude<Position, 'PICK'>,
  { key: keyof PlayerSeasonStats; label: string }[]
> = {
  QB: [
    { key: 'games', label: 'G' },
    { key: 'passAttempts', label: 'Att' },
    { key: 'passYards', label: 'Pass' },
    { key: 'passTds', label: 'PTD' },
    { key: 'passInts', label: 'INT' },
    { key: 'rushYards', label: 'Rush' },
    { key: 'rushTds', label: 'RTD' },
    { key: 'halfPprPoints', label: 'Pts' },
  ],
  RB: [
    { key: 'games', label: 'G' },
    { key: 'rushAttempts', label: 'Car' },
    { key: 'rushYards', label: 'Rush' },
    { key: 'rushTds', label: 'RTD' },
    { key: 'receptions', label: 'Rec' },
    { key: 'recYards', label: 'Rec yds' },
    { key: 'recTds', label: 'Rec TD' },
    { key: 'halfPprPoints', label: 'Pts' },
  ],
  WR: [
    { key: 'games', label: 'G' },
    { key: 'targets', label: 'Tgt' },
    { key: 'receptions', label: 'Rec' },
    { key: 'recYards', label: 'Yds' },
    { key: 'recTds', label: 'TD' },
    { key: 'rushYards', label: 'Rush' },
    { key: 'halfPprPoints', label: 'Pts' },
  ],
  TE: [
    { key: 'games', label: 'G' },
    { key: 'targets', label: 'Tgt' },
    { key: 'receptions', label: 'Rec' },
    { key: 'recYards', label: 'Yds' },
    { key: 'recTds', label: 'TD' },
    { key: 'halfPprPoints', label: 'Pts' },
  ],
};

function formatDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function statusLabel(status: string): string {
  if (status === 'complete') return 'Final';
  if (status === 'in_game') return 'Live';
  return 'Upcoming';
}

export default function PlayerProfileDialog({ player, onClose }: Props) {
  const [panel, setPanel] = useState<Panel>('stats');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PlayerSeasonStats[]>([]);
  const [schedule, setSchedule] = useState<NflScheduleGame[]>([]);
  const [projection, setProjection] = useState<AnalogProjection | null>(null);

  useEffect(() => {
    if (!player || player.position === 'PICK') return;
    setPanel('stats');
    setLoading(true);
    setError(null);
    setHistory([]);
    setSchedule([]);
    setProjection(null);

    const tasks: Promise<void>[] = [];

    if (player.sleeperId) {
      tasks.push(
        fetchPlayerSeasonHistory(player.sleeperId).then(setHistory).catch(() => {
          setHistory([]);
        }),
      );
      if (player.team) {
        tasks.push(
          fetchNflSeason()
            .then((season) => fetchTeamSchedule(player.team!, season))
            .then(setSchedule)
            .catch(() => setSchedule([])),
        );
      }
      if (hasSupabase) {
        tasks.push(
          fetchAnalogProjection(player.sleeperId)
            .then(setProjection)
            .catch(() => setProjection(null)),
        );
      }
    }

    Promise.all(tasks)
      .catch(() => setError('Could not load player data.'))
      .finally(() => setLoading(false));
  }, [player]);

  const statColumns = useMemo(() => {
    if (!player || player.position === 'PICK') return [];
    return STAT_FIELDS[player.position];
  }, [player]);

  if (!player || player.position === 'PICK') return null;

  const posColor = POSITION_COLORS[player.position];

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <AssetAvatar
            name={player.name}
            position={player.position}
            sleeperId={player.sleeperId}
            size={48}
          />
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6">{player.name}</Typography>
              <PositionChip position={player.position} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {player.team ?? 'FA'}
              {player.age ? ` · Age ${Math.floor(player.age)}` : ''}
              {projection
                ? formatBuild(projection.heightInches, projection.weightLbs)
                  ? ` · ${formatBuild(projection.heightInches, projection.weightLbs)}`
                  : ''
                : ''}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Tabs
        value={panel}
        onChange={(_, v) => setPanel(v)}
        variant="fullWidth"
        sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="stats" label="Stats" />
        <Tab value="schedule" label="Horaire" />
        <Tab value="projection" label="Projection" />
      </Tabs>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : panel === 'stats' ? (
          history.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No NFL season stats on record
              {player.sleeperId ? ' (rookie or limited data).' : ' — no Sleeper id.'}
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Season</TableCell>
                    {statColumns.map((c) => (
                      <TableCell key={c.key} align="right">
                        {c.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={row.season}>
                      <TableCell>
                        <Typography fontWeight={600}>{row.season}</Typography>
                      </TableCell>
                      {statColumns.map((c) => (
                        <TableCell key={c.key} align="right">
                          {c.key === 'halfPprPoints'
                            ? row[c.key].toFixed(1)
                            : row[c.key].toLocaleString()}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Half-PPR fantasy points · source: Sleeper
              </Typography>
            </Box>
          )
        ) : panel === 'schedule' ? (
          !player.team ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No team on file — schedule unavailable.
            </Typography>
          ) : schedule.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              Schedule not available for {player.team}.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Wk</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Matchup</TableCell>
                  <TableCell align="right">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schedule.map((g) => (
                  <TableRow key={`${g.week}-${g.opponent}`}>
                    <TableCell>{g.week}</TableCell>
                    <TableCell>{formatDate(g.date)}</TableCell>
                    <TableCell>
                      {g.isHome ? 'vs' : '@'} {g.opponent}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={statusLabel(g.status)}
                        color={g.status === 'complete' ? 'default' : 'primary'}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : !hasSupabase ? (
          <Alert severity="info">
            Projections require Supabase — configure <code>VITE_SUPABASE_URL</code> in your
            .env file.
          </Alert>
        ) : !projection?.seasons.length ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            No analog projection on record for this player yet.
          </Typography>
        ) : (
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              ML projection from {projection.seasons[0]?.nAnalogs ?? 0} similar{' '}
              {projection.position}s (same age + build + offensive profile).
              {projection.baseSeason
                ? ` Base: ${projection.baseSeason} (${Math.round(projection.basePoints ?? 0)} pts).`
                : ''}
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              }}
            >
              {projection.seasons
                .filter((s) => s.horizon > 0)
                .map((s) => (
                  <Box
                    key={s.horizon}
                    sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(148,163,184,0.08)' }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      +{s.horizon} yr{s.projectedAge ? ` · age ${s.projectedAge}` : ''}
                    </Typography>
                    <Typography variant="h5" fontWeight={800} sx={{ color: posColor }}>
                      {Math.round(s.projectedPoints)} pts
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {Math.round(s.low)}–{Math.round(s.high)} range
                    </Typography>
                  </Box>
                ))}
            </Box>

            {projection.comparables.length > 0 && (
              <>
                <Divider />
                <Typography variant="subtitle2">Similar players</Typography>
                <Stack spacing={1}>
                  {projection.comparables.slice(0, 8).map((c) => (
                    <Stack key={c.playerId} direction="row" alignItems="center" spacing={2}>
                      <Box sx={{ minWidth: 140 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {c.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatBuild(c.heightInches, c.weightLbs) ?? c.position}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Tooltip title={`${Math.round(c.similarity * 100)}% similar`}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.round(c.similarity * 100)}
                            sx={{ height: 6, borderRadius: 1 }}
                          />
                        </Tooltip>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
