import structlog
from typing import Dict, Any, List
from pydantic import BaseModel, Field
from app.infrastructure.llm import get_llm
from langchain_core.messages import HumanMessage
from app.domain.analysis.entities import AnalysisState

logger = structlog.get_logger(__name__)

class Recommendation(BaseModel):
    title: str = Field(description="Short title for the recommendation")
    description: str = Field(description="Detailed explanation of the recommendation")
    action: str = Field(description="A specific, actionable next step")

class AnalystOutput(BaseModel):
    executive_summary: str = Field(description="A professional executive summary of the document insights")
    recommendations: List[Recommendation] = Field(description="Exactly 3 actionable strategic recommendations")

async def analyst_agent(state: AnalysisState) -> Dict[str, Any]:
    """Analytical Agent to generate high-level insights and professional recommendations."""
    report = state.get("insight_report")
    
    if not report:
        return {}
        
    logger.info("analyst_insights_started")
    
    # We use Groq's fast Llama 3.1 8B for analysis
    llm = get_llm(temperature=0, model="llama-3.1-8b-instant")
    structured_llm = llm.with_structured_output(AnalystOutput)
    
    prompt = f"""You are a Strategic Analyst with expertise in document intelligence.
    Review the following AI ANSWER and provide a structured Executive Summary and 3 actionable recommendations. 
    
    RULES:
    1. Respond in the EXACT SAME LANGUAGE as the AI ANSWER (Arabic or English).
    2. Focus on "What should the user do next?".
    3. Keep it professional and concise.
    
    AI ANSWER:
    {report}
    """
    
    try:
        res = await structured_llm.ainvoke([HumanMessage(content=prompt)])
        logger.info("analyst_insights_completed")
        
        # Convert Pydantic objects to generic dicts for state merging
        recommendations_list = [
            {"title": r.title, "description": r.description, "action": r.action} 
            for r in res.recommendations
        ]
        
        return {
            "executive_summary": res.executive_summary,
            "recommendations": recommendations_list,
        }
            
    except Exception as e:
        logger.error("analyst_insights_failed", error=str(e))
        return {
            "executive_summary": "Analysis completed. Review the findings above.", 
            "recommendations": [
                {
                    "title": "Review Required", 
                    "description": "The AI encountered an error while synthesizing strategic recommendations.", 
                    "action": "Please try submitting the query again."
                }
            ]
        }
