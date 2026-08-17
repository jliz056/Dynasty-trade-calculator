"""Weekly usage signals the market sites don't use.

Season totals hide whether a player was startable every week or a boom/bust
lottery ticket, and whether they were heating up or fading down the stretch.
Those two facts are dynasty-relevant and almost invisible in KTC/FantasyCalc.
"""

from __future__ import annotations

import statistics


def load_weekly_features(conn) -> dict[tuple, dict]:
    """(player_id, season) -> {fp_cv, late_trend, snap_share, weeks}."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT player_id, season, week, fantasy_points, offensive_snaps, stats_json
            FROM weekly_stats
            WHERE fantasy_points IS NOT NULL
            ORDER BY player_id, season, week
            """
        )
        rows = cur.fetchall()

    buckets: dict[tuple, list[dict]] = {}
    for r in rows:
        buckets.setdefault((r["player_id"], int(r["season"])), []).append(r)

    out: dict[tuple, dict] = {}
    for key, weeks in buckets.items():
        fps = [float(w["fantasy_points"] or 0) for w in weeks]
        if len(fps) < 4:
            continue
        mean = statistics.fmean(fps)
        if mean <= 0:
            continue
        std = statistics.pstdev(fps) if len(fps) > 1 else 0.0
        last5 = fps[-5:] if len(fps) >= 5 else fps
        late = statistics.fmean(last5) / mean

        shares = []
        for w in weeks:
            snaps = w.get("offensive_snaps")
            meta = w.get("stats_json") or {}
            team = meta.get("tm_off_snp") if isinstance(meta, dict) else None
            if snaps and team and float(team) > 0:
                shares.append(float(snaps) / float(team))

        out[key] = {
            "fp_cv": min(2.0, std / mean),
            "late_trend": min(2.0, max(0.3, late)),
            "snap_share": statistics.fmean(shares) if shares else 0.0,
            "weeks": len(fps),
        }
    return out
