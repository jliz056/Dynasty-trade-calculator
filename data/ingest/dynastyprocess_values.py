"""
Snapshot DynastyProcess player values into market_values.

DynastyProcess publishes openly licensed dynasty values as a daily-updated CSV
on GitHub (derived from FantasyPros expert consensus ranks). This gives us a
third market source next to FantasyCalc (real trades) and KTC (crowd votes).
"""

from __future__ import annotations

import csv
import io
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_conn, log_ingest, upsert_market_values
from ingest.nflverse_draft import norm_name

PIPELINE = "dynastyprocess_values"
SOURCE = "dynastyprocess"
URL = (
    "https://raw.githubusercontent.com/dynastyprocess/data/"
    "master/files/values-players.csv"
)

VARIANTS = [
    ("value_1qb", "1qb-12t-1ppr-0tep"),
    ("value_2qb", "sf-12t-1ppr-0tep"),
]
SKILL = {"QB", "RB", "WR", "TE"}


def _num(value) -> float | None:
    try:
        return float(value) if value not in (None, "", "NA") else None
    except (TypeError, ValueError):
        return None


def run() -> int:
    print("Fetching DynastyProcess values...")
    res = requests.get(URL, timeout=60)
    res.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(res.text)))

    with get_conn() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, name, position FROM players "
                    "WHERE level = 'nfl' AND position IN ('QB','RB','WR','TE')"
                )
                db_rows = cur.fetchall()
            by_name: dict[tuple[str, str], list] = {}
            for r in db_rows:
                by_name.setdefault(
                    (norm_name(r["name"]), r["position"]), []
                ).append(r["id"])
            id_by_name = {k: v[0] for k, v in by_name.items() if len(v) == 1}

            params = []
            for value_col, settings_key in VARIANTS:
                # Ranks are recomputed from the values so all sources rank the
                # same way (value desc).
                ranked = sorted(
                    (r for r in rows if _num(r.get(value_col))),
                    key=lambda r: -_num(r[value_col]),
                )
                pos_counter: dict[str, int] = {}
                for i, r in enumerate(ranked):
                    pos = (r.get("pos") or "").upper()
                    if pos not in SKILL:
                        continue
                    name = r.get("player")
                    if not name:
                        continue
                    pos_counter[pos] = pos_counter.get(pos, 0) + 1
                    external_id = r.get("fp_id") or norm_name(name)
                    params.append(
                        (
                            SOURCE,
                            str(external_id),
                            id_by_name.get((norm_name(name), pos)),
                            name,
                            pos,
                            r.get("team") or None,
                            _num(r.get("age")),
                            None,
                            settings_key,
                            int(_num(r[value_col])),
                            i + 1,
                            pos_counter[pos],
                            None,
                            None,
                        )
                    )

            count = upsert_market_values(conn, params)
            log_ingest(conn, PIPELINE, "success", count)
            print(f"Stored {count} DynastyProcess market value rows.")
            return count
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", 0, str(exc))
            raise


if __name__ == "__main__":
    run()
