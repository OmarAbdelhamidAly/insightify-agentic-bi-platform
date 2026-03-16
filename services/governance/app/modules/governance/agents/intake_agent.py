"""Intake agent — parses the user's question, determines intent and relevant columns."""
from __future__ import annotations
import json
from typing import Any, Dict
from app.infrastructure.llm import get_llm
from app.domain.analysis.entities import AnalysisState

INTAKE_PROMPT = """You are an intake analyst for a data analysis platform.
Given a user's question, a data source schema, and a dictionary of business metrics, determine:
1. **intent**: One of: trend, comparison, ranking, correlation, anomaly
2. **relevant_columns**: List of column names from the schema that are relevant
3. **time_range**: If temporal, specify the range (e.g., "last 2 years"), else null
4. **clarification_needed**: If the question is ambiguous, ask for clarification, else null

Respond in JSON format:
{{
  "intent": "...",
  "relevant_columns": ["col1", "col2"],
  "time_range": null,
  "clarification_needed": null
}}

Business Metrics Dictionary:
{metrics}

Schema:
{schema}

User Question: {question}"""

async def intake_agent(state: AnalysisState) -> Dict[str, Any]:
    llm = get_llm(temperature=0)
    schema_str = json.dumps(state.get("schema_summary", {}), indent=2)
    metrics_str = json.dumps(state.get("business_metrics", []), indent=2)
    prompt = INTAKE_PROMPT.format(metrics=metrics_str, schema=schema_str, question=state["question"])
    response = await llm.ainvoke(prompt)
    content = response.content
    try:
        if isinstance(content, str):
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0]
            parsed = json.loads(content)
        else: parsed = {}
    except: parsed = {}
    return {
        "intent": parsed.get("intent", "comparison"),
        "relevant_columns": parsed.get("relevant_columns", []),
        "time_range": parsed.get("time_range"),
        "clarification_needed": parsed.get("clarification_needed"),
    }
