"""JSON Pipeline — Basic LangGraph.

intake → json_analysis → insight → output_assembler → END
"""
from typing import Any, Dict
from langgraph.graph import END, StateGraph, START
from app.domain.analysis.entities import AnalysisState
from app.modules.shared.agents.output_assembler import output_assembler
from app.modules.json.agents.json_agent import json_analysis_agent

def build_json_graph(checkpointer: Any = None) -> Any:
    """Construct a basic JSON analysis pipeline."""
    graph = StateGraph(AnalysisState)

    # Add nodes
    graph.add_node("json_analysis", json_analysis_agent)
    graph.add_node("output_assembler", output_assembler)

    # Setup flow
    graph.add_edge(START, "json_analysis")
    graph.add_edge("json_analysis", "output_assembler")
    graph.add_edge("output_assembler", END)

    return graph.compile(checkpointer=checkpointer)
