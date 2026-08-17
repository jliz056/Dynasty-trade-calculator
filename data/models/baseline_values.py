"""
Phase 2 - baseline dynasty values (no ML yet).

Pipeline:
  1. Pull each NFL player's most recent season (points, receptions, age).
  2. Project the next N seasons using positional age curves.
  3. Dynasty value = discounted sum of projected points.
  4. Apply league-settings multipliers (Superflex, TE premium, PPR).
  5. Rank, scale to a 0..10000 board, and write `dynasty_values`
     (+ per-season rows in `projections`).

This validates the DB end-to-end and gives the app real numbers to show
before the ML models land. `model_version = 'baseline_v1'`.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_conn, log_ingest
from models.age_curves import age_multiplier, projection_ratio
from models.build_match import remaining_career_mult, usage_value_mult
from models.settings import (
    DEFAULT_SETTINGS,
    LeagueSettings,
    apply_vorp,
    position_settings_multiplier,
    ppr_points_delta,
)
from models.usage import load_weekly_features

PIPELINE = "baseline_values"
MODEL_VERSION = "baseline_v2"
ANALOG_MODEL = "analog_v2"
PROJECTION_YEARS = 3
DISCOUNT = 0.82  # future seasons worth less in dynasty
SCALE_TOP = 10000  # top asset ~ 10000, FantasyCalc-like scale


def _latest_seasons(conn) -> list[dict]:
    """Most recent NFL season per player, with age and receptions.

    Only players still in the league belong on a dynasty board: they must be
    flagged active by Sleeper and have played within the last two seasons.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT ON (ss.player_id)
              ss.player_id,
              p.name,
              p.position,
              ss.season,
              ss.fantasy_points,
              ss.receptions,
              COALESCE(cs.age, ss.age) AS age
            FROM season_stats ss
            JOIN players p ON p.id = ss.player_id
            LEFT JOIN career_snapshots cs
              ON cs.player_id = ss.player_id AND cs.season = ss.season
            WHERE ss.level = 'nfl'
              AND p.active IS TRUE
              AND p.team IS NOT NULL
              AND COALESCE(ss.games, 0) > 0
              AND COALESCE(ss.fantasy_points, 0) > 0
              AND ss.season >= (
                SELECT max(season) - 1 FROM season_stats WHERE level = 'nfl'
              )
            ORDER BY ss.player_id, ss.season DESC
            """
        )
        return cur.fetchall()


def _load_analog_horizons(conn) -> dict[str, dict[int, float]]:
    """player_id -> {horizon: projected_points} from analog_v1 (next 1-3 seasons)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT player_id, horizon_year, projected_points
            FROM projections
            WHERE model_version = %s AND horizon_year BETWEEN 1 AND %s
            """,
            (ANALOG_MODEL, PROJECTION_YEARS),
        )
        out: dict[str, dict[int, float]] = {}
        for r in cur.fetchall():
            out.setdefault(r["player_id"], {})[int(r["horizon_year"])] = float(
                r["projected_points"] or 0
            )
        return out


def _project_player(
    row: dict,
    settings: LeagueSettings,
    analog: dict[int, float] | None = None,
) -> tuple[float, list[dict]]:
    """Return (dynasty_value_raw, per-season projection rows).

    Prefer analog_v1 horizons (what similar players actually did next) so a
    38-year-old QB who just scored 350 is not valued as if he'll repeat it.
    Fall back to the positional age curve starting *next* season (k=1..N),
    never counting last year as a free extra dynasty season.
    """
    pos = (row["position"] or "").upper()
    age = float(row["age"]) if row.get("age") is not None else 25.0
    base_points = float(row.get("fantasy_points") or 0.0)
    receptions = float(row.get("receptions") or 0.0)
    base_points += ppr_points_delta(receptions, settings)
    pos_mult = position_settings_multiplier(pos, settings)

    raw_value = 0.0
    projections: list[dict] = []
    for k in range(1, PROJECTION_YEARS + 1):
        if analog and k in analog:
            projected = analog[k] * pos_mult
            source = ANALOG_MODEL
        else:
            projected = base_points * projection_ratio(pos, age, k) * pos_mult
            source = "age_curve"
        raw_value += projected * (DISCOUNT ** (k - 1))
        projections.append(
            {
                "horizon_year": k,
                "projected_points": round(projected, 2),
                "age": round(age + k, 1),
                "age_multiplier": round(age_multiplier(pos, age + k), 4),
                "source": source,
            }
        )
    return raw_value, projections


def _write_values(conn, settings: LeagueSettings, scored: list[dict]) -> None:
    scored.sort(key=lambda r: r["raw_value"], reverse=True)
    top = scored[0]["raw_value"] if scored and scored[0]["raw_value"] > 0 else 1.0

    position_counts: dict[str, int] = {}
    params = []
    for overall_rank, row in enumerate(scored, start=1):
        pos = (row["position"] or "").upper()
        position_counts[pos] = position_counts.get(pos, 0) + 1
        value = int(round(SCALE_TOP * row["raw_value"] / top))
        params.append(
            (
                row["player_id"],
                settings.key,
                value,
                overall_rank,
                position_counts[pos],
                PROJECTION_YEARS,
                MODEL_VERSION,
                _json(
                    {
                        "raw_value": round(row["raw_value"], 2),
                        "replacement": row.get("replacement"),
                        "fp_cv": row.get("fp_cv"),
                        "late_trend": row.get("late_trend"),
                    }
                ),
            )
        )

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO dynasty_values (
              player_id, settings_key, value, overall_rank, position_rank,
              projection_years, model_version, metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (player_id, settings_key, model_version)
            DO UPDATE SET
              value = EXCLUDED.value,
              overall_rank = EXCLUDED.overall_rank,
              position_rank = EXCLUDED.position_rank,
              projection_years = EXCLUDED.projection_years,
              metadata = EXCLUDED.metadata,
              computed_at = now()
            """,
            params,
        )


def _write_projections(conn, scored: list[dict]) -> None:
    """Projections are settings-independent; write once from the default set."""
    params = []
    for row in scored:
        for proj in row["projections"]:
            params.append(
                (
                    row["player_id"],
                    proj["horizon_year"],
                    proj["projected_points"],
                    MODEL_VERSION,
                    _json(
                        {
                          "age": proj["age"],
                          "age_multiplier": proj["age_multiplier"],
                          "source": proj.get("source"),
                        }
                    ),
                )
            )

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO projections (
              player_id, horizon_year, projected_points, model_version, metadata
            )
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (player_id, horizon_year, model_version)
            DO UPDATE SET
              projected_points = EXCLUDED.projected_points,
              metadata = EXCLUDED.metadata,
              created_at = now()
            """,
            params,
        )


def _json(obj) -> object:
    import psycopg

    return psycopg.types.json.Json(obj)


def run() -> int:
    count = 0
    with get_conn() as conn:
        try:
            seasons = _latest_seasons(conn)
            if not seasons:
                print("No NFL season stats found - run ingestion first.")
                log_ingest(conn, PIPELINE, "success", 0)
                return 0

            analog_by_player = _load_analog_horizons(conn)
            usage = load_weekly_features(conn)
            analog_used = sum(1 for r in seasons if r["player_id"] in analog_by_player)
            print(
                f"  Ranking {len(seasons)} active players "
                f"({analog_used} with analog projections)."
            )

            # Full rebuild: drop stale rows so players who left the pool
            # (retired, inactive) disappear from the board.
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM dynasty_values WHERE model_version = %s",
                    (MODEL_VERSION,),
                )
                cur.execute(
                    "DELETE FROM projections WHERE model_version = %s",
                    (MODEL_VERSION,),
                )

            # Default-settings pass also produces the shared projections.
            wrote_projections = False
            for settings in DEFAULT_SETTINGS:
                scored = []
                for row in seasons:
                    raw_value, projections = _project_player(
                        row, settings, analog_by_player.get(row["player_id"])
                    )
                    feat = usage.get((row["player_id"], int(row["season"]))) or {}
                    raw_value *= remaining_career_mult(
                        row["position"], float(row["age"] or 25)
                    )
                    raw_value *= usage_value_mult(
                        feat.get("fp_cv"), feat.get("late_trend")
                    )
                    scored.append(
                        {
                            "player_id": row["player_id"],
                            "position": row["position"],
                            "raw_value": raw_value,
                            "projections": projections,
                            "fp_cv": feat.get("fp_cv"),
                            "late_trend": feat.get("late_trend"),
                        }
                    )
                scored = apply_vorp(scored, settings)
                _write_values(conn, settings, scored)
                if not wrote_projections:
                    _write_projections(conn, scored)
                    wrote_projections = True
                count += len(scored)
                print(f"  {settings.key}: valued {len(scored)} players")

            log_ingest(conn, PIPELINE, "success", count)
            print(f"Wrote {count} dynasty value rows across {len(DEFAULT_SETTINGS)} settings.")
            return count
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", count, str(exc))
            raise


if __name__ == "__main__":
    run()
