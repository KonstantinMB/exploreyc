from database import Database


def test_sync_cursor_roundtrip(tmp_path):
    db = Database(str(tmp_path / "t.db"))
    assert db.get_sync_cursor("hackernews") is None
    db.save_sync_state("hackernews", "1700000000", "ok", 5)
    assert db.get_sync_cursor("hackernews") == "1700000000"
    # Upsert (not duplicate insert) on a second run.
    db.save_sync_state("hackernews", "1700000500", "ok", 3)
    assert db.get_sync_cursor("hackernews") == "1700000500"


def test_save_sync_state_error(tmp_path):
    db = Database(str(tmp_path / "t.db"))
    db.save_sync_state("producthunt", None, "error", 0, "boom")
    assert db.get_sync_cursor("producthunt") is None


def test_backfill_dedupe_keys(tmp_path):
    db = Database(str(tmp_path / "t.db"))
    db.insert_company({
        "id": 1, "source": "yc", "slug": "acme", "name": "Acme",
        "website": "https://www.acme.com/careers", "isHiring": False,
    })
    db.insert_company({
        "id": 2, "source": "hackernews", "slug": "noweb", "name": "NoWeb",
        "website": None, "isHiring": False,
    })
    n = db.backfill_dedupe_keys()
    assert n == 2
    assert db.get_company_by_id(1)["dedupe_key"] == "acme.com"
    assert db.get_company_by_id(2)["dedupe_key"] == "hackernews:noweb"
    # Idempotent: nothing left to backfill.
    assert db.backfill_dedupe_keys() == 0


def test_delete_source_companies_with_batch(tmp_path):
    db = Database(str(tmp_path / "t.db"))
    db.insert_company({"id": 1, "source": "yc", "slug": "yc-acme", "name": "Acme",
                       "batch": "W26", "isHiring": False})               # YC — keep
    db.insert_company({"id": 3_000_000_001, "source": "hackernews", "slug": "hn-acme",
                       "name": "Acme", "batch": "W26", "isHiring": False})  # HN+batch — delete
    db.insert_company({"id": 3_000_000_002, "source": "hackernews", "slug": "hn-nb",
                       "name": "NoBatch", "batch": None, "isHiring": False})  # HN, no batch — keep
    db.insert_company({"id": 4_000_000_001, "source": "producthunt", "slug": "ph-x",
                       "name": "X", "batch": "S25", "isHiring": False})   # PH+batch — delete
    n = db.delete_source_companies_with_batch()
    assert n == 2
    assert db.get_company_by_id(1) is not None                # YC untouched
    assert db.get_company_by_id(3_000_000_002) is not None    # HN no-batch untouched
    assert db.get_company_by_id(3_000_000_001) is None        # HN+batch removed
    assert db.get_company_by_id(4_000_000_001) is None        # PH+batch removed


def test_insert_company_persists_dedupe_key(tmp_path):
    db = Database(str(tmp_path / "t.db"))
    db.insert_company({
        "id": 3, "source": "hackernews", "slug": "acme", "name": "Acme",
        "website": "https://acme.com", "dedupe_key": "acme.com", "isHiring": True,
    })
    assert db.get_company_by_id(3)["dedupe_key"] == "acme.com"
