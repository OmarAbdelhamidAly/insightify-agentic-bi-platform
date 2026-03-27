"""CSV Pipeline — Insight Agent.

Generates written analysis and executive summary from CSV analysis results.
Source-agnostic logic — identical to the SQL version, both kept
separate so each pipeline folder is self-contained.
"""

from __future__ import annotations

import json
import re
import structlog
from typing import Any, Dict

logger = structlog.get_logger(__name__)

from app.infrastructure.llm import get_llm
from app.domain.analysis.entities import AnalysisState
from app.infrastructure.config import settings

INSIGHT_PROMPT = """You are a senior data analyst writing insights for business stakeholders.

Based on the analysis results, write:

1. **insight_report**: A detailed analysis in plain English (3-5 paragraphs).
   - Always quantify findings: "23% drop" not just "dropped".
   - Reference specific data points.
   - Explain the "why" behind the numbers when possible.

2. **executive_summary**: Max 3 sentences. Plain English. No jargon.
   - Lead with the headline finding.
   - Include the key number.
   - State the implication.

Respond in the following STRICT JSON format:
{{
  "insight_report": "...",
  "executive_summary": "..."
}}

STRICT JSON format only. NO PREAMBLE. NO post-explanation.

Question: {question}
Intent: {intent}
Data: {data}

{complexity_instruction}"""


async def insight_agent(state: AnalysisState) -> Dict[str, Any]:
    """Generate written analysis and executive summary from CSV results."""
    analysis = state.get("analysis_results")
    if not analysis:
        return {
            "insight_report": "No analysis data available.",
            "executive_summary": "Analysis could not be completed.",
        }

    # Extract the true analytical result from the chain
    result_payload = analysis.get("result")
    
    if result_payload is not None:
        if isinstance(result_payload, list):
            data_sample = result_payload[:10]
        elif isinstance(result_payload, dict):
            # For nested dicts (e.g. correlation_matrix), truncate inner values
            data_sample = {}
            for k, v in result_payload.items():
                if isinstance(v, dict):
                    # Truncate inner dicts to 5 keys max
                    data_sample[k] = dict(list(v.items())[:5])
                elif isinstance(v, list):
                    data_sample[k] = v[:10]
                else:
                    data_sample[k] = v
        else:
            data_sample = result_payload
    elif "dataframe" in analysis:
        data_sample = analysis["dataframe"][:10]
    else:
        # Flatten non-tabular results safely, stripping extremely verbose context
        data_sample = {k: v for k, v in analysis.items() if k not in ("plan", "source_type", "chain_outputs")}

    llm = get_llm(temperature=0)

    # Calculate complexity instructions
    idx = state.get("complexity_index", 1)
    tot = state.get("total_pills", 1)
    
    complexity_instruction = ""
    if tot > 1:
        if idx == 1:
            complexity_instruction = "TONE: Tactical & Foundational. Focus on the immediate facts."
        elif idx == tot:
            complexity_instruction = f"TONE: Strategic & Executive. Synthesis of implications."
        else:
            complexity_instruction = f"TONE: Investigative & Advanced. Dig into the 'why'."

    # Hard-cap the serialized data to prevent token overruns (Groq 6K TPM limit)
    data_str = json.dumps(data_sample, indent=2, default=str)
    MAX_DATA_CHARS = 3000  # ~750 tokens, leaves room for prompt + response
    if len(data_str) > MAX_DATA_CHARS:
        data_str = data_str[:MAX_DATA_CHARS] + '\n... [truncated for brevity]'

    prompt = INSIGHT_PROMPT.format(
        question=state.get("question", ""),
        intent=state.get("intent", "comparison"),
        data=data_str,
        complexity_instruction=complexity_instruction
    )

    try:
        res = await llm.ainvoke(prompt)
        content = res.content
        
        parsed = _parse_json(content)
        
        if not parsed:
            logger.warning("csv_insight_parsing_failed", content=content)
            return {
                "insight_report": "Analysis was performed but the narrative report could not be formatted.",
                "executive_summary": "Technical error during summary generation.",
            }

        return {
            "insight_report": parsed.get("insight_report", "Analysis completed."),
            "executive_summary": parsed.get("executive_summary", "See detailed report."),
        }
    except Exception as e:
        logger.error("csv_insight_generation_failed", error=str(e))
        return {
            "insight_report": "Analysis was performed but insight generation encountered an error.",
            "executive_summary": "Results are available in chart form.",
        }


def _parse_json(content: Any) -> Dict[str, Any]:
    """Ultra-resilient JSON parser for LLM responses."""
    if not isinstance(content, str) or not content.strip():
        return {}

    content = content.strip()
    
    start_idx = content.find('{')
    end_idx = content.rfind('}')
    
    if start_idx == -1 or end_idx == -1:
        return {}

    json_str = content[start_idx : end_idx + 1]

    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        pass

    try:
        # Aggressive cleanup: remove trailing commas and control characters
        cleaned = re.sub(r',\s*([\]}])', r'\1', json_str)
        cleaned = re.sub(r'[\x00-\x1F\x7F]', '', cleaned)
        return json.loads(cleaned)
    except Exception:
        pass

    return {}
