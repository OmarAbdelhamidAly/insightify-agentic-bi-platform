"""SQL Pipeline — Visualization Agent.

Generates Plotly chart JSON based on SQL analysis results.
Source-agnostic logic — identical to the CSV version, both kept
separate so each pipeline folder is self-contained.
"""

from __future__ import annotations

import json
from typing import Any, Dict

from app.infrastructure.llm import get_llm

from app.domain.analysis.entities import AnalysisState
from app.infrastructure.config import settings

VIZ_PROMPT = """You are a data visualization expert. Based on the analysis results and intent,
create a Plotly chart specification as JSON.

Chart selection rules:
- trend over time → line chart (type: "scatter", mode: "lines")
- comparison by category → bar chart (type: "bar")
- correlation 2 metrics → scatter plot (type: "scatter", mode: "markers")
- part-to-whole → pie chart (type: "pie")
- value distribution → histogram (type: "histogram")
- correlation matrix → heatmap (type: "heatmap")

CRITICAL STYLING REQUIREMENTS:
The application uses a dark glassmorphism UI. You MUST include these properties in the `layout` to match:
- `paper_bgcolor: "rgba(0,0,0,0)"` (fully transparent)
- `plot_bgcolor: "rgba(0,0,0,0)"` (fully transparent)
- `font: {{ "color": "#F1F5F9" }}` (light text)
- `margin: {{ "t": 40, "b": 40, "l": 40, "r": 20 }}`

Respond with a valid Plotly JSON figure with "data" and "layout" keys.
Use professional, vibrant colors like #6366f1, #ec4899, #14b8a6. Include title, axis labels, and hover info.

Intent: {intent}
Question: {question}
Data columns: {columns}
Sample data (first 10 rows): {data}"""


async def visualization_agent(state: AnalysisState) -> Dict[str, Any]:
    """Generate a Plotly chart JSON from SQL analysis results."""
    analysis = state.get("analysis_results") or {}
    if not analysis or not analysis.get("data"):
        return {"chart_json": None}

    llm = get_llm(temperature=0)

    data_sample = analysis["data"][:10]
    prompt = VIZ_PROMPT.format(
        intent=state.get("intent", "comparison"),
        question=state.get("question", ""),
        columns=json.dumps(analysis.get("columns", [])),
        data=json.dumps(data_sample, indent=2, default=str),
    )

    try:
        response = await llm.ainvoke(prompt)
        content = response.content

        if isinstance(content, str):
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1]
                content = content.rsplit("```", 1)[0]
            chart_json = json.loads(content)
        else:
            chart_json = None

        return {"chart_json": chart_json}
    except Exception:
        # Fallback: robust multi-strategy generation
        data = analysis["data"]
        columns = analysis.get("columns", [])
        
        if not columns or not data:
            return {"chart_json": None}

        # Strategy A: Multi-column chart (Trend/Bar)
        if len(columns) >= 2:
            return {"chart_json": {
                "data": [{
                    "type": "bar",
                    "x": [str(row.get(columns[0], "")) for row in data],
                    "y": [row.get(columns[1], 0) for row in data],
                    "marker": {"color": "#6366f1"},
                }],
                "layout": {
                    "title": {"text": state.get("question", "Analysis Results"), "font": {"color": "#F1F5F9"}},
                    "xaxis": {"title": {"text": columns[0]}, "color": "#F1F5F9"},
                    "yaxis": {"title": {"text": columns[1]}, "color": "#F1F5F9"},
                    "paper_bgcolor": "rgba(0,0,0,0)",
                    "plot_bgcolor": "rgba(0,0,0,0)",
                    "font": {"color": "#F1F5F9"},
                    "margin": {"t": 40, "b": 40, "l": 40, "r": 20},
                },
            }}
            
        # Strategy B: Single-value indicator (e.g. Total Count)
        if len(columns) == 1:
            val = data[0].get(columns[0], "N/A")
            return {"chart_json": {
                "data": [{
                    "type": "indicator",
                    "mode": "number+delta" if isinstance(val, (int, float)) else "number",
                    "value": val if isinstance(val, (int, float)) else 0,
                    "title": {"text": columns[0], "font": {"size": 24, "color": "#F1F5F9"}},
                    "number": {"font": {"size": 64, "color": "#6366f1"}},
                    "domain": {"x": [0, 1], "y": [0, 1]}
                }],
                "layout": {
                    "paper_bgcolor": "rgba(0,0,0,0)",
                    "plot_bgcolor": "rgba(0,0,0,0)",
                    "margin": {"t": 0, "b": 0, "l": 0, "r": 0},
                    "height": 250
                }
            }}

        return {"chart_json": None}
