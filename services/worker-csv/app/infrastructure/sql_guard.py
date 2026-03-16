"""SQL query guard — ensures only SELECT statements reach the database.

Used by the LLM pipeline to prevent prompt-injection attacks from generating
destructive queries (DROP, DELETE, INSERT, UPDATE, etc.).
"""

from __future__ import annotations

import re

# Any keyword that can mutate or destroy data
_DANGEROUS_PATTERN = re.compile(
    r"\b(DROP|DELETE|INSERT|UPDATE|ALTER|TRUNCATE|CREATE|GRANT|REVOKE"
    r"|ATTACH|DETACH|PRAGMA|EXEC|EXECUTE|CALL|MERGE|REPLACE|LOAD)\b",
    re.IGNORECASE,
)


def validate_select_only(sql: str) -> None:
    """Raise ValueError if *sql* is not a safe, read-only SELECT statement.

    Rules
    -----
    1. After stripping whitespace and leading semicolons, the query must
       start with SELECT (or WITH … SELECT for CTEs).
    2. None of the dangerous mutation keywords may appear anywhere in the
       query, even inside subqueries or comments.

    Raises
    ------
    ValueError
        With a human-readable message if the query fails either check.

    Example
    -------
    >>> validate_select_only("SELECT * FROM users")      # OK — no error
    >>> validate_select_only("DROP TABLE users")          # raises ValueError
    """
    stripped = sql.strip().lstrip(";").strip()

    # Allow CTEs: WITH ... SELECT ...
    upper = stripped.upper()
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        raise ValueError(
            f"Security: only SELECT queries are allowed by this platform. "
            f"Received statement starting with: '{stripped[:60]}'"
        )

    match = _DANGEROUS_PATTERN.search(sql)
    if match:
        raise ValueError(
            f"Security: detected forbidden keyword '{match.group()}' in SQL query. "
            "Only read-only SELECT statements are permitted."
        )
