"""Run every market value snapshot (FantasyCalc, KTC, DynastyProcess).

Each source is best-effort: one site being down never blocks the others.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest.dynastyprocess_values import run as run_dp
from ingest.fantasycalc_values import run as run_fc
from ingest.ktc_values import run as run_ktc


def run() -> int:
    total = 0
    failures = []
    for name, fn in [
        ("fantasycalc", run_fc),
        ("ktc", run_ktc),
        ("dynastyprocess", run_dp),
    ]:
        try:
            total += fn()
        except Exception as exc:  # noqa: BLE001
            failures.append(name)
            print(f"  {name} snapshot failed (non-fatal): {exc}")
        print()
    if failures and total == 0:
        raise RuntimeError(f"All market sources failed: {', '.join(failures)}")
    print(f"Market snapshot done: {total} rows ({3 - len(failures)}/3 sources).")
    return total


if __name__ == "__main__":
    run()
