"""Auto-Analysis Service.

Runs once on first upload/connection per DataSource.
Steps:
  1. Use LLM to inspect schema → detect domain_type + generate 5 smart questions
  2. Run each question through the appropriate pipeline (CSV or SQL)
  3. Save all 5 results to DataSource.auto_analysis_json permanently

Results are cached in the DB — subsequent reads are instant (no re-run).
"""

from __future__ import annotations

import json
import asyncio
import uuid
from typing import Any, Dict, List, Optional

import structlog
from app.infrastructure.llm import get_llm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.config import settings
from app.models.data_source import DataSource

logger = structlog.get_logger(__name__)

# ── Domain Detection + Question Generation Prompt ─────────────────────────────

DISCOVERY_PROMPT = """You are a senior data analyst. Given the following data schema, your job is to:
1. Detect the domain type of this data
2. Generate exactly 5 smart, diverse analysis questions that will give the most business value

Domain types: sales, hr, finance, inventory, customer, logistics, healthcare, education, mixed

Rules for questions:
- Each question should reveal a DIFFERENT insight (trend, ranking, correlation, comparison, summary)
- Questions must be answerable from the given schema
- Questions should be in plain English, as a business user would ask them
- Make them specific (e.g. use actual column names where natural)

Respond ONLY with valid JSON, no markdown:
{{
  "domain_type": "sales",
  "questions": [
    "What is the overall sales trend over time?",
    "Which product category generates the most revenue?",
    "Which region has the highest number of orders?",
    "What is the correlation between discount and profit?",
    "Who are the top 10 customers by total spending?"
  ]
}}

Schema:
{schema}"""


# ── Main Service Function ──────────────────────────────────────────────────────

async def run_auto_analysis(source_id: str, user_id: str, db: AsyncSession) -> None:
    """Run the auto-analysis pipeline for a DataSource.

    This function is called as a FastAPI BackgroundTask immediately after
    a new DataSource is created. It:
    1. Marks the source as 'running'
    2. Generates 5 smart questions via LLM
    3. Runs each question through the pipeline
    4. Saves results back to the DataSource row
    5. Marks as 'done' (or 'failed' on error)
    """
    # Load source
    result = await db.execute(
        select(DataSource).where(DataSource.id == uuid.UUID(source_id))
    )
    source = result.scalar_one_or_none()
    if source is None:
        logger.error("auto_analysis_source_not_found", source_id=source_id)
        return

    logger.info("auto_analysis_started", source_id=source_id, source_type=source.type)

    # Mark as running
    source.auto_analysis_status = "running"
    await db.commit()

    try:
        # Step 2: NEW - Generate domain + questions from schema
        # Compact JSON (no whitespace) saves ~40% tokens for large schemas
        schema_str = json.dumps(source.schema_json or {}, separators=(',', ':'))
        # Hard cap at 3500 chars to stay within Ollama's 4096-token context window
        # (prompt template overhead ~600 chars + response tokens)
        MAX_SCHEMA_CHARS = 3000
        if len(schema_str) > MAX_SCHEMA_CHARS:
            schema_str = schema_str[:MAX_SCHEMA_CHARS] + "... [schema truncated]"
        domain_type, suggested_questions = await _generate_questions(schema_str)

        # Estimate tokens for EACH suggested question
        questions_with_estimates = []
        for q in suggested_questions:
            # Rough estimate based on schema size + prompt overhead
            # Prompt overhead is ~1000 chars, schema is schema_str
            est_input_tokens = (len(schema_str) + len(q) + 1200) // 4
            questions_with_estimates.append({
                "text": q,
                "estimated_tokens": est_input_tokens
            })

        source.domain_type = domain_type
        
        # Step 3: Trigger distributed execution
        # Results are now handled asynchronously by workers
        await _run_questions(source, suggested_questions, user_id)

        source.auto_analysis_status = "done"
        await db.commit()

        logger.info(
            "auto_analysis_discovery_complete",
            source_id=source_id,
            domain_type=domain_type,
            suggestions=len(questions_with_estimates),
        )

    except Exception as exc:
        logger.error("auto_analysis_failed", source_id=source_id, error=str(exc))
        source.auto_analysis_status = "failed"
        await db.commit()


# ── Step 1: LLM Question Generator ────────────────────────────────────────────

async def _generate_questions(schema_str: str):
    """Use LLM to detect domain + generate 5 smart questions."""
    llm = get_llm(temperature=0.3)

    prompt = DISCOVERY_PROMPT.format(schema=schema_str)

    try:
        response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=300.0)
        content = response.content
    except asyncio.TimeoutError:
        logger.warning("auto_analysis_llm_timeout_generating_questions")
        return "mixed", []

    if not content or not content.strip():
        logger.warning("auto_analysis_empty_llm_response")
        return "mixed", []

    content = content.strip()

    # Strip markdown code fences robustly (handles ```json, ```JSON, ``` etc.)
    if content.startswith("```"):
        lines = content.split("\n")
        # Remove the opening fence line (e.g. "```json")
        content = "\n".join(lines[1:])
        # Remove the closing fence
        if content.rstrip().endswith("```"):
            content = content.rstrip().rsplit("```", 1)[0]

    content = content.strip()
    if not content:
        logger.warning("auto_analysis_empty_content_after_strip")
        return "mixed", []

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        logger.warning("auto_analysis_json_parse_failed", error=str(e), raw=content[:200])
        return "mixed", []

    domain_type = parsed.get("domain_type", "mixed")
    questions = parsed.get("questions", [])[:5]

    return domain_type, questions


# ── Step 2: Run Each Question Through the Pipeline ────────────────────────────

async def _run_questions(
    source: DataSource,
    questions: List[str],
    user_id: str,
) -> List[Dict[str, Any]]:
    """Create AnalysisJob records for each question and trigger distributed execution."""
    from app.infrastructure.database.postgres import async_session_factory
    from app.models.analysis_job import AnalysisJob
    # Celery import
    from app.worker import celery_app

    results = []

    async with async_session_factory() as db:
        for i, question in enumerate(questions):
            try:
                # Create Job record
                job = AnalysisJob(
                    tenant_id=source.tenant_id,
                    user_id=uuid.UUID(user_id), # Original uploader
                    source_id=source.id,
                    question=question,
                    status="pending",
                )
                db.add(job)
                await db.flush() # Get the job ID
                
                # Trigger Governance Task (Distributed Async)
                celery_app.send_task("governance_task", args=[str(job.id)], queue="governance")

                results.append({
                    "index": i,
                    "question": question,
                    "status": "triggered",
                    "job_id": str(job.id),
                })

            except Exception as exc:
                logger.warning("auto_analysis_trigger_failed", question=question, error=str(exc))
                results.append({
                    "index": i,
                    "question": question,
                    "status": "failed",
                    "error": str(exc),
                })
        
        await db.commit()

    return results
