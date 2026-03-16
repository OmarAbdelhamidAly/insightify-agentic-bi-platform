from __future__ import annotations
import re
from typing import Any, Dict, List, Set


class SemanticSchemaSelector:
    """Filters large database schemas to only relevant tables for a given query.

    Uses heuristic-based semantic matching + multi-hop FK expansion to ensure
    all tables needed for JOINs are always included.
    """

    @staticmethod
    def select_tables(schema_summary: Dict[str, Any], query: str, top_k: int = 10) -> Dict[str, Any]:
        """Return a filtered version of the schema summary.

        Steps:
        1. Exact/Partial match on table and column names against query terms.
        2. 2-hop FK expansion to include bridge/intersection tables.
        3. Fallback to full schema if nothing is selected.
        """
        if not schema_summary.get("tables") or len(schema_summary["tables"]) <= top_k:
            return schema_summary

        query_terms = set(re.findall(r"\w+", query.lower()))
        all_fks = schema_summary.get("foreign_keys", [])
        selected_table_names: Set[str] = set()

        # Phase 1: Direct semantic match on table names and column names
        for t in schema_summary["tables"]:
            t_name = t["table"].lower()
            if any(term in t_name for term in query_terms):
                selected_table_names.add(t["table"])
                continue
            for c in t["columns"]:
                c_name = c["name"].lower()
                if any(term == c_name or term in c_name for term in query_terms):
                    selected_table_names.add(t["table"])
                    break

        # Phase 2: Multi-hop FK expansion (2 hops)
        # This ensures bridge/intersection tables are never dropped.
        # Example: Customer selected → Invoice added (hop 1) → InvoiceLine added (hop 2)
        for _hop in range(2):
            expansion: Set[str] = set()
            for fk in all_fks:
                if fk["from_table"] in selected_table_names:
                    expansion.add(fk["to_table"])
                if fk["to_table"] in selected_table_names:
                    expansion.add(fk["from_table"])
            selected_table_names.update(expansion)

        # Reconstruct filtered summary preserving original table order
        filtered_tables = [t for t in schema_summary["tables"] if t["table"] in selected_table_names]

        # Fallback: if nothing was matched, return entire schema
        if not filtered_tables:
            return schema_summary

        return {
            **schema_summary,
            "tables": filtered_tables,
            "filtered": True,
            "original_table_count": len(schema_summary["tables"]),
            "selected_tables": list(selected_table_names),
        }


schema_selector = SemanticSchemaSelector()
