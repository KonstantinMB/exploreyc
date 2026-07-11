"""Orchestrates incremental multi-source sync.

For each registered adapter: read its cursor, fetch the delta, upsert rows
(existing insert_company handles dedup on id / (source, source_id)), record the
new cursor, and soft-remove upstream-removed rows. Embedding backfill + cache
refresh are triggered by the caller (cron endpoint) after run_sync.
"""

import logging

from ingestion import registry

logger = logging.getLogger(__name__)


def run_sync(db, sources=None, full=False):
    """Run the given sources (default: all registered). Returns per-source summary."""
    keys = sources if sources else list(registry.ADAPTERS.keys())
    results = {}
    for key in keys:
        adapter = registry.get_adapter(key)
        if adapter is None:
            results[key] = {"upserted": 0, "cursor": None, "status": "error",
                            "error": "unknown source"}
            continue
        try:
            cursor = db.get_sync_cursor(key)
            result = adapter.fetch(cursor, full=full)
            for row in result.rows:
                db.insert_company(row)
            _soft_remove(db, key, result.removed_source_ids)
            db.save_sync_state(key, result.cursor, "ok", len(result.rows))
            results[key] = {"upserted": len(result.rows), "cursor": result.cursor,
                            "status": "ok"}
            logger.info("sync %s: upserted %d, cursor %s", key, len(result.rows), result.cursor)
        except Exception as e:  # noqa: BLE001 — one bad source must not sink the rest
            db.save_sync_state(key, None, "error", 0, str(e))
            results[key] = {"upserted": 0, "cursor": None, "status": "error", "error": str(e)}
            logger.error("sync %s failed: %s", key, e)
    return results


def _soft_remove(db, source, source_ids):
    """Soft-delete rows whose upstream source record disappeared (never a hard delete)."""
    if not source_ids or not hasattr(db, "mark_companies_removed"):
        return
    try:
        db.mark_companies_removed(source, source_ids)
    except Exception as e:  # noqa: BLE001
        logger.warning("soft-remove for %s skipped: %s", source, e)


def embed_missing(db, limit=2000):
    """Embed any rows (all sources) missing an embedding. No-op on SQLite."""
    if not hasattr(db, "get_companies_for_embedding"):
        return 0
    from embedding_service import get_embedding_service
    from idea_filter import get_search_text_for_embedding

    missing = db.get_companies_for_embedding(only_missing=True, limit=limit)
    if not missing:
        return 0
    svc = get_embedding_service()
    texts = [get_search_text_for_embedding(db.build_company_embedding_text(c)) for c in missing]
    vectors = svc.generate_embeddings_batch(texts)
    return db.update_company_embeddings_batch([(c["id"], v) for c, v in zip(missing, vectors)])
