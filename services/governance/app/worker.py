"""Celery worker — specialized Microservices Architecture."""

from __future__ import annotations
import asyncio
import uuid
import structlog
from datetime import datetime, timezone
from celery import Celery
from app.infrastructure.config import settings

logger = structlog.get_logger(__name__)

celery_app = Celery(
    "analyst_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
)

# ── 1. Governance Layer (Intent + Policies) ───────────────────────────────────

@celery_app.task(bind=True, name="governance_task", max_retries=3)
def governance_task(self, job_id: str) -> dict:
    """Handles business metrics, intent detection, and safety guardrails."""
    return asyncio.run(_execute_governance(job_id))

async def _execute_governance(job_id: str) -> dict:
    from sqlalchemy import select
    from app.infrastructure.database.postgres import async_session_factory
    from app.models.analysis_job import AnalysisJob
    from app.models.data_source import DataSource
    from app.use_cases.analysis.run_pipeline import get_pipeline
    from app.models.metric import BusinessMetric
    from app.models.policy import SystemPolicy

    # Instantiate fresh checkpointer for the current loop
    import redis.asyncio as redis
    from langgraph.checkpoint.redis import AsyncRedisSaver
    redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=False)
    checkpointer = AsyncRedisSaver(redis_client=redis_client)

    try:
        async with async_session_factory() as db:
            res = await db.execute(select(AnalysisJob).where(AnalysisJob.id == uuid.UUID(job_id)))
            job = res.scalar_one_or_none()
            if not job: return {"error": "Job not found"}

            job.status = "running"
            job.started_at = datetime.now(timezone.utc)
            await db.commit()

            ds_res = await db.execute(select(DataSource).where(DataSource.id == job.source_id))
            source = ds_res.scalar_one_or_none()
            if not source: return {"error": "Source not found"}

            # Build Initial State
            m_result = await db.execute(select(BusinessMetric).where(BusinessMetric.tenant_id == job.tenant_id))
            metrics = [{"name": m.name, "definition": m.definition, "formula": m.formula or "N/A"} for m in m_result.scalars().all()]
            
            p_result = await db.execute(select(SystemPolicy).where(SystemPolicy.tenant_id == job.tenant_id))
            policies = [{"name": p.name, "type": p.rule_type, "description": p.description} for p in p_result.scalars().all()]

            initial_state = {
                "tenant_id": str(job.tenant_id),
                "user_id": str(job.user_id),
                "question": job.question,
                "source_id": str(job.source_id),
                "kb_id": str(job.kb_id) if job.kb_id else None,
                "complexity_index": job.complexity_index,
                "total_pills": job.total_pills,
                "history": [],
                "source_type": source.type,
                "file_path": source.file_path,
                "config_encrypted": source.config_encrypted,
                "schema_summary": source.schema_json or {},
                "business_metrics": metrics,
                "system_policies": policies,
                "retry_count": 0,
                "history": [],
                "thread_id": str(job.id),
                "approval_granted": False,
            }

            # Run Governance Phase (Intake -> Guardrail)
            from app.modules.governance.workflow import get_governance_pipeline
            pipeline = get_governance_pipeline(checkpointer=checkpointer)
            config = {"configurable": {"thread_id": str(job.id)}}
            
            await pipeline.ainvoke(initial_state, config) 
            
            target_queue = f"pillar.{source.type.lower()}"
            pillar_task.apply_async(args=[job_id], queue=target_queue)
            
            return {"status": "governance_complete", "pillar_queue": target_queue}
    except Exception as e:
        logger.error("governance_execution_failed", error=str(e), job_id=job_id)
        async with async_session_factory() as db:
            from sqlalchemy import update
            await db.execute(
                update(AnalysisJob)
                .where(AnalysisJob.id == uuid.UUID(job_id))
                .values(status="error", error_message=str(e))
            )
            await db.commit()
        return {"error": str(e)}
    finally:
        # ── Loop Safety ──
        # In Celery with prefork, a process is reused but asyncio.run starts a NEW loop.
        # Global objects like the SQL engine or Redis client must be cleared/closed
        # to prevent "attached to a different loop" errors.
        try:
            from app.infrastructure.database.postgres import engine
            await engine.dispose()
            await redis_client.aclose()
        except Exception:
            pass

# ── 2. Specialist Pillars (SQL, CSV, PDF, JSON) ──────────────────────────────

@celery_app.task(bind=True, name="pillar_task", max_retries=3)
def pillar_task(self, job_id: str) -> dict:
    """Executes the core specialist analysis logic."""
    return asyncio.run(_execute_pillar(job_id))

async def _execute_pillar(job_id: str) -> dict:
    from sqlalchemy import select
    from app.infrastructure.database.postgres import async_session_factory
    from app.models.analysis_job import AnalysisJob
    from app.models.analysis_result import AnalysisResult
    from app.models.data_source import DataSource
    from app.use_cases.analysis.run_pipeline import get_pipeline

    # Instantiate fresh checkpointer for the current loop
    import redis.asyncio as redis
    from langgraph.checkpoint.redis import AsyncRedisSaver
    redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=False)
    checkpointer = AsyncRedisSaver(redis_client=redis_client)

    try:
        async with async_session_factory() as db:
            res = await db.execute(select(AnalysisJob).where(AnalysisJob.id == uuid.UUID(job_id)))
            job = res.scalar_one_or_none()
            if not job: return {"error": "Job not found"}

            ds_res = await db.execute(select(DataSource).where(DataSource.id == job.source_id))
            source = ds_res.scalar_one_or_none()

            thread_id = str(job.id)
            config = {"configurable": {"thread_id": thread_id}}
            
            pipeline = get_pipeline(source.type, checkpointer=checkpointer)

            # NEW: Check for existing checkpoint and metadata for immediate pause/resume logic
            checkpoint = await checkpointer.aget_tuple(config)
            
            # NEW: Persist metadata even if pausing (for SQL visibility during HITL)
            if checkpoint and checkpoint.metadata:
                from sqlalchemy import update
                await db.execute(
                    update(AnalysisJob)
                    .where(AnalysisJob.id == uuid.UUID(job_id))
                    .values(
                        generated_sql=checkpoint.metadata.get("generated_sql"),
                        intent=checkpoint.metadata.get("intent")
                    )
                )
                await db.commit()

            if checkpoint and checkpoint.metadata.get("source") == "interrupt":
                job.status = "awaiting_approval"
                await db.commit() # Commit status change
                logger.info("job_paused_for_approval", job_id=job_id, next_nodes=checkpoint.next)
                return {"status": "awaiting_approval"}

            existing_state = await pipeline.aget_state(config)
            is_resuming = bool(existing_state.next)
            
            graph_input = None if is_resuming else {
                "tenant_id": str(job.tenant_id),
                "user_id": str(job.user_id),
                "question": job.question,
                "source_id": str(job.source_id),
                "source_type": source.type,
                "kb_id": str(job.kb_id) if job.kb_id else None,
            }

            logger.info("graph_execution_started", job_id=job_id, is_resuming=is_resuming, start_node=existing_state.next)

            async for event in pipeline.astream(
                graph_input,
                config,
                stream_mode="updates",
            ):
                if "__metadata__" not in event:
                    for node_name, state_update in event.items():
                        # Skip special langgraph events that are not node updates
                        if node_name.startswith("__") or not isinstance(state_update, dict):
                            logger.info("graph_special_event", node=node_name, type=str(type(state_update)), job_id=job_id)
                            continue
                            
                        logger.info("graph_node_update", node=node_name, keys=list(state_update.keys()), job_id=job_id)
                        
                        # Update job thinking steps
                        current_steps = list(job.thinking_steps or [])
                        current_steps.append({
                            "node": node_name, 
                            "status": "completed", 
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                        job.thinking_steps = current_steps
                        await db.commit()

            # Final state retrieval
            graph_state = await pipeline.aget_state(config)
            res_data = graph_state.values
            
            # Update Job Metadata (Always capture latest SQL/Intent regardless of completion)
            job.generated_sql = res_data.get("generated_sql") or job.generated_sql
            job.intent = res_data.get("intent") or job.intent
            
            if graph_state.next:
                 job.status = "awaiting_approval"
                 logger.info("job_paused_for_approval", job_id=job_id, next_nodes=graph_state.next)
            else:
                  logger.info("saving_analysis_results", 
                              job_id=job_id, 
                              has_chart=res_data.get("chart_json") is not None, 
                              insight_len=len(res_data.get("insight_report") or ""))
                  
                  # Update Job Metadata
                  job.generated_sql = res_data.get("generated_sql") or job.generated_sql
                  job.intent = res_data.get("intent") or job.intent
                  
                  # Save Analysis Results (Upsert)
                  # Mapping ORM attributes to their database column names for absolute consistency
                  from sqlalchemy.dialects.postgresql import insert
                  stmt = insert(AnalysisResult).values(
                      job_id=job.id,
                      chart_json=res_data.get("chart_json"),
                      insight_report=res_data.get("insight_report"),
                      exec_summary=res_data.get("executive_summary"),
                      recommendations_json=res_data.get("recommendations"),
                      follow_up_suggestions=res_data.get("follow_up_suggestions"),
                  )
                  stmt = stmt.on_conflict_do_update(
                      index_elements=['job_id'],
                      set_={
                          'chart_json': stmt.excluded.chart_json,
                          'insight_report': stmt.excluded.insight_report,
                          'exec_summary': stmt.excluded.exec_summary,
                          'recommendations_json': stmt.excluded.recommendations_json,
                          'follow_up_suggestions': stmt.excluded.follow_up_suggestions,
                      }
                  )
                  await db.execute(stmt)
                  
                  job.status = "done"
                  job.completed_at = datetime.now(timezone.utc)

            await db.commit()
            return {"status": job.status}

    except Exception as e:
        logger.error("pillar_execution_failed", error=str(e), job_id=job_id)
        async with async_session_factory() as db:
            from sqlalchemy import update
            await db.execute(
                update(AnalysisJob)
                .where(AnalysisJob.id == uuid.UUID(job_id))
                .values(status="error", error_message=str(e))
            )
            await db.commit()
        return {"error": str(e)}
    finally:
        # ── Loop Safety ──
        # In Celery with prefork, a process is reused but asyncio.run starts a NEW loop.
        # Global objects like the SQL engine or Redis client must be cleared/closed
        # to prevent "attached to a different loop" errors.
        try:
            from app.infrastructure.database.postgres import engine
            await engine.dispose()
            await redis_client.aclose()
            # SQL engines only exist in SQL workers
            try:
                from app.modules.sql.tools.run_sql_query import dispose_all_engines
                await dispose_all_engines()
            except ImportError:
                pass
        except Exception:
            pass

# ── 3. Auto-Analysis Orchestration ───────────────────────────────────────────

@celery_app.task(name="auto_analysis_task")
def auto_analysis_task(source_id: str) -> None:
    """Orchestrates LLM-driven discovery and analysis of a new DataSource."""
    return asyncio.run(_execute_auto_analysis(source_id))

async def _execute_auto_analysis(source_id: str) -> None:
    from sqlalchemy import select
    from app.infrastructure.database.postgres import async_session_factory
    from app.models.data_source import DataSource
    
    async with async_session_factory() as db:
        res = await db.execute(select(DataSource).where(DataSource.id == uuid.UUID(source_id)))
        source = res.scalar_one_or_none()
        if not source:
            return

        # Trigger governance task for each suggested question in background
        # Note: Questions should already be generated by the API's auto-analysis service
        if source.auto_analysis_json and "suggested_questions" in source.auto_analysis_json:
             pass 
             # Logic for triggering the analysis jobs based on source.auto_analysis_json

# ── 4. Document Indexing (Knowledge Service) ──────────────────────────────────

@celery_app.task(name="process_document_indexing")
def process_document_indexing(doc_id: str):
    return asyncio.run(_execute_indexing(doc_id))

async def _execute_indexing(doc_id: str):
    from app.infrastructure.database.postgres import async_session_factory
    # ... logic from previous worker.py ...
    pass
