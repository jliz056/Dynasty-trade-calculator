import {
  Box,
  IconButton,
  List,
  ListItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { Asset } from '../types';
import AssetAvatar from './AssetAvatar';
import PositionChip from './PositionChip';
import PlayerSearch from './PlayerSearch';

interface Props {
  title: string;
  accentColor: string;
  selected: Asset[];
  allAssets: Asset[];
  excludeIds: Set<number>;
  onAdd: (asset: Asset) => void;
  onRemove: (assetId: number) => void;
}

export default function TradeSide({
  title,
  accentColor,
  selected,
  allAssets,
  excludeIds,
  onAdd,
  onRemove,
}: Props) {
  const total = selected.reduce((sum, a) => sum + a.value, 0);

  return (
    <Paper sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ color: accentColor }}>
          {title}
        </Typography>
        <Typography variant="h6" fontWeight={800}>
          {total.toLocaleString()}
        </Typography>
      </Stack>

      <PlayerSearch
        assets={allAssets}
        excludeIds={excludeIds}
        onSelect={onAdd}
        label={`Add to ${title}`}
      />

      <List sx={{ mt: 1, flexGrow: 1 }}>
        {selected.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            Add players or draft picks above
          </Typography>
        )}
        {selected.map((asset) => (
          <ListItem
            key={asset.id}
            sx={{
              px: 1.5,
              py: 1,
              mb: 1,
              borderRadius: 2,
              bgcolor: 'rgba(148, 163, 184, 0.06)',
              border: '1px solid rgba(148, 163, 184, 0.1)',
            }}
            secondaryAction={
              <IconButton edge="end" size="small" onClick={() => onRemove(asset.id)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', pr: 4 }}>
              <AssetAvatar
                name={asset.name}
                position={asset.position}
                sleeperId={asset.sleeperId}
              />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography fontWeight={600} noWrap>
                    {asset.name}
                  </Typography>
                  <PositionChip position={asset.position} />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {asset.team ?? 'Pick'} · #{asset.overallRank} overall
                  </Typography>
                  {asset.trend30Day !== 0 && (
                    <Stack direction="row" spacing={0.25} alignItems="center">
                      {asset.trend30Day > 0 ? (
                        <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      ) : (
                        <TrendingDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
                      )}
                      <Typography
                        variant="caption"
                        sx={{ color: asset.trend30Day > 0 ? 'success.main' : 'error.main' }}
                      >
                        {Math.abs(asset.trend30Day)}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>
              <Typography fontWeight={700} color="primary.main">
                {asset.value.toLocaleString()}
              </Typography>
            </Stack>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
