"""SQL Pipeline — Data Discovery Agent.

Introspects the SQL database via INFORMATION_SCHEMA to build a schema summary.
Uses the sql_schema_discovery tool with the decrypted connection string.
SQL data is assumed to be high quality (score = 1.0).
"""

from __future__ import annotations

from typing import Any, Dict

from app.domain.analysis.entities import AnalysisState
from app.modules.shared.tools.load_data_source import get_connection_string


async def data_discovery_agent(state: AnalysisState) -> Dict[str, Any]:
    """Introspect the SQL database, generate ERD, and return FULL schema."""
    connection_string = get_connection_string(state)
    if not connection_string:
        return {
            "schema_summary": state.get("schema_summary", {}),
            "data_quality_score": 1.0,
        }

    try:
        from app.modules.sql.tools.sql_schema_discovery import sql_schema_discovery

        # Bug 1 Fix: force_refresh=True to bust stale cache and always get real schema
        raw = sql_schema_discovery.invoke({
            "connection_string": connection_string,
            "sample_rows": 3,          # More samples help agent understand data values
            "force_refresh": True,     # Never use cached schema — always fetch fresh
        })

        from structlog import get_logger
        debug_logger = get_logger("app.debug.erd")
        debug_logger.info(
            "erd_discovery_raw",
            tables_count=len(raw.get("tables", [])),
            fks_count=len(raw.get("foreign_keys", [])),
        )

        from app.modules.sql.utils.schema_utils import infer_foreign_keys, generate_mermaid_erd

        tables = raw.get("tables", [])
        foreign_keys = raw.get("foreign_keys", [])

        # Infer missing foreign keys by naming convention and generate ERD
        final_fks = infer_foreign_keys(tables, foreign_keys)
        mermaid_erd = generate_mermaid_erd(tables, final_fks)
        raw["foreign_keys"] = final_fks

        # Bug 2 Fix: DO NOT filter tables here.
        # We pass ALL tables to the state so the analysis_agent's schema_selector
        # can make an intelligent, JOIN-aware selection later.
        # Removing the old heuristic filter that was silently dropping JOIN-required tables.

        schema_summary = {
            "source_type": "sql",
            "mermaid_erd": mermaid_erd,
            **raw,
        }

        return {
            "schema_summary": schema_summary,
            "data_quality_score": 1.0,
        }

    except Exception as exc:
        return {
            "schema_summary": {
                "source_type": "sql",
                "error": str(exc),
                "tables": [],
            },
            "data_quality_score": 1.0,
        }

