"""Guardrail Agent — validates analysis plans against system policies."""
from __future__ import annotations
import json
from typing import Any, Dict
from app.infrastructure.llm import get_llm
from app.domain.analysis.entities import AnalysisState

GUARDRAIL_PROMPT = """You are a Data Governance & Security Auditor.
Review the following analysis plan and determine if it violates any organization policies.

Policies:
{policies}

Analysis Plan:
{plan}

Columns in Data Source:
{columns}

Rules:
1. If the plan violates any policy (e.g. accessing a forbidden column, performing a restricted aggregation), you must FLAG it.
2. If flagged, provide a clear explanation for the violation.
3. If no violations are found, return 'compliant'.

Respond in JSON format:
{{
  "status": "compliant" | "violated",
  "reason": null | "..."
}}
"""

async def guardrail_agent(state: AnalysisState) -> Dict[str, Any]:
    policies = state.get("system_policies", [])
    if not policies: return {"policy_violation": None}
    llm = get_llm(temperature=0)
    plan = json.dumps(state.get("analysis_results", {}).get("plan", {}), indent=2)
    prompt = GUARDRAIL_PROMPT.format(
        policies=json.dumps(policies, indent=2),
        plan=plan,
        columns=json.dumps(state.get("relevant_columns", []), indent=2)
    )
    response = await llm.ainvoke(prompt)
    content = response.content
    try:
        if isinstance(content, str):
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0]
            parsed = json.loads(content)
        else: parsed = {"status": "compliant"}
    except: parsed = {"status": "compliant"}
    if parsed.get("status") == "violated":
        return {"policy_violation": parsed.get("reason", "Policy violation detected.")}
    return {"policy_violation": None}
