import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { SavedTrade, SavedTradeAsset } from '../types';
import { useAuth } from '../context/AuthContext';
import { deleteTrade, getUserTrades } from '../services/trades';
import AssetAvatar from '../components/AssetAvatar';

function SideList({ title, items, total, color }: {
  title: string;
  items: SavedTradeAsset[];
  total: number;
  color: string;
}) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ color }}>
          {title}
        </Typography>
        <Typography variant="subtitle2" fontWeight={700}>
          {total.toLocaleString()}
        </Typography>
      </Stack>
      <Stack spacing={0.75}>
        {items.map((item) => (
          <Stack key={item.id} direction="row" spacing={1} alignItems="center">
            <AssetAvatar
              name={item.name}
              position={item.position}
              sleeperId={item.sleeperId}
              size={26}
            />
            <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
              {item.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {item.value.toLocaleString()}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export default function History() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<SavedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserTrades(user.uid)
      .then(setTrades)
      .catch(() => setError('Could not load your trades.'))
      .finally(() => setLoading(false));
  }, [user]);

  const handleDelete = async (id: string) => {
    await deleteTrade(id);
    setTrades((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <Stack spacing={3}>
      <Box sx={{ pt: 2 }}>
        <Typography variant="h4" gutterBottom>
          My Trades
        </Typography>
        <Typography color="text.secondary">
          Trades you've saved from the calculator
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : trades.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No saved trades yet. Build a trade in the calculator and hit "Save trade".
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {trades.map((trade) => (
            <Grid item xs={12} md={6} key={trade.id}>
              <Paper sx={{ p: 2.5 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 1.5 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={trade.verdict}
                      size="small"
                      color={trade.verdict === 'Fair trade' ? 'success' : 'warning'}
                      variant="outlined"
                    />
                    <Chip
                      label={trade.settings.numQbs === 2 ? 'Superflex' : '1QB'}
                      size="small"
                      variant="outlined"
                    />
                    {trade.settings.tePremium > 0 && (
                      <Chip label={`TEP +${trade.settings.tePremium}`} size="small" variant="outlined" />
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {new Date(trade.createdAt).toLocaleDateString()}
                    </Typography>
                    <IconButton size="small" onClick={() => handleDelete(trade.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <SideList
                      title="Team A Receives"
                      items={trade.sideA}
                      total={trade.totalA}
                      color="#38bdf8"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <SideList
                      title="Team B Receives"
                      items={trade.sideB}
                      total={trade.totalB}
                      color="#a855f7"
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}
