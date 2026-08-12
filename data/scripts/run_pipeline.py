"""Full pipeline: ingest -> snapshots -> comparables -> baseline values -> devy model."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from features.career_curves import run as build_curves
from features.comparables import run as build_comparables
from ingest.run_all import main as ingest_all
from models.analog_projection import run as build_analog_projections
from models.baseline_values import run as build_baseline_values


def main() -> None:
    ingest_all()
    print()
    build_curves()
    print()
    build_comparables()
    print()
    build_baseline_values()
    print()
    build_analog_projections()

    # The devy ML model is optional: it needs the ML libs installed and enough
    # labeled examples. Failures here shouldn't sink the whole pipeline.
    print()
    try:
        from models.devy_model import predict as devy_predict
        from models.devy_model import train as devy_train

        result = devy_train()
        if result.get("status") == "trained":
            devy_predict()
        else:
            print("Devy model skipped (not enough data yet).")
    except ImportError as exc:
        print(f"Devy model skipped (ML libs not installed): {exc}")

    print("\nPipeline complete.")


if __name__ == "__main__":
    main()
