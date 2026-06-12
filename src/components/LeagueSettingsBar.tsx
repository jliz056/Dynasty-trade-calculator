import {
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useSettings } from '../context/SettingsContext';

export default function LeagueSettingsBar() {
  const { settings, updateSettings } = useSettings();

  return (
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
            FORMAT
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={settings.numQbs}
            onChange={(_, v) => v !== null && updateSettings({ numQbs: v })}
          >
            <ToggleButton value={1}>1QB</ToggleButton>
            <ToggleButton value={2}>Superflex</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            TE PREMIUM
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={settings.tePremium}
            onChange={(_, v) => v !== null && updateSettings({ tePremium: v })}
          >
            <ToggleButton value={0}>Off</ToggleButton>
            <ToggleButton value={0.5}>+0.5</ToggleButton>
            <ToggleButton value={1}>+1.0</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            SCORING
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={settings.ppr}
            onChange={(_, v) => v !== null && updateSettings({ ppr: v })}
          >
            <ToggleButton value={0}>Standard</ToggleButton>
            <ToggleButton value={0.5}>0.5 PPR</ToggleButton>
            <ToggleButton value={1}>PPR</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            TEAMS
          </Typography>
          <TextField
            select
            size="small"
            value={settings.numTeams}
            onChange={(e) => updateSettings({ numTeams: Number(e.target.value) })}
            sx={{ minWidth: 90 }}
          >
            {[8, 10, 12, 14, 16].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>
    </Paper>
  );
}
