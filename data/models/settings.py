"""League settings and the value adjustments they imply.

Mirrors the app's LeagueSettings (src/types.ts):
  numQbs: 1 | 2, numTeams, ppr: 0 | 0.5 | 1, tePremium: 0 | 0.5 | 1
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LeagueSettings:
    num_qbs: int = 1
    num_teams: int = 12
    ppr: float = 1.0
    te_premium: float = 0.0

    @property
    def key(self) -> str:
        ppr_tag = {0: "0ppr", 0.5: "05ppr", 1: "1ppr"}.get(self.ppr, f"{self.ppr}ppr")
        tep_tag = {0: "0tep", 0.5: "05tep", 1: "1tep"}.get(
            self.te_premium, f"{self.te_premium}tep"
        )
        qb_tag = "sf" if self.num_qbs == 2 else "1qb"
        return f"{qb_tag}-{self.num_teams}t-{ppr_tag}-{tep_tag}"


# The settings we precompute dynasty values for.
DEFAULT_SETTINGS = [
    LeagueSettings(num_qbs=1, num_teams=12, ppr=1.0, te_premium=0.0),
    LeagueSettings(num_qbs=2, num_teams=12, ppr=1.0, te_premium=0.0),
    LeagueSettings(num_qbs=1, num_teams=12, ppr=1.0, te_premium=0.5),
    LeagueSettings(num_qbs=2, num_teams=12, ppr=1.0, te_premium=0.5),
]


def position_settings_multiplier(position: str, settings: LeagueSettings) -> float:
    """Scarcity-style multiplier applied after base projection.

    - Superflex roughly doubles QB scarcity value (~1.6x is a common heuristic).
    - TE premium boosts TEs (matches the app's +0.25 per TEP point).
    """
    pos = (position or "").upper()
    mult = 1.0
    if pos == "QB" and settings.num_qbs == 2:
        mult *= 1.6
    if pos == "TE" and settings.te_premium > 0:
        mult *= 1.0 + 0.25 * settings.te_premium
    return mult


def ppr_points_delta(receptions: float, settings: LeagueSettings) -> float:
    """Adjust a half-PPR baseline to the league's PPR setting."""
    return (settings.ppr - 0.5) * (receptions or 0.0)
