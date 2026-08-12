"""
Ingest college seasonal stats from CollegeFootballData.

The /stats/player/season endpoint returns long-format rows (one stat per row:
season, playerId, player, position, team, category, statType, stat). We pivot
them per (playerId, season), keep meaningful offensive producers, and store one
season_stats row per college player-season. Player upserts and stat inserts are
batched for speed.
"""

from __future__ import annotations

import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import CFB_API_KEY, CFB_API_URL, CFB_SEASONS
from db import get_conn, log_ingest, upsert_season_stats_many
from ingest.sleeper_players import fantasy_points_half_ppr

PIPELINE = "cfbd_college"
CATEGORIES = ["passing", "rushing", "receiving"]
OFFENSE = {"QB", "RB", "WR", "TE"}
MIN_FANTASY_POINTS = 40.0  # focus on draftable producers, skip deep bench


def cfbd_get(path: str, params: dict) -> list:
    if not CFB_API_KEY:
        raise RuntimeError("CFB_API_KEY is not set.")
    res = requests.get(
        f"{CFB_API_URL}{path}",
        params=params,
        headers={"Authorization": f"Bearer {CFB_API_KEY}"},
        timeout=90,
    )
    res.raise_for_status()
    try:
        data = res.json()
    except ValueError as exc:
        raise RuntimeError(f"CFBD returned non-JSON for {path}: {res.text[:120]}") from exc
    return data if isinstance(data, list) else []


def _num(value) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _int(value) -> int | None:
    if value is None:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def run() -> int:
    print(f"Ingesting college seasons {CFB_SEASONS} from CFBD...")

    # (playerId, season) -> aggregated record
    accum: dict[tuple, dict] = {}
    for season in CFB_SEASONS:
        for category in CATEGORIES:
            print(f"  CFBD {season} / {category}...")
            rows = cfbd_get("/stats/player/season", {"year": season, "category": category})
            for r in rows:
                pid = r.get("playerId")
                if not pid:
                    continue
                yr = _int(r.get("season")) or season
                key = (str(pid), yr)
                rec = accum.setdefault(
                    key,
                    {
                        "cfbd_id": str(pid),
                        "season": yr,
                        "name": r.get("player"),
                        "team": r.get("team"),
                        "position": (r.get("position") or "").upper(),
                        "stats": {},
                    },
                )
                if not rec["position"] and r.get("position"):
                    rec["position"] = r["position"].upper()
                rec["stats"][f"{category}_{r.get('statType')}"] = r.get("stat")

    # Build fantasy points + filter to meaningful offensive seasons.
    records = []
    for rec in accum.values():
        if rec["position"] not in OFFENSE or not rec["name"]:
            continue
        s = rec["stats"]
        fp = fantasy_points_half_ppr(
            {
                "pass_yards": s.get("passing_YDS"),
                "pass_tds": s.get("passing_TD"),
                "pass_int": s.get("passing_INT"),
                "rush_yards": s.get("rushing_YDS"),
                "rush_tds": s.get("rushing_TD"),
                "receptions": s.get("receiving_REC"),
                "rec_yards": s.get("receiving_YDS"),
                "rec_tds": s.get("receiving_TD"),
            }
        )
        if fp < MIN_FANTASY_POINTS:
            continue
        rec["fantasy_points"] = fp
        records.append(rec)

    if not records:
        print("No qualifying college records.")
        with get_conn() as conn:
            log_ingest(conn, PIPELINE, "success", 0)
        return 0

    with get_conn() as conn:
        count = 0
        try:
            # Batch upsert college players (deduped by cfbd_id).
            player_params = [
                (rec["name"], rec["position"], rec["cfbd_id"], rec["team"])
                for rec in records
            ]
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO players (name, position, level, cfbd_id, team, updated_at)
                    VALUES (%s, %s, 'college', %s, %s, now())
                    ON CONFLICT (cfbd_id) WHERE cfbd_id IS NOT NULL
                    DO UPDATE SET
                      name = EXCLUDED.name,
                      position = EXCLUDED.position,
                      team = EXCLUDED.team,
                      updated_at = now()
                    """,
                    player_params,
                )

            # Map cfbd_id -> player UUID.
            cfbd_ids = list({rec["cfbd_id"] for rec in records})
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, cfbd_id FROM players WHERE cfbd_id = ANY(%s)",
                    (cfbd_ids,),
                )
                id_by_cfbd = {row["cfbd_id"]: row["id"] for row in cur.fetchall()}

            # Batch season_stats inserts.
            stat_rows = []
            for rec in records:
                player_id = id_by_cfbd.get(rec["cfbd_id"])
                if player_id is None:
                    continue
                s = rec["stats"]
                stat_rows.append(
                    dict(
                        player_id=player_id,
                        season=rec["season"],
                        level="college",
                        source="cfbd",
                        team=rec["team"],
                        fantasy_points=rec["fantasy_points"],
                        pass_attempts=_int(s.get("passing_ATT")),
                        pass_yards=_int(s.get("passing_YDS")),
                        pass_tds=_int(s.get("passing_TD")),
                        rush_attempts=_int(s.get("rushing_CAR")),
                        rush_yards=_int(s.get("rushing_YDS")),
                        rush_tds=_int(s.get("rushing_TD")),
                        targets=None,
                        receptions=_int(s.get("receiving_REC")),
                        rec_yards=_int(s.get("receiving_YDS")),
                        rec_tds=_int(s.get("receiving_TD")),
                        stats=s,
                    )
                )
            count = upsert_season_stats_many(conn, stat_rows)

            log_ingest(conn, PIPELINE, "success", count)
            print(f"Upserted {count} college season stat rows.")
            return count
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", count, str(exc))
            raise


if __name__ == "__main__":
    run()
