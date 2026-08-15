-- Dynasty Trade Calculator — data layer (Phase 1)
-- PostgreSQL / Supabase compatible

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE player_level AS ENUM ('college', 'nfl');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE data_source AS ENUM ('sleeper', 'cfbd', 'nflverse', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Core player registry (college + NFL)
CREATE TABLE IF NOT EXISTS players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  position        TEXT NOT NULL,
  level           player_level NOT NULL DEFAULT 'nfl',
  sleeper_id      TEXT UNIQUE,
  cfbd_id         TEXT,
  gsis_id         TEXT,
  team            TEXT,
  birth_date      DATE,
  draft_year      INT,
  draft_round     INT,
  draft_pick      INT,
  height_inches   INT,   -- total inches (e.g. 74 = 6'2")
  weight_lbs      INT,
  active          BOOLEAN,  -- Sleeper active flag (false = retired/out of NFL)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent upgrade for databases created before the column existed.
ALTER TABLE players ADD COLUMN IF NOT EXISTS active BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_players_name ON players (name);
CREATE INDEX IF NOT EXISTS idx_players_position ON players (position);
CREATE INDEX IF NOT EXISTS idx_players_level ON players (level);
CREATE INDEX IF NOT EXISTS idx_players_sleeper_id ON players (sleeper_id) WHERE sleeper_id IS NOT NULL;

-- Raw + normalized season stats (college and NFL)
CREATE TABLE IF NOT EXISTS season_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season          INT NOT NULL,
  level           player_level NOT NULL,
  team            TEXT,
  games           INT,
  age             NUMERIC(4, 1),
  -- Volume (position-agnostic storage; features layer interprets)
  pass_attempts   INT,
  pass_yards      INT,
  pass_tds        INT,
  rush_attempts   INT,
  rush_yards      INT,
  rush_tds        INT,
  targets         INT,
  receptions      INT,
  rec_yards       INT,
  rec_tds         INT,
  -- Derived fantasy (half-PPR baseline; settings applied at valuation layer)
  fantasy_points  NUMERIC(8, 2),
  stats_json      JSONB NOT NULL DEFAULT '{}',
  source          data_source NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, season, level, source)
);

CREATE INDEX IF NOT EXISTS idx_season_stats_player ON season_stats (player_id);
CREATE INDEX IF NOT EXISTS idx_season_stats_season ON season_stats (season);
CREATE INDEX IF NOT EXISTS idx_season_stats_level ON season_stats (level);

-- Age-season snapshots for career curve analysis
CREATE TABLE IF NOT EXISTS career_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season          INT NOT NULL,
  level           player_level NOT NULL,
  age             NUMERIC(4, 1) NOT NULL,
  season_index    INT NOT NULL,  -- 1 = rookie year at this level
  fantasy_points  NUMERIC(8, 2),
  volume_index    NUMERIC(8, 4), -- normalized usage vs position peers
  efficiency_index NUMERIC(8, 4),
  feature_vector  JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, season, level)
);

CREATE INDEX IF NOT EXISTS idx_career_snapshots_age ON career_snapshots (age);
CREATE INDEX IF NOT EXISTS idx_career_snapshots_player ON career_snapshots (player_id);

-- Historical comparables: "player X at age 23 looks like player Y at age 23"
CREATE TABLE IF NOT EXISTS player_comparables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id      UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  comparable_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  subject_age     NUMERIC(4, 1) NOT NULL,
  similarity      NUMERIC(5, 4) NOT NULL, -- 0..1
  method          TEXT NOT NULL DEFAULT 'cosine_v1',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, comparable_id, subject_age, method)
);

CREATE INDEX IF NOT EXISTS idx_comparables_subject ON player_comparables (subject_id);

-- Dynasty values output (future ML / formula engine)
CREATE TABLE IF NOT EXISTS dynasty_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  settings_key    TEXT NOT NULL, -- e.g. "1qb-12t-1ppr-0tep"
  value           INT NOT NULL,
  overall_rank    INT,
  position_rank   INT,
  projection_years INT NOT NULL DEFAULT 3,
  model_version   TEXT NOT NULL DEFAULT 'baseline_v1',
  metadata        JSONB NOT NULL DEFAULT '{}',
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, settings_key, model_version)
);

CREATE INDEX IF NOT EXISTS idx_dynasty_values_settings ON dynasty_values (settings_key, value DESC);

-- Multi-season fantasy projections (formula baseline now, ML later).
-- horizon_year 0 = current/next season, 1..N = seasons out.
CREATE TABLE IF NOT EXISTS projections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  horizon_year     INT NOT NULL,
  projected_points NUMERIC(8, 2),
  low              NUMERIC(8, 2),
  high             NUMERIC(8, 2),
  model_version    TEXT NOT NULL,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, horizon_year, model_version)
);

CREATE INDEX IF NOT EXISTS idx_projections_player ON projections (player_id);
CREATE INDEX IF NOT EXISTS idx_projections_model ON projections (model_version);

-- Per-game stats (Sleeper weekly). Unlocks consistency metrics, partial-injury
-- seasons, late-season trends, and (later) weather/stadium features.
CREATE TABLE IF NOT EXISTS weekly_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season          INT NOT NULL,
  week            INT NOT NULL,
  team            TEXT,
  opponent        TEXT,
  pass_attempts   INT,
  pass_yards      INT,
  pass_tds        INT,
  rush_attempts   INT,
  rush_yards      INT,
  rush_tds        INT,
  targets         INT,
  receptions      INT,
  rec_yards       INT,
  rec_tds         INT,
  offensive_snaps INT,
  fantasy_points  NUMERIC(8, 2),
  stats_json      JSONB NOT NULL DEFAULT '{}',
  source          data_source NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, season, week, source)
);

CREATE INDEX IF NOT EXISTS idx_weekly_stats_player ON weekly_stats (player_id, season);
CREATE INDEX IF NOT EXISTS idx_weekly_stats_season_week ON weekly_stats (season, week);

-- NFL combine measurements (nflverse) — sharpens build-based comparables.
CREATE TABLE IF NOT EXISTS combine_metrics (
  player_id       UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  combine_year    INT,
  forty           NUMERIC(4, 2),
  bench           INT,
  vertical        NUMERIC(4, 1),
  broad_jump      INT,
  cone            NUMERIC(4, 2),
  shuttle         NUMERIC(4, 2),
  source          TEXT NOT NULL DEFAULT 'nflverse',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backtest: projections replayed as-of a past season vs what actually happened.
CREATE TABLE IF NOT EXISTS backtest_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version    TEXT NOT NULL,
  as_of_season     INT NOT NULL,   -- built using only data up to this season
  horizon_year     INT NOT NULL,
  player_id        UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position         TEXT NOT NULL,
  age              NUMERIC(4, 1),
  projected_points NUMERIC(8, 2) NOT NULL,
  low              NUMERIC(8, 2),
  high             NUMERIC(8, 2),
  actual_points    NUMERIC(8, 2),  -- NULL = no season played (injury/retired)
  error            NUMERIC(8, 2),  -- projected - actual
  in_range         BOOLEAN,        -- actual within [low, high]
  n_analogs        INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_version, as_of_season, horizon_year, player_id)
);

CREATE INDEX IF NOT EXISTS idx_backtest_results_model
  ON backtest_results (model_version, as_of_season, horizon_year);

-- Aggregated evaluation metrics per model / backtest run / scope.
CREATE TABLE IF NOT EXISTS model_metrics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version    TEXT NOT NULL,
  as_of_season     INT NOT NULL,
  horizon_year     INT NOT NULL,
  scope            TEXT NOT NULL,  -- 'ALL' or a position
  n                INT NOT NULL,
  mae              NUMERIC(8, 2),
  median_abs_error NUMERIC(8, 2),
  rmse             NUMERIC(8, 2),
  spearman         NUMERIC(6, 4),  -- projected vs actual rank correlation
  coverage         NUMERIC(5, 4),  -- share of actuals inside [low, high]
  attrition        NUMERIC(5, 4),  -- share of subjects with no season at horizon
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_version, as_of_season, horizon_year, scope)
);

-- Market value snapshots (FantasyCalc, etc.) — our own copy of crowd/market
-- values so the app has a fallback when the API is down and so we accumulate
-- history for trend analysis and ML features.
CREATE TABLE IF NOT EXISTS market_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL DEFAULT 'fantasycalc',
  external_id     TEXT NOT NULL,     -- id in the source system
  player_id       UUID REFERENCES players(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  position        TEXT NOT NULL,     -- QB/RB/WR/TE/PICK
  team            TEXT,
  age             NUMERIC(4, 1),
  sleeper_id      TEXT,
  settings_key    TEXT NOT NULL,     -- e.g. "1qb-12t-1ppr-0tep"
  value           INT NOT NULL,
  overall_rank    INT,
  position_rank   INT,
  trend_30day     INT,
  tier            INT,
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, settings_key, external_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_market_values_board
  ON market_values (source, settings_key, snapshot_date, value DESC);
CREATE INDEX IF NOT EXISTS idx_market_values_player
  ON market_values (player_id) WHERE player_id IS NOT NULL;

ALTER TABLE market_values ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY market_values_read ON market_values
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE weekly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE combine_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_metrics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY weekly_stats_read ON weekly_stats
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY combine_metrics_read ON combine_metrics
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY backtest_results_read ON backtest_results
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY model_metrics_read ON model_metrics
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ingestion audit log
CREATE TABLE IF NOT EXISTS ingest_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline        TEXT NOT NULL,
  status          TEXT NOT NULL,
  rows_affected   INT NOT NULL DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ
);

-- Our model vs the market (latest snapshot). rank_edge > 0 means our model
-- likes the player more than the market does (potential buy target).
CREATE OR REPLACE VIEW market_divergence AS
WITH latest AS (
  SELECT mv.*
  FROM market_values mv
  WHERE mv.snapshot_date = (SELECT max(snapshot_date) FROM market_values)
    AND mv.position <> 'PICK'
    AND mv.player_id IS NOT NULL
)
SELECT
  dv.settings_key,
  p.id AS player_id,
  p.name,
  p.position,
  p.team,
  dv.overall_rank AS model_rank,
  m.overall_rank AS market_rank,
  m.overall_rank - dv.overall_rank AS rank_edge,
  dv.value AS model_value,
  m.value AS market_value,
  m.trend_30day AS market_trend_30day,
  m.snapshot_date
FROM dynasty_values dv
JOIN players p ON p.id = dv.player_id
JOIN latest m
  ON m.player_id = dv.player_id
 AND m.settings_key = dv.settings_key
WHERE dv.model_version = 'baseline_v1';

-- Helper view: join snapshots with player metadata for curve queries
CREATE OR REPLACE VIEW career_curves AS
SELECT
  p.id AS player_id,
  p.name,
  p.position,
  p.level AS current_level,
  cs.season,
  cs.age,
  cs.season_index,
  cs.fantasy_points,
  cs.volume_index,
  cs.efficiency_index,
  cs.feature_vector
FROM career_snapshots cs
JOIN players p ON p.id = cs.player_id;
