import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import GroupsIcon from '@mui/icons-material/Groups';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useNavigate } from 'react-router-dom';
import { usePlayerValues } from '../hooks/usePlayerValues';
import { useSettings } from '../context/SettingsContext';
import {
  SleeperLeague,
  SleeperLeagueUser,
  SleeperRoster,
  SleeperUser,
  detectLeagueSettings,
  getLeagueData,
  getLeagues,
  getUser,
  sleeperAvatarUrl,
} from '../services/sleeper';
import {
  TeamAnalysis,
  TradeRecommendation,
  analyzeTeam,
  generateRecommendations,
  parseStarterSlots,
} from '../services/recommendations';
import AssetAvatar from '../components/AssetAvatar';
import PositionChip from '../components/PositionChip';
import { Asset } from '../types';

const USERNAME_KEY = 'dtc-sleeper-username';

function RecAssetList({ assets, label }: { assets: Asset[]; label: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      <Stack spacing={0.75} sx={{ mt: 0.5 }}>
        {assets.map((a) => (
          <Stack key={a.id} direction="row" spacing={1} alignItems="center">
            <AssetAvatar name={a.name} position={a.position} sleeperId={a.sleeperId} size={28} />
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {a.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {a.position} · {a.value.toLocaleString()}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export default function Leagues() {
  const { assets, loading: valuesLoading, error: valuesError } = usePlayerValues();
  const { updateSettings } = useSettings();
  const navigate = useNavigate();

  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY) ?? '');
  const [user, setUser] = useState<SleeperUser | null>(null);
  const [leagues, setLeagues] = useState<SleeperLeague[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<SleeperLeague | null>(null);
  const [rosters, setRosters] = useState<SleeperRoster[]>([]);
  const [leagueUsers, setLeagueUsers] = useState<SleeperLeagueUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUser = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedLeague(null);
    try {
      const u = await getUser(username);
      const ls = await getLeagues(u.user_id);
      setUser(u);
      setLeagues(ls);
      localStorage.setItem(USERNAME_KEY, username.trim());
      if (ls.length === 0) setError('No Sleeper leagues found for this user.');
    } catch (err) {
      setUser(null);
      setLeagues([]);
      setError(err instanceof Error ? err.message : 'Could not reach Sleeper.');
    } finally {
      setLoading(false);
    }
  };

  const selectLeague = async (league: SleeperLeague) => {
    setLoading(true);
    setError(null);
    try {
      const { rosters: r, users: us } = await getLeagueData(league.league_id);
      setRosters(r);
      setLeagueUsers(us);
      setSelectedLeague(league);
      updateSettings(detectLeagueSettings(league));
    } catch {
      setError('Could not load league data from Sleeper.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-reload the saved username on first visit.
  useEffect(() => {
    if (username && !user) void loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assetsBySleeperId = useMemo(() => {
    const map = new Map<string, Asset>();
    for (const a of assets) {
      if (a.sleeperId) map.set(a.sleeperId, a);
    }
    return map;
  }, [assets]);

  const slots = useMemo(
    () => (selectedLeague ? parseStarterSlots(selectedLeague.roster_positions) : []),
    [selectedLeague],
  );

  const analyses = useMemo<TeamAnalysis[]>(() => {
    if (!selectedLeague || assets.length === 0) return [];
    return rosters
      .map((r) => analyzeTeam(r, leagueUsers, assetsBySleeperId, slots))
      .sort((a, b) => b.starterValue - a.starterValue);
  }, [selectedLeague, rosters, leagueUsers, assetsBySleeperId, slots, assets.length]);

  const myTeam = useMemo(
    () => analyses.find((a) => a.ownerId === user?.user_id) ?? null,
    [analyses, user],
  );

  const recommendations = useMemo<TradeRecommendation[]>(() => {
    if (!myTeam) return [];
    return generateRecommendations(
      myTeam,
      analyses.filter((a) => a !== myTeam),
      slots,
    );
  }, [myTeam, analyses, slots]);

  const openInCalculator = (rec: TradeRecommendation) => {
    localStorage.setItem(
      'dtc-pending-trade',
      JSON.stringify({
        a: rec.receive.map((x) => x.id),
        b: rec.send.map((x) => x.id),
      }),
    );
    navigate('/');
  };

  return (
    <Stack spacing={3}>
      <Box sx={{ pt: 2 }}>
        <Typography variant="h4" gutterBottom>
          My Leagues
        </Typography>
        <Typography color="text.secondary">
          Link your Sleeper account to analyze your team and get trade recommendations
        </Typography>
      </Box>

      <Paper sx={{ p: 2.5 }}>
        <form onSubmit={loadUser}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Sleeper username"
              size="small"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              sx={{ minWidth: 240 }}
            />
            <Button type="submit" variant="contained" disabled={loading || !username.trim()}>
              Load leagues
            </Button>
          </Stack>
        </form>
      </Paper>

      {(error || valuesError) && <Alert severity="error">{error ?? valuesError}</Alert>}

      {(loading || valuesLoading) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {user && leagues.length > 0 && !selectedLeague && !loading && (
        <Grid container spacing={2}>
          {leagues.map((league) => (
            <Grid item xs={12} sm={6} md={4} key={league.league_id}>
              <Card>
                <CardActionArea onClick={() => selectLeague(league)} sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar src={sleeperAvatarUrl(league.avatar)} variant="rounded">
                      <GroupsIcon />
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700} noWrap>
                        {league.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {league.total_rosters} teams · {league.season}
                        {league.roster_positions.includes('SUPER_FLEX') ? ' · SF' : ''}
                      </Typography>
                    </Box>
                  </Stack>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {selectedLeague && !loading && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              label={selectedLeague.name}
              color="primary"
              onDelete={() => setSelectedLeague(null)}
            />
            <Chip
              label="League settings applied to values"
              size="small"
              variant="outlined"
              color="success"
            />
            {myTeam && myTeam.unmatchedCount > 0 && (
              <Typography variant="caption" color="text.secondary">
                {myTeam.unmatchedCount} deep-bench players have no market value and are ignored
              </Typography>
            )}
          </Stack>

          {!myTeam ? (
            <Alert severity="warning">Could not find your roster in this league.</Alert>
          ) : (
            <>
              <Paper sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <SyncAltIcon color="primary" />
                  <Typography variant="h6">Recommended trades for you</Typography>
                </Stack>
                {recommendations.length === 0 ? (
                  <Alert severity="info">
                    No clearly beneficial trades found right now — your starters may already be
                    optimal for fair-value swaps in this league.
                  </Alert>
                ) : (
                  <Grid container spacing={2}>
                    {recommendations.map((rec, i) => (
                      <Grid item xs={12} md={6} key={i}>
                        <Paper
                          variant="outlined"
                          sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}
                        >
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ mb: 1.5 }}
                          >
                            <Typography variant="subtitle2" color="text.secondary">
                              with <strong>{rec.partner.teamName}</strong>
                            </Typography>
                            <Chip
                              size="small"
                              color="success"
                              label={`+${rec.myStarterGain.toLocaleString()} starter value`}
                            />
                          </Stack>
                          <Stack direction="row" spacing={2} sx={{ flexGrow: 1 }}>
                            <RecAssetList assets={rec.send} label="YOU SEND" />
                            <ArrowForwardIcon sx={{ alignSelf: 'center', color: 'text.disabled' }} />
                            <RecAssetList assets={rec.receive} label="YOU RECEIVE" />
                          </Stack>
                          <Divider sx={{ my: 1.5 }} />
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" color="text.secondary">
                              Value diff: {rec.valueDiff >= 0 ? '+' : ''}
                              {rec.valueDiff.toLocaleString()} for you
                            </Typography>
                            <Button size="small" onClick={() => openInCalculator(rec)}>
                              Open in calculator
                            </Button>
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Paper>

              <Paper sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <EmojiEventsIcon color="primary" />
                  <Typography variant="h6">League power rankings</Typography>
                </Stack>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 50 }}>#</TableCell>
                        <TableCell>Team</TableCell>
                        <TableCell align="right">Starter value</TableCell>
                        <TableCell align="right">Total value</TableCell>
                        <TableCell align="right">QB</TableCell>
                        <TableCell align="right">RB</TableCell>
                        <TableCell align="right">WR</TableCell>
                        <TableCell align="right">TE</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analyses.map((team, i) => {
                        const isMe = team.ownerId === user?.user_id;
                        return (
                          <TableRow
                            key={team.rosterId}
                            hover
                            sx={isMe ? { bgcolor: 'rgba(34, 197, 94, 0.08)' } : undefined}
                          >
                            <TableCell>
                              <Typography fontWeight={700} color="text.secondary">
                                {i + 1}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Avatar
                                  src={sleeperAvatarUrl(team.avatar)}
                                  sx={{ width: 26, height: 26 }}
                                />
                                <Typography fontWeight={isMe ? 700 : 500}>
                                  {team.teamName}
                                  {isMe ? ' (you)' : ''}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight={700} color="primary.main">
                                {team.starterValue.toLocaleString()}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{team.totalValue.toLocaleString()}</TableCell>
                            <TableCell align="right">{team.positionValue.QB.toLocaleString()}</TableCell>
                            <TableCell align="right">{team.positionValue.RB.toLocaleString()}</TableCell>
                            <TableCell align="right">{team.positionValue.WR.toLocaleString()}</TableCell>
                            <TableCell align="right">{team.positionValue.TE.toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              <Paper sx={{ p: 2.5 }}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  Your roster
                </Typography>
                <Grid container spacing={1}>
                  {myTeam.assets.map((a) => {
                    const isStarter = myTeam.starters.some((s) => s.id === a.id);
                    return (
                      <Grid item xs={12} sm={6} md={4} key={a.id}>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                          sx={{
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 2,
                            bgcolor: isStarter
                              ? 'rgba(56, 189, 248, 0.08)'
                              : 'rgba(148, 163, 184, 0.05)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                          }}
                        >
                          <AssetAvatar
                            name={a.name}
                            position={a.position}
                            sleeperId={a.sleeperId}
                            size={30}
                          />
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {a.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {isStarter ? 'Starter' : 'Bench'} · {a.team ?? '—'}
                            </Typography>
                          </Box>
                          <PositionChip position={a.position} />
                          <Typography variant="body2" fontWeight={700} color="primary.main">
                            {a.value.toLocaleString()}
                          </Typography>
                        </Stack>
                      </Grid>
                    );
                  })}
                </Grid>
              </Paper>
            </>
          )}
        </>
      )}
    </Stack>
  );
}
