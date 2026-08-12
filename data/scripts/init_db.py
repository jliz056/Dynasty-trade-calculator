"""Initialize the PostgreSQL schema."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import run_schema


def main() -> None:
    print("Applying schema.sql ...")
    run_schema()
    print("Schema ready.")


if __name__ == "__main__":
    main()
