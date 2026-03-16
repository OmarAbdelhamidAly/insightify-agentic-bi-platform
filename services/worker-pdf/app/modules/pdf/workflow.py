"""PDF Pipeline — Advanced Visual RAG with ColPali.

colpali_retrieval → output_assembler → END
"""
from typing import Any, Dict
from langgraph.graph import END, StateGraph, START
from app.domain.analysis.entities import AnalysisState
from app.modules.shared.agents.output_assembler import output_assembler
from app.modules.pdf.agents.pdf_agent import colpali_retrieval_agent

def build_pdf_graph(checkpointer: Any = None) -> Any:
    """Construct an advanced PDF analysis pipeline using ColPali retrieval."""
    graph = StateGraph(AnalysisState)

    # Add nodes
    graph.add_node("colpali_retrieval", colpali_retrieval_agent)
    graph.add_node("output_assembler", output_assembler)

    # Setup flow
    graph.add_edge(START, "colpali_retrieval")
    graph.add_edge("colpali_retrieval", "output_assembler")
    graph.add_edge("output_assembler", END)

    return graph.compile(checkpointer=checkpointer)
