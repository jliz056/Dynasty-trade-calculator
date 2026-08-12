"""
Draft capital + combine measurements from nflverse (public CSV releases).

Fills players.draft_year / draft_round / draft_pick and the combine_metrics
table. Draft capital is a strong prior for young players: a 1st-round WR and
an undrafted WR with identical rookie production do not have the same future.

Matching strategy: gsis_id first (Sleeper provides it for most NFL players),
then normalized name + position. Players with a gsis_id, NFL production, and
no draft row are marked draft_round = 0 (genuinely undrafted).
"""

from __future__ import annotations

import csv
import io
import re
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_conn, log_ingest

PIPELINE = "nflverse_draft"
DRAFT_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/"
    "draft_picks/draft_picks.csv"
)
COMBINE_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/"
    "combine/combine.csv"
)
SKILL = {"QB", "RB", "WR", "TE"}

_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}


def norm_name(name: str | None) -> str:
    if not name:
        return ""
    s = re.sub(r"[^a-z ]", "", name.lower().replace(".", " ").replace("'", ""))
    parts = [p for p in s.split() if p and p not in _SUFFIXES]
    return " ".join(parts)


def _download_csv(url: str) -> list[dict]:
    res = requests.get(url, timeout=120)
    res.raise_for_status()
    return list(csv.DictReader(io.StringIO(res.text)))


def _int(value) -> int | None:
    try:
        return int(float(value)) if value not in (None, "", "NA") else None
    except (TypeError, ValueError):
        return None


def _num(value) -> float | None:
    try:
        return float(value) if value not in (None, "", "NA") else None
    except (TypeError, ValueError):
        return None


def _load_db_players(conn) -> tuple[dict, dict]:
    """Index our NFL players by gsis_id and by (normalized name, position)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.id, p.name, p.position, p.gsis_id, p.draft_pick,
                   EXISTS (
                     SELECT 1 FROM season_stats ss
                     WHERE ss.player_id = p.id AND ss.level = 'nfl'
                   ) AS has_nfl_stats
            FROM players p
            WHERE p.level = 'nfl' AND p.position = ANY(%s)
            """,
            (list(SKILL),),
        )
        rows = cur.fetchall()

    by_gsis: dict[str, dict] = {}
    by_name: dict[tuple[str, str], list[dict]] = {}
    for r in rows:
        if r["gsis_id"]:
            by_gsis[r["gsis_id"].strip()] = r
        by_name.setdefault((norm_name(r["name"]), r["position"]), []).append(r)
    return by_gsis, by_name


def _match(row_gsis: str | None, name: str, pos: str, by_gsis: dict, by_name: dict):
    if row_gsis:
        rec = by_gsis.get(row_gsis.strip())
        if rec:
            return rec
    cands = by_name.get((norm_name(name), pos), [])
    return cands[0] if len(cands) == 1 else None  # skip ambiguous names


def run() -> int:
    print("Downloading nflverse draft picks + combine data...")
    draft_rows = _download_csv(DRAFT_URL)
    combine_rows = _download_csv(COMBINE_URL)
    print(f"  {len(draft_rows)} draft picks, {len(combine_rows)} combine rows.")

    with get_conn() as conn:
        try:
            by_gsis, by_name = _load_db_players(conn)

            # --- Draft capital ---
            draft_params = []
            matched_ids = set()
            for row in draft_rows:
                pos = (row.get("position") or "").upper()
                if pos not in SKILL:
                    continue
                rec = _match(
                    row.get("gsis_id"), row.get("pfr_player_name") or "",
                    pos, by_gsis, by_name,
                )
                if rec is None:
                    continue
                matched_ids.add(rec["id"])
                draft_params.append(
                    (
                        _int(row.get("season")),
                        _int(row.get("round")),
                        _int(row.get("pick")),
                        rec["id"],
                    )
                )

            # Players who played in the NFL, have a gsis_id (so a draft match
            # would have worked), and no draft row -> genuinely undrafted.
            undrafted_ids = [
                r["id"]
                for r in by_gsis.values()
                if r["has_nfl_stats"] and r["id"] not in matched_ids
            ]

            with conn.cursor() as cur:
                cur.executemany(
                    """
                    UPDATE players
                    SET draft_year = COALESCE(%s, draft_year),
                        draft_round = %s,
                        draft_pick = %s,
                        updated_at = now()
                    WHERE id = %s
                    """,
                    draft_params,
                )
                cur.execute(
                    """
                    UPDATE players
                    SET draft_round = 0, draft_pick = NULL, updated_at = now()
                    WHERE id = ANY(%s) AND draft_round IS NULL
                    """,
                    (undrafted_ids,),
                )

            # --- Combine measurements ---
            combine_params = []
            for row in combine_rows:
                pos = (row.get("pos") or "").upper()
                if pos not in SKILL:
                    continue
                rec = _match(None, row.get("player_name") or "", pos, by_gsis, by_name)
                if rec is None:
                    continue
                combine_params.append(
                    (
                        rec["id"],
                        _int(row.get("season")),
                        _num(row.get("forty")),
                        _int(row.get("bench")),
                        _num(row.get("vertical")),
                        _int(row.get("broad_jump")),
                        _num(row.get("cone")),
                        _num(row.get("shuttle")),
                    )
                )

            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO combine_metrics (
                      player_id, combine_year, forty, bench, vertical,
                      broad_jump, cone, shuttle
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (player_id) DO UPDATE SET
                      combine_year = EXCLUDED.combine_year,
                      forty = EXCLUDED.forty,
                      bench = EXCLUDED.bench,
                      vertical = EXCLUDED.vertical,
                      broad_jump = EXCLUDED.broad_jump,
                      cone = EXCLUDED.cone,
                      shuttle = EXCLUDED.shuttle
                    """,
                    combine_params,
                )

            total = len(draft_params) + len(combine_params)
            log_ingest(conn, PIPELINE, "success", total)
            print(
                f"Draft capital for {len(draft_params)} players "
                f"(+{len(undrafted_ids)} marked undrafted), "
                f"combine metrics for {len(combine_params)}."
            )
            return total
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", 0, str(exc))
            raise


if __name__ == "__main__":
    run()
