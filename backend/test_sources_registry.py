from sources import SOURCES, SOURCE_ID_OFFSETS, to_global_id, from_global_id


def test_new_sources_registered():
    for k in ("hackernews", "producthunt", "techstars"):
        assert k in SOURCES
        assert "display_name" in SOURCES[k]
        assert k in SOURCE_ID_OFFSETS


def test_global_id_roundtrip_for_new_sources():
    assert to_global_id("hackernews", 42) == 3_000_000_042
    assert to_global_id("producthunt", 7) == 4_000_000_007
    assert from_global_id(3_000_000_042) == ("hackernews", 42)
    assert from_global_id(5_000_000_001) == ("techstars", 1)
    # Existing sources unchanged.
    assert to_global_id("yc", 12345) == 12345
    assert to_global_id("a16z", 371262) == 2_000_371_262
