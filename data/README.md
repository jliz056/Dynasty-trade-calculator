# Data pipeline — Phase 1

Own database + career curve foundation for dynasty player projections.

**Goals (now → later):**
- Store NFL + college season stats in PostgreSQL
- Build age-season **career snapshots** for evolution charts
- Match young players to **historical comparables** (similar early curves)
- Later: ML projections → custom dynasty values served to the app

## Setup

### 1. PostgreSQL (Supabase recommended, free tier)

1. Create a project at [supabase.com](https://supabase.com)
2. Copy the **Connection string** (URI) from Project Settings → Database
3. Create `data/.env` from the example:

```bash
cp data/.env.example data/.env
```

4. Set `DATABASE_URL` and `CFB_API_KEY` (same key as the main app)

### 2. Python environment

```bash
cd data
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### 3. Initialize schema

From the repo root:

```bash
python data/scripts/init_db.py
```

### 4. Run ingestion + features

```bash
python data/scripts/run_pipeline.py
```

Or step by step:

```bash
python data/ingest/run_all.py          # Sleeper + NFL + college
python data/features/career_curves.py  # age-season snapshots
python data/features/comparables.py    # historical curve matches
python data/models/baseline_values.py  # Phase 2 formula dynasty values
python data/models/devy_model.py all    # Phase 3 train + project devy
```

## Valuation engine

### Phase 2 - baseline formula (`models/baseline_values.py`)

No ML. Projects each NFL player's next 3 seasons from their latest production
using positional **age curves** (`models/age_curves.py`), discounts future
seasons, applies league-settings multipliers (Superflex, TE premium, PPR), and
writes a 0..10000 board to `dynasty_values` (`model_version = 'baseline_v1'`).
This validates the DB and gives the app real numbers before ML lands.

### Phase 3 - devy model (`models/devy_model.py`)

**Model: XGBoost regressor** (gradient-boosted trees) - the right tool for
tabular sports data with limited samples, and interpretable via feature
importances. scikit-learn provides cross-validation; deep learning is deferred
until the labeled dataset is large enough.

- **Input:** best college season per prospect - volume, efficiency, age,
  one-hot position (`models/features.py`, `FEATURE_NAMES` is the model contract)
- **Label:** the player's first 3 NFL seasons of fantasy points (matched
  college -> NFL by normalized name + position)
- **Output:** projected NFL output -> `projections` + a `devy` board in
  `dynasty_values` (`model_version = 'devy_xgb_v1'`)

```bash
python data/models/devy_model.py train     # fit + cross-validate + save artifact
python data/models/devy_model.py predict    # project current prospects
```

Models are saved to `data/models/artifacts/` (gitignored). Training needs
`MIN_TRAINING_ROWS` labeled examples; it skips gracefully below that.

## Data model

| Table | Purpose |
|-------|---------|
| `players` | Registry (NFL + college), Sleeper/CFBD/GSIS IDs |
| `season_stats` | Raw seasonal stats by level |
| `career_snapshots` | Age-season metrics for curve analysis |
| `player_comparables` | "Player X at 23 ≈ Player Y at 23" |
| `projections` | Per-season projected points (baseline + ML) |
| `dynasty_values` | Settings-aware value boards (baseline + devy) |
| `ingest_runs` | Pipeline audit log |

View `career_curves` joins snapshots with player metadata for queries.

## Example queries

**Career evolution (NFL):**
```sql
SELECT name, season, age, fantasy_points, volume_index
FROM career_curves
WHERE name ILIKE '%Jefferson%'
ORDER BY season;
```

**Comparables for a young WR:**
```sql
SELECT
  sub.name AS subject,
  comp.name AS comparable,
  pc.subject_age,
  pc.similarity
FROM player_comparables pc
JOIN players sub ON sub.id = pc.subject_id
JOIN players comp ON comp.id = pc.comparable_id
WHERE sub.name ILIKE '%Nabers%'
ORDER BY pc.similarity DESC
LIMIT 10;
```

**Compare two players' curves by age:**
```sql
SELECT name, age, fantasy_points
FROM career_curves
WHERE name ILIKE ANY(ARRAY['%Nabers%', '%Jefferson%'])
  AND current_level = 'nfl'
ORDER BY name, age;
```

## Sources

| Pipeline | Source | Data |
|----------|--------|------|
| `sleeper_players` | Sleeper API | Player metadata, birth dates |
| `nfl_seasons` | nflverse (`nfl_data_py`) | NFL seasonal stats 2021+ |
| `cfbd_college` | CollegeFootballData | College seasonal stats |

## Roadmap

- **Phase 2 (done):** baseline formula dynasty values
- **Phase 3 (done):** XGBoost devy model (college → NFL projection)
- **Phase 4:** LightGBM multi-season NFL projection + learned age curves + k-NN comparables
- **Phase 5:** `/api/values` endpoint + UI (career chart + comparables panel)
- **Phase 6:** calibrate to the market with real trades (Sleeper + saved trades)

### Future feature sources

`feature_vector` / `metadata` are JSONB, so these can be added without schema
changes (mostly relevant once we model weekly/matchup-level output):

- **Weather** (game-time conditions, dome vs. outdoor)
- **Stadium** (surface, altitude, home/away splits)
- **Opponent** (defense vs. position, strength of schedule)
- **Team context** (offensive coordinator, pace, target/carry share)
