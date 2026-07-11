from database import Database
from ingestion import sync_service
from ingestion.base import FetchResult


class FakeAdapter:
    key = "hackernews"
    display_name = "HN"

    def __init__(self, rows, cursor):
        self._rows = rows
        self._cursor = cursor
        self.seen_cursor = "unset"

    def fetch(self, cursor, full=False):
        self.seen_cursor = cursor
        return FetchResult(rows=self._rows, cursor=self._cursor, removed_source_ids=[])


class BoomAdapter:
    key = "hackernews"
    display_name = "HN"

    def fetch(self, cursor, full=False):
        raise RuntimeError("network down")


def _row(**kw):
    base = {
        "id": 3_000_000_001, "source": "hackernews", "source_id": "1",
        "name": "Acme", "slug": "acme", "website": "https://acme.com",
        "dedupe_key": "acme.com", "isHiring": False, "raw_json": {"x": 1},
        "tags": ["Launch HN"], "industries": [], "regions": [],
    }
    base.update(kw)
    return base


def test_run_sync_upserts_and_saves_cursor(tmp_path, monkeypatch):
    db = Database(str(tmp_path / "t.db"))
    monkeypatch.setitem(sync_service.registry.ADAPTERS, "hackernews", FakeAdapter([_row()], "123"))
    out = sync_service.run_sync(db, sources=["hackernews"])
    assert out["hackernews"]["status"] == "ok"
    assert out["hackernews"]["upserted"] == 1
    assert db.get_sync_cursor("hackernews") == "123"
    assert db.get_company_by_id(3_000_000_001)["dedupe_key"] == "acme.com"


def test_run_sync_passes_stored_cursor_next_time(tmp_path, monkeypatch):
    db = Database(str(tmp_path / "t.db"))
    a1 = FakeAdapter([_row()], "123")
    monkeypatch.setitem(sync_service.registry.ADAPTERS, "hackernews", a1)
    sync_service.run_sync(db, sources=["hackernews"])
    a2 = FakeAdapter([], "123")
    monkeypatch.setitem(sync_service.registry.ADAPTERS, "hackernews", a2)
    sync_service.run_sync(db, sources=["hackernews"])
    assert a2.seen_cursor == "123"  # second run reads the cursor saved by the first


def test_run_sync_isolates_source_failure(tmp_path, monkeypatch):
    db = Database(str(tmp_path / "t.db"))
    monkeypatch.setitem(sync_service.registry.ADAPTERS, "hackernews", BoomAdapter())
    out = sync_service.run_sync(db, sources=["hackernews"])
    assert out["hackernews"]["status"] == "error"
    assert "network down" in out["hackernews"]["error"]
