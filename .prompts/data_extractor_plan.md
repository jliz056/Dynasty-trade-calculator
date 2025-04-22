# Data Extraction Module ‑ Iteration 1
*For Jay’s Dynasty Trade Calculator*

**Version:** 0.1   **Date:** 2025‑04‑20   **Author:** ChatGPT (draft for Eric)

---
## 1  Purpose
Provide a detailed, implementation‑ready specification for the first iteration of a **data extraction layer** that pulls NFL player and game data from free/public sources, normalises it, and stores it for use by the existing trade‑calculator backend.

The spec is designed for hand‑off to an AI coding agent (or dev) who will implement the module in the existing TypeScript/Node code‑base.

---
## 2  Scope
### In‑Scope
* **Data Sources (free):**
  * **Sleeper API** – roster, dynasty ADP, basic player metadata.
  * **nflfastR CSV dumps** – historical per‑play and season aggregate stats.
* **Core Functions:**
  * Download/fetch data (with paging + rate‑limit compliance).
  * Transform to unified schema.
  * Upsert into Mongo DB (same instance used by backend models) *or* Supabase Postgres (config option).
  * Provide a programmatic interface (`StatsProvider`) for the backend to query.
  * Schedule nightly refresh via GitHub Actions workflow.

### Out of Scope (Iteration 1)
* Paid APIs (e.g., SportsDataIO) – stub hooks only.
* Real‑time in‑game updates (<5 min latency).
* Advanced projections/ML.

---
## 3  Glossary
| Term | Meaning |
|------|---------|
| **Adapter** | Implementation of `IStatsProvider` for a specific data source. |
| **ETL** | Extract, Transform, Load. |
| **nflfastR** | Open‑source R project publishing CSV play‑by‑play datasets. |
| **Sleeper** | Fantasy‑football platform providing a free, undocumented JSON API. |

---
## 4  High‑Level Architecture
```
┌──────────────┐      ┌────────────┐      ┌────────────┐
│ Sleeper API  │───► │SleeperAdapter│
└──────────────┘      └────────────┘
                             │                 ┌────────────┐
┌──────────────┐      ┌────────────┐      │DataNormalizer│
│ nflfastR CSV │───► │FastRAdapter │───► └────────────┘──┐
└──────────────┘      └────────────┘                      │
                                                         ▼
                                                 ┌────────────┐
                                                 │ DataStore  │
                                                 │ (Mongo/PG) │
                                                 └────────────┘
```
* **Scheduler** (GitHub Action or CRON) triggers each adapter nightly.
* Backend services read via the common `StatsProvider` interface.

---
## 5  Technical Stack & Conventions
* **Language:** TypeScript 5.x, Node 20 (per `.nvmrc`).
* **Package manager:** pnpm or npm (stick to repo default).
* **Lint/Format:** ESLint + Prettier (existing config).
* **Testing:** Vitest + ts‑jest.
* **DB:** choose at runtime via `ENV`: `MONGO_URI` or `SUPABASE_URL/SERVICE_KEY`.

---
## 6  Module API (Public Surface)
```ts
// src/services/stats/IStatsProvider.ts
export interface IStatsProvider {
  /** Pulls fresh data and writes/updates DB. */
  sync(opts?: { season?: number; week?: number }): Promise<void>;

  /** Direct lookup helper used by backend routes (optional shortcut). */
  getPlayer(id: string): Promise<PlayerDoc | null>;
}
```
Each adapter **implements** `IStatsProvider` and is registered in `src/services/stats/index.ts`.

---
## 7  Data Sources & Endpoints
### 7.1  Sleeper API
| Purpose | Endpoint | Notes |
|---------|----------|-------|
| All players meta | `https://api.sleeper.app/v1/players/nfl` | ~3 MB JSON |
| Dynasty ADP | `https://api.sleeper.app/v1/adp/nfl/dynasty` | Query param `?season=YYYY` |
| Injuries (beta) | `https://api.sleeper.app/v1/players/injuries` | May 404 in off‑season |

**Rate‑limits:** ± 90 req/min (empirical). Add 500 ms delay between calls.

### 7.2  nflfastR
* **Download URL pattern:** `https://github.com/nflverse/nflfastR-data/releases/download/v{season}/play_by_play_{season}.parquet` – but we’ll use the companion **CSV aggregates**: `https://raw.githubusercontent.com/nflverse/nflfastR-data/master/data/stats/basic/{season}_basic.csv`.
* Hosted on GitHub – no auth, but compress with `axios({ responseType:'stream' })` + `zlib`.

---
## 8  Data Model (DB)
### 8.1  `Player` (extends existing Mongoose schema)
| Field | Type | Source |
|-------|------|--------|
| `playerId` | string (Sleeper ID) | Sleeper |
| `firstName`/`lastName` | string | Sleeper |
| `position` | enum("QB","RB","WR","TE",...) | Sleeper |
| `team` | string | Sleeper |
| `college` | string | Sleeper |
| `draftYear` / `draftPick` | number | Sleeper |
| `dynastyADP` | number | Sleeper |
| `injuryStatus` | string | Sleeper |
| `seasonStats` | [SeasonStat] ref | fastR |

### 8.2  `SeasonStat`
| Field | Type | Example |
|-------|------|---------|
| `playerId` | string | FK to Player |
| `season` | number | 2024 |
| `games` | number | 17 |
| `pprPoints` | number | 312.4 |
| `targets` / `receptions` | number | etc. |

*(Weekly granularity optional; we aggregate for iteration 1.)*

---
## 9  Component Specs
### 9.1  Scheduler (`scripts/cronSync.ts`)
* Reads `.env` vars `SYNC_SOURCES` (csv list) + `CRON_SCHEDULE`.
* Invokes `import("../src/services/stats").syncAll()`.
* To be wired into GitHub Actions:
```yaml
name: Nightly Data Sync
on:
  schedule:
    - cron: "0 5 * * *"  # 05:00 UTC daily
jobs:
  run-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm i --frozen-lockfile
      - run: pnpm ts-node scripts/cronSync.ts
      - run: pnpm test --filter stats
```

### 9.2  Adapters
* `SleeperAdapter` – fetch JSON → map to `Player`, write/update `dynastyADP`, `injuryStatus`.
* `FastRAdapter` – stream CSV → aggregate per player/season (use `csv-parser`) → write `SeasonStat` docs.
* Provide **delta‑update** logic (upsert by `playerId + season`).

### 9.3  DataNormalizer
* Resolves ID crosswalk: Sleeper `player_id` ⇄ fastR `gsis_id` .
* Use mapping file `mappings/playerIdMap.json` (seeded manually for iteration 1; automate later).

### 9.4  DataStore
* Wrapper around Mongoose models **or** Supabase client. Provide `insertManyOrUpdate()` util.

---
## 10  Error Handling & Resilience
* **Retry policy:** 3 tries with back‑off (1 s → 3 s → 7 s).
* **Partial failure:** Log and continue; failed player rows collected in `sync_report.json` (S3 or local `/tmp`).
* **Logging:** Use `pino` logger; level configurable via `LOG_LEVEL`.

---
## 11  Security & Secrets
* No hard‑coded keys. Env vars defined in `.env.example`.
* GitHub Actions secrets: `MONGO_URI_PROD`, `SUPABASE_SERVICE_KEY`.

---
## 12  Testing Strategy
| Layer | Tool | Coverage |
|-------|------|----------|
| Unit | Vitest | Parsing helpers, mapping functions |
| Integration | Vitest + `nock` | External HTTP mocked |
| E2E smoke | GitHub Actions | Run full sync against dev DB weekly |

Target **80 %** line coverage for adapters.

---
## 13  Deliverables
1. Source code under `src/services/stats/*` + `scripts/`.
2. Updated `package.json` scripts:
   * `sync:all`, `sync:sleeper`, `sync:fastr`.
3. GitHub Actions workflow file.
4. `.env.example` with all vars.
5. README section "Data Sync" with setup & troubleshooting.
6. Unit & integration tests, `pnpm test --filter stats` passes.

---
## 14  Timeline (suggested)
| Week | Milestone |
|------|-----------|
| 1 | SleeperAdapter functional + DB write |
| 2 | FastRAdapter + Normaliser |
| 3 | Cron/scheduler + README + tests |
| 4 | Buffer week for bug‑bash & code review |

---
## 15  Future Enhancements (Iteration 2+)
* Plug‑in **SportsDataIOAdapter** controlled by feature flag.
* Real‑time websocket stream for injuries/in‑game events.
* Redis layer for faster player‑lookup caching.
* GraphQL API overlay.

---
**End of Spec – v0.1**

