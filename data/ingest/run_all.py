"""Run all ingestion pipelines in order."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest.cfbd_college import run as ingest_college
from ingest.fantasycalc_values import run as ingest_market
from ingest.nfl_seasons import run as ingest_nfl
from ingest.sleeper_players import run as ingest_sleeper


def main() -> None:
    print("=== Dynasty data ingest ===\n")
    ingest_sleeper()
    print()
    ingest_nfl()
    print()
    # Market snapshot is best-effort: the rest of the pipeline doesn't need it.
    try:
        ingest_market()
    except Exception as exc:  # noqa: BLE001
        print(f"Skipping market values ingest (non-fatal): {exc}")
    print()
    # College ingest depends on an external API (CFBD); never let a hiccup there
    # sink the NFL pipeline that everything else is built on.
    try:
        ingest_college()
    except Exception as exc:  # noqa: BLE001
        print(f"Skipping college ingest (non-fatal): {exc}")
    print("\nDone.")


if __name__ == "__main__":
    main()
