from datetime import datetime, timezone
from typing import Any, Optional


def parse_utc_timestamp(value: Any) -> datetime:
    """
    Parses an ISO-8601 timestamp and returns it in UTC.

    Naive timestamps are rejected: comparing a local time at one airport with a
    UTC time at another silently produces wrong connection windows.
    """
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            raise ValueError(f"invalid timestamp: {value!r}") from None
    else:
        raise ValueError(f"invalid timestamp: {value!r}")

    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(f"timestamp has no timezone offset: {value!r}")
    return parsed.astimezone(timezone.utc)


def try_parse_utc_timestamp(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    try:
        return parse_utc_timestamp(value)
    except ValueError:
        return None


def minutes_between(start: datetime, end: datetime) -> int:
    """Whole minutes from start to end (negative when end precedes start), truncated toward zero."""
    return int((end - start).total_seconds() / 60)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
