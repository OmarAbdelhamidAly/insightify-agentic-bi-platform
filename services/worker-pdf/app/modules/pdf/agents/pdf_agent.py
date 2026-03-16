"""Advanced PDF Analysis Agent — ColPali Implementation."""
import os
import torch
from typing import Any, Dict
from PIL import Image
from pdf2image import convert_from_path
from colpali_engine.models import ColPali
from transformers import AutoProcessor
from app.domain.analysis.entities import AnalysisState
from app.infrastructure.llm import llm
from app.modules.pdf.utils.qdrant_multivector import QdrantMultiVectorManager

# Lazy load model to save memory if not called
_model = None
_processor = None

def get_colpali():
    global _model, _processor
    if _model is None:
        model_name = "vidore/colpali-v1.2"
        _processor = AutoProcessor.from_pretrained(model_name)
        _model = ColPali.from_pretrained(
            model_name, 
            torch_dtype=torch.bfloat16,
            device_map="auto"
        ).eval()
    return _model, _processor

async def colpali_retrieval_agent(state: AnalysisState) -> Dict[str, Any]:
    """Uses ColPali to encode query and retrieve document context via Qdrant."""
    kb_id = state.get("kb_id")
    question = state.get("question")
    
    if not kb_id:
        return {"error": "Knowledge Base ID missing for advanced RAG."}

    try:
        model, processor = get_colpali()
        qdrant = QdrantMultiVectorManager(collection_name=f"kb_{kb_id}")
        await qdrant.ensure_collection()

        # 1. Encode Query
        with torch.no_grad():
            batch_query = processor.process_queries([question]).to(model.device)
            query_embeddings = model.forward(**batch_query)
            # Convert to list for Qdrant (MaxSim expects multi-vector query too)
            query_vector = query_embeddings[0].cpu().tolist()

            # TODO: Generate MUVERA FDE for the query
            # For this basic 'advanced' version, we'll use a placeholder or skip MUVERA prefetch 
            # if we don't have the MUVERA encoder weights yet, and do direct MaxSim search.
            # In a full PROD implementation, we'd use FastEmbed to get the FDE.
            
        # 2. Search
        # Direct MaxSim search for better accuracy in this stage
        search_results = qdrant.client.query_points(
            collection_name=qdrant.collection_name,
            query=query_vector,
            using="colpali",
            limit=3,
            with_payload=True
        ).points

        if not search_results:
            return {"insight_report": "No visual context found matching your question."}

        # 3. Synthesize Context
        context_text = ""
        for i, hit in enumerate(search_results):
            context_text += f"\n--- Page {hit.payload.get('page_num')} ---\n"
            context_text += hit.payload.get("page_summary", "Image-based context")

        prompt = f"""
        You are an advanced Visual RAG Assistant. 
        You have access to DOCUMENT IMAGES (summarized below) retrieved via ColPali.
        
        QUESTION: {question}
        RETRIEVED CONTEXT:
        {context_text}
        
        Provide a comprehensive answer. Mention if the answer was found via visual analysis (charts/tables).
        """
        
        response = await llm.ainvoke(prompt)
        
        return {
            "insight_report": response.content,
            "executive_summary": "Advanced Multi-vector retrieval completed with ColPali.",
            "analysis_results": {"pages_retrieved": [h.payload.get("page_num") for h in search_results]}
        }

    except Exception as e:
        return {"error": f"ColPali RAG failed: {str(e)}"}
