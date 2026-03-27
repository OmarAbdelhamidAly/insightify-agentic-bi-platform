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
- **Part-to-Whole / Hierarchies**: Use "pie" (set hole=0.4 for donut style).
- **Outliers & Correlations (2 numeric vars)**: Use "scatter" with mode="markers".
- **Distribution of a single variable**: Use "histogram".
- **Compare distributions across groups**: Use "box".
- **Matrix / Cross-tabulations**: Use "heatmap".
- **Hierarchical breakdowns**: Use "treemap".
- **Sequential stages / Conversion**: Use "funnel".

### COLUMN MAPPING PROTOCOL
Because datasets are large, you MUST NOT include raw data arrays. Instead, provide EXACT COLUMN NAMES from the schema using these mapping keys. Our engine will automatically hydrate the actual values:

| Chart Type | Required Mappings |
|---|---|
| bar, scatter, line | "x_col", "y_col" |
| pie | "labels_col", "values_col" |
| histogram | "x_col" (single column to bin) |
| box | "x_col" (group), "y_col" (values) |
| heatmap | "x_col", "y_col", "z_col" (intensity matrix) |
| treemap | "labels_col", "parents_col", "values_col" |
| funnel | "x_col" (values), "y_col" (stage names) |

### EXAMPLES

Bar/Line/Scatter:
{{
  "data": [{{
    "x_col": "category", "y_col": "sales",
    "type": "bar", "name": "Sales",
    "marker": {{ "color": "#0ea5e9" }}
  }}],
  "layout": {{ "title": "Sales by Category", "xaxis": {{ "title": "Category" }}, "yaxis": {{ "title": "Sales" }} }}
}}

Pie:
{{
  "data": [{{
    "labels_col": "region", "values_col": "revenue",
    "type": "pie", "hole": 0.4
  }}],
  "layout": {{ "title": "Revenue Distribution" }}
}}

Histogram:
{{
  "data": [{{
    "x_col": "age", "type": "histogram",
    "marker": {{ "color": "#8b5cf6" }}, "nbinsx": 20
  }}],
  "layout": {{ "title": "Age Distribution", "xaxis": {{ "title": "Age" }}, "yaxis": {{ "title": "Count" }} }}
}}

Box Plot:
{{
  "data": [{{
    "x_col": "department", "y_col": "salary",
    "type": "box"
  }}],
  "layout": {{ "title": "Salary by Department" }}
}}

Heatmap:
{{
  "data": [{{
    "z_col": "value", "x_col": "col_x", "y_col": "col_y",
    "type": "heatmap", "colorscale": "Viridis"
  }}],
  "layout": {{ "title": "Correlation Heatmap" }}
}}

CRITICAL RULES:
- NEVER fabricate column names. They MUST correspond verbatim to the Columns provided below.
- Return ONLY a valid JSON object.
- NO markdown formatting (no ```json). NO explanation. NO preamble.

**Query Result Summary**:
Intent: {intent}
Question: {question}
Columns: {columns}
Stochastic Data Sample: {data}
"""

def _inject_plotly_data(chart_config: dict, dataset: list) -> dict:
    """Hydrates the Plotly trace definitions with actual dataset arrays.
    Supports: bar, scatter, line, pie, histogram, box, heatmap, treemap, funnel."""
    if "data" not in chart_config or not isinstance(chart_config["data"], list):
        return chart_config
        
    for trace in chart_config["data"]:
        # Standard X/Y mapping (bar, scatter, line, histogram, box, funnel)
        if "x_col" in trace:
            col = trace.pop("x_col")
            trace["x"] = [row.get(col) for row in dataset]
        if "y_col" in trace:
            col = trace.pop("y_col")
            trace["y"] = [row.get(col) for row in dataset]
        
        # Pie / Treemap mappings
        if "labels_col" in trace:
            col = trace.pop("labels_col")
            trace["labels"] = [row.get(col) for row in dataset]
        if "values_col" in trace:
            col = trace.pop("values_col")
            trace["values"] = [row.get(col) for row in dataset]
        
        # Treemap parent mapping
        if "parents_col" in trace:
            col = trace.pop("parents_col")
            trace["parents"] = [row.get(col, "") for row in dataset]
        
        # Heatmap Z matrix mapping
        if "z_col" in trace:
            col = trace.pop("z_col")
            # Build a 2D z-matrix from the flat records
            x_vals = trace.get("x", [])
            y_vals = trace.get("y", [])
            if x_vals and y_vals:
                unique_x = list(dict.fromkeys(x_vals))  # preserve order
                unique_y = list(dict.fromkeys(y_vals))
                z_matrix = [[0] * len(unique_x) for _ in range(len(unique_y))]
                for row in dataset:
                    xi = unique_x.index(row.get(trace.get("_x_orig", list(row.keys())[0] if row else ""))) if row else 0
                    yi = unique_y.index(row.get(trace.get("_y_orig", list(row.keys())[1] if len(row) > 1 else ""))) if row else 0
                    try:
                        z_matrix[yi][xi] = row.get(col, 0) or 0
                    except (IndexError, ValueError):
                        pass
                trace["z"] = z_matrix
                trace["x"] = unique_x
                trace["y"] = unique_y
            else:
                # Fallback: just extract z as flat array
                trace["z"] = [[row.get(col, 0) for row in dataset]]
        
        # Text/hover mapping
        if "text_col" in trace:
            col = trace.pop("text_col")
            trace["text"] = [row.get(col) for row in dataset]
            
    return chart_config

async def visualization_agent(state: AnalysisState) -> Dict[str, Any]:
    """Generate a Plotly Chart dynamically for CSV data."""
    analysis = state.get("analysis_results") or {}
    
    result_payload = analysis.get("result")
    
    # Use the computed analytical result if it's tabular
    if isinstance(result_payload, list):
        dataset = result_payload
    elif isinstance(result_payload, dict):
        # Check if this is a simple scalar dict (e.g. {"average": 42.5}) vs a complex/nested one
        has_complex_values = any(
            isinstance(v, (dict, list)) for v in result_payload.values()
        )
        all_scalar = all(
            isinstance(v, (int, float, str, bool, type(None))) for v in result_payload.values()
        )
        
        if all_scalar and len(result_payload) <= 3:
            # Pure scalar aggregate (e.g. avg=42.5, correlation=0.85) — suppress chart
            return {"chart_json": None}
        elif has_complex_values:
            # Nested dict (distribution, correlation_matrix) — flatten for visualization
            records = []
            for k, v in result_payload.items():
                if isinstance(v, dict):
                    for inner_k, inner_v in v.items():
                        records.append({"category": str(k), "label": str(inner_k), "value": inner_v})
                elif isinstance(v, list):
                    for item in v[:20]:
                        if isinstance(item, dict):
                            records.append(item)
                        else:
                            records.append({"category": str(k), "value": item})
                else:
                    records.append({"category": str(k), "value": v})
            dataset = records[:50]  # Cap at 50 records for token safety
        else:
            # Simple multi-key dict (e.g. {col1: val1, col2: val2}) — convert to bar-friendly format
            dataset = [{"name": str(k), "value": v} for k, v in result_payload.items()]
    elif isinstance(result_payload, (int, float, str)):
        return {"chart_json": None}
    else:
        # Fallback to the raw dataframe state ONLY if no explicit result was yielded (like drop_nulls mutation)
        dataset = analysis.get("dataframe")

    if not dataset or not isinstance(dataset, list) or len(dataset) == 0:
        return {"chart_json": None}
        
    # Skip chart generation if dataset is too small to visualize meaningfully (e.g. single scalar wrapped in array)
    if len(dataset) == 1 and isinstance(dataset[0], dict) and len(dataset[0]) <= 1:
        return {"chart_json": None}

    llm = get_llm(temperature=0)
    data_sample = dataset[:5]
    
    dataset_columns = analysis.get("columns")
    if not dataset_columns and dataset and isinstance(dataset[0], dict):
        dataset_columns = list(dataset[0].keys())

    # ── Deterministic Chart Hints ───────────────────────────────────────────
    # Map each analytical function to the most appropriate chart type.
    # This overrides the LLM's free choice, forcing accuracy.
    CHART_HINTS = {
        # EDA
        "distribution_analysis": "Use type='bar'. X axis = bin/category column, Y axis = count column. Title should mention 'Distribution'.",
        "summary_stats": "Use type='bar'. Show each statistic as a bar. X = statistic name, Y = value.",
        "outlier_detection": "Use type='scatter' with mode='markers'. Highlight outlier points.",
        "missing_values": "Use type='bar'. X = column name, Y = missing_count or missing_pct.",
        # Aggregation
        "groupby": "Use type='bar'. X = group column, Y = aggregated value column.",
        "sum": "Use type='bar'. X = column name, Y = sum value.",
        "avg": "Use type='bar'. X = column name, Y = average value.",
        # Statistical
        "correlation": "Use type='scatter' with mode='markers'. X and Y are the two correlated columns. Add a trendline if possible.",
        "correlation_matrix": "Use type='heatmap'. X and Y are column names, Z is the correlation coefficient.",
        "variance": "Use type='bar'. X = column name, Y = variance value.",
        "std_dev": "Use type='bar'. X = column name, Y = standard deviation value.",
        # Time Series
        "trend_analysis": "Use type='scatter' with mode='lines+markers'. X = date/period, Y = value. Show the trend clearly.",
        "moving_average": "Use type='scatter' with mode='lines'. Show both raw and moving average lines.",
        "growth_rate": "Use type='scatter' with mode='lines+markers'. X = date, Y = growth percentage.",
        "volatility": "Use type='bar'. Show volatility metrics.",
        "forecasting": "Use type='scatter' with mode='lines'. Show forecast with confidence bands if available.",
        # Diagnostic
        "segmentation": "Use type='pie' with hole=0.4. Labels = segment names, Values = segment counts.",
        "contribution_analysis": "Use type='pie' with hole=0.4. Labels = category, Values = contribution percentage.",
        "drill_down": "Use type='bar'. Group by primary and secondary categories.",
        "cohort_analysis": "Use type='scatter' with mode='lines+markers'. X = cohort period, Y = metric value.",
        # Predictive
        "clustering": "Use type='scatter' with mode='markers'. Color by cluster group.",
        "linear_regression": "Use type='scatter' with mode='markers'. Show data points and regression line.",
        "random_forest": "Use type='bar'. X = feature name, Y = feature importance score.",
        "classification": "Use type='bar'. Show accuracy or class distribution.",
        # Prescriptive
        "scenario_analysis": "Use type='bar'. Compare original vs simulated values side by side.",
        "what_if_analysis": "Use type='bar'. Compare baseline vs scenario statistics.",
    }

    # Extract the function name from the analysis metadata
    func_name = ""
    metadata = analysis.get("metadata", {})
    if isinstance(metadata, dict):
        func_name = metadata.get("function", "")
    
    chart_hint = CHART_HINTS.get(func_name, "")
    hint_instruction = ""
    if chart_hint:
        hint_instruction = f"\n\n**MANDATORY CHART DIRECTIVE** (you MUST follow this):\nThe analytical function used was `{func_name}`. {chart_hint}\n"

    prompt = PLOTLY_VIZ_PROMPT.format(
        intent=state.get("intent", "comparison"),
        question=state.get("question", ""),
        columns=json.dumps(dataset_columns or []),
        data=json.dumps(data_sample, indent=2, default=str),
    ) + hint_instruction

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

        # ── Post-Processing: Guarantee axis labels & chart title ─────────
        layout = hydrated_config.setdefault("layout", {})
        
        # Auto-generate chart title from question if LLM didn't provide one
        question = state.get("question", "")
        if not layout.get("title"):
            title_text = question.strip().capitalize() if question else f"{func_name.replace('_', ' ').title()} Analysis"
            layout["title"] = title_text
        
        # Auto-label axes from the actual column names used in traces
        for trace in hydrated_config.get("data", []):
            trace_type = trace.get("type", "bar")
            
            if trace_type not in ("pie", "treemap"):
                # Infer X axis label
                xaxis = layout.setdefault("xaxis", {})
                if not xaxis.get("title"):
                    if "x" in trace and dataset and isinstance(dataset[0], dict):
                        # Find the column key that produced the x values
                        x_label = next((k for k in dataset[0].keys() if k not in ("value", "count")), None)
                        if x_label:
                            xaxis["title"] = x_label.replace("_", " ").title()
                
                # Infer Y axis label
                yaxis = layout.setdefault("yaxis", {})
                if not yaxis.get("title"):
                    if "y" in trace and dataset and isinstance(dataset[0], dict):
                        keys = list(dataset[0].keys())
                        y_label = keys[-1] if len(keys) > 1 else keys[0]
                        yaxis["title"] = y_label.replace("_", " ").title()
            break  # Only process the first trace for labels

        return {
            "chart_json": hydrated_config, 
            "chart_engine": "plotly"
        }

    except Exception as e:
        logger.error("csv_plotly_failed", error=str(e), content=content)
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
