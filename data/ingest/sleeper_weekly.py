"""
Per-game (weekly) NFL stats from Sleeper.

Season totals hide a lot: a 900-yard WR who scored 55 half-PPR points in his
last 6 games is not the same asset as one who faded down the stretch. Weekly
lines unlock consistency metrics, partial-injury seasons, late-season trends,
and per-game snap counts (off_snp) — and they are the prerequisite for
weather/stadium features later.

Endpoint: /stats/nfl/regular/{season}/{week} -> {sleeper_id: {stat: value}}
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import SLEEPER_API_URL
from db import get_conn, log_ingest
from ingest.sleeper_players import fantasy_points_half_ppr

PIPELINE = "sleeper_weekly"

WEEKLY_SEASONS = [
    int(s.strip())
    for s in os.environ.get(
        "WEEKLY_SEASONS", "2020,2021,2022,2023,2024,2025"
    ).split(",")
    if s.strip()
]
MAX_WEEK = 18


def _i(value) -> int | None:
    if value is None:
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def _relevant(stats: dict) -> bool:
    """Keep rows where the player actually took part in the offense."""
    return any(
        float(stats.get(k) or 0) > 0
        for k in ("pass_att", "rush_att", "rec_tgt", "off_snp")
    )


def run() -> int:
    with get_conn() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, sleeper_id FROM players "
                    "WHERE sleeper_id IS NOT NULL AND level = 'nfl'"
                )
                id_by_sleeper = {r["sleeper_id"]: r["id"] for r in cur.fetchall()}

            print(f"Ingesting weekly stats for seasons {WEEKLY_SEASONS}...")
            params = []
            for season in WEEKLY_SEASONS:
                season_rows = 0
                for week in range(1, MAX_WEEK + 1):
                    res = requests.get(
                        f"{SLEEPER_API_URL}/stats/nfl/regular/{season}/{week}",
                        timeout=60,
                    )
                    res.raise_for_status()
                    data = res.json() or {}
                    for sleeper_id, stats in data.items():
                        if not isinstance(stats, dict):
                            continue
                        player_id = id_by_sleeper.get(str(sleeper_id))
                        if player_id is None or not _relevant(stats):
                            continue
                        params.append(
                            (
                                player_id,
                                season,
                                week,
                                _i(stats.get("pass_att")),
                                _i(stats.get("pass_yd")),
                                _i(stats.get("pass_td")),
                                _i(stats.get("rush_att")),
                                _i(stats.get("rush_yd")),
                                _i(stats.get("rush_td")),
                                _i(stats.get("rec_tgt")),
                                _i(stats.get("rec")),
                                _i(stats.get("rec_yd")),
                                _i(stats.get("rec_td")),
                                _i(stats.get("off_snp")),
                                round(fantasy_points_half_ppr(stats), 2),
                                _json(
                                    {
                                        "tm_off_snp": _i(stats.get("tm_off_snp")),
                                        "pass_int": _i(stats.get("pass_int")),
                                        "fum_lost": _i(stats.get("fum_lost")),
                                    }
                                ),
                            )
                        )
                        season_rows += 1
                print(f"  Season {season}: {season_rows} player-weeks")

            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO weekly_stats (
                      player_id, season, week,
                      pass_attempts, pass_yards, pass_tds,
                      rush_attempts, rush_yards, rush_tds,
                      targets, receptions, rec_yards, rec_tds,
                      offensive_snaps, fantasy_points, stats_json, source
                    )
                    VALUES (
                      %s, %s, %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s, %s, 'sleeper'
                    )
                    ON CONFLICT (player_id, season, week, source)
                    DO UPDATE SET
                      pass_attempts = EXCLUDED.pass_attempts,
                      pass_yards = EXCLUDED.pass_yards,
                      pass_tds = EXCLUDED.pass_tds,
                      rush_attempts = EXCLUDED.rush_attempts,
                      rush_yards = EXCLUDED.rush_yards,
                      rush_tds = EXCLUDED.rush_tds,
                      targets = EXCLUDED.targets,
                      receptions = EXCLUDED.receptions,
                      rec_yards = EXCLUDED.rec_yards,
                      rec_tds = EXCLUDED.rec_tds,
                      offensive_snaps = EXCLUDED.offensive_snaps,
                      fantasy_points = EXCLUDED.fantasy_points,
                      stats_json = EXCLUDED.stats_json
                    """,
                    params,
                )

            log_ingest(conn, PIPELINE, "success", len(params))
            print(f"Upserted {len(params)} weekly stat rows.")
            return len(params)
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", 0, str(exc))
            raise


def _json(obj) -> object:
    import psycopg

    return psycopg.types.json.Json({k: v for k, v in obj.items() if v is not None})


if __name__ == "__main__":
    run()
