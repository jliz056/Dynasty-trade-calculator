"""
Build age-season career snapshots from season_stats.

These snapshots power:
- NFL career evolution charts
- Comparisons between young players and historical curves
- Future ML feature vectors
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_conn, log_ingest

PIPELINE = "career_snapshots"


def volume_score(row: dict) -> float:
    pos = (row.get("position") or "").upper()
    if pos == "QB":
        return float(row.get("pass_attempts") or 0) + float(row.get("rush_attempts") or 0) * 0.5
    if pos == "RB":
        return float(row.get("rush_attempts") or 0) + float(row.get("targets") or 0) * 0.7
    return float(row.get("targets") or 0) + float(row.get("receptions") or 0) * 0.3


def efficiency_score(row: dict) -> float:
    fp = float(row.get("fantasy_points") or 0)
    games = float(row.get("games") or 0)
    if games <= 0:
        return 0.0
    return fp / games


def estimate_age(row: dict, season: int) -> float | None:
    if row.get("age") is not None:
        return float(row["age"])
    birth = row.get("birth_date")
    if birth:
        try:
            return round(season - int(str(birth)[:4]), 1)
        except ValueError:
            pass
    draft_year = row.get("draft_year")
    if draft_year:
        # Rough NFL rookie age baseline
        return round(season - int(draft_year) + 22, 1)
    return None


def build_feature_vector(row: dict) -> dict:
    return {
        "fantasy_points": float(row.get("fantasy_points") or 0),
        "volume": volume_score(row),
        "efficiency": efficiency_score(row),
        "games": float(row.get("games") or 0),
        "pass_yards": float(row.get("pass_yards") or 0),
        "rush_yards": float(row.get("rush_yards") or 0),
        "rec_yards": float(row.get("rec_yards") or 0),
    }


def normalize_peer_group(rows: list[dict]) -> None:
    """Set volume_index / efficiency_index vs same position+season peers."""
    if not rows:
        return
    volumes = [volume_score(r) for r in rows]
    effs = [efficiency_score(r) for r in rows]
    max_vol = max(volumes) or 1.0
    max_eff = max(effs) or 1.0
    for r, vol, eff in zip(rows, volumes, effs):
        r["volume_index"] = round(vol / max_vol, 4)
        r["efficiency_index"] = round(eff / max_eff, 4)


def run() -> int:
    count = 0
    with get_conn() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      ss.player_id,
                      ss.season,
                      ss.level,
                      ss.games,
                      ss.age,
                      ss.fantasy_points,
                      ss.pass_attempts,
                      ss.pass_yards,
                      ss.rush_attempts,
                      ss.rush_yards,
                      ss.targets,
                      ss.receptions,
                      ss.rec_yards,
                      p.position,
                      p.birth_date,
                      p.draft_year
                    FROM season_stats ss
                    JOIN players p ON p.id = ss.player_id
                    ORDER BY ss.level, ss.season, p.position
                    """
                )
                all_rows = cur.fetchall()

            # Group for peer normalization: level + season + position
            groups: dict[tuple, list] = {}
            for row in all_rows:
                key = (row["level"], row["season"], row["position"])
                groups.setdefault(key, []).append(row)

            for group_rows in groups.values():
                normalize_peer_group(group_rows)

            # Season index within level (1 = first recorded season), computed in
            # Python to avoid a per-row round trip to the database.
            seasons_seen: dict[tuple, list[int]] = {}
            for row in all_rows:
                key = (row["player_id"], row["level"])
                seasons_seen.setdefault(key, []).append(int(row["season"]))
            for seasons in seasons_seen.values():
                seasons.sort()
            index_lookup: dict[tuple, int] = {}
            for key, seasons in seasons_seen.items():
                for i, season in enumerate(seasons, start=1):
                    index_lookup[(key[0], key[1], season)] = i

            params = []
            for row in all_rows:
                age = estimate_age(row, row["season"])
                if age is None:
                    continue
                season_index = index_lookup[(row["player_id"], row["level"], int(row["season"]))]
                features = build_feature_vector(row)
                params.append(
                    (
                        row["player_id"],
                        row["season"],
                        row["level"],
                        age,
                        season_index,
                        row.get("fantasy_points"),
                        row.get("volume_index"),
                        row.get("efficiency_index"),
                        json.dumps(features),
                    )
                )

            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO career_snapshots (
                      player_id, season, level, age, season_index,
                      fantasy_points, volume_index, efficiency_index, feature_vector
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (player_id, season, level)
                    DO UPDATE SET
                      age = EXCLUDED.age,
                      season_index = EXCLUDED.season_index,
                      fantasy_points = EXCLUDED.fantasy_points,
                      volume_index = EXCLUDED.volume_index,
                      efficiency_index = EXCLUDED.efficiency_index,
                      feature_vector = EXCLUDED.feature_vector
                    """,
                    params,
                )
            count = len(params)

            log_ingest(conn, PIPELINE, "success", count)
            print(f"Built {count} career snapshots.")
            return count
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", count, str(exc))
            raise


if __name__ == "__main__":
    run()
