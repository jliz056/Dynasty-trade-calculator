import { Chip } from '@mui/material';
import { Position } from '../types';
import { POSITION_COLORS } from '../theme';

export default function PositionChip({ position }: { position: Position }) {
  const color = POSITION_COLORS[position];
  return (
    <Chip
      label={position}
      size="small"
      sx={{
        bgcolor: `${color}26`,
        color,
        fontWeight: 700,
        fontSize: 11,
        height: 22,
      }}
    />
  );
}
