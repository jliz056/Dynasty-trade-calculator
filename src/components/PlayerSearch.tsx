import { Autocomplete, Box, Stack, TextField, Typography } from '@mui/material';
import { Asset } from '../types';
import AssetAvatar from './AssetAvatar';
import PositionChip from './PositionChip';

interface Props {
  assets: Asset[];
  excludeIds: Set<number>;
  onSelect: (asset: Asset) => void;
  label: string;
}

export default function PlayerSearch({ assets, excludeIds, onSelect, label }: Props) {
  const options = assets.filter((a) => !excludeIds.has(a.id));

  return (
    <Autocomplete
      options={options}
      getOptionLabel={(o) => o.name}
      value={null}
      blurOnSelect
      onChange={(_, asset) => {
        if (asset) onSelect(asset);
      }}
      filterOptions={(opts, state) => {
        const input = state.inputValue.toLowerCase().trim();
        if (!input) return opts.slice(0, 30);
        return opts
          .filter((o) => o.name.toLowerCase().includes(input))
          .slice(0, 30);
      }}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
            <AssetAvatar
              name={option.name}
              position={option.position}
              sleeperId={option.sleeperId}
              size={32}
            />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {option.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {option.team ?? 'Draft Pick'}
                {option.age ? ` · ${Math.floor(option.age)} yrs` : ''}
              </Typography>
            </Box>
            <PositionChip position={option.position} />
            <Typography variant="body2" fontWeight={700} color="primary.main">
              {option.value.toLocaleString()}
            </Typography>
          </Stack>
        </Box>
      )}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder="Search players or picks…" size="small" />
      )}
    />
  );
}
