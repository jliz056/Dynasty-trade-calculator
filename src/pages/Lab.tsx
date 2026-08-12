import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import InsightsIcon from '@mui/icons-material/Insights';
import { useSettings } from '../context/SettingsContext';
import { usePlayerValues } from '../hooks/usePlayerValues';
import { fetchPlayerProduction } from '../services/sleeper';
import PlayerSearch from '../components/PlayerSearch';
import { POSITION_COLORS } from '../theme';
import { Asset, Position } from '../types';
import { ageCurve, ageMultiplier, projectPlayer } from '../services/projection';
import {
  AnalogProjection,
  fetchAnalogProjection,
  formatBuild,
  hasSupabase,
} from '../services/dynastyData';

const POSITIONS: Exclude<Position, 'PICK'>[] = ['QB', 'RB', 'WR', 'TE'];

// Last completed NFL seasons to look up real production for, newest first.
const PRODUCTION_SEASONS = [2025, 2024, 2023];
const NO_EXCLUSIONS = new Set<number>();

interface Preset {
  label: string;
  position: Exclude<Position, 'PICK'>;
  age: number;
  lastSeasonPoints: number;
  receptions: number;
}

const PRESETS: Preset[] = [
  { label: 'Young WR breakout', position: 'WR', age: 22, lastSeasonPoints: 250, receptions: 90 },
  { label: 'Elite RB (age cliff)', position: 'RB', age: 27, lastSeasonPoints: 290, receptions: 60 },
  { label: 'Franchise QB', position: 'QB', age: 25, lastSeasonPoints: 360, receptions: 0 },
  { label: 'Ascending TE', position: 'TE', age: 24, lastSeasonPoints: 170, receptions: 75 },
];

function AgeCurveChart({
  position,
  currentAge,
  projectionAges,
}: {
  position: string;
  currentAge: number;
  projectionAges: number[];
}) {
  const width = 540;
  const height = 200;
  const padX = 36;
  const padY = 24;
  const minAge = 21;
  const maxAge = 35;
  const curve = useMemo(() => ageCurve(position, minAge, maxAge), [position]);

  const x = (age: number) =>
    padX + ((age - minAge) / (maxAge - minAge)) * (width - padX * 2);
  const y = (mult: number) => height - padY - mult * (height - padY * 2);

  const linePoints = curve.map((p) => `${x(p.age)},${y(p.mult)}`).join(' ');
  const color = POSITION_COLORS[(position as Position) ?? 'WR'] ?? '#38bdf8';

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg width={width} height={height} role="img" aria-label="Age curve">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line
              x1={padX}
              x2={width - padX}
              y1={y(g)}
              y2={y(g)}
              stroke="rgba(148,163,184,0.15)"
              strokeWidth={1}
            />
            <text x={6} y={y(g) + 4} fill="rgba(148,163,184,0.7)" fontSize={10}>
              {g.toFixed(2)}
            </text>
          </g>
        ))}

        {[21, 24, 27, 30, 33].map((a) => (
          <text key={a} x={x(a)} y={height - 6} fill="rgba(148,163,184,0.7)" fontSize={10} textAnchor="middle">
            {a}
          </text>
        ))}

        <polyline points={linePoints} fill="none" stroke={color} strokeWidth={2.5} />

        <line
          x1={x(currentAge)}
          x2={x(currentAge)}
          y1={padY}
          y2={height - padY}
          stroke="#38bdf8"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />

        {projectionAges.map((a) => (
          <circle key={a} cx={x(a)} cy={y(ageMultiplier(position, a))} r={4} fill="#38bdf8" />
        ))}
      </svg>
    </Box>
  );
}

// Stat-line fields we surface, in display order, with short labels.
const STAT_FIELDS: { key: string; label: string; positions?: string[] }[] = [
  { key: 'games', label: 'G' },
  { key: 'pass_yards', label: 'Pass yds', positions: ['QB'] },
  { key: 'pass_tds', label: 'Pass TD', positions: ['QB'] },
  { key: 'rush_yards', label: 'Rush yds', positions: ['QB', 'RB', 'WR'] },
  { key: 'rush_tds', label: 'Rush TD', positions: ['QB', 'RB', 'WR'] },
  { key: 'receptions', label: 'Rec', positions: ['RB', 'WR', 'TE'] },
  { key: 'rec_yards', label: 'Rec yds', positions: ['RB', 'WR', 'TE'] },
  { key: 'rec_tds', label: 'Rec TD', positions: ['RB', 'WR', 'TE'] },
];

function CareerSparkline({
  arc,
  highlightAge,
  color,
}: {
  arc: { age: number; points: number }[];
  highlightAge: number;
  color: string;
}) {
  const w = 120;
  const h = 30;
  if (arc.length < 2) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }
  const ages = arc.map((p) => p.age);
  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  const maxPts = Math.max(...arc.map((p) => p.points), 1);
  const x = (age: number) =>
    maxAge === minAge ? 0 : ((age - minAge) / (maxAge - minAge)) * w;
  const y = (pts: number) => h - (pts / maxPts) * (h - 4) - 2;
  const pts = arc.map((p) => `${x(p.age).toFixed(1)},${y(p.points).toFixed(1)}`).join(' ');
  const hx = x(highlightAge);
  return (
    <svg width={w} height={h} role="img" aria-label="Career arc">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
      {highlightAge >= minAge && highlightAge <= maxAge && (
        <line x1={hx} x2={hx} y1={0} y2={h} stroke="rgba(148,163,184,0.5)" strokeDasharray="2 2" />
      )}
    </svg>
  );
}

export default function Lab() {
  const { settings } = useSettings();
  const { assets } = usePlayerValues();
  const [position, setPosition] = useState<Exclude<Position, 'PICK'>>('WR');
  const [age, setAge] = useState(22);
  const [lastSeasonPoints, setLastSeasonPoints] = useState(250);
  const [receptions, setReceptions] = useState(90);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [loadingProd, setLoadingProd] = useState(false);
  const [prodSource, setProdSource] = useState<{ season: number } | null>(null);
  const [analog, setAnalog] = useState<AnalogProjection | null>(null);
  const [loadingAnalog, setLoadingAnalog] = useState(false);

  const skillAssets = useMemo(
    () => assets.filter((a) => a.position !== 'PICK'),
    [assets],
  );

  const result = useMemo(
    () => projectPlayer({ position, age, lastSeasonPoints, receptions, settings }),
    [position, age, lastSeasonPoints, receptions, settings],
  );

  const handleSelectPlayer = async (asset: Asset) => {
    if (asset.position === 'PICK') return;
    setSelected(asset);
    setProdSource(null);
    setAnalog(null);
    setPosition(asset.position);
    if (asset.age) setAge(Math.min(34, Math.max(20, Math.round(asset.age))));

    if (!asset.sleeperId) return;

    setLoadingProd(true);
    setLoadingAnalog(hasSupabase);
    const prodPromise = fetchPlayerProduction(asset.sleeperId, PRODUCTION_SEASONS)
      .then((prod) => {
        if (prod) {
          setLastSeasonPoints(prod.halfPprPoints);
          setReceptions(prod.receptions);
          setProdSource({ season: prod.season });
        } else {
          setProdSource(null);
        }
      })
      .finally(() => setLoadingProd(false));

    const analogPromise = hasSupabase
      ? fetchAnalogProjection(asset.sleeperId)
          .then((data) => setAnalog(data))
          .catch(() => setAnalog(null))
          .finally(() => setLoadingAnalog(false))
      : Promise.resolve();

    await Promise.all([prodPromise, analogPromise]);
  };

  const applyPreset = (p: Preset) => {
    setSelected(null);
    setProdSource(null);
    setAnalog(null);
    setPosition(p.position);
    setAge(p.age);
    setLastSeasonPoints(p.lastSeasonPoints);
    setReceptions(p.receptions);
  };

  return (
    <Stack spacing={3} sx={{ mt: 3 }}>
      <Box>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ScienceIcon sx={{ color: 'secondary.main' }} />
          <Typography variant="h4">ML Lab</Typography>
          <Chip label="baseline_v1" size="small" color="secondary" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Test the Phase 2 valuation engine live. Projections run entirely in your
          browser using the same age curves and league-settings logic as the Python
          pipeline. Adjust the inputs and watch the dynasty value update.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Inputs
            </Typography>

            <Stack spacing={3} sx={{ mt: 1 }}>
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  SEARCH A PLAYER
                </Typography>
                <PlayerSearch
                  assets={skillAssets}
                  excludeIds={NO_EXCLUSIONS}
                  onSelect={handleSelectPlayer}
                  label="Search by name"
                />
                {selected && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    {loadingProd ? (
                      <>
                        <CircularProgress size={14} />
                        <Typography variant="caption" color="text.secondary">
                          Loading {selected.name}'s real stats…
                        </Typography>
                      </>
                    ) : prodSource ? (
                      <Chip
                        size="small"
                        color="success"
                        variant="outlined"
                        label={`${selected.name} · real ${prodSource.season} production`}
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        No NFL stats found for {selected.name} — enter production manually.
                      </Typography>
                    )}
                  </Stack>
                )}
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  POSITION
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={position}
                  onChange={(_, v) => v !== null && setPosition(v)}
                >
                  {POSITIONS.map((p) => (
                    <ToggleButton key={p} value={p}>
                      {p}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Stack>

              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  AGE: {age}
                </Typography>
                <Slider
                  value={age}
                  min={20}
                  max={34}
                  step={1}
                  marks
                  onChange={(_, v) => setAge(v as number)}
                  valueLabelDisplay="auto"
                />
              </Box>

              <TextField
                label="Last season fantasy points (half-PPR)"
                type="number"
                size="small"
                value={lastSeasonPoints}
                onChange={(e) => {
                  setLastSeasonPoints(Math.max(0, Number(e.target.value)));
                  setProdSource(null);
                }}
              />

              {position !== 'QB' && (
                <TextField
                  label="Receptions last season"
                  type="number"
                  size="small"
                  value={receptions}
                  onChange={(e) => {
                    setReceptions(Math.max(0, Number(e.target.value)));
                    setProdSource(null);
                  }}
                  helperText="Used to adjust the half-PPR baseline to your PPR setting"
                />
              )}

              <Divider />
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  QUICK PRESETS
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {PRESETS.map((p) => (
                    <Button
                      key={p.label}
                      size="small"
                      variant="outlined"
                      onClick={() => applyPreset(p)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Projection
            </Typography>

            <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  DYNASTY VALUE
                </Typography>
                <Typography variant="h3" sx={{ color: 'primary.main', fontWeight: 800 }}>
                  {result.scaledValue}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  scaled 0–10000 (estimate)
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  DYNASTY SCORE
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {result.dynastyScore}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  discounted 3-yr points
                </Typography>
              </Box>
            </Stack>

            <Divider sx={{ mb: 2 }} />

            <Stack spacing={1}>
              {result.seasons.map((s) => {
                const max = Math.max(...result.seasons.map((x) => x.projectedPoints), 1);
                const pct = (s.projectedPoints / max) * 100;
                return (
                  <Box key={s.yearOffset}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">
                        {s.yearOffset === 0 ? 'This season' : `+${s.yearOffset} yr`} (age {s.age})
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {s.projectedPoints} pts
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        bgcolor: 'rgba(148,163,184,0.15)',
                        mt: 0.5,
                      }}
                    >
                      <Box
                        sx={{
                          width: `${pct}%`,
                          height: '100%',
                          borderRadius: 1,
                          bgcolor: POSITION_COLORS[position],
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {selected && (loadingAnalog || analog) && (
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <InsightsIcon sx={{ color: 'secondary.main' }} />
              <Typography variant="h6">Analog projection (ML)</Typography>
              <Chip label="analog_v1" size="small" color="secondary" variant="outlined" />
            </Stack>

            {loadingAnalog ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Finding similar player profiles…
                </Typography>
              </Stack>
            ) : analog && analog.seasons.length ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Next-season stat lines from the median trajectory of{' '}
                  {analog.seasons[0]?.nAnalogs ?? 0} historical {analog.position}s with a
                  similar profile and build
                  {formatBuild(analog.heightInches, analog.weightLbs)
                    ? ` (${formatBuild(analog.heightInches, analog.weightLbs)})`
                    : ''}{' '}
                  at the same age
                  {analog.baseSeason
                    ? ` (base: ${analog.baseSeason} season, ${Math.round(
                        analog.basePoints ?? 0,
                      )} pts)`
                    : ''}
                  .
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                  }}
                >
                  {analog.seasons.map((s) => (
                    <Box
                      key={s.horizon}
                      sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(148,163,184,0.08)' }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        +{s.horizon} yr{s.projectedAge ? ` · age ${s.projectedAge}` : ''}
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>
                        {Math.round(s.projectedPoints)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        range {Math.round(s.low)}–{Math.round(s.high)} pts
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Stack spacing={0.25}>
                        {STAT_FIELDS.filter(
                          (f) => !f.positions || f.positions.includes(analog.position),
                        ).map((f) => (
                          <Stack
                            key={f.key}
                            direction="row"
                            justifyContent="space-between"
                          >
                            <Typography variant="caption" color="text.secondary">
                              {f.label}
                            </Typography>
                            <Typography variant="caption" fontWeight={600}>
                              {Math.round(s.statLine[f.key] ?? 0)}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No analog projection on record for {selected.name} — the engine needs a
                recent NFL season (rookies are covered by the devy model).
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {analog && analog.comparables.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Most similar players at age {Math.round(age)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Historical players with a similar offensive profile and frame at this age.
              WRs are matched within ±3&quot; height; RB/TE within ±2&quot;.
              The sparkline is each player&apos;s real fantasy-points career arc.
            </Typography>
            <Stack divider={<Divider flexItem />} spacing={1}>
              {analog.comparables.map((c) => (
                <Stack key={c.playerId} direction="row" alignItems="center" spacing={2}>
                  <Box sx={{ minWidth: 150 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {c.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.position}
                      {formatBuild(c.heightInches, c.weightLbs)
                        ? ` · ${formatBuild(c.heightInches, c.weightLbs)}`
                        : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 80 }}>
                    <Tooltip title={`${Math.round(c.similarity * 100)}% similar`}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.round(c.similarity * 100)}
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </Tooltip>
                  </Box>
                  <CareerSparkline
                    arc={c.arc}
                    highlightAge={age}
                    color={POSITION_COLORS[analog.position as Position] ?? '#38bdf8'}
                  />
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {position} age curve
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Production multiplier by age. The dashed line is the current age; dots
            mark the projected seasons.
          </Typography>
          <AgeCurveChart
            position={position}
            currentAge={age}
            projectionAges={result.seasons.map((s) => s.age)}
          />
        </CardContent>
      </Card>

      <Alert severity={hasSupabase ? 'success' : 'info'} variant="outlined">
        <Typography variant="body2" fontWeight={700} gutterBottom>
          {hasSupabase ? 'Live ML data connected' : 'Coming online with the database'}
        </Typography>
        <Typography variant="body2">
          {hasSupabase ? (
            <>
              The two left cards are the formula baseline (runs in your browser). The
              <strong> Analog projection</strong> and <strong>similar players</strong>{' '}
              below are served from Supabase — built from 2009–2025 NFL seasons by the
              Python pipeline. Search a current NFL player to see their data-driven
              stat-line forecast and historical comparables.
            </>
          ) : (
            <>
              This sandbox runs the formula-based baseline. The analog projection model
              and live player values activate once the Supabase pipeline is connected.
              Set <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code> and
              run <code>npm run data:pipeline</code>.
            </>
          )}
        </Typography>
      </Alert>
    </Stack>
  );
}
