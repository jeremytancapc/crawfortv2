#!/usr/bin/env bash
#
# Starts a throwaway Postgres for the database-backed tests, and applies the
# migrations to it.
#
# The tests that matter here assert things only a real Postgres does - the
# UNIQUE constraint that stops a second Ascend order against one applicant,
# the foreign keys, the enum values. A fake would assert nothing.
#
#   bash scripts/db-test-server.sh start   # prints the TEST_DATABASE_URL
#   bash scripts/db-test-server.sh stop
#
# The data directory lives under .tmp/ (gitignored) rather than the system
# temp dir, which gets cleared underneath a long session.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDATA="$ROOT/.tmp/pgtest"
PORT="${TEST_PG_PORT:-55432}"
DB="crawfort_test"
URL="postgresql://postgres@127.0.0.1:$PORT/$DB"

# Homebrew's Postgres is not on PATH by default, and macOS needs LC_ALL set or
# the postmaster aborts with "became multithreaded during startup".
export PATH="/opt/homebrew/opt/postgresql@17/bin:/usr/local/opt/postgresql@17/bin:$PATH"
export LC_ALL=C LANG=C

case "${1:-start}" in
  start)
    # Starting is conditional; migrating is not. The ledger makes migrations
    # idempotent, and skipping them on an already-running server leaves a
    # database that is up but has no schema - which fails as a confusing
    # "relation does not exist" inside a test rather than here.
    if ! pg_isready -h 127.0.0.1 -p "$PORT" -q 2>/dev/null; then
      if [[ ! -d "$PGDATA" ]]; then
        mkdir -p "$(dirname "$PGDATA")"
        initdb -D "$PGDATA" -U postgres --auth=trust >/dev/null 2>&1
      fi

      # -k '' disables the unix socket: its path would exceed the 103-byte limit.
      pg_ctl -D "$PGDATA" -o "-p $PORT -h 127.0.0.1 -k ''" -l "$PGDATA/server.log" -w start >/dev/null 2>&1
    fi

    psql -h 127.0.0.1 -p "$PORT" -U postgres -tAc \
      "select 1 from pg_database where datname='$DB'" | grep -q 1 \
      || psql -h 127.0.0.1 -p "$PORT" -U postgres -q -c "create database $DB" >/dev/null

    DATABASE_URL="$URL" DATABASE_URL_UNPOOLED="" node "$ROOT/scripts/db-migrate.mjs" >/dev/null 2>&1
    echo "$URL"
    ;;
  stop)
    pg_ctl -D "$PGDATA" -w stop >/dev/null 2>&1 || true
    echo "stopped"
    ;;
  *)
    echo "usage: db-test-server.sh [start|stop]" >&2
    exit 1
    ;;
esac
