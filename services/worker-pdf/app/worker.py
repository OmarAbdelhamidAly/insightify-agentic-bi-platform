"""Celery worker — PDF/Knowledge Base Specialized Pillar."""
import asyncio
import uuid
import structlog
from datetime import datetime, timezone
from celery import Celery
from app.infrastructure.config import settings

logger = structlog.get_logger(__name__)

celery_app = Celery(
    "analyst_worker_pdf",
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

@celery_app.task(bind=True, name="pillar_task", max_retries=3)
def pillar_task(self, job_id: str) -> dict:
    """Executes the PDF/KB analysis logic."""
    return asyncio.run(_execute_pillar(job_id))

async def _execute_pillar(job_id: str) -> dict:
    from sqlalchemy import select
    from app.infrastructure.database.postgres import async_session_factory
    from app.models.analysis_job import AnalysisJob
    from app.models.analysis_result import AnalysisResult
    from app.models.data_source import DataSource
    from app.modules.pdf.workflow import build_pdf_graph

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
            # Note: PDF source might be different from KB source, but for basic we use DataSource.kb_id
            
            thread_id = str(job.id)
            config = {"configurable": {"thread_id": thread_id}}
            
            pipeline = build_pdf_graph(checkpointer=checkpointer)

            graph_input = {
                "tenant_id": str(job.tenant_id),
                "user_id": str(job.user_id),
                "question": job.question,
                "source_id": str(job.source_id),
                "source_type": source.type if source else "pdf",
                "kb_id": str(job.kb_id) if job.kb_id else None,
            }

            logger.info("pdf_graph_execution_started", job_id=job_id)

            async for event in pipeline.astream(
                graph_input,
                config,
                stream_mode="updates",
            ):
                if "__metadata__" not in event:
                    for node_name, state_update in event.items():
                        logger.info("graph_node_update", node=node_name, job_id=job_id)
                        
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
            
            # Save Analysis Results (Upsert)
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
            
            return {"status": "done"}

    except Exception as e:
        logger.error("pdf_pillar_failed", error=str(e), job_id=job_id)
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
        try:
            from app.infrastructure.database.postgres import engine
            await engine.dispose()
            await redis_client.aclose()
        except Exception:
            pass
