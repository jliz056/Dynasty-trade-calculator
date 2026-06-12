import { Avatar } from '@mui/material';
import { Position } from '../types';
import { headshotUrl } from '../services/fantasycalc';
import { POSITION_COLORS } from '../theme';

interface Props {
  name: string;
  position: Position;
  sleeperId: string | null;
  size?: number;
}

export default function AssetAvatar({ name, position, sleeperId, size = 40 }: Props) {
  const url = headshotUrl({ sleeperId, position });
  const color = POSITION_COLORS[position];

  return (
    <Avatar
      src={url ?? undefined}
      alt={name}
      sx={{
        width: size,
        height: size,
        bgcolor: `${color}33`,
        color,
        fontSize: size * 0.32,
        fontWeight: 700,
        border: `2px solid ${color}66`,
      }}
    >
      {position === 'PICK' ? '🎟' : name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
    </Avatar>
  );
}
