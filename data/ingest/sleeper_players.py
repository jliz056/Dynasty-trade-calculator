"""Ingest NFL player metadata from Sleeper."""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import SLEEPER_API_URL
from db import get_conn, log_ingest, upsert_player
from models.build_match import parse_height_inches, parse_weight_lbs

OFFENSE_POSITIONS = {"QB", "RB", "WR", "TE"}
PIPELINE = "sleeper_players"


def parse_birth_date(raw: str | None) -> str | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10]).isoformat()
    except ValueError:
        return None


def fantasy_points_half_ppr(row: dict) -> float:
    """Simple half-PPR baseline for cross-season comparison."""
    pass_yds = float(row.get("pass_yd") or row.get("pass_yards") or 0)
    pass_tds = float(row.get("pass_td") or row.get("pass_tds") or 0)
    ints = float(row.get("pass_int") or row.get("interceptions") or 0)
    rush_yds = float(row.get("rush_yd") or row.get("rush_yards") or 0)
    rush_tds = float(row.get("rush_td") or row.get("rush_tds") or 0)
    rec = float(row.get("rec") or row.get("receptions") or 0)
    rec_yds = float(row.get("rec_yd") or row.get("rec_yards") or 0)
    rec_tds = float(row.get("rec_td") or row.get("rec_tds") or 0)
    return (
        pass_yds * 0.04
        + pass_tds * 4
        - ints * 2
        + rush_yds * 0.1
        + rush_tds * 6
        + rec * 0.5
        + rec_yds * 0.1
        + rec_tds * 6
    )


def run() -> int:
    print("Fetching Sleeper NFL players...")
    res = requests.get(f"{SLEEPER_API_URL}/players/nfl", timeout=120)
    res.raise_for_status()
    players = res.json()

    count = 0
    with get_conn() as conn:
        try:
            for sleeper_id, p in players.items():
                pos = (p.get("position") or "").upper()
                if pos not in OFFENSE_POSITIONS:
                    continue
                if p.get("active") is False and not p.get("years_exp"):
                    continue

                metadata = p.get("metadata") or {}
                upsert_player(
                    conn,
                    name=p.get("full_name") or p.get("last_name") or "Unknown",
                    position=pos,
                    level="nfl",
                    sleeper_id=str(sleeper_id),
                    gsis_id=p.get("gsis_id"),
                    team=p.get("team"),
                    birth_date=parse_birth_date(p.get("birth_date")),
                    draft_year=_int(metadata.get("draft_year")),
                    height_inches=parse_height_inches(p.get("height")),
                    weight_lbs=parse_weight_lbs(p.get("weight")),
                )
                count += 1

            log_ingest(conn, PIPELINE, "success", count)
            print(f"Upserted {count} NFL players.")
            return count
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", count, str(exc))
            raise


def _int(value) -> int | None:
    try:
        return int(value) if value else None
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    run()
