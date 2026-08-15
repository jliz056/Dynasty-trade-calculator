"""
Snapshot KeepTradeCut dynasty values into market_values.

KTC has no official API; like our /api/devy proxy, we parse the playersArray
JSON embedded in their rankings page (one request per run, cached daily by the
snapshot). Values are crowd-sourced 0-9999, with 1QB and Superflex variants.

Players are matched to our registry by normalized name + position; rookie
draft picks (position 'RDP') are stored as PICK rows without a player link.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_conn, log_ingest, upsert_market_values
from ingest.nflverse_draft import norm_name

PIPELINE = "ktc_values"
SOURCE = "ktc"
URL = "https://keeptradecut.com/dynasty-rankings"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

VARIANTS = [
    ("oneQBValues", "1qb-12t-1ppr-0tep"),
    ("superflexValues", "sf-12t-1ppr-0tep"),
]


def fetch_players() -> list[dict]:
    res = requests.get(URL, headers=UA, timeout=60)
    res.raise_for_status()
    m = re.search(r"var playersArray = (\[[\s\S]*?\]);", res.text)
    if not m:
        raise RuntimeError("Could not find playersArray in KTC page.")
    return json.loads(m.group(1))


def _load_player_ids(conn) -> dict[tuple[str, str], str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, position FROM players "
            "WHERE level = 'nfl' AND position IN ('QB','RB','WR','TE')"
        )
        rows = cur.fetchall()
    out: dict[tuple[str, str], list] = {}
    for r in rows:
        out.setdefault((norm_name(r["name"]), r["position"]), []).append(r["id"])
    # Ambiguous names can't be matched safely.
    return {k: v[0] for k, v in out.items() if len(v) == 1}


def run() -> int:
    print("Fetching KeepTradeCut dynasty rankings...")
    entries = fetch_players()

    with get_conn() as conn:
        try:
            id_by_name = _load_player_ids(conn)

            params = []
            for e in entries:
                raw_pos = (e.get("position") or "").upper()
                is_pick = raw_pos == "RDP"
                pos = "PICK" if is_pick else raw_pos
                if not is_pick and pos not in {"QB", "RB", "WR", "TE"}:
                    continue
                name = e.get("playerName")
                external_id = e.get("playerID")
                if not name or external_id is None:
                    continue
                player_id = (
                    None if is_pick else id_by_name.get((norm_name(name), pos))
                )
                for key, settings_key in VARIANTS:
                    v = e.get(key) or {}
                    value = v.get("value")
                    if value is None:
                        continue
                    params.append(
                        (
                            SOURCE,
                            str(external_id),
                            player_id,
                            name,
                            pos,
                            e.get("team") or None,
                            e.get("age"),
                            None,
                            settings_key,
                            int(value),
                            v.get("rank"),
                            v.get("positionalRank"),
                            None,
                            v.get("overallTier"),
                        )
                    )

            count = upsert_market_values(conn, params)
            log_ingest(conn, PIPELINE, "success", count)
            print(f"Stored {count} KTC market value rows (today's snapshot).")
            return count
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", 0, str(exc))
            raise


if __name__ == "__main__":
    run()
