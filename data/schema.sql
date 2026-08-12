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
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
