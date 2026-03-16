"""Analysis Use Case — orchestrates the dispatch of modular pipelines.

Implements Clean Architecture 'Use Case' layer.
Handles lazy loading of modular graphs to ensure team isolation.
"""

from __future__ import annotations

from typing import Any, Dict


def get_pipeline(source_type: str, checkpointer: Any = None):
    """Return the compiled LangGraph pipeline for the given source type using lazy imports.

    This ensures that:
    1. Team 1 (CSV) code is only loaded when a CSV job is run.
    2. Team 2 (SQL) code is only loaded when a SQL job is run.
    """
    normalised = (source_type or "csv").lower()
    
    if normalised in ("sql", "sqlite", "postgresql", "mysql", "mssql"):
        from app.modules.sql.workflow import build_sql_graph
        return build_sql_graph(checkpointer=checkpointer)
    
    # Default to CSV pipeline
    from app.modules.csv.workflow import build_csv_graph
    return build_csv_graph(checkpointer=checkpointer)
