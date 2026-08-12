"""
Physical build matching for player comparables.

A 6'4" WR and a 5'8" WR play different roles — they should not be analogs.
When both players have height on record we require a similar frame before
comparing offensive profiles. Weight is a secondary check when available.
"""

from __future__ import annotations

import re

# Max height difference (inches) allowed between subject and comparable.
MAX_HEIGHT_DELTA: dict[str, int] = {
    "WR": 3,   # e.g. 5'8" (68) vs 6'4" (76) = 8" → excluded
    "TE": 2,
    "RB": 2,
    "QB": 3,
}

# Max weight difference (lbs) when both weights are known.
MAX_WEIGHT_DELTA: dict[str, int] = {
    "WR": 20,
    "TE": 25,
    "RB": 25,
    "QB": 30,
}


def parse_height_inches(raw) -> int | None:
    """Parse Sleeper-style height ('6\\'2\"', '74', etc.) to total inches."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        v = int(raw)
        return v if 60 <= v <= 88 else None
    s = str(raw).strip().replace('"', "")
    m = re.match(r"^(\d+)['\-](\d+)$", s)
    if m:
        return int(m.group(1)) * 12 + int(m.group(2))
    if s.isdigit():
        v = int(s)
        return v if 60 <= v <= 88 else None
    return None


def parse_weight_lbs(raw) -> int | None:
    if raw is None:
        return None
    try:
        v = int(float(raw))
        return v if 150 <= v <= 350 else None
    except (TypeError, ValueError):
        return None


def format_height(inches: int | None) -> str | None:
    if inches is None:
        return None
    return f"{inches // 12}'{inches % 12}\""


def draft_compatible(
    subject_age: int,
    subj_round: int | None,
    cand_round: int | None,
    max_round_delta: int = 2,
    age_limit: int = 25,
) -> bool:
    """
    Draft capital matters most on rookie contracts: a 1st-round WR and an
    undrafted WR with the same early production do not share a future.
    Round 0 = undrafted (treated as round 8). None = unknown -> no filter.
    Past `age_limit`, production speaks for itself and the filter is skipped.
    """
    if subject_age > age_limit:
        return True
    if subj_round is None or cand_round is None:
        return True
    subj = subj_round if subj_round > 0 else 8
    cand = cand_round if cand_round > 0 else 8
    return abs(subj - cand) <= max_round_delta


def build_compatible(
    position: str,
    subj_height: int | None,
    subj_weight: int | None,
    cand_height: int | None,
    cand_weight: int | None,
) -> bool:
    """
    True when the comparable is a similar physical frame to the subject.
    If the subject has no height on file, we cannot filter (returns True).
    If the subject has height but the candidate does not, exclude the candidate.
    """
    pos = (position or "").upper()
    if subj_height is None:
        return True
    if cand_height is None:
        return False

    if abs(subj_height - cand_height) > MAX_HEIGHT_DELTA.get(pos, 3):
        return False

    if subj_weight is not None and cand_weight is not None:
        if abs(subj_weight - cand_weight) > MAX_WEIGHT_DELTA.get(pos, 25):
            return False

    return True
