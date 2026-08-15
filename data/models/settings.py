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


# Starter slots in a typical 12-team starting lineup. Flex is split across
# RB/WR/TE so replacement is a bit deeper at those spots than at QB.
STARTER_SLOTS_1QB: dict[str, float] = {"QB": 1.0, "RB": 2.5, "WR": 3.5, "TE": 1.25}
STARTER_SLOTS_SF: dict[str, float] = {"QB": 2.0, "RB": 2.5, "WR": 3.5, "TE": 1.25}

# Share of production below replacement that still counts (backups aren't $0).
DEPTH_CREDIT = 0.25


def starter_slots(settings: LeagueSettings) -> dict[str, float]:
    slots = dict(STARTER_SLOTS_SF if settings.num_qbs == 2 else STARTER_SLOTS_1QB)
    if settings.te_premium > 0:
        slots["TE"] = 1.5
    return slots


def apply_vorp(scored: list[dict], settings: LeagueSettings) -> list[dict]:
    """Rewrite each player's raw_value as points above a positional replacement.

    Without this, QBs dominate every board because they score ~350 fantasy
    points vs ~250 for an elite WR. In 1QB you only start one QB, so the 12th
    QB is a replacement starter and Chase-level WRs are much scarcer.
    """
    slots = starter_slots(settings)
    by_pos: dict[str, list[dict]] = {}
    for row in scored:
        by_pos.setdefault((row["position"] or "").upper(), []).append(row)

    replacement: dict[str, float] = {}
    for pos, rows in by_pos.items():
        ordered = sorted(rows, key=lambda r: r["raw_value"], reverse=True)
        n = max(1, int(round(settings.num_teams * slots.get(pos, 2.0))))
        idx = min(n - 1, len(ordered) - 1)
        replacement[pos] = ordered[idx]["raw_value"] if ordered else 0.0

    for row in scored:
        pos = (row["position"] or "").upper()
        raw = float(row["raw_value"])
        repl = replacement.get(pos, 0.0)
        above = raw - repl
        row["raw_value"] = max(above, 0.0) + DEPTH_CREDIT * min(raw, repl)
        row["replacement"] = round(repl, 2)
    return scored
