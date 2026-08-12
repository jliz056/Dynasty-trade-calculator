"""
Snapshot FantasyCalc market values into our own database.

FantasyCalc exposes a free public API (no key). We store one snapshot per day
per settings variant so that:
  - the app can fall back to our copy when the live API is unavailable,
  - we build market-value history (trends, ML features/labels),
  - our own model can be benchmarked against the market.

Be a good citizen: one request per settings variant per run (2 requests total),
and snapshots are idempotent per day (re-running the same day just updates).
"""

from __future__ import annotations

import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_conn, log_ingest

PIPELINE = "fantasycalc_values"
SOURCE = "fantasycalc"
API_URL = "https://api.fantasycalc.com/values/current"

# Matches the app defaults and our baseline settings keys (FantasyCalc has no
# TE-premium parameter, so we only snapshot the 0tep variants).
VARIANTS = [
    {"num_qbs": 1, "key": "1qb-12t-1ppr-0tep"},
    {"num_qbs": 2, "key": "sf-12t-1ppr-0tep"},
]


def fetch_values(num_qbs: int) -> list[dict]:
    res = requests.get(
        API_URL,
        params={
            "isDynasty": "true",
            "numQbs": str(num_qbs),
            "numTeams": "12",
            "ppr": "1",
        },
        timeout=60,
    )
    res.raise_for_status()
    data = res.json()
    return data if isinstance(data, list) else []


def _int(value) -> int | None:
    if value is None:
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def run() -> int:
    count = 0
    with get_conn() as conn:
        try:
            # sleeper_id -> our player UUID, to link market rows to our players.
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, sleeper_id FROM players WHERE sleeper_id IS NOT NULL"
                )
                id_by_sleeper = {r["sleeper_id"]: r["id"] for r in cur.fetchall()}

            params = []
            for variant in VARIANTS:
                print(f"Fetching FantasyCalc values ({variant['key']})...")
                entries = fetch_values(variant["num_qbs"])
                for e in entries:
                    p = e.get("player") or {}
                    external_id = p.get("id")
                    name = p.get("name")
                    if external_id is None or not name:
                        continue
                    sleeper_id = p.get("sleeperId")
                    params.append(
                        (
                            SOURCE,
                            str(external_id),
                            id_by_sleeper.get(str(sleeper_id)) if sleeper_id else None,
                            name,
                            (p.get("position") or "PICK").upper(),
                            p.get("maybeTeam"),
                            p.get("maybeAge"),
                            str(sleeper_id) if sleeper_id else None,
                            variant["key"],
                            _int(e.get("value")) or 0,
                            _int(e.get("overallRank")),
                            _int(e.get("positionRank")),
                            _int(e.get("trend30Day")),
                            _int(e.get("maybeTier")),
                        )
                    )

            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO market_values (
                      source, external_id, player_id, name, position, team, age,
                      sleeper_id, settings_key, value, overall_rank, position_rank,
                      trend_30day, tier
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (source, settings_key, external_id, snapshot_date)
                    DO UPDATE SET
                      player_id = EXCLUDED.player_id,
                      name = EXCLUDED.name,
                      position = EXCLUDED.position,
                      team = EXCLUDED.team,
                      age = EXCLUDED.age,
                      sleeper_id = EXCLUDED.sleeper_id,
                      value = EXCLUDED.value,
                      overall_rank = EXCLUDED.overall_rank,
                      position_rank = EXCLUDED.position_rank,
                      trend_30day = EXCLUDED.trend_30day,
                      tier = EXCLUDED.tier,
                      created_at = now()
                    """,
                    params,
                )
            count = len(params)

            log_ingest(conn, PIPELINE, "success", count)
            print(f"Stored {count} market value rows (today's snapshot).")
            return count
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", count, str(exc))
            raise


if __name__ == "__main__":
    run()
