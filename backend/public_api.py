"""
ExploreYC Public API — a mounted FastAPI sub-app served at /api/v1.

Isolated from the internal app so its OpenAPI (/api/v1/docs, /api/v1/openapi.json)
exposes ONLY the public read-only endpoints and gets its own permissive CORS. Every
route requires a valid API key (Authorization: Bearer eyc_live_… or X-API-Key) and is
rate-limited per key against the DB-backed usage log (plans in backend/plans.py).

Mounted from main.py:  app.mount("/api/v1", create_public_api(db, company_cache))
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from pydantic import BaseModel

from password_utils import hash_token
from plans import plan_limit

RATE_WINDOW = timedelta(hours=24)
MAX_PAGE = 100


def _to_epoch(value) -> Optional[int]:
    """Normalize a DB timestamp (SQLite 'YYYY-MM-DD HH:MM:SS' str or PG datetime) to unix seconds (UTC)."""
    if value is None:
        return None
    if isinstance(value, str):
        try:
            dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    else:
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


class PublicCompany(BaseModel):
    id: int
    source: Optional[str] = None
    source_id: Optional[str] = None
    name: Optional[str] = None
    slug: Optional[str] = None
    website: Optional[str] = None
    one_liner: Optional[str] = None
    long_description: Optional[str] = None
    team_size: Optional[int] = None
    batch: Optional[str] = None
    status: Optional[str] = None
    industry: Optional[str] = None
    subindustry: Optional[str] = None
    all_locations: Optional[str] = None
    is_hiring: Optional[bool] = None
    top_company: Optional[bool] = None
    nonprofit: Optional[bool] = None
    stage: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    small_logo_thumb_url: Optional[str] = None
    founders: Optional[str] = None
    year_founded: Optional[int] = None
    exit_type: Optional[str] = None
    acquirer: Optional[str] = None
    ticker_symbol: Optional[str] = None
    funded_date: Optional[str] = None
    source_url: Optional[str] = None
    funding_total_usd: Optional[float] = None
    funding_last_round_usd: Optional[float] = None
    funding_last_round_name: Optional[str] = None
    funding_last_round_date: Optional[str] = None
    valuation_usd: Optional[float] = None
    employee_count: Optional[int] = None
    employee_growth_6m: Optional[float] = None
    # Postgres returns datetime objects (SQLite returns strings) — accept both, serialize to ISO
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        extra = "ignore"  # cache dicts carry internal fields (raw_json, …) — dropped from the public shape


class CompanyListResponse(BaseModel):
    companies: List[PublicCompany]
    total: int
    limit: int
    offset: int
    has_more: bool


def create_public_api(db, company_cache) -> FastAPI:
    api = FastAPI(
        title="ExploreYC Public API",
        version="1.0.0",
        description=(
            "Read-only programmatic access to the ExploreYC dataset: Y Combinator and a16z "
            "portfolio companies with funding, stage, and exit data.\n\n"
            "**Auth:** send your key as `Authorization: Bearer eyc_live_…` (or `X-API-Key`). "
            "Create a key at https://exploreyc.com/dashboard.\n\n"
            "**Rate limits:** per key, rolling 24h. Free = 5 requests/day. "
            "Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # Public API is server-to-server with an API key (no cookies) -> wildcard origins,
    # no credentials. (You cannot combine '*' with allow_credentials=True.)
    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["Authorization", "X-API-Key", "Content-Type"],
    )

    bearer = HTTPBearer(auto_error=False, description="Your ExploreYC API key (eyc_live_…)")

    def verify_api_key(
        request: Request,
        authorization: Optional[str] = Header(None),
        x_api_key: Optional[str] = Header(None),
        _scheme=Depends(bearer),  # populates the Swagger "Authorize" box
    ) -> dict:
        raw = x_api_key
        if not raw and authorization and authorization.startswith("Bearer "):
            raw = authorization[7:].strip()
        if not raw:
            raise HTTPException(status_code=401, detail="Missing API key. Send 'Authorization: Bearer <key>' or 'X-API-Key'.")

        row = db.get_api_key_by_hash(hash_token(raw))
        if not row or not row.get("is_active") or row.get("user_status") != "active":
            raise HTTPException(status_code=401, detail="Invalid, revoked, or suspended API key.")

        now = datetime.now(timezone.utc)
        now_epoch = int(now.timestamp())
        limit = plan_limit(row.get("plan"))
        used, oldest = db.count_api_usage_since(row["id"], now - RATE_WINDOW)
        reset = (_to_epoch(oldest) or now_epoch) + int(RATE_WINDOW.total_seconds())
        if used >= limit:
            raise HTTPException(
                status_code=429, detail="Rate limit exceeded for your plan. Upgrade for a higher limit.",
                headers={"X-RateLimit-Limit": str(limit), "X-RateLimit-Remaining": "0",
                         "X-RateLimit-Reset": str(reset), "Retry-After": str(max(1, reset - now_epoch))},
            )

        # Allowed: stamp state so the middleware logs usage + sets headers after the response.
        request.state.api_key_id = row["id"]
        request.state.rate_limit = limit
        request.state.rate_remaining = max(0, limit - used - 1)
        request.state.rate_reset = reset
        return row

    @api.middleware("http")
    async def usage_and_headers(request: Request, call_next):
        response = await call_next(request)
        key_id = getattr(request.state, "api_key_id", None)
        if key_id is not None:
            try:
                db.log_api_usage(key_id, request.url.path, response.status_code)
            except Exception:
                pass  # never fail a request because usage logging hiccuped
            response.headers["X-RateLimit-Limit"] = str(getattr(request.state, "rate_limit", ""))
            response.headers["X-RateLimit-Remaining"] = str(getattr(request.state, "rate_remaining", ""))
            response.headers["X-RateLimit-Reset"] = str(getattr(request.state, "rate_reset", ""))
        return response

    v1 = APIRouter(dependencies=[Depends(verify_api_key)])

    @v1.get("/companies", response_model=CompanyListResponse, tags=["Companies"], summary="List / filter companies")
    def list_companies(
        limit: int = Query(50, ge=1, le=MAX_PAGE),
        offset: int = Query(0, ge=0),
        source: Optional[str] = Query("all", description="'yc', 'a16z', or 'all' (default)"),
        batch: Optional[str] = None,
        industry: Optional[str] = None,
        country: Optional[str] = None,
        is_hiring: Optional[bool] = None,
        top_company: Optional[bool] = None,
        search: Optional[str] = None,
    ):
        kwargs = dict(batch=batch, is_hiring=is_hiring, industry=industry, country=country,
                      search=search, top_company=top_company, source=source)
        companies = company_cache.get_companies(limit=limit, offset=offset, **kwargs)
        total = company_cache.count_companies(**kwargs)
        return {"companies": companies, "total": total, "limit": limit, "offset": offset,
                "has_more": (offset + limit) < total}

    @v1.get("/companies/{company_id}", response_model=PublicCompany, tags=["Companies"], summary="Company by id")
    def get_company(company_id: int):
        company = company_cache.get_company_by_id(company_id)
        if not company and hasattr(db, "get_company_by_id"):
            company = db.get_company_by_id(company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        return company

    @v1.get("/companies/slug/{slug}", response_model=PublicCompany, tags=["Companies"], summary="Company by slug")
    def get_company_by_slug(slug: str):
        company = db.get_company_by_slug(slug) if hasattr(db, "get_company_by_slug") else None
        if not company:
            match = [c for c in company_cache.get_companies(limit=1, offset=0, source="all", search=None)
                     if c.get("slug") == slug]
            company = match[0] if match else None
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        return company

    @v1.get("/search", response_model=CompanyListResponse, tags=["Companies"], summary="Full-text company search")
    def search_companies(q: str = Query(..., min_length=1), limit: int = Query(50, ge=1, le=MAX_PAGE),
                         offset: int = Query(0, ge=0), source: Optional[str] = Query("all")):
        companies = company_cache.get_companies(limit=limit, offset=offset, search=q, source=source)
        total = company_cache.count_companies(search=q, source=source)
        return {"companies": companies, "total": total, "limit": limit, "offset": offset,
                "has_more": (offset + limit) < total}

    @v1.get("/stats", tags=["Analytics"], summary="Portfolio stats (Y Combinator)")
    def stats():
        return company_cache.get_stats()

    @v1.get("/sources", tags=["Metadata"], summary="Available sources (incubators / VCs)")
    def sources():
        return {"sources": company_cache.get_sources()}

    @v1.get("/batches", tags=["Metadata"], summary="Distinct YC batches")
    def batches():
        return {"batches": company_cache.get_unique_batches()}

    @v1.get("/industries", tags=["Metadata"], summary="Distinct industries")
    def industries():
        return {"industries": company_cache.get_unique_industries()}

    @v1.get("/countries", tags=["Metadata"], summary="Distinct countries")
    def countries():
        return {"countries": company_cache.get_unique_countries()}

    @v1.get("/map", tags=["Analytics"], summary="Geo-located companies")
    def geo(batch: Optional[str] = None, is_hiring: Optional[bool] = None):
        companies = company_cache.get_companies_for_map(batch=batch, is_hiring=is_hiring)
        return {"companies": companies, "total": len(companies)}

    @v1.get("/batch/{batch_name}/wrapped", tags=["Analytics"], summary="Batch 'wrapped' analytics")
    def batch_wrapped(batch_name: str):
        if not hasattr(db, "get_batch_wrapped_stats"):
            raise HTTPException(status_code=501, detail="Batch analytics unavailable on this deployment")
        data = db.get_batch_wrapped_stats(batch_name)
        if not data:
            raise HTTPException(status_code=404, detail="Batch not found")
        return data

    @v1.get("/founders", tags=["Founders"], summary="Founder leaderboards (ranked)")
    def list_founders(
        metric: str = Query("funded", description="Ranking metric: serial | funded | exits | unicorns"),
        batch: Optional[str] = Query(None, description="Filter to a YC batch, e.g. 'Winter 2012'"),
        limit: int = Query(50, ge=1, le=MAX_PAGE),
        offset: int = Query(0, ge=0),
    ):
        """Ranked Y Combinator founders. `funded` = total raised across their companies,
        `serial` = most YC companies, `exits` = biggest exit, `unicorns` = $1B+ valuations.
        Each row includes the founder, their derived stats, and their rank."""
        if not hasattr(db, "get_founder_leaderboard"):
            raise HTTPException(status_code=501, detail="Founder data unavailable on this deployment")
        try:
            data = db.get_founder_leaderboard(metric, batch=batch, limit=limit, offset=offset)
        except ValueError:
            raise HTTPException(status_code=400,
                                detail="metric must be one of: serial, funded, exits, unicorns")
        results = [{"rank": offset + i + 1, **r} for i, r in enumerate(data.get("results", []))]
        total = data.get("total", 0)
        return {"founders": results, "metric": metric, "total": total, "limit": limit,
                "offset": offset, "has_more": (offset + limit) < total}

    @v1.get("/founders/{slug}", tags=["Founders"], summary="Founder profile + stats + companies")
    def get_founder(slug: str):
        """A single founder: identity, derived stats, the YC companies they founded, every
        leaderboard rank they hold, and (web-sourced) enrichment if available."""
        if not hasattr(db, "get_founder_by_slug"):
            raise HTTPException(status_code=501, detail="Founder data unavailable on this deployment")
        founder = db.get_founder_by_slug(slug)
        if not founder:
            raise HTTPException(status_code=404, detail="Founder not found")
        return founder

    api.include_router(v1)
    return api
