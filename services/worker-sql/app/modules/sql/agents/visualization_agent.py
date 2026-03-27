import json
import re
import structlog
from typing import Any, Dict

logger = structlog.get_logger(__name__)

from app.infrastructure.llm import get_llm
from app.domain.analysis.entities import AnalysisState

PLOTLY_VIZ_PROMPT = """You are a Principal Data Scientist and Lead Visualization Architect.
Your core directive is to automatically configure premium, highly-insightful Plotly charts for analytical data.

### CHART INTELLIGENCE & SELECTION HEURISTICS
You MUST choose the single MOST statistically powerful chart to answer the user's question, applying these rules:
- **Time-Series / Trends**: Use "scatter" with mode="lines" or "lines+markers".
- **Categorical Comparisons**: Use "bar" charts.
- **Part-to-Whole / Hierarchies**: Use "pie".
- **Outliers & Correlations**: Use "scatter" with mode="markers".

### EXECUTION DIRECTIVES
You MUST output a strict JSON object containing TWO keys: "data" and "layout".
The "data" must be an array of Plotly trace mapping objects.
Because datasets are large, you MUST NOT include the raw data arrays. Instead, provide the EXACT COLUMN NAMES from the schema as "x_col", "y_col", "labels_col", or "values_col".
Our engine will automatically extract these columns from the dataset and dynamically populate the actual 'x', 'y', 'labels', and 'values' arrays.

Example for Bar/Line/Scatter:
{{
  "data": [
    {{
      "x_col": "category",
      "y_col": "sales",
      "type": "bar",
      "name": "Sales",
      "marker": {{ "color": "#0ea5e9" }}
    }}
  ],
  "layout": {{ 
    "title": "Sales by Category",
    "xaxis": {{ "title": "Category" }},
    "yaxis": {{ "title": "Sales" }}
  }}
}}

Example for Pie:
{{
  "data": [
    {{
      "labels_col": "region",
      "values_col": "revenue",
      "type": "pie",
      "hole": 0.4
    }}
  ],
  "layout": {{ "title": "Revenue Distribution" }}
}}

CRITICAL RULES:
- NEVER fabricate column names. They MUST correspond verbatim to the Columns provided below.
- Return ONLY a valid JSON object.
- NO markdown formatting (no ```json). NO explanation. NO preamble.

**Query Result Summary**:
Intent: {intent}
Question: {question}
SQL Query Generated: {sql}
Columns: {columns}
Stochastic Data Sample: {data}
"""

def _inject_plotly_data(chart_config: dict, dataset: list) -> dict:
    """Hydrates the Plotly trace definitions with actual dataset arrays."""
    if "data" not in chart_config or not isinstance(chart_config["data"], list):
        return chart_config
        
    for trace in chart_config["data"]:
        if "x_col" in trace:
            col = trace.pop("x_col")
            trace["x"] = [row.get(col) for row in dataset]
        if "y_col" in trace:
            col = trace.pop("y_col")
            trace["y"] = [row.get(col) for row in dataset]
        if "labels_col" in trace:
            col = trace.pop("labels_col")
            trace["labels"] = [row.get(col) for row in dataset]
        if "values_col" in trace:
            col = trace.pop("values_col")
            trace["values"] = [row.get(col) for row in dataset]
            
    return chart_config

async def visualization_agent(state: AnalysisState) -> Dict[str, Any]:
    """Generate a Plotly Chart dynamically for SQL data."""
    analysis = state.get("analysis_results") or {}
    dataset = analysis.get("data")
    if not analysis or not dataset:
        return {"chart_json": None}

    llm = get_llm(temperature=0)
    data_sample = dataset[:5]
    
    prompt = PLOTLY_VIZ_PROMPT.format(
        intent=state.get("intent", "comparison"),
        question=state.get("question", ""),
        sql=state.get("generated_sql", ""),
        columns=json.dumps(analysis.get("columns", [])),
        data=json.dumps(data_sample, indent=2, default=str),
    )

    content = None
    try:
        response = await llm.ainvoke(prompt)
        content = response.content
        chart_config = _parse_json(content)

        if not chart_config or "data" not in chart_config or "layout" not in chart_config:
            logger.warning("invalid_plotly_config", content=content)
            # Fallback barebones table interpretation or empty
            return {"chart_json": None, "error": "Invalid Plotly schema."}
            
        # Hydrate the data into the chart config
        hydrated_config = _inject_plotly_data(chart_config, dataset)

        return {
            "chart_json": hydrated_config, 
            "chart_engine": "plotly"
        }

    except Exception as e:
        logger.error("sql_plotly_failed", error=str(e), content=content)
        return {"chart_json": None, "error": f"Plotly rendering failed: {e}"}

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
        cleaned = re.sub(r',\s*([\]}])', r'\1', json_str)
        cleaned = re.sub(r'[\x00-\x1F\x7F]', '', cleaned)
        return json.loads(cleaned)
    except Exception:
        pass
    return {}
