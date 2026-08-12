"""
Build the devy training set: college production -> NFL outcome.

Labels are scarce (a college season only has a "label" once that player has
NFL seasons on record), so we match college players to their NFL selves by
normalized name + position. The label is the player's best 3-year NFL fantasy
total early in their career -- a proxy for dynasty payoff.

Returns (X, y, meta) where:
  X    = list of feature vectors (see models.features.FEATURE_NAMES)
  y    = list of labels (best early-career NFL points)
  meta = list of {player_id, name, position} for traceability
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_conn
from models.features import extract_features, normalize_name, to_vector

LABEL_WINDOW = 3  # first N NFL seasons count toward the label


def _college_best_seasons(conn) -> dict[tuple[str, str], dict]:
    """Best (highest fantasy points) college season per (name, position)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              p.id AS player_id, p.name, p.position,
              ss.season, ss.games, ss.fantasy_points,
              ss.pass_attempts, ss.pass_yards, ss.pass_tds,
              ss.rush_attempts, ss.rush_yards, ss.rush_tds,
              ss.targets, ss.receptions, ss.rec_yards, ss.rec_tds,
              ss.age
            FROM season_stats ss
            JOIN players p ON p.id = ss.player_id
            WHERE ss.level = 'college'
            """
        )
        rows = cur.fetchall()

    best: dict[tuple[str, str], dict] = {}
    for row in rows:
        key = (normalize_name(row["name"]), (row["position"] or "").upper())
        if not key[0]:
            continue
        current = best.get(key)
        if current is None or _num(row.get("fantasy_points")) > _num(
            current.get("fantasy_points")
        ):
            best[key] = row
    return best


def _nfl_outcomes(conn) -> dict[tuple[str, str], float]:
    """Sum of fantasy points over each NFL player's first LABEL_WINDOW seasons."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.name, p.position, ss.season, ss.fantasy_points
            FROM season_stats ss
            JOIN players p ON p.id = ss.player_id
            WHERE ss.level = 'nfl'
            ORDER BY p.name, ss.season
            """
        )
        rows = cur.fetchall()

    seasons_by_player: dict[tuple[str, str], list[tuple[int, float]]] = {}
    for row in rows:
        key = (normalize_name(row["name"]), (row["position"] or "").upper())
        if not key[0]:
            continue
        seasons_by_player.setdefault(key, []).append(
            (int(row["season"]), _num(row.get("fantasy_points")))
        )

    outcomes: dict[tuple[str, str], float] = {}
    for key, seasons in seasons_by_player.items():
        seasons.sort(key=lambda s: s[0])
        early = seasons[:LABEL_WINDOW]
        outcomes[key] = sum(points for _, points in early)
    return outcomes


def build_dataset() -> tuple[list[list[float]], list[float], list[dict]]:
    with get_conn() as conn:
        college = _college_best_seasons(conn)
        outcomes = _nfl_outcomes(conn)

    X: list[list[float]] = []
    y: list[float] = []
    meta: list[dict] = []
    for key, row in college.items():
        if key not in outcomes:
            continue  # no NFL outcome yet -> not a training example
        X.append(to_vector(extract_features(row)))
        y.append(outcomes[key])
        meta.append(
            {
                "player_id": str(row["player_id"]),
                "name": row["name"],
                "position": row["position"],
            }
        )
    return X, y, meta


def build_inference_set() -> tuple[list[list[float]], list[dict]]:
    """Current college players (prospects) to project, regardless of NFL match."""
    with get_conn() as conn:
        college = _college_best_seasons(conn)

    X: list[list[float]] = []
    meta: list[dict] = []
    for row in college.values():
        X.append(to_vector(extract_features(row)))
        meta.append(
            {
                "player_id": str(row["player_id"]),
                "name": row["name"],
                "position": row["position"],
            }
        )
    return X, meta


def _num(value) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


if __name__ == "__main__":
    X, y, meta = build_dataset()
    print(f"Training examples: {len(X)}")
    if y:
        print(f"Label range: {min(y):.1f} .. {max(y):.1f}")
