"""JSON Analysis Agent — Basic Implementation."""
import json
import os
from typing import Any, Dict
from app.domain.analysis.entities import AnalysisState
from app.infrastructure.llm import llm

async def json_analysis_agent(state: AnalysisState) -> Dict[str, Any]:
    """Analyzes JSON data and generates a basic report."""
    file_path = state.get("file_path")
    question = state.get("question")
    
    if not file_path or not os.path.exists(file_path):
        return {"error": f"JSON file not found at {file_path}"}
        
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # Sample data if too large for LLM context
        data_str = json.dumps(data)[:4000] # Safe limit for basic version
        
        prompt = f"""
        You are a JSON Data Analyst.
        USER QUESTION: {question}
        
        JSON DATA SNIPPET:
        {data_str}
        
        TASK:
        1. Summarize the content and structure of this JSON.
        2. Answer the user's question based on the data.
        3. Suggest a simple visualization if applicable (e.g., a bar chart labels).
        
        Format your response as a structured report.
        """
        
        response = await llm.ainvoke(prompt)
        content = response.content
        
        return {
            "insight_report": content,
            "executive_summary": "JSON analysis completed successfully.",
            "analysis_results": {"raw_data_preview": data_str[:500]}
        }
    except Exception as e:
        return {"error": f"Failed to analyze JSON: {str(e)}"}
