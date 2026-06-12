import { Box, Paper, Stack, Typography } from '@mui/material';
import BalanceIcon from '@mui/icons-material/Balance';
import { Asset } from '../types';
import AssetAvatar from './AssetAvatar';

export interface Verdict {
  text: string;
  fair: boolean;
  diff: number;
  diffPercent: number;
  winner: 'A' | 'B' | null;
}

export function evaluateTrade(
  totalA: number,
  totalB: number,
  labelA: string,
  labelB: string,
): Verdict {
  const diff = Math.abs(totalA - totalB);
  const max = Math.max(totalA, totalB);
  const diffPercent = max === 0 ? 0 : (diff / max) * 100;
  const winner = totalA === totalB ? null : totalA > totalB ? 'A' : 'B';
  const winnerLabel = winner === 'A' ? labelA : labelB;

  if (diffPercent <= 5) {
    return { text: 'Fair trade', fair: true, diff, diffPercent, winner };
  }
  if (diffPercent <= 12) {
    return {
      text: `Slightly favors ${winnerLabel}`,
      fair: true,
      diff,
      diffPercent,
      winner,
    };
  }
  return {
    text: `Favors ${winnerLabel}`,
    fair: false,
    diff,
    diffPercent,
    winner,
  };
}

interface Props {
  totalA: number;
  totalB: number;
  labelA: string;
  labelB: string;
  colorA: string;
  colorB: string;
  suggestions: Asset[];
}

export default function TradeVerdict({
  totalA,
  totalB,
  labelA,
  labelB,
  colorA,
  colorB,
  suggestions,
}: Props) {
  if (totalA === 0 && totalB === 0) return null;

  const verdict = evaluateTrade(totalA, totalB, labelA, labelB);
  const sum = totalA + totalB;
  const percentA = sum === 0 ? 50 : (totalA / sum) * 100;
  const losingLabel = verdict.winner === 'A' ? labelB : labelA;
  const verdictColor = verdict.fair
    ? verdict.diffPercent <= 5
      ? '#22c55e'
      : '#f59e0b'
    : '#ef4444';

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
          <BalanceIcon sx={{ color: verdictColor }} />
          <Typography variant="h5" sx={{ color: verdictColor }}>
            {verdict.text}
          </Typography>
        </Stack>

        <Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: colorA }}>
              {labelA} · {totalA.toLocaleString()}
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ color: colorB }}>
              {totalB.toLocaleString()} · {labelB}
            </Typography>
          </Stack>
          <Box
            sx={{
              height: 12,
              borderRadius: 6,
              overflow: 'hidden',
              display: 'flex',
              bgcolor: 'rgba(148,163,184,0.15)',
            }}
          >
            <Box sx={{ width: `${percentA}%`, bgcolor: colorA, transition: 'width 0.4s' }} />
            <Box sx={{ flexGrow: 1, bgcolor: colorB, transition: 'width 0.4s' }} />
          </Box>
          {verdict.diff > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', mt: 0.75 }}
            >
              Value gap: {verdict.diff.toLocaleString()} ({verdict.diffPercent.toFixed(1)}%)
            </Typography>
          )}
        </Box>

        {verdict.winner && suggestions.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              To even it out, <strong>{losingLabel}</strong> could also receive:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {suggestions.map((s) => (
                <Stack
                  key={s.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 5,
                    bgcolor: 'rgba(148,163,184,0.08)',
                    border: '1px solid rgba(148,163,184,0.15)',
                  }}
                >
                  <AssetAvatar
                    name={s.name}
                    position={s.position}
                    sleeperId={s.sleeperId}
                    size={24}
                  />
                  <Typography variant="body2" fontWeight={600}>
                    {s.name}
                  </Typography>
                  <Typography variant="body2" color="primary.main" fontWeight={700}>
                    {s.value.toLocaleString()}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
