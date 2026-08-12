"""
Leak-free backtest of the analog projection model.

For each "as of" season S we replay the model exactly as it would have run at
the time: subjects are players whose latest line is season S, the analog pool
only contains stat lines from seasons <= S, and analog growth is only measured
on futures known by S. We then compare each projection against what the player
actually did 1-3 seasons later (age-indexed, seasons > S).

Writes:
  backtest_results   one row per (as_of, horizon, player): projected vs actual
  model_metrics      aggregates per (as_of, horizon, position + ALL):
                     MAE, median abs error, RMSE, Spearman rank correlation,
                     coverage of the low-high band, attrition rate

Run: python data/models/backtest.py   (or npm run data:backtest)
"""

from __future__ import annotations

import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_conn, log_ingest
from models.analog_projection import (
    MODEL_VERSION,
    _load_players,
    _position_scalers,
    build_pool,
    find_candidates,
    project_horizons,
)

PIPELINE = "backtest"

# Latest season with complete data (actuals can't come from beyond this).
LAST_COMPLETE_SEASON = 2025
AS_OF_SEASONS = list(range(2015, 2025))  # 2015..2024


def _ranks(values: list[float]) -> list[float]:
    """Average ranks (ties share the mean rank)."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def spearman(a: list[float], b: list[float]) -> float | None:
    if len(a) < 3:
        return None
    ra, rb = _ranks(a), _ranks(b)
    ma, mb = statistics.fmean(ra), statistics.fmean(rb)
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    da = sum((x - ma) ** 2 for x in ra) ** 0.5
    db = sum((y - mb) ** 2 for y in rb) ** 0.5
    if da == 0 or db == 0:
        return None
    return num / (da * db)


def _metrics(rows: list[dict]) -> dict | None:
    """Aggregate metrics over backtest rows (one scope)."""
    scored = [r for r in rows if r["actual"] is not None]
    if not rows:
        return None
    out = {
        "n": len(scored),
        "attrition": round(1 - len(scored) / len(rows), 4),
        "mae": None,
        "median_abs_error": None,
        "rmse": None,
        "spearman": None,
        "coverage": None,
    }
    if scored:
        errors = [r["projected"] - r["actual"] for r in scored]
        abs_errors = [abs(e) for e in errors]
        out["mae"] = round(statistics.fmean(abs_errors), 2)
        out["median_abs_error"] = round(statistics.median(abs_errors), 2)
        out["rmse"] = round((statistics.fmean([e**2 for e in errors])) ** 0.5, 2)
        sp = spearman(
            [r["projected"] for r in scored], [r["actual"] for r in scored]
        )
        out["spearman"] = round(sp, 4) if sp is not None else None
        out["coverage"] = round(
            sum(1 for r in scored if r["in_range"]) / len(scored), 4
        )
    return out


def run() -> int:
    print(f"Backtesting {MODEL_VERSION} over as-of seasons {AS_OF_SEASONS}...")
    with get_conn() as conn:
        try:
            players = _load_players(conn)
            scalers = _position_scalers(players)

            result_params = []
            metric_params = []
            all_rows: list[dict] = []

            for as_of in AS_OF_SEASONS:
                pool = build_pool(players, scalers, max_season=as_of)

                # Subjects exactly as production would have seen them at as_of.
                subjects = []
                for rec in players.values():
                    known = {
                        a: l for a, l in rec["by_age"].items() if l["season"] <= as_of
                    }
                    if not known:
                        continue
                    age0 = max(known)
                    base = known[age0]
                    if base["season"] == as_of and base["fantasy_points"] > 0:
                        subjects.append((rec, age0, base))

                rows_this_season: list[dict] = []
                for rec, age0, base in subjects:
                    nearest = find_candidates(rec, age0, base, pool, scalers)
                    if not nearest:
                        continue
                    horizons = project_horizons(base, nearest, max_season=as_of)

                    for h, res in horizons.items():
                        if as_of + h > LAST_COMPLETE_SEASON:
                            continue
                        actual_line = rec["by_age"].get(age0 + h)
                        actual = (
                            actual_line["fantasy_points"]
                            if actual_line is not None
                            and actual_line["season"] > as_of
                            else None
                        )
                        row = {
                            "as_of": as_of,
                            "horizon": h,
                            "player_id": rec["player_id"],
                            "position": rec["position"],
                            "age": float(age0),
                            "projected": res["points"],
                            "low": res["low"],
                            "high": res["high"],
                            "actual": actual,
                            "in_range": (
                                res["low"] <= actual <= res["high"]
                                if actual is not None
                                else None
                            ),
                            "n_analogs": res["n"],
                        }
                        rows_this_season.append(row)
                        result_params.append(
                            (
                                MODEL_VERSION,
                                as_of,
                                h,
                                row["player_id"],
                                row["position"],
                                row["age"],
                                round(row["projected"], 2),
                                round(row["low"], 2),
                                round(row["high"], 2),
                                round(actual, 2) if actual is not None else None,
                                round(row["projected"] - actual, 2)
                                if actual is not None
                                else None,
                                row["in_range"],
                                row["n_analogs"],
                            )
                        )

                all_rows.extend(rows_this_season)

                # Aggregates for this as_of season.
                for h in sorted({r["horizon"] for r in rows_this_season}):
                    h_rows = [r for r in rows_this_season if r["horizon"] == h]
                    scopes = {"ALL": h_rows}
                    for pos in sorted({r["position"] for r in h_rows}):
                        scopes[pos] = [r for r in h_rows if r["position"] == pos]
                    for scope, rows in scopes.items():
                        m = _metrics(rows)
                        if m is None or m["n"] < 5:
                            continue
                        metric_params.append(
                            (
                                MODEL_VERSION,
                                as_of,
                                h,
                                scope,
                                m["n"],
                                m["mae"],
                                m["median_abs_error"],
                                m["rmse"],
                                m["spearman"],
                                m["coverage"],
                                m["attrition"],
                            )
                        )
                print(f"  as-of {as_of}: {len(rows_this_season)} projections scored")

            # Persist (full rebuild of this model's backtest).
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM backtest_results WHERE model_version = %s",
                    (MODEL_VERSION,),
                )
                cur.execute(
                    "DELETE FROM model_metrics WHERE model_version = %s",
                    (MODEL_VERSION,),
                )
                cur.executemany(
                    """
                    INSERT INTO backtest_results (
                      model_version, as_of_season, horizon_year, player_id,
                      position, age, projected_points, low, high,
                      actual_points, error, in_range, n_analogs
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    result_params,
                )
                cur.executemany(
                    """
                    INSERT INTO model_metrics (
                      model_version, as_of_season, horizon_year, scope,
                      n, mae, median_abs_error, rmse, spearman, coverage, attrition
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    metric_params,
                )

            # Console summary across all as_of seasons, by horizon.
            print("\n=== Global summary (all as-of seasons pooled) ===")
            for h in sorted({r["horizon"] for r in all_rows}):
                m = _metrics([r for r in all_rows if r["horizon"] == h])
                if m:
                    print(
                        f"  +{h} yr: n={m['n']}  MAE={m['mae']}  "
                        f"medAE={m['median_abs_error']}  spearman={m['spearman']}  "
                        f"coverage={m['coverage']}  attrition={m['attrition']}"
                    )

            log_ingest(conn, PIPELINE, "success", len(result_params))
            print(
                f"\nSaved {len(result_params)} backtest rows and "
                f"{len(metric_params)} metric aggregates."
            )
            return len(result_params)
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", 0, str(exc))
            raise


if __name__ == "__main__":
    run()
