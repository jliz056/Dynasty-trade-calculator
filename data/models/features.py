"""Feature extraction shared by the devy ML model.

Feature vectors are plain dicts so they round-trip cleanly through the
`feature_vector` / `metadata` JSONB columns. New signals (weather, stadium,
strength of schedule, opponent defense vs. position, ...) can be added here
later without schema changes.
"""

from __future__ import annotations

import re
import unicodedata

# Position is one-hot encoded so a single model can serve all skill positions.
POSITIONS = ["QB", "RB", "WR", "TE"]

# Order matters: this is the model's feature contract. Append-only.
FEATURE_NAMES = [
    "age",
    "pass_attempts",
    "pass_yards",
    "pass_tds",
    "rush_attempts",
    "rush_yards",
    "rush_tds",
    "targets",
    "receptions",
    "rec_yards",
    "rec_tds",
    "games",
    "fantasy_points",
    "fantasy_points_per_game",
    "yards_per_reception",
    "yards_per_attempt",
    *[f"pos_{p}" for p in POSITIONS],
]


def normalize_name(name: str) -> str:
    """Lowercase, strip accents/punctuation/suffixes for fuzzy player matching."""
    if not name:
        return ""
    text = unicodedata.normalize("NFKD", name)
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _num(value) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def extract_features(row: dict) -> dict[str, float]:
    """Build a feature dict from a college season_stats row joined to players."""
    games = _num(row.get("games")) or 0.0
    fp = _num(row.get("fantasy_points"))
    receptions = _num(row.get("receptions"))
    rec_yards = _num(row.get("rec_yards"))
    pass_attempts = _num(row.get("pass_attempts"))
    pass_yards = _num(row.get("pass_yards"))

    features: dict[str, float] = {
        "age": _num(row.get("age")) or 21.0,
        "pass_attempts": pass_attempts,
        "pass_yards": pass_yards,
        "pass_tds": _num(row.get("pass_tds")),
        "rush_attempts": _num(row.get("rush_attempts")),
        "rush_yards": _num(row.get("rush_yards")),
        "rush_tds": _num(row.get("rush_tds")),
        "targets": _num(row.get("targets")),
        "receptions": receptions,
        "rec_yards": rec_yards,
        "rec_tds": _num(row.get("rec_tds")),
        "games": games,
        "fantasy_points": fp,
        "fantasy_points_per_game": fp / games if games > 0 else 0.0,
        "yards_per_reception": rec_yards / receptions if receptions > 0 else 0.0,
        "yards_per_attempt": pass_yards / pass_attempts if pass_attempts > 0 else 0.0,
    }
    pos = (row.get("position") or "").upper()
    for p in POSITIONS:
        features[f"pos_{p}"] = 1.0 if pos == p else 0.0
    return features


def to_vector(features: dict[str, float]) -> list[float]:
    """Order a feature dict according to FEATURE_NAMES (the model contract)."""
    return [float(features.get(name, 0.0)) for name in FEATURE_NAMES]
