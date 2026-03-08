"""Tool: Discover SQL database schema via INFORMATION_SCHEMA.

SQL Pipeline — supports PostgreSQL, MySQL, and SQLite.
Returns a structured schema dict identical in shape to what profile_dataframe
produces for CSV sources, so agents can treat both identically.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from langchain_core.tools import ToolException, tool
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, inspect, text


class SQLSchemaInput(BaseModel):
    """Input schema for sql_schema_discovery tool."""
    connection_string: str = Field(
        ..., description="SQLAlchemy connection string to the target database"
    )
    schema_name: Optional[str] = Field(
        None,
        description="Database schema to introspect (default: public for PG, None for MySQL/SQLite)",
    )
    sample_rows: int = Field(
        3, description="Number of sample values to collect per column", ge=0, le=10
    )


@tool("sql_schema_discovery", args_schema=SQLSchemaInput)
def sql_schema_discovery(
    connection_string: str,
    schema_name: Optional[str] = None,
    sample_rows: int = 3,
) -> Dict[str, Any]:
    """Introspect a SQL database and return a structured schema summary.

    Discovers all tables, columns, data types, nullable flags, and sample values.
    Uses SQLAlchemy Inspector — no raw SQL injection possible.

    Returns a dict with the same shape as profile_dataframe so downstream
    agents can treat CSV and SQL schemas identically.
    """
    import hashlib
    import json
    import os
    from pathlib import Path

    # 1. Check Cache
    cache_dir = Path(".cache/schemas")
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    # Hash connection string and schema to uniquely identify this DB
    db_hash = hashlib.md5(f"{connection_string}|{schema_name}".encode()).hexdigest()
    cache_file = cache_dir / f"{db_hash}.json"
    
    # If cache exists and is fresh-ish (could add TTL logic here)
    if cache_file.exists():
        try:
            with open(cache_file, "r") as f:
                cached_data = json.load(f)
                cached_data["cached"] = True
                return cached_data
        except Exception:
            pass # Fallback to live discovery

    engine = create_engine(connection_string)
    try:
        inspector = inspect(engine)
        dialect = engine.dialect.name
        effective_schema = schema_name
        if effective_schema is None and dialect == "postgresql":
            effective_schema = "public"

        tables = inspector.get_table_names(schema=effective_schema)
        
        from concurrent.futures import ThreadPoolExecutor
        
        def fetch_table_metadata(table_name):
            """Fetch columns, PKs, FKs, RowCount and Samples for a single table."""
            # Use a fresh engine per thread for safety if needed, 
            # though SQLAlchemy engines are generally thread-safe.
            with engine.connect() as conn:
                columns = inspector.get_columns(table_name, schema=effective_schema)
                pk_constraint = inspector.get_pk_constraint(table_name, schema=effective_schema)
                pk_cols = set(pk_constraint.get("constrained_columns", []))
                
                # Foreign Keys
                fks = inspector.get_foreign_keys(table_name, schema=effective_schema)
                t_foreign_keys = []
                for fk in fks:
                    for constrained, referred in zip(fk["constrained_columns"], fk["referred_columns"]):
                        t_foreign_keys.append({
                            "from_table": table_name,
                            "from_col": constrained,
                            "to_table": fk["referred_table"],
                            "to_col": referred
                        })

                col_infos = []
                for col in columns:
                    col_info = {
                        "name": col["name"],
                        "dtype": str(col["type"]),
                        "nullable": col.get("nullable", True),
                        "primary_key": col["name"] in pk_cols,
                        "sample_values": []
                    }

                    # Collect sample values
                    if sample_rows > 0:
                        try:
                            qualified = f'"{effective_schema}"."{table_name}"' if effective_schema else f'"{table_name}"'
                            # Use conn from the outer scope's context
                            rows = conn.execute(
                                text(f"SELECT {_quoted(col['name'])} FROM {qualified} WHERE {_quoted(col['name'])} IS NOT NULL LIMIT :n"),
                                {"n": sample_rows},
                            ).fetchall()
                            col_info["sample_values"] = [str(r[0]) for r in rows]
                        except Exception:
                            pass
                    col_infos.append(col_info)

                # Row Count
                row_count = None
                try:
                    qualified = f'"{effective_schema}"."{table_name}"' if effective_schema else f'"{table_name}"'
                    row_count = conn.execute(text(f"SELECT COUNT(*) FROM {qualified}")).scalar()
                except Exception:
                    pass

                return {
                    "table": {
                        "table": table_name,
                        "schema": effective_schema,
                        "columns": col_infos,
                        "column_count": len(col_infos),
                        "row_count": row_count,
                    },
                    "fks": t_foreign_keys
                }

        # Execute discovery in parallel
        schema_tables = []
        foreign_keys = []
        total_columns = 0
        
        # CPU-bound tasks like SQL parsing/inspection benefit from threads when blocked on I/O (DB queries)
        with ThreadPoolExecutor(max_workers=min(len(tables), 10)) as executor:
            results = list(executor.map(fetch_table_metadata, tables))
            
        for res in results:
            schema_tables.append(res["table"])
            foreign_keys.extend(res["fks"])
            total_columns += len(res["table"]["columns"])

        output = {
            "dialect": dialect,
            "schema": effective_schema,
            "table_count": len(tables),
            "total_columns": total_columns,
            "tables": schema_tables,
            "foreign_keys": foreign_keys,
            "all_column_names": [
                f"{t['table']}.{c['name']}"
                for t in schema_tables
                for c in t["columns"]
            ],
        }

        # 2. Save to Cache
        try:
            with open(cache_file, "w") as f:
                json.dump(output, f)
        except Exception:
            pass

        return output

    except Exception as exc:
        raise ToolException(f"Schema discovery failed: {exc}") from exc
    finally:
        engine.dispose()


def _quoted(name: str) -> str:
    """Quote an identifier safely (no injection possible — name comes from inspector)."""
    return f'"{name}"'
