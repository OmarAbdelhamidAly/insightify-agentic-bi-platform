"""CSV Pipeline — LangGraph StateGraph.

Wires the complete CSV pipeline:
  intake → [clarify?] → data_discovery → [clean?] → analysis
  → [retry?] → visualization → insight → recommendation → output_assembler → END
"""

from __future__ import annotations

from typing import Any, Dict, Literal

from langgraph.graph import END, StateGraph

from langgraph.checkpoint.redis import AsyncRedisSaver
import redis.asyncio as redis
from app.infrastructure.config import settings
from app.domain.analysis.entities import AnalysisState
from app.modules.shared.agents.output_assembler import output_assembler
from app.modules.csv.agents.data_discovery_agent import data_discovery_agent
from app.modules.csv.agents.data_cleaning_agent import data_cleaning_agent
from app.modules.csv.agents.analysis_agent import analysis_agent
from app.modules.csv.agents.visualization_agent import visualization_agent
from app.modules.csv.agents.insight_agent import insight_agent
from app.modules.csv.agents.recommendation_agent import recommendation_agent


# ── Conditional Edge Functions ─────────────────────────────────────────────────

# Governance has been moved to a separate microservice layer.


def needs_cleaning(state: AnalysisState) -> Literal["clean", "analyze"]:
    """Route to cleaning if data quality is below 0.9."""
    quality = state.get("data_quality_score", 1.0)
    if quality < 0.9:
        return "clean"
    return "analyze"


def should_retry(state: AnalysisState) -> Literal["retry", "visualize"]:
    """Route back to analysis on error (up to 3 retries)."""
    if state.get("error") and state.get("retry_count", 0) <= 3:
        return "retry"
    return "visualize"


# ── Build the Graph ────────────────────────────────────────────────────────────

def build_csv_graph(checkpointer: Any = None) -> Any:
    """Construct and compile the CSV LangGraph analysis pipeline.

    CSV-specific flow includes a data cleaning step (skipped for SQL).
    """
    graph = StateGraph(AnalysisState)

    # Add nodes
    graph.add_node("data_discovery", data_discovery_agent)
    graph.add_node("data_cleaning", data_cleaning_agent)
    graph.add_node("analysis", analysis_agent)
    graph.add_node("visualization", visualization_agent)
    graph.add_node("insight", insight_agent)
    graph.add_node("recommendation", recommendation_agent)
    graph.add_node("output_assembler", output_assembler)

    # Entry point is Discovery
    graph.set_entry_point("data_discovery")

    # Logic moved to governance layer

    # data_discovery → conditional: clean or analyze (CSV only — SQL always goes to analyze)
    graph.add_conditional_edges(
        "data_discovery",
        needs_cleaning,
        {
            "clean": "data_cleaning",
            "analyze": "analysis",
        },
    )

    # data_cleaning → analysis
    graph.add_edge("data_cleaning", "analysis")

    # analysis → visualization
    graph.add_edge("analysis", "visualization")

    # visualization → insight → recommendation → output_assembler → END
    graph.add_edge("visualization", "insight")
    graph.add_edge("insight", "recommendation")
    graph.add_edge("recommendation", "output_assembler")
    graph.add_edge("output_assembler", END)

    return graph.compile(checkpointer=checkpointer)
