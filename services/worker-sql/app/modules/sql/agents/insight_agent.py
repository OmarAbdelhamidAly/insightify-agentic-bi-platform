"""SQL Pipeline — Insight Agent.

Generates written analysis and executive summary from SQL analysis results.
Source-agnostic logic — identical to the CSV version, both kept
separate so each pipeline folder is self-contained.
"""

from __future__ import annotations

import json
from typing import Any, Dict

from app.infrastructure.llm import get_llm

from app.domain.analysis.entities import AnalysisState
from app.infrastructure.config import settings

INSIGHT_PROMPT = """You are a senior data analyst writing insights for business stakeholders.

Based on the analysis results and supplemental knowledge base context, write:

1. **insight_report**: A detailed analysis in plain English (3-5 paragraphs).
   - Always quantify findings: "23% drop" not just "dropped".
   - Reference specific data points.
   - **Hybrid Reasoning**: If Knowledge Base context is provided, cross-reference the numbers with the policies/guidelines found in the context.

2. **executive_summary**: Max 3 sentences. Plain English. No jargon.
   - Lead with the headline finding.
   - Include the key number.
   - State the implication.

Respond in JSON format:
{{
  "insight_report": "...",
  "executive_summary": "..."
}}

Question: {question}
Intent: {intent}
Knowledge Base Context: {kb_context}
Data: {data}

{complexity_instruction}"""


async def insight_agent(state: AnalysisState) -> Dict[str, Any]:
    """Generate written analysis and executive summary from SQL results."""
    analysis = state.get("analysis_results") or {}
    if not analysis:
        error_msg = state.get("error") or "No analysis data available."
        return {
            "insight_report": f"Analysis could not be completed. Details: {error_msg}",
            "executive_summary": "Analysis could not be completed.",
        }

    llm = get_llm(temperature=0.3)

    # Calculate complexity instructions (Idea: Dynamic tone)
    idx = state.get("complexity_index", 1)
    tot = state.get("total_pills", 1)
    
    complexity_instruction = ""
    if tot > 1:
        if idx == 1:
            complexity_instruction = "TONE: Tactical & Foundational. Focus on the immediate facts. Keep the analysis grounded in the specific numbers provided."
        elif idx == tot:
            complexity_instruction = f"TONE: Strategic & Executive. This is the master insight (level {idx}). Provide a high-level summary that synthesizes the implications for the business. Focus on ROI, growth, or risk."
        else:
            complexity_instruction = f"TONE: Investigative & Advanced. Dig into the 'why'. Look for second-order effects or trends that are not immediately obvious at first glance."

    prompt = INSIGHT_PROMPT.format(
        question=state.get("question") or "",
        intent=state.get("intent") or "comparison",
        kb_context=analysis.get("kb_context") or "None provided.",
        data=json.dumps(analysis.get("data", [])[:20], indent=2, default=str),
        complexity_instruction=complexity_instruction
    )

    try:
        response = await llm.ainvoke(prompt)
        content = response.content

        if isinstance(content, str):
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1]
                content = content.rsplit("```", 1)[0]
            parsed = json.loads(content)
        else:
            parsed = {}

        return {
            "insight_report": parsed.get("insight_report", "Analysis completed."),
            "executive_summary": parsed.get("executive_summary", "See detailed report."),
        }
    except Exception:
        return {
            "insight_report": "Analysis was performed but insight generation encountered an error.",
            "executive_summary": "Results are available in chart form.",
        }
