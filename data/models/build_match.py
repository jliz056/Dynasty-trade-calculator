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


def forty_compatible(
    subj_forty: float | None,
    cand_forty: float | None,
    max_delta: float = 0.15,
) -> bool:
    """Keep speed similar when both players ran a combine 40. Skip if unknown."""
    if subj_forty is None or cand_forty is None:
        return True
    return abs(float(subj_forty) - float(cand_forty)) <= max_delta


def remaining_career_mult(position: str, age: float) -> float:
    """Extra dynasty weight for years *after* the 3 we explicitly project.

    A 22-year-old WR still has a long window past +3; a 29-year-old does not.
    Market sites bake this in via hype; we bake it in from age + position peak.
    """
    pos = (position or "").upper()
    window_end = {"QB": 33.0, "RB": 27.0, "WR": 30.0, "TE": 31.0}.get(pos, 29.0)
    extra = min(3.0, max(0.0, window_end - age - 3.0))
    return 1.0 + 0.06 * extra


def usage_value_mult(fp_cv: float | None, late_trend: float | None) -> float:
    """Startable-every-week players are worth more than boom/bust totals.

    late_trend > 1 means they finished hotter than their season average —
    the next contract / role is more likely to look like the finish.
    """
    cv = 0.45 if fp_cv is None else float(fp_cv)
    late = 1.0 if late_trend is None else float(late_trend)
    consistency = 1.0 + 0.15 * (0.45 - cv)
    finish = 1.0 + 0.18 * (late - 1.0)
    return max(0.82, min(1.22, consistency * finish))


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
