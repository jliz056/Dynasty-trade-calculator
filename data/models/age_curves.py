"""
Positional age curves.

Phase 2 uses hand-tuned Gaussian-ish curves (sensible dynasty defaults).
Phase 4 will replace these with curves learned from `career_snapshots`,
but the interface (`age_multiplier`) stays the same so callers don't change.
"""

from __future__ import annotations

import math

# Approximate peak age per position (fantasy production).
PEAK_AGE: dict[str, float] = {
    "QB": 28.0,
    "RB": 24.0,
    "WR": 26.0,
    "TE": 27.0,
}

# Spread before peak (rise) and after peak (decline). RBs fall off fast.
RISE_SPREAD: dict[str, float] = {
    "QB": 5.0,
    "RB": 2.5,
    "WR": 3.5,
    "TE": 4.0,
}
FALL_SPREAD: dict[str, float] = {
    "QB": 6.0,
    "RB": 2.8,
    "WR": 4.0,
    "TE": 4.5,
}

DEFAULT_PEAK = 26.0
DEFAULT_RISE = 3.5
DEFAULT_FALL = 4.0


def age_multiplier(position: str, age: float) -> float:
    """Return a 0..1 production multiplier for a position at a given age.

    Asymmetric Gaussian: separate spreads before/after the peak so we can
    capture the steep RB decline vs. the gentler QB curve.
    """
    pos = (position or "").upper()
    peak = PEAK_AGE.get(pos, DEFAULT_PEAK)
    if age <= peak:
        spread = RISE_SPREAD.get(pos, DEFAULT_RISE)
    else:
        spread = FALL_SPREAD.get(pos, DEFAULT_FALL)
    return math.exp(-((age - peak) ** 2) / (2 * spread ** 2))


def projection_ratio(position: str, current_age: float, years_out: int) -> float:
    """Ratio of expected production `years_out` seasons from now vs. now."""
    now = max(age_multiplier(position, current_age), 0.01)
    future = age_multiplier(position, current_age + years_out)
    return future / now
