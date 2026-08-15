"""PostgreSQL helpers."""

from __future__ import annotations

import uuid
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

from config import DATABASE_URL


def require_database_url() -> str:
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy data/.env.example to data/.env "
            "or add DATABASE_URL to the root .env file."
        )
    return DATABASE_URL


@contextmanager
def get_conn() -> Iterator[psycopg.Connection]:
    # prepare_threshold=None: no server-side prepared statements, required when
    # going through Supabase's transaction pooler (port 6543).
    conn = psycopg.connect(
        require_database_url(), row_factory=dict_row, prepare_threshold=None
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def run_schema() -> None:
    schema_path = __import__("pathlib").Path(__file__).resolve().parent / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)


def log_ingest(
    conn: psycopg.Connection,
    pipeline: str,
    status: str,
    rows_affected: int = 0,
    error_message: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ingest_runs (pipeline, status, rows_affected, error_message, finished_at)
            VALUES (%s, %s, %s, %s, now())
            """,
            (pipeline, status, rows_affected, error_message),
        )


def upsert_player(
    conn: psycopg.Connection,
    *,
    name: str,
    position: str,
    level: str,
    sleeper_id: str | None = None,
    cfbd_id: str | None = None,
    gsis_id: str | None = None,
    team: str | None = None,
    birth_date: str | None = None,
    draft_year: int | None = None,
    draft_round: int | None = None,
    draft_pick: int | None = None,
    height_inches: int | None = None,
    weight_lbs: int | None = None,
) -> uuid.UUID:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO players (
              name, position, level, sleeper_id, cfbd_id, gsis_id, team,
              birth_date, draft_year, draft_round, draft_pick,
              height_inches, weight_lbs, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (sleeper_id) WHERE sleeper_id IS NOT NULL
            DO UPDATE SET
              name = EXCLUDED.name,
              position = EXCLUDED.position,
              level = EXCLUDED.level,
              cfbd_id = COALESCE(EXCLUDED.cfbd_id, players.cfbd_id),
              gsis_id = COALESCE(EXCLUDED.gsis_id, players.gsis_id),
              team = EXCLUDED.team,
              birth_date = COALESCE(EXCLUDED.birth_date, players.birth_date),
              draft_year = COALESCE(EXCLUDED.draft_year, players.draft_year),
              draft_round = COALESCE(EXCLUDED.draft_round, players.draft_round),
              draft_pick = COALESCE(EXCLUDED.draft_pick, players.draft_pick),
              height_inches = COALESCE(EXCLUDED.height_inches, players.height_inches),
              weight_lbs = COALESCE(EXCLUDED.weight_lbs, players.weight_lbs),
              updated_at = now()
            RETURNING id
            """,
            (
                name,
                position,
                level,
                sleeper_id,
                cfbd_id,
                gsis_id,
                team,
                birth_date,
                draft_year,
                draft_round,
                draft_pick,
                height_inches,
                weight_lbs,
            ),
        )
        row = cur.fetchone()
        if row:
            return row["id"]

        # Fallback when sleeper_id is null (college-only players)
        cur.execute(
            """
            SELECT id FROM players
            WHERE name = %s AND position = %s AND level = %s
              AND (cfbd_id = %s OR (%s IS NULL AND cfbd_id IS NULL))
            LIMIT 1
            """,
            (name, position, level, cfbd_id, cfbd_id),
        )
        existing = cur.fetchone()
        if existing:
            return existing["id"]

        cur.execute(
            """
            INSERT INTO players (
              name, position, level, cfbd_id, team, birth_date, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, now())
            RETURNING id
            """,
            (name, position, level, cfbd_id, team, birth_date),
        )
        return cur.fetchone()["id"]


_SEASON_STATS_SQL = """
    INSERT INTO season_stats (
      player_id, season, level, team, games, age,
      pass_attempts, pass_yards, pass_tds,
      rush_attempts, rush_yards, rush_tds,
      targets, receptions, rec_yards, rec_tds,
      fantasy_points, stats_json, source
    )
    VALUES (
      %s, %s, %s, %s, %s, %s,
      %s, %s, %s,
      %s, %s, %s,
      %s, %s, %s, %s,
      %s, %s, %s
    )
    ON CONFLICT (player_id, season, level, source)
    DO UPDATE SET
      team = EXCLUDED.team,
      games = EXCLUDED.games,
      age = EXCLUDED.age,
      pass_attempts = EXCLUDED.pass_attempts,
      pass_yards = EXCLUDED.pass_yards,
      pass_tds = EXCLUDED.pass_tds,
      rush_attempts = EXCLUDED.rush_attempts,
      rush_yards = EXCLUDED.rush_yards,
      rush_tds = EXCLUDED.rush_tds,
      targets = EXCLUDED.targets,
      receptions = EXCLUDED.receptions,
      rec_yards = EXCLUDED.rec_yards,
      rec_tds = EXCLUDED.rec_tds,
      fantasy_points = EXCLUDED.fantasy_points,
      stats_json = EXCLUDED.stats_json
"""


def _season_stats_tuple(
    *,
    player_id: uuid.UUID,
    season: int,
    level: str,
    source: str,
    team: str | None = None,
    games: int | None = None,
    age: float | None = None,
    fantasy_points: float | None = None,
    stats: dict[str, Any] | None = None,
    **volume: Any,
) -> tuple:
    return (
        player_id,
        season,
        level,
        team,
        games,
        age,
        volume.get("pass_attempts"),
        volume.get("pass_yards"),
        volume.get("pass_tds"),
        volume.get("rush_attempts"),
        volume.get("rush_yards"),
        volume.get("rush_tds"),
        volume.get("targets"),
        volume.get("receptions"),
        volume.get("rec_yards"),
        volume.get("rec_tds"),
        fantasy_points,
        psycopg.types.json.Json(stats or {}),
        source,
    )


_MARKET_VALUES_SQL = """
    INSERT INTO market_values (
      source, external_id, player_id, name, position, team, age,
      sleeper_id, settings_key, value, overall_rank, position_rank,
      trend_30day, tier
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (source, settings_key, external_id, snapshot_date)
    DO UPDATE SET
      player_id = EXCLUDED.player_id,
      name = EXCLUDED.name,
      position = EXCLUDED.position,
      team = EXCLUDED.team,
      age = EXCLUDED.age,
      sleeper_id = EXCLUDED.sleeper_id,
      value = EXCLUDED.value,
      overall_rank = EXCLUDED.overall_rank,
      position_rank = EXCLUDED.position_rank,
      trend_30day = EXCLUDED.trend_30day,
      tier = EXCLUDED.tier,
      created_at = now()
"""


def upsert_market_values(conn: psycopg.Connection, params: list[tuple]) -> int:
    """Batched market_values upsert (today's snapshot). Tuple order:
    (source, external_id, player_id, name, position, team, age,
     sleeper_id, settings_key, value, overall_rank, position_rank,
     trend_30day, tier)"""
    if not params:
        return 0
    with conn.cursor() as cur:
        cur.executemany(_MARKET_VALUES_SQL, params)
    return len(params)


def upsert_season_stats(conn: psycopg.Connection, **kwargs: Any) -> None:
    with conn.cursor() as cur:
        cur.execute(_SEASON_STATS_SQL, _season_stats_tuple(**kwargs))


def upsert_season_stats_many(conn: psycopg.Connection, rows: list[dict]) -> int:
    """Batched season_stats upsert. Each row is the kwargs dict for one stat line."""
    if not rows:
        return 0
    params = [_season_stats_tuple(**row) for row in rows]
    with conn.cursor() as cur:
        cur.executemany(_SEASON_STATS_SQL, params)
    return len(params)
