"""Governance Workflow — The 3 Core Pillars: Intake, Metrics, and Guardrails."""
from __future__ import annotations
from typing import Any, Dict, Literal
from langgraph.graph import StateGraph, START, END
from app.domain.analysis.entities import AnalysisState
from .agents.intake_agent import intake_agent
from .agents.guardrail_agent import guardrail_agent
from langgraph.checkpoint.redis import AsyncRedisSaver
import redis.asyncio as redis
from app.infrastructure.config import settings

def get_governance_pipeline(checkpointer: Any = None):
    """Factory to build and compile the governance graph fresh for each task loop."""
    graph = build_governance_graph_logic()
    return graph.compile(checkpointer=checkpointer)

def build_governance_graph_logic() -> StateGraph:
    graph = StateGraph(AnalysisState)
    
    graph.add_node("intake", intake_agent)
    graph.add_node("guardrail", guardrail_agent)
    
    graph.add_edge(START, "intake")
    
    def check_intake(state: AnalysisState) -> Literal["guardrail", "clarify"]:
        if state.get("clarification_needed"):
            return "clarify"
        return "guardrail"
        
    graph.add_conditional_edges("intake", check_intake, {
        "guardrail": "guardrail",
        "clarify": END
    })
    
    graph.add_edge("guardrail", END)
    return graph
