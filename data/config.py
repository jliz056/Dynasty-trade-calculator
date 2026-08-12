"""Shared configuration for the data pipeline."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

DATA_DIR = Path(__file__).resolve().parent
ROOT_DIR = DATA_DIR.parent

load_dotenv(ROOT_DIR / ".env")
load_dotenv(DATA_DIR / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL", "")
CFB_API_KEY = os.environ.get("CFB_API_KEY") or os.environ.get("VITE_CFB_API_KEY", "")
CFB_API_URL = "https://api.collegefootballdata.com"
SLEEPER_API_URL = "https://api.sleeper.app/v1"

NFL_SEASONS = [
    int(s.strip())
    for s in os.environ.get("NFL_SEASONS", "2021,2022,2023,2024").split(",")
    if s.strip()
]
CFB_SEASONS = [
    int(s.strip())
    for s in os.environ.get("CFB_SEASONS", "2022,2023,2024").split(",")
    if s.strip()
]
