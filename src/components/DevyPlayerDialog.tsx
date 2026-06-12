import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DevyPlayer } from '../services/ktcDevy';
import { CollegeProfile, fetchCollegeProfile, hasCfbdKey } from '../services/cfbd';
import AssetAvatar from './AssetAvatar';
import PositionChip from './PositionChip';

const CATEGORY_LABELS: Record<string, string> = {
  passing: 'Passing',
  rushing: 'Rushing',
  receiving: 'Receiving',
};

const STAT_ORDER: Record<string, string[]> = {
  passing: ['COMPLETIONS', 'ATT', 'PCT', 'YDS', 'TD', 'INT', 'YPA'],
  rushing: ['CAR', 'YDS', 'YPC', 'TD', 'LONG'],
  receiving: ['REC', 'YDS', 'YPR', 'TD', 'LONG'],
};

const STAT_LABELS: Record<string, string> = {
  COMPLETIONS: 'Comp',
  ATT: 'Att',
  PCT: 'Pct',
  YDS: 'Yards',
  TD: 'TD',
  INT: 'Int',
  YPA: 'Y/A',
  CAR: 'Carries',
  YPC: 'Y/C',
  LONG: 'Long',
  REC: 'Rec',
  YPR: 'Y/R',
};

function formatHeight(inches: number | null): string | null {
  if (!inches) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

function StatBlock({ category, values }: { category: string; values: Record<string, number> }) {
  const order = STAT_ORDER[category] ?? Object.keys(values);
  const shown = order.filter((k) => values[k] !== undefined);
  if (shown.length === 0) return null;

  return (
    <Box>
      <Typography variant="subtitle2" color="primary.main" sx={{ mb: 1 }}>
        {CATEGORY_LABELS[category] ?? category}
      </Typography>
      <Grid container spacing={1}>
        {shown.map((key) => (
          <Grid item xs={4} sm={2} key={key}>
            <Paper sx={{ p: 1, textAlign: 'center' }}>
              <Typography variant="h6">{values[key].toLocaleString()}</Typography>
              <Typography variant="caption" color="text.secondary">
                {STAT_LABELS[key] ?? key}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

interface Props {
  player: DevyPlayer | null;
  onClose: () => void;
}

export default function DevyPlayerDialog({ player, onClose }: Props) {
  const [profile, setProfile] = useState<CollegeProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!player || !hasCfbdKey) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);
    fetchCollegeProfile(player.name, player.position)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [player]);

  return (
    <Dialog open={!!player} onClose={onClose} maxWidth="sm" fullWidth>
      {player && (
        <>
          <DialogTitle>
            <Stack direction="row" spacing={2} alignItems="center">
              <AssetAvatar
                name={player.name}
                position={player.position}
                sleeperId={null}
                size={48}
              />
              <Box sx={{ flexGrow: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="h6">{player.name}</Typography>
                  <PositionChip position={player.position} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {profile?.player?.team ?? player.college ?? 'Unknown college'}
                  {player.draftYear ? ` · Projected ${player.draftYear} draft` : ''}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h6" color="secondary.main">
                  {player.value.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Devy value
                </Typography>
              </Box>
              <IconButton onClick={onClose} size="small">
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            {!hasCfbdKey ? (
              <Alert severity="info">
                College stats need a free CollegeFootballData API key. Register at{' '}
                <Link href="https://collegefootballdata.com/key" target="_blank" rel="noreferrer">
                  collegefootballdata.com/key
                </Link>
                , then copy <code>.env.example</code> to <code>.env</code>, paste the key as{' '}
                <code>VITE_CFB_API_KEY</code>, and restart the dev server.
              </Alert>
            ) : loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error">{error}</Alert>
            ) : profile ? (
              <Stack spacing={3}>
                {profile.player && (
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    {formatHeight(profile.player.height) && (
                      <Typography variant="body2" color="text.secondary">
                        Height: <strong>{formatHeight(profile.player.height)}</strong>
                      </Typography>
                    )}
                    {profile.player.weight && (
                      <Typography variant="body2" color="text.secondary">
                        Weight: <strong>{profile.player.weight} lbs</strong>
                      </Typography>
                    )}
                    {profile.player.jersey != null && (
                      <Typography variant="body2" color="text.secondary">
                        Jersey: <strong>#{profile.player.jersey}</strong>
                      </Typography>
                    )}
                    {profile.player.hometown && (
                      <Typography variant="body2" color="text.secondary">
                        Hometown: <strong>{profile.player.hometown}</strong>
                      </Typography>
                    )}
                  </Stack>
                )}
                {profile.season ? (
                  <>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {profile.season} Season Stats
                    </Typography>
                    {Object.entries(profile.stats).map(([category, values]) => (
                      <StatBlock key={category} category={category} values={values} />
                    ))}
                  </>
                ) : (
                  <Alert severity="info">
                    No college stats found for {player.name}
                    {profile.player ? ` at ${profile.player.team}` : ''}.
                  </Alert>
                )}
              </Stack>
            ) : null}
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}
