"""
Phase 3 - devy projection model (XGBoost).

  train    -> fit an XGBoost regressor on college->NFL examples, cross-validate,
              and persist the model + feature contract to artifacts/.
  predict  -> load the model, project current college prospects, and write
              `projections` (horizon_year = -1, "career outlook") +
              `dynasty_values` rows (model_version = 'devy_xgb_v1').

xgboost / sklearn are imported lazily so the Phase 2 baseline can run on a
machine without the ML libs installed.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_conn, log_ingest
from models.devy_dataset import build_dataset, build_inference_set
from models.features import FEATURE_NAMES

PIPELINE = "devy_model"
MODEL_VERSION = "devy_xgb_v1"
ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "devy_xgb.json"
META_PATH = ARTIFACT_DIR / "devy_xgb_meta.json"
MIN_TRAINING_ROWS = 50


def train() -> dict:
    """Fit and persist the devy model. Returns training metrics."""
    import numpy as np
    import xgboost as xgb
    from sklearn.model_selection import KFold, cross_val_score

    X, y, meta = build_dataset()
    n = len(X)
    print(f"Loaded {n} training examples.")
    if n < MIN_TRAINING_ROWS:
        msg = (
            f"Only {n} labeled examples (need >= {MIN_TRAINING_ROWS}). "
            "Ingest more NFL + college seasons before training."
        )
        print(msg)
        return {"status": "insufficient_data", "n": n, "message": msg}

    X_arr = np.array(X, dtype=float)
    y_arr = np.array(y, dtype=float)

    model = xgb.XGBRegressor(
        n_estimators=400,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=1.0,
        random_state=42,
        objective="reg:squarederror",
    )

    # Cross-validated MAE so we know roughly how trustworthy projections are.
    folds = min(5, max(2, n // 25))
    cv = KFold(n_splits=folds, shuffle=True, random_state=42)
    neg_mae = cross_val_score(model, X_arr, y_arr, cv=cv, scoring="neg_mean_absolute_error")
    mae = float(-neg_mae.mean())
    print(f"Cross-validated MAE ({folds}-fold): {mae:.1f} fantasy points")

    model.fit(X_arr, y_arr)

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    model.save_model(str(MODEL_PATH))

    importances = {
        name: float(score)
        for name, score in zip(FEATURE_NAMES, model.feature_importances_)
    }
    metrics = {
        "status": "trained",
        "model_version": MODEL_VERSION,
        "n_examples": n,
        "cv_folds": folds,
        "cv_mae": round(mae, 2),
        "feature_names": FEATURE_NAMES,
        "top_features": dict(
            sorted(importances.items(), key=lambda kv: kv[1], reverse=True)[:8]
        ),
    }
    META_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"Saved model -> {MODEL_PATH}")
    return metrics


def predict() -> int:
    """Project current college prospects and store the results."""
    import numpy as np
    import xgboost as xgb

    if not MODEL_PATH.exists():
        print("No trained model found. Run `train()` first.")
        return 0

    # Guard against feature-contract drift between training and inference.
    if META_PATH.exists():
        saved = json.loads(META_PATH.read_text(encoding="utf-8")).get("feature_names")
        if saved and saved != FEATURE_NAMES:
            raise RuntimeError(
                "Feature contract changed since training. Retrain the model "
                "(saved feature_names differ from models.features.FEATURE_NAMES)."
            )

    model = xgb.XGBRegressor()
    model.load_model(str(MODEL_PATH))

    X, meta = build_inference_set()
    if not X:
        print("No college prospects to project.")
        return 0

    preds = model.predict(np.array(X, dtype=float))
    preds = [max(0.0, float(p)) for p in preds]

    # Scale projected NFL output to a 0..10000 devy board.
    top = max(preds) if preds else 1.0
    top = top or 1.0

    count = 0
    with get_conn() as conn:
        try:
            ranked = sorted(
                zip(meta, preds), key=lambda mp: mp[1], reverse=True
            )
            position_counts: dict[str, int] = {}
            proj_params = []
            value_params = []
            for overall_rank, (m, pred) in enumerate(ranked, start=1):
                pos = (m["position"] or "").upper()
                position_counts[pos] = position_counts.get(pos, 0) + 1
                value = int(round(10000 * pred / top))
                proj_params.append(
                    (m["player_id"], -1, round(pred, 2), MODEL_VERSION, _json({}))
                )
                value_params.append(
                    (
                        m["player_id"],
                        "devy",
                        value,
                        overall_rank,
                        position_counts[pos],
                        3,
                        MODEL_VERSION,
                        _json({"projected_nfl_points": round(pred, 2)}),
                    )
                )

            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO projections (
                      player_id, horizon_year, projected_points, model_version, metadata
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (player_id, horizon_year, model_version)
                    DO UPDATE SET
                      projected_points = EXCLUDED.projected_points,
                      created_at = now()
                    """,
                    proj_params,
                )
                cur.executemany(
                    """
                    INSERT INTO dynasty_values (
                      player_id, settings_key, value, overall_rank, position_rank,
                      projection_years, model_version, metadata
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (player_id, settings_key, model_version)
                    DO UPDATE SET
                      value = EXCLUDED.value,
                      overall_rank = EXCLUDED.overall_rank,
                      position_rank = EXCLUDED.position_rank,
                      computed_at = now()
                    """,
                    value_params,
                )
            count = len(value_params)

            log_ingest(conn, PIPELINE, "success", count)
            print(f"Projected {count} devy prospects.")
            return count
        except Exception as exc:
            log_ingest(conn, PIPELINE, "error", count, str(exc))
            raise


def _json(obj) -> object:
    import psycopg

    return psycopg.types.json.Json(obj)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Devy XGBoost model")
    parser.add_argument(
        "command", choices=["train", "predict", "all"], nargs="?", default="all"
    )
    args = parser.parse_args()

    if args.command in ("train", "all"):
        result = train()
        if args.command == "all" and result.get("status") != "trained":
            sys.exit(0)
    if args.command in ("predict", "all"):
        predict()
