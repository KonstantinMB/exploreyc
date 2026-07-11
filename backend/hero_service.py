"""Deterministic 'verdict' builder for the homepage hero answer box.

Pure functions only — NO I/O, NO LLM calls. Turns a list of pgvector-retrieved
similar companies into a crisp, computed answer + market meter. This is what
makes the hero instant and free per query.
"""
from typing import List, Dict
from collections import Counter

# Meter thresholds by count of similar YC companies above the similarity floor.
_OPEN, _EMERGING, _COMPETITIVE = 0, 1, 5   # 0 → open, 1-4 → emerging, 5-9 → competitive, 10+ → crowded


def _meter(n: int) -> str:
    if n <= _OPEN:
        return "open"
    if n < _COMPETITIVE:
        return "emerging"
    if n < 10:
        return "competitive"
    return "crowded"


def _rank_batches(similar: List[Dict]) -> List[str]:
    # Order batches by rough recency using the year in the batch label; newest first.
    def key(b: str):
        parts = (b or "").split()
        year = int(parts[-1]) if parts and parts[-1].isdigit() else 0
        season = {"Winter": 0, "Spring": 1, "Summer": 2, "Fall": 3}.get(parts[0], 0) if parts else 0
        return (year, season)
    uniq = sorted({c.get("batch") or "" for c in similar if c.get("batch")}, key=key, reverse=True)
    return uniq


def build_verdict(idea: str, similar: List[Dict], portfolio_total: int) -> Dict:
    n = len(similar)
    meter = _meter(n)
    ordered = sorted(similar, key=lambda c: c.get("similarity_score") or 0, reverse=True)
    closest = [
        {"id": c.get("id"), "name": c.get("name"), "slug": c.get("slug"),
         "batch": c.get("batch"), "similarity": round(c.get("similarity_score") or 0, 3)}
        for c in ordered[:3]
    ]
    inds = Counter((c.get("industry") or "").strip() for c in similar if c.get("industry"))
    top_industries = [{"name": k, "count": v} for k, v in inds.most_common(3)]

    recent_batches = set(_rank_batches(similar)[:3])
    recent_share = round(sum(1 for c in similar if (c.get("batch") or "") in recent_batches) / n, 2) if n else 0.0
    hiring_share = round(sum(1 for c in similar if c.get("is_hiring")) / n, 2) if n else 0.0
    market_size = round((n / portfolio_total * 100), 2) if portfolio_total else 0.0

    if n == 0:
        return {
            "meter": meter, "total_similar": 0, "closest": [], "top_industries": [],
            "recent_share": 0.0, "hiring_share": 0.0, "market_size_percentage": market_size,
            "headline": "Open field — no close matches",
            "summary": ("No company we track is doing something close to this. That can mean genuine "
                        "first-mover space — or that it lives outside our sources. Worth a deeper look."),
        }

    names = ", ".join(f'{c["name"]} ({c["batch"] or "unknown"})' for c in closest)
    label = {"emerging": "Emerging", "competitive": "Competitive", "crowded": "Crowded"}[meter]
    headline = f"{label} — {n} compan{'y' if n == 1 else 'ies'} overlap"
    recency_clause = (f" {int(recent_share*100)}% are from the latest batches" if recent_share >= 0.4 else "")
    hiring_clause = (f" and {int(hiring_share*100)}% are hiring" if hiring_share >= 0.3 else "")
    ind_clause = (f" Most cluster in {top_industries[0]['name']}." if top_industries else "")
    summary = (f"{n} compan{'y' if n == 1 else 'ies'} overlap with this idea. "
               f"Closest: {names}.{(' This space is active —' + recency_clause + hiring_clause + '.') if (recency_clause or hiring_clause) else ''}"
               f"{ind_clause}").replace("  ", " ").strip()
    return {
        "meter": meter, "total_similar": n, "closest": closest, "top_industries": top_industries,
        "recent_share": recent_share, "hiring_share": hiring_share,
        "market_size_percentage": market_size, "headline": headline, "summary": summary,
    }
