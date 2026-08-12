"""
Analog-based season projection (data-driven, no hand-tuned age curve).

For every current NFL player we find historical "analogs": players who, at the
same position and a similar age, posted a similar offensive profile. We then look
at what those analogs did 1-3 seasons later (indexed by age, so injury gaps don't
break the chain) and apply the *median* year-over-year change to the subject's
most recent stat line. Quartiles give a low/high range.

Writes:
  projections          model_version='analog_v1', horizon_year = 1..3
                       (projected_points + low/high; metadata = projected stat line)
  player_comparables   method='analog_v1' so the UI can list the analogs used
                       and pull their real career arcs.

The model is intentionally simple and transparent: every projection is just
"here are N similar players and here's what they did next."
"""

from __future__ import annotations

import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_conn, log_ingest
from models.build_match import build_compatible
from models.features import to_vector  # noqa: F401  (kept for contract parity)

PIPELINE = "analog_projection"
MODEL_VERSION = "analog_v1"
SKILL = {"QB", "RB", "WR", "TE"}

# Seasons that count a player as "current" (worth projecting forward).
CURRENT_SEASONS = {2024, 2025}
HORIZONS = [1, 2, 3]
AGE_WINDOW = 1            # analogs within +/- this many years of the subject age
TOP_K = 40               # nearest analogs considered for the median
MIN_ANALOGS = 6          # need at least this many to trust a horizon
COMPS_STORED = 12        # analogs surfaced to the UI

# Offensive-profile features used for similarity (z-scored within position).
PROFILE_KEYS = [
    "fp_per_game",
    "pass_yards",
    "rush_yards",
    "rec_yards",
    "receptions",
    "rush_attempts",
]

# Counting stats we project a full line for (besides fantasy points).
STAT_KEYS = [
    "games",
    "pass_yards",
    "pass_tds",
    "rush_yards",
    "rush_tds",
    "receptions",
    "rec_yards",
    "rec_tds",
]


def _f(value) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _statline(row: dict) -> dict:
    games = _f(row.get("games"))
    fp = _f(row.get("fantasy_points"))
    line = {
        "season": int(row["season"]),
        "fantasy_points": fp,
        "games": games,
        "fp_per_game": fp / games if games > 0 else 0.0,
        "pass_yards": _f(row.get("pass_yards")),
        "pass_tds": _f(row.get("pass_tds")),
        "rush_attempts": _f(row.get("rush_attempts")),
        "rush_yards": _f(row.get("rush_yards")),
        "rush_tds": _f(row.get("rush_tds")),
        "targets": _f(row.get("targets")),
        "receptions": _f(row.get("receptions")),
        "rec_yards": _f(row.get("rec_yards")),
        "rec_tds": _f(row.get("rec_tds")),
    }
    return line


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    k = (len(s) - 1) * pct
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def _load_players(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              ss.player_id, p.name, p.position, p.sleeper_id,
              p.height_inches, p.weight_lbs,
              ss.season, ss.age, ss.games, ss.fantasy_points,
              ss.pass_yards, ss.pass_tds,
              ss.rush_attempts, ss.rush_yards, ss.rush_tds,
              ss.targets, ss.receptions, ss.rec_yards, ss.rec_tds
            FROM season_stats ss
            JOIN players p ON p.id = ss.player_id
            WHERE ss.level = 'nfl' AND ss.age IS NOT NULL
            ORDER BY ss.player_id, ss.season
            """
        )
        rows = cur.fetchall()

    players: dict = {}
    for row in rows:
        pos = (row["position"] or "").upper()
        if pos not in SKILL:
            continue
        age = int(round(_f(row["age"])))
        if age < 20 or age > 40:
            continue
        pid = row["player_id"]
        rec = players.setdefault(
            pid,
            {
                "player_id": pid,
                "name": row["name"],
                "position": pos,
                "sleeper_id": row["sleeper_id"],
                "height_inches": row.get("height_inches"),
                "weight_lbs": row.get("weight_lbs"),
                "by_age": {},
            },
        )
        # Keep the higher-volume line if two seasons map to the same age.
        line = _statline(row)
        existing = rec["by_age"].get(age)
        if existing is None or line["fantasy_points"] >= existing["fantasy_points"]:
            rec["by_age"][age] = line
    return players


def _position_scalers(players: dict) -> dict:
    """Mean/std per position for each profile feature (for z-scoring)."""
    buckets: dict[str, dict[str, list[float]]] = {}
    for rec in players.values():
        pos = rec["position"]
        b = buckets.setdefault(pos, {k: [] for k in PROFILE_KEYS})
        for line in rec["by_age"].values():
            for k in PROFILE_KEYS:
                b[k].append(line.get(k, 0.0))
    scalers: dict = {}
    for pos, feats in buckets.items():
        scalers[pos] = {}
        for k, vals in feats.items():
            mean = statistics.fmean(vals) if vals else 0.0
            std = statistics.pstdev(vals) if len(vals) > 1 else 0.0
            scalers[pos][k] = (mean, std or 1.0)
    return scalers


def _vector(line: dict, pos: str, scalers: dict) -> list[float]:
    sc = scalers.get(pos, {})
    out = []
    for k in PROFILE_KEYS:
        mean, std = sc.get(k, (0.0, 1.0))
        out.append((line.get(k, 0.0) - mean) / std)
    return out


def _dist(a: list[float], b: list[float]) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def run() -> int:
    print("Building analog projections...")
    with get_conn() as conn:
        try:
            players = _load_players(conn)
            scalers = _position_scalers(players)

            # Analog pool bucketed by (position, age) for fast lookup.
            pool: dict[tuple[str, int], list[dict]] = {}
            for rec in players.values():
                pos = rec["position"]
                for age, line in rec["by_age"].items():
                    pool.setdefault((pos, age), []).append(
                        {
                            "rec": rec,
                            "age": age,
                            "vec": _vector(line, pos, scalers),
                            "line": line,
                        }
                    )

            # Subjects: players with a recent season; project from their latest.
            subjects = []
            for rec in players.values():
                ages = rec["by_age"]
                latest_age = max(ages)
                latest = ages[latest_age]
                if latest["season"] in CURRENT_SEASONS and latest["fantasy_points"] > 0:
                    subjects.append((rec, latest_age, latest))

            proj_params = []
            comp_params = []
            projected = 0

            # Full rebuild — drop stale rows so removed comps (e.g. after a
            # build filter change) don't linger in the UI.
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM projections WHERE model_version = %s",
                    (MODEL_VERSION,),
                )
                cur.execute(
                    "DELETE FROM player_comparables WHERE method = %s",
                    (MODEL_VERSION,),
                )

            for rec, age0, base in subjects:
                pos = rec["position"]
                base_vec = _vector(base, pos, scalers)

                # Gather candidate analogs within the age window and similar build.
                candidates = []
                for da in range(-AGE_WINDOW, AGE_WINDOW + 1):
                    for cand in pool.get((pos, age0 + da), []):
                        if cand["rec"]["player_id"] == rec["player_id"]:
                            continue
                        if not build_compatible(
                            pos,
                            rec.get("height_inches"),
                            rec.get("weight_lbs"),
                            cand["rec"].get("height_inches"),
                            cand["rec"].get("weight_lbs"),
                        ):
                            continue
                        candidates.append(cand)
                if len(candidates) < MIN_ANALOGS:
                    continue

                for cand in candidates:
                    cand["_d"] = _dist(base_vec, cand["vec"])
                candidates.sort(key=lambda c: c["_d"])
                nearest = candidates[:TOP_K]

                wrote_any = False
                for h in HORIZONS:
                    fp_growth = []
                    stat_growth: dict[str, list[float]] = {k: [] for k in STAT_KEYS}
                    stat_abs: dict[str, list[float]] = {k: [] for k in STAT_KEYS}
                    for cand in nearest:
                        future = cand["rec"]["by_age"].get(cand["age"] + h)
                        if future is None:
                            continue
                        cur_fp = cand["line"]["fantasy_points"]
                        if cur_fp > 0:
                            fp_growth.append(future["fantasy_points"] / cur_fp)
                        for k in STAT_KEYS:
                            stat_abs[k].append(future.get(k, 0.0))
                            cur_v = cand["line"].get(k, 0.0)
                            if cur_v > 0:
                                stat_growth[k].append(future.get(k, 0.0) / cur_v)

                    if len(fp_growth) < MIN_ANALOGS:
                        continue

                    base_fp = base["fantasy_points"]
                    proj_fp = base_fp * statistics.median(fp_growth)
                    low_fp = base_fp * _percentile(fp_growth, 0.25)
                    high_fp = base_fp * _percentile(fp_growth, 0.75)

                    line = {}
                    for k in STAT_KEYS:
                        base_v = base.get(k, 0.0)
                        if base_v > 0 and len(stat_growth[k]) >= MIN_ANALOGS:
                            line[k] = round(base_v * statistics.median(stat_growth[k]), 1)
                        elif stat_abs[k]:
                            line[k] = round(statistics.median(stat_abs[k]), 1)
                        else:
                            line[k] = 0.0

                    proj_params.append(
                        (
                            rec["player_id"],
                            h,
                            round(max(0.0, proj_fp), 2),
                            round(max(0.0, low_fp), 2),
                            round(max(0.0, high_fp), 2),
                            MODEL_VERSION,
                            _json(
                                {
                                    "projected_age": age0 + h,
                                    "base_season": base["season"],
                                    "base_points": round(base_fp, 1),
                                    "n_analogs": len(fp_growth),
                                    "stat_line": line,
                                }
                            ),
                        )
                    )
                    wrote_any = True

                if not wrote_any:
                    continue
                projected += 1

                # Surface the closest analogs to the UI.
                dmax = nearest[-1]["_d"] or 1.0
                for cand in nearest[:COMPS_STORED]:
                    sim = max(0.0, min(1.0, 1.0 - cand["_d"] / (dmax + 1e-9)))
                    comp_params.append(
                        (
                            rec["player_id"],
                            cand["rec"]["player_id"],
                            float(age0),
                            round(sim, 4),
                        )
                    )

            # Persist (batched).
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO projections (
                      player_id, horizon_year, projected_points, low, high,
                      model_version, metadata
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (player_id, horizon_year, model_version)
                    DO UPDATE SET
                      projected_points = EXCLUDED.projected_points,
                      low = EXCLUDED.low,
                      high = EXCLUDED.high,
                      metadata = EXCLUDED.metadata,
                      created_at = now()
                    """,
                    proj_params,
                )
                cur.executemany(
                    """
                    INSERT INTO player_comparables (
                      subject_id, comparable_id, subject_age, similarity, method
                    )
                    VALUES (%s, %s, %s, %s, 'analog_v1')
                    ON CONFLICT (subject_id, comparable_id, subject_age, method)
                    DO UPDATE SET similarity = EXCLUDED.similarity
                    """,
                    comp_params,
                )

            log_ingest(conn, PIPELINE, "success", projected)
            print(
                f"Projected {projected} players "
                f"({len(proj_params)} horizon rows, {len(comp_params)} comparables)."
            )
            return projected
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", 0, str(exc))
            raise


def _json(obj) -> object:
    import psycopg

    return psycopg.types.json.Json(obj)


if __name__ == "__main__":
    run()
