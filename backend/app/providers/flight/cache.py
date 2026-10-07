"""
Persistent response cache and monthly request counter for flight providers (SQLite, stdlib only).
Survives restarts so a small free quota (AviationStack: 100 requests/month) is not wasted.
"""
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
import json
import sqlite3
import threading
import time


class FlightCache:
    def __init__(self, path: str = ":memory:"):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._lock = threading.Lock()
        with self._lock, self._conn:
            self._conn.execute(
                "CREATE TABLE IF NOT EXISTS responses (key TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at REAL NOT NULL)"
            )
            self._conn.execute(
                "CREATE TABLE IF NOT EXISTS quota (provider TEXT NOT NULL, month TEXT NOT NULL, calls INTEGER NOT NULL, "
                "PRIMARY KEY (provider, month))"
            )

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            row = self._conn.execute("SELECT payload, expires_at FROM responses WHERE key = ?", (key,)).fetchone()
        if row is None or row[1] < time.time():
            return None
        return json.loads(row[0])

    def set(self, key: str, value: Any, ttl_seconds: float) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT OR REPLACE INTO responses (key, payload, expires_at) VALUES (?, ?, ?)",
                (key, json.dumps(value), time.time() + ttl_seconds),
            )

    @staticmethod
    def _month() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m")

    def calls_this_month(self, provider: str) -> int:
        with self._lock:
            row = self._conn.execute(
                "SELECT calls FROM quota WHERE provider = ? AND month = ?", (provider, self._month())
            ).fetchone()
        return row[0] if row else 0

    def record_call(self, provider: str) -> int:
        month = self._month()
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO quota (provider, month, calls) VALUES (?, ?, 1) "
                "ON CONFLICT(provider, month) DO UPDATE SET calls = calls + 1",
                (provider, month),
            )
            return self._conn.execute(
                "SELECT calls FROM quota WHERE provider = ? AND month = ?", (provider, month)
            ).fetchone()[0]
