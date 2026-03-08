"""3-Layer SQL Validator — Ensures safety, syntactical correctness, and schema validity.

Inspired by the notebook implementation, optimized for a multi-dialect SaaS environment.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from app.infrastructure.sql_guard import validate_select_only
from structlog import get_logger

logger = get_logger("app.sql.validator")

class SQLValidator:
    """Validates SQL through 3 defensive layers before execution."""

    def __init__(self, engine: Any, schema_summary: Optional[Dict[str, Any]] = None):
        self.engine = engine
        self.schema_summary = schema_summary
        self.dialect = engine.dialect.name if engine else "sqlite"

    def validate(self, sql: str) -> Dict[str, Any]:
        """Runs the 3-layer validation.
        
        Returns: {"valid": bool, "errors": [str], "warnings": [str]}
        """
        errors: List[str] = []
        warnings: List[str] = []
        
        if not sql or not sql.strip():
            return {"valid": False, "errors": ["Query is empty."], "warnings": []}

        # ── Layer 1: Security & Keyword Guard ──
        try:
            validate_select_only(sql)
        except ValueError as exc:
            errors.append(str(exc))
            return {"valid": False, "errors": errors, "warnings": []}

        # ── Layer 2: Engine Parser (EXPLAIN) ──
        # This asks the DB to parse the query without running it.
        # Catches syntax errors and missing column/table names.
        try:
            explain_cmd = "EXPLAIN QUERY PLAN" if self.dialect == "sqlite" else "EXPLAIN"
            with self.engine.connect() as conn:
                conn.execute(text(f"{explain_cmd} {sql}"))
        except Exception as exc:
            # We truncate the error to avoid leaking too much internal DB info to the LLM
            errors.append(f"SQL engine validation failed: {str(exc)[:200]}")

        # ── Layer 3: Schema Hallucination Check ──
        # Cross-references mentioned tables against our discovered schema.
        if self.schema_summary and self.schema_summary.get("tables"):
            known_tables = {t["table"].lower() for t in self.schema_summary["tables"]}
            
            # Simple regex to find table names after FROM/JOIN
            mentioned_tables = re.findall(
                r"\b(?:FROM|JOIN)\s+[\"\'\`\[]?([\w.]+)", 
                sql, 
                re.IGNORECASE
            )
            
            for table in mentioned_tables:
                # Handle schema-qualified names (e.g. public.users -> users)
                base_table = table.split(".")[-1].lower().strip("\"'`[]")
                if base_table not in known_tables:
                    warnings.append(f"Table '{table}' was not found in the initial discovery. It might be a hallucination.")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
