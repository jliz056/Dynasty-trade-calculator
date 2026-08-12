"""
Find historical NFL players with similar early-career trajectories.

Phase 1: cosine similarity on normalized feature vectors at the same age.
Future: learned embeddings from ML model.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_conn, log_ingest
from models.build_match import build_compatible

PIPELINE = "player_comparables"
TOP_K = 10
MIN_AGE = 21
MAX_AGE = 27


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    keys = set(a) & set(b)
    if not keys:
        return 0.0
    dot = sum(a[k] * b[k] for k in keys)
    norm_a = math.sqrt(sum(a[k] ** 2 for k in keys))
    norm_b = math.sqrt(sum(b[k] ** 2 for k in keys))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def vector_from_snapshot(raw) -> dict[str, float]:
    if isinstance(raw, str):
        data = json.loads(raw)
    else:
        data = raw or {}
    return {k: float(v) for k, v in data.items()}


def run(subject_player_id: str | None = None, top_k: int = TOP_K) -> int:
    count = 0
    with get_conn() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT cs.*, p.position, p.name,
                           p.height_inches, p.weight_lbs
                    FROM career_snapshots cs
                    JOIN players p ON p.id = cs.player_id
                    WHERE cs.level = 'nfl'
                    """
                )
                snapshots = cur.fetchall()

            builds: dict[UUID, tuple[int | None, int | None]] = {
                snap["player_id"]: (snap.get("height_inches"), snap.get("weight_lbs"))
                for snap in snapshots
            }

            # Total NFL seasons per player -> a comp is only meaningful if the
            # player has an observable trajectory (>= 3 recorded seasons).
            career_lengths: dict[UUID, int] = {}
            for snap in snapshots:
                pid = snap["player_id"]
                career_lengths[pid] = career_lengths.get(pid, 0) + 1

            # Comparable pool indexed by (position, integer age). Any historical
            # player-age snapshot with enough career history qualifies.
            by_pos_age: dict[tuple[str, int], list] = {}
            for snap in snapshots:
                if career_lengths[snap["player_id"]] < 3:
                    continue
                key = (snap["position"], round(float(snap["age"])))
                by_pos_age.setdefault(key, []).append(snap)

            # Subjects: young players early in their careers.
            subjects = [
                s for s in snapshots
                if float(s["age"]) <= 24 and s["season_index"] <= 2
            ]
            if subject_player_id:
                subjects = [s for s in subjects if str(s["player_id"]) == subject_player_id]

            params = []
            for subject in subjects:
                key = (subject["position"], round(float(subject["age"])))
                subj_h, subj_w = builds.get(subject["player_id"], (None, None))
                pool = [
                    c for c in by_pos_age.get(key, [])
                    if c["player_id"] != subject["player_id"]
                    and build_compatible(
                        subject["position"],
                        subj_h,
                        subj_w,
                        builds.get(c["player_id"], (None, None))[0],
                        builds.get(c["player_id"], (None, None))[1],
                    )
                ]
                if not pool:
                    continue

                sub_vec = vector_from_snapshot(subject["feature_vector"])
                scored = []
                for comp in pool:
                    sim = cosine(sub_vec, vector_from_snapshot(comp["feature_vector"]))
                    scored.append((sim, comp))
                scored.sort(key=lambda x: x[0], reverse=True)

                for sim, comp in scored[:top_k]:
                    params.append(
                        (
                            subject["player_id"],
                            comp["player_id"],
                            subject["age"],
                            round(sim, 4),
                        )
                    )

            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO player_comparables (
                      subject_id, comparable_id, subject_age, similarity, method
                    )
                    VALUES (%s, %s, %s, %s, 'cosine_v1')
                    ON CONFLICT (subject_id, comparable_id, subject_age, method)
                    DO UPDATE SET similarity = EXCLUDED.similarity
                    """,
                    params,
                )
            count = len(params)

            log_ingest(conn, PIPELINE, "success", count)
            print(f"Stored {count} comparable pairs.")
            return count
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", count, str(exc))
            raise


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--player-id", default=None)
    parser.add_argument("--top-k", type=int, default=TOP_K)
    args = parser.parse_args()
    run(args.player_id, args.top_k)
