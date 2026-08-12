"""
Ingest NFL seasonal stats from Sleeper.

Sleeper exposes per-player regular-season totals (including pts_half_ppr and all
volume stats) at /stats/nfl/regular/{season}, keyed by Sleeper player id. We join
those to the players already ingested by sleeper_players.py. This avoids the
heavy/fragile nfl_data_py + numpy<2 dependency and keeps everything on one API.
"""

from __future__ import annotations

import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import NFL_SEASONS, SLEEPER_API_URL
from db import get_conn, log_ingest, upsert_season_stats_many
from ingest.sleeper_players import fantasy_points_half_ppr

PIPELINE = "nfl_seasons"
OFFENSE = {"QB", "RB", "WR", "TE"}


def fetch_season_stats(season: int) -> dict:
    res = requests.get(f"{SLEEPER_API_URL}/stats/nfl/regular/{season}", timeout=120)
    res.raise_for_status()
    return res.json() or {}


def _age(birth_date, season: int) -> float | None:
    if not birth_date:
        return None
    try:
        return round(season - int(str(birth_date)[:4]), 1)
    except (ValueError, TypeError):
        return None


def _safe_int(value) -> int | None:
    if value is None:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def run() -> int:
    print(f"Ingesting NFL seasons {NFL_SEASONS} from Sleeper...")
    count = 0

    with get_conn() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, sleeper_id, position, birth_date
                    FROM players
                    WHERE sleeper_id IS NOT NULL AND level = 'nfl'
                    """
                )
                players = {r["sleeper_id"]: r for r in cur.fetchall()}

            if not players:
                msg = "No NFL players found - run sleeper_players ingest first."
                print(msg)
                log_ingest(conn, PIPELINE, "success", 0)
                return 0

            for season in NFL_SEASONS:
                print(f"  Season {season}...")
                stats = fetch_season_stats(season)
                rows = []
                for sleeper_id, line in stats.items():
                    if not isinstance(line, dict):
                        continue
                    player = players.get(sleeper_id)
                    if player is None or (player["position"] or "").upper() not in OFFENSE:
                        continue

                    fp = line.get("pts_half_ppr")
                    if fp is None:
                        fp = fantasy_points_half_ppr(
                            {
                                "pass_yards": line.get("pass_yd"),
                                "pass_tds": line.get("pass_td"),
                                "pass_int": line.get("pass_int"),
                                "rush_yards": line.get("rush_yd"),
                                "rush_tds": line.get("rush_td"),
                                "receptions": line.get("rec"),
                                "rec_yards": line.get("rec_yd"),
                                "rec_tds": line.get("rec_td"),
                            }
                        )

                    rows.append(
                        dict(
                            player_id=player["id"],
                            season=season,
                            level="nfl",
                            source="sleeper",
                            games=_safe_int(line.get("gp")),
                            age=_age(player["birth_date"], season),
                            fantasy_points=float(fp) if fp is not None else None,
                            pass_attempts=_safe_int(line.get("pass_att")),
                            pass_yards=_safe_int(line.get("pass_yd")),
                            pass_tds=_safe_int(line.get("pass_td")),
                            rush_attempts=_safe_int(line.get("rush_att")),
                            rush_yards=_safe_int(line.get("rush_yd")),
                            rush_tds=_safe_int(line.get("rush_td")),
                            targets=_safe_int(line.get("rec_tgt")),
                            receptions=_safe_int(line.get("rec")),
                            rec_yards=_safe_int(line.get("rec_yd")),
                            rec_tds=_safe_int(line.get("rec_td")),
                            stats=line,
                        )
                    )
                count += upsert_season_stats_many(conn, rows)

            log_ingest(conn, PIPELINE, "success", count)
            print(f"Upserted {count} NFL season stat rows.")
            return count
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", count, str(exc))
            raise


if __name__ == "__main__":
    run()
