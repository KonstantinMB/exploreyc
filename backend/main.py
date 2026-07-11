"""
FastAPI backend for YC Company Scraper
"""

# Load environment variables from .env file (for local development)
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse, Response, HTMLResponse
from pydantic import BaseModel
from typing import Optional, List
import asyncio
import csv
import hashlib
import io
import json
import logging
import os
import secrets
import requests
from urllib.parse import urlparse
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from time import time

from database_factory import get_database
from scraper_service import ScraperService
from email_service import EmailService
from embedding_service import get_embedding_service
from idea_filter import get_search_text_for_embedding
from og_image_generator import get_og_image_generator
from company_cache import CompanyCache
from coresignal_service import coresignal_service
from hiring_service import get_hiring_service
from gamification_scoring import GamificationScorer
from perplexity_service import get_perplexity_service
from hero_service import build_verdict
import ratelimit

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Hide the internal API's docs/OpenAPI in production so admin/cron routes aren't published.
# The public API keeps its own docs at /api/v1/docs.
_IS_PROD = os.environ.get("ENV", "").lower() == "production"
app = FastAPI(
    title="YC Company Scraper API",
    version="1.0.0",
    docs_url=None if _IS_PROD else "/docs",
    redoc_url=None if _IS_PROD else "/redoc",
    openapi_url=None if _IS_PROD else "/openapi.json",
)


# Rate Limiter for Research Endpoint
class ResearchRateLimiter:
    """Simple rate limiter for research requests (5 requests per minute per IP)"""
    def __init__(self, max_requests: int = 5, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> bool:
        """Check if request is allowed for this client IP"""
        now = time()
        # Remove old requests outside the window
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if now - req_time < self.window_seconds
        ]

        # Check if within limit
        if len(self.requests[client_ip]) >= self.max_requests:
            return False

        # Add new request
        self.requests[client_ip].append(now)
        return True

    def get_reset_time(self, client_ip: str) -> int:
        """Get seconds until rate limit resets"""
        if not self.requests[client_ip]:
            return 0
        oldest_request = min(self.requests[client_ip])
        reset_time = int(oldest_request + self.window_seconds - time())
        return max(0, reset_time)


research_rate_limiter = ResearchRateLimiter(max_requests=5, window_seconds=60)

# Additional IP-based limiters for expensive / abuse-prone endpoints.
# Each one wraps an LLM call, an email send, or a long-running background job —
# without these an unauthenticated `for` loop can drain provider balances.
validate_idea_limiter = ResearchRateLimiter(max_requests=5, window_seconds=60)
gamified_predict_limiter = ResearchRateLimiter(max_requests=5, window_seconds=60)
research_query_limiter = ResearchRateLimiter(max_requests=5, window_seconds=60)
subscribe_limiter = ResearchRateLimiter(max_requests=3, window_seconds=60)
scrape_limiter = ResearchRateLimiter(max_requests=3, window_seconds=3600)
dev_auth_limiter = ResearchRateLimiter(max_requests=10, window_seconds=3600)  # signup/login per IP


def _enforce_rate_limit(limiter: ResearchRateLimiter, request_obj: Request, label: str) -> None:
    """Raise HTTP 429 if the caller's IP has exceeded `limiter`."""
    client_ip = request_obj.client.host if request_obj.client else "unknown"
    if not limiter.is_allowed(client_ip):
        reset = limiter.get_reset_time(client_ip)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded for {label}. Try again in {reset} seconds.",
        )


def _log_startup_warnings():
    """Log warnings for missing config at startup"""
    if not os.environ.get("RESEND_API_KEY"):
        logger.warning("RESEND_API_KEY not set - email subscriptions will save but verification emails will NOT be sent")


def _safe_string(value) -> str:
    """Safely convert any value to string, handling lists and None"""
    if isinstance(value, list):
        value = value[0] if value else ""
    if value is None:
        return ""
    return str(value)


# CORS - allow localhost + production frontend (including www variant)
_cors_origins = ["http://localhost:5173", "http://localhost:3000", "https://www.workatastartup.com"]
if os.environ.get("FRONTEND_URL"):
    url = os.environ["FRONTEND_URL"].rstrip("/")
    if url not in _cors_origins:
        _cors_origins.append(url)
    # Also allow www variant (e.g. www.exploreyc.com when FRONTEND_URL is exploreyc.com)
    if url.startswith("https://"):
        domain = url.replace("https://", "")
        if not domain.startswith("www."):
            www_url = f"https://www.{domain}"
            if www_url not in _cors_origins:
                _cors_origins.append(www_url)
    elif url.startswith("http://"):
        domain = url.replace("http://", "")
        if not domain.startswith("www."):
            www_url = f"http://www.{domain}"
            if www_url not in _cors_origins:
                _cors_origins.append(www_url)
if os.environ.get("VERCEL_URL"):
    u = f"https://{os.environ['VERCEL_URL']}"
    if u not in _cors_origins:
        _cors_origins.append(u)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
)

# Initialize database, scraper service, email service, and company cache
db = get_database()
scraper = ScraperService(db)
from a16z_scraper_service import A16ZScraperService
a16z_scraper = A16ZScraperService(db)
email_service = EmailService()
company_cache = CompanyCache()


def get_last_2_years_batches() -> List[str]:
    """Get YC batch names for the last 2 years (e.g., Summer 2024, Winter 2024, ...)"""
    from datetime import date
    current_year = date.today().year
    seasons = ["Winter", "Spring", "Summer", "Fall"]
    batches = []
    for year in [current_year - 2, current_year - 1, current_year]:
        for season in seasons:
            batches.append(f"{season} {year}")
    return batches


@app.on_event("startup")
async def startup_check_database():
    """Check database status on startup and load company cache"""
    _log_startup_warnings()
    company_cache.load(db)
    stats = company_cache.get_stats()
    logger.info(f"Startup: Company cache loaded with {stats['total_companies']:,} companies (hiring: {stats['hiring']:,}, batches: {len(stats['by_batch'])})")

    # Load hiring board cache
    hiring_service = get_hiring_service()
    hiring_service.cache.load(db)
    hiring_stats = hiring_service.get_hiring_stats()
    logger.info(f"Startup: Hiring cache loaded with {hiring_stats.get('totalJobs', 0):,} jobs from {hiring_stats.get('hiringCompanies', 0):,} companies")

    # Note: Removed automatic scraping on startup since we now have a complete database
    # Use the /api/scrape endpoint or run scrape_all_by_batch.py to update companies

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()


# Admin Session Management
admin_sessions = {}  # {token: {username: str, expires: datetime}}

def create_admin_session(username: str) -> str:
    """Create a new admin session token"""
    token = secrets.token_urlsafe(32)
    admin_sessions[token] = {
        "username": username,
        "expires": datetime.utcnow() + timedelta(hours=24)
    }
    return token

def verify_admin_session(authorization: Optional[str] = Header(None)) -> dict:
    """Verify admin session token from Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = authorization.replace("Bearer ", "")

    session = admin_sessions.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    if session["expires"] < datetime.utcnow():
        del admin_sessions[token]
        raise HTTPException(status_code=401, detail="Session expired")

    return session


# Pydantic models
class AdminLoginRequest(BaseModel):
    username: str
    password: str



class ScrapeRequest(BaseModel):
    query: str = ""
    batch: Optional[List[str]] = None
    industry: Optional[List[str]] = None
    region: Optional[List[str]] = None
    is_hiring: Optional[bool] = None
    top_company: Optional[bool] = None
    nonprofit: Optional[bool] = None
    hits_per_page: int = 1000
    max_pages: int = 10
    source: str = "yc"  # 'yc' (Algolia) or 'a16z' (portfolio page)


class CompanyFilter(BaseModel):
    limit: int = 100
    offset: int = 0
    batch: Optional[str] = None
    is_hiring: Optional[bool] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    search: Optional[str] = None
    top_company: Optional[bool] = None
    source: Optional[str] = None  # None -> YC only, 'all' -> every source, or a source key
    merged: bool = False  # collapse same-domain rows across sources into one card


# Background task storage
active_jobs = {}


# Routes
@app.get("/")
async def root():
    return {"message": "YC Company Scraper API", "version": "1.0.0"}


@app.get("/api/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


# Admin Authentication Endpoints
@app.post("/api/admin/login")
async def admin_login(request: AdminLoginRequest):
    """Admin login endpoint"""
    admin_username = os.environ.get("ADMIN_USERNAME")
    admin_password = os.environ.get("ADMIN_PASSWORD")

    if not admin_username or not admin_password:
        raise HTTPException(status_code=500, detail="Admin credentials not configured")

    if request.username != admin_username or request.password != admin_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_admin_session(request.username)

    return {
        "token": token,
        "username": request.username,
        "expires_in": 86400  # 24 hours in seconds
    }


@app.post("/api/admin/logout")
async def admin_logout(session: dict = Depends(verify_admin_session), authorization: str = Header(None)):
    """Admin logout endpoint"""
    token = authorization.replace("Bearer ", "")
    if token in admin_sessions:
        del admin_sessions[token]

    return {"message": "Logged out successfully"}


@app.get("/api/admin/session")
async def admin_session_check(session: dict = Depends(verify_admin_session)):
    """Check if admin session is valid"""
    return {
        "username": session["username"],
        "expires": session["expires"].isoformat()
    }


@app.get("/api/admin/email-config")
async def get_email_config(session: dict = Depends(verify_admin_session)):
    """Get email configuration status"""
    from email_service import EmailService

    email_service = EmailService()

    return {
        "resend_configured": bool(email_service.api_key and not email_service.api_key.startswith("re_your")),
        "from_email": email_service.from_email,
        "cron_secret_configured": bool(os.environ.get("CRON_SECRET"))
    }


@app.post("/api/admin/test-verification-email")
async def send_test_verification_email(
    request: dict,
    session: dict = Depends(verify_admin_session)
):
    """Send a test verification email"""
    from email_service import EmailService
    import secrets

    email = request.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email address required")

    email_service = EmailService()

    if not email_service.api_key or email_service.api_key.startswith("re_your"):
        raise HTTPException(
            status_code=500,
            detail="RESEND_API_KEY not configured. Set it in environment variables."
        )

    # Generate a test token
    test_token = secrets.token_urlsafe(32)

    # Send the email
    success = email_service.send_verification_email(email, test_token)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send email. Check logs for details.")

    return {
        "success": True,
        "message": f"Test verification email sent to {email}",
        "email": email
    }


@app.get("/api/admin/enrichment/stats")
async def get_enrichment_stats(session: dict = Depends(verify_admin_session)):
    """Get enrichment statistics and progress"""
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Total companies (YC only — Coresignal enrichment is YC-scoped)
            cursor.execute("SELECT COUNT(*) FROM companies WHERE source = 'yc'")
            total_companies = cursor.fetchone()[0]

            # Companies enriched (have coresignal data)
            cursor.execute("SELECT COUNT(*) FROM companies WHERE coresignal_last_updated IS NOT NULL")
            enriched_count = cursor.fetchone()[0]

            # Companies with funding data
            cursor.execute("SELECT COUNT(*) FROM companies WHERE funding_total_usd IS NOT NULL")
            with_funding_amount = cursor.fetchone()[0]

            # Companies with funding rounds (but maybe no amount)
            cursor.execute("SELECT COUNT(*) FROM companies WHERE funding_last_round_name IS NOT NULL")
            with_funding_rounds = cursor.fetchone()[0]

            # Recent enrichments (last 24 hours)
            # PostgreSQL syntax
            cursor.execute("""
                SELECT COUNT(*) FROM companies
                WHERE coresignal_last_updated IS NOT NULL
                AND coresignal_last_updated > NOW() - INTERVAL '1 day'
            """)
            recent_enrichments = cursor.fetchone()[0]

            # Top enriched companies
            cursor.execute("""
                SELECT id, name, batch, funding_total_usd, funding_last_round_name, funding_last_round_date, investors_count
                FROM companies
                WHERE coresignal_last_updated IS NOT NULL
                ORDER BY funding_total_usd DESC NULLS LAST
                LIMIT 10
            """)
            top_enriched = []
            for row in cursor.fetchall():
                top_enriched.append({
                    "id": row[0],
                    "name": row[1],
                    "batch": row[2],
                    "funding_total_usd": row[3],
                    "funding_last_round_name": row[4],
                    "funding_last_round_date": row[5],
                    "investors_count": row[6]
                })

            return {
                "total_companies": total_companies,
                "enriched_count": enriched_count,
                "unenriched_count": total_companies - enriched_count,
                "with_funding_amount": with_funding_amount,
                "with_funding_rounds": with_funding_rounds,
                "recent_enrichments_24h": recent_enrichments,
                "enrichment_percentage": round((enriched_count / total_companies * 100), 2) if total_companies > 0 else 0,
                "funding_data_percentage": round((with_funding_amount / enriched_count * 100), 2) if enriched_count > 0 else 0,
                "top_enriched": top_enriched,
                "coresignal_enabled": coresignal_service.enabled
            }

    except Exception as e:
        logger.error(f"Error getting enrichment stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scrape")
async def start_scrape(request: ScrapeRequest, background_tasks: BackgroundTasks, request_obj: Request):
    """Start a new scraping job"""
    _enforce_rate_limit(scrape_limiter, request_obj, "scrape jobs")

    # Create job in database
    job_id = db.create_scrape_job({
        'source': request.source,
        'query': request.query,
        'batch': request.batch,
        'industry': request.industry,
        'region': request.region,
        'is_hiring': request.is_hiring,
        'top_company': request.top_company,
        'nonprofit': request.nonprofit,
        'hits_per_page': request.hits_per_page,
        'max_pages': request.max_pages,
    })

    # Progress callback for WebSocket updates
    async def progress_callback(data):
        await manager.broadcast(data)

    # Start scraping in background
    async def run_scrape():
        try:
            if request.source == "a16z":
                total = await a16z_scraper.scrape_companies(
                    job_id=job_id,
                    progress_callback=progress_callback,
                )
            else:
                total = await scraper.scrape_companies(
                    job_id=job_id,
                    query=request.query,
                    batch=request.batch,
                    industry=request.industry,
                    region=request.region,
                    is_hiring=request.is_hiring,
                    top_company=request.top_company,
                    nonprofit=request.nonprofit,
                    hits_per_page=request.hits_per_page,
                    max_pages=request.max_pages,
                    progress_callback=progress_callback
                )
            active_jobs[job_id] = {'status': 'completed', 'total': total}
        except Exception as e:
            active_jobs[job_id] = {'status': 'failed', 'error': str(e)}
        finally:
            # Refresh in-memory cache after scrape completes (success or failure)
            company_cache.refresh(db)

    # Schedule background task
    asyncio.create_task(run_scrape())
    active_jobs[job_id] = {'status': 'running'}

    return {
        "job_id": job_id,
        "status": "started",
        "message": "Scraping job started"
    }


@app.get("/api/scrape/status/{job_id}")
async def get_scrape_status(job_id: int):
    """Get the status of a scraping job"""
    job = db.get_scrape_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": job_id,
        "status": job['status'],
        "total_scraped": job['total_scraped'],
        "current_page": job['current_page'],
        "error": job['error'],
        "created_at": job['created_at'],
        "updated_at": job['updated_at']
    }


@app.post("/api/companies")
async def get_companies(filters: CompanyFilter):
    """Get companies with filters and pagination"""

    companies = company_cache.get_companies(
        limit=filters.limit,
        offset=filters.offset,
        batch=filters.batch,
        is_hiring=filters.is_hiring,
        industry=filters.industry,
        country=filters.country,
        search=filters.search,
        top_company=filters.top_company,
        source=filters.source,
        merged=filters.merged,
    )

    total = company_cache.count_companies(
        batch=filters.batch,
        is_hiring=filters.is_hiring,
        industry=filters.industry,
        country=filters.country,
        search=filters.search,
        top_company=filters.top_company,
        source=filters.source,
        merged=filters.merged,
    )

    return {
        "companies": companies,
        "total": total,
        "limit": filters.limit,
        "offset": filters.offset,
        "has_more": (filters.offset + filters.limit) < total
    }


@app.get("/api/companies/{company_id}")
async def get_company(company_id: int):
    """Get a single company by ID"""
    company = company_cache.get_company_by_id(company_id)

    # Fallback to DB when cache miss (e.g. funding network companies not yet in cache)
    if not company and hasattr(db, "get_company_by_id"):
        company = db.get_company_by_id(company_id)

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    return company


@app.get("/api/company/slug/{slug}")
async def get_company_by_slug(slug: str):
    """Get a single company by slug (URL-friendly name)"""
    # Find company by slug in cache
    companies = company_cache.get_all_companies()
    company = next((c for c in companies if c.get('slug') == slug), None)

    # Fallback to DB when cache miss
    if not company and hasattr(db, "get_company_by_slug"):
        company = db.get_company_by_slug(slug)

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    return company


class SimilarQuery(BaseModel):
    query: str
    limit: int = 12


@app.post("/api/companies/similar")
async def companies_similar(body: SimilarQuery):
    """All-source semantic search: return companies across every source most similar
    to a free-text query, deduped by domain. Vector search spans the full corpus
    (YC + Hacker News + a16z + ...), unlike the YC-scoped hero idea-validator."""
    if not body.query or not body.query.strip():
        raise HTTPException(status_code=400, detail="query is required")
    if not hasattr(db, "find_similar_companies_by_embedding"):
        raise HTTPException(status_code=503, detail="Semantic search unavailable (no vector DB)")
    if db.count_companies_with_embeddings() == 0:
        raise HTTPException(status_code=503, detail="Company embeddings not yet generated")
    search_text = get_search_text_for_embedding(body.query, min_length=3)
    embedding = get_embedding_service().generate_embedding_for_idea(search_text)
    # source_filter=None -> all sources, deduped by dedupe_key
    results = db.find_similar_companies_by_embedding(
        embedding, limit=min(body.limit, 50), min_similarity=0.3
    )
    return {"companies": results, "total": len(results)}


# Allowed domains for logo proxy (YC and common CDNs)
_LOGO_PROXY_ALLOWED = (
    "yc.co", "ycombinator.com", "bookface-images.s3.amazonaws.com", "s3.amazonaws.com",
    "res.cloudinary.com", "cloudinary.com", "logo.clearbit.com", "logo.dev", "amazonaws.com",
)


@app.get("/api/logo-proxy")
async def proxy_logo(url: str):
    """Proxy company logos to avoid CORS/referrer blocking (e.g. Stripe)."""
    if not url or not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid URL")
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower().replace("www.", "")
        if not any(allowed in domain for allowed in _LOGO_PROXY_ALLOWED):
            raise HTTPException(status_code=400, detail="Domain not allowed")
        r = requests.get(url, timeout=5, headers={"User-Agent": "YCExplorer/1.0"}, stream=True)
        r.raise_for_status()
        content_type = r.headers.get("Content-Type", "image/png")
        return Response(content=r.content, media_type=content_type)
    except requests.RequestException as e:
        logger.warning(f"Logo proxy failed for {url[:80]}: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch image")


@app.get("/api/stats")
async def get_stats():
    """Get database statistics"""
    return company_cache.get_stats()


@app.get("/api/bootstrap")
async def get_bootstrap(recent_batches: int = 4):
    """
    Single endpoint for initial load: stats + map companies in one round-trip.
    Limits map to recent_batches for smaller payload (~60% smaller).
    """
    stats = company_cache.get_stats()
    companies = company_cache.get_companies_for_map(recent_batches=recent_batches)
    total_map = company_cache.get_total_map_companies()
    return {"stats": stats, "companies": companies, "total": len(companies), "total_map": total_map}


@app.get("/api/map")
async def get_map_data(
    batch: Optional[str] = None,
    is_hiring: Optional[bool] = None,
    recent_batches: Optional[int] = None,
):
    """Get companies with geo coordinates for map"""
    companies = company_cache.get_companies_for_map(
        batch=batch, is_hiring=is_hiring, recent_batches=recent_batches
    )
    return {"companies": companies, "total": len(companies)}


@app.get("/api/filters/sources")
async def get_sources():
    """Get available company sources (incubators/VCs) with counts"""
    return {"sources": company_cache.get_sources()}


@app.get("/api/filters/batches")
async def get_batches():
    """Get list of unique batches"""
    batches = company_cache.get_unique_batches()
    return {"batches": batches}


@app.get("/api/filters/industries")
async def get_industries():
    """Get list of unique industries"""
    industries = company_cache.get_unique_industries()
    return {"industries": industries}


@app.get("/api/filters/countries")
async def get_countries():
    """Get list of unique countries"""
    countries = company_cache.get_unique_countries()
    return {"countries": countries}


# Data export (CSV/JSON) is currently disabled. The endpoints are kept so direct
# callers get a clear 503 instead of a 404. Users can register interest for the
# feature via POST /api/feature-interest (see below).
_EXPORT_DISABLED_DETAIL = "Data export is temporarily unavailable."


@app.get("/api/export/json")
async def export_json():
    """Disabled — data export is temporarily unavailable."""
    raise HTTPException(status_code=503, detail=_EXPORT_DISABLED_DETAIL)


@app.get("/api/export/csv")
async def export_csv():
    """Disabled — data export is temporarily unavailable."""
    raise HTTPException(status_code=503, detail=_EXPORT_DISABLED_DETAIL)


@app.websocket("/ws/scrape")
async def websocket_scrape(websocket: WebSocket):
    """WebSocket endpoint for real-time scrape updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ============================================================================
# EMAIL SUBSCRIPTION ENDPOINTS
# ============================================================================

class SubscriptionRequest(BaseModel):
    email: str
    preferences: Optional[dict] = {}


class UnsubscribeRequest(BaseModel):
    token: str


@app.post("/api/subscribe")
async def subscribe_to_emails(request: SubscriptionRequest, request_obj: Request):
    """Subscribe to daily email notifications"""
    _enforce_rate_limit(subscribe_limiter, request_obj, "subscriptions")
    import secrets

    # Generate verification and unsubscribe tokens
    verification_token = secrets.token_urlsafe(32)
    unsubscribe_token = secrets.token_urlsafe(32)

    try:
        subscription_id = db.create_subscription(
            email=request.email,
            verification_token=verification_token,
            unsubscribe_token=unsubscribe_token,
            preferences=request.preferences
        )

        # Send verification email
        email_sent = email_service.send_verification_email(request.email, verification_token)

        return {
            "success": True,
            "subscription_id": subscription_id,
            "message": "Please check your email to verify your subscription",
            "email_sent": email_sent
        }
    except Exception as e:
        logger.error(f"Subscription error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/verify-email/{token}")
async def verify_email(token: str):
    """Verify email subscription"""
    try:
        # Get email before verify clears the token (Postgres only)
        subscription = getattr(db, "get_subscription_by_verification_token", lambda t: None)(token)
        if not subscription:
            success = db.verify_email(token)
            if not success:
                raise HTTPException(status_code=404, detail="Invalid or expired verification token")
        else:
            success = db.verify_email(token)
            if success:
                email_service.send_welcome_confirmation(subscription["email"])
            else:
                raise HTTPException(status_code=404, detail="Invalid or expired verification token")

        return {"success": True, "message": "Email verified successfully!"}
    except Exception as e:
        logger.error(f"Verification error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/unsubscribe")
async def unsubscribe(request: UnsubscribeRequest):
    """Unsubscribe from email notifications"""
    try:
        success = db.unsubscribe(request.token)
        if success:
            return {"success": True, "message": "Successfully unsubscribed"}
        else:
            raise HTTPException(status_code=404, detail="Invalid unsubscribe token")
    except Exception as e:
        logger.error(f"Unsubscribe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/subscription/{email}")
async def get_subscription(email: str):
    """Get subscription details (for settings page)"""
    subscription = db.get_subscription(email)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    # Remove sensitive tokens from response
    subscription.pop("verification_token", None)
    subscription.pop("unsubscribe_token", None)
    return subscription


@app.put("/api/subscription/{email}/preferences")
async def update_preferences(email: str, preferences: dict):
    """Update subscription preferences"""
    success = db.update_subscription_preferences(email, preferences)
    if success:
        return {"success": True, "message": "Preferences updated"}
    else:
        raise HTTPException(status_code=404, detail="Subscription not found")


class ContactFormRequest(BaseModel):
    email: str
    message: str
    name: Optional[str] = ""


@app.post("/api/contact")
async def submit_contact_form(request: ContactFormRequest):
    """Submit contact/feature idea form (emails to ideas@exploreyc.com via Resend)"""
    if not request.email or not request.message.strip():
        raise HTTPException(status_code=400, detail="Email and message are required")
    success = email_service.send_contact_form(
        email=request.email,
        message=request.message.strip(),
        name=(request.name or "").strip(),
    )
    if success:
        return {"success": True, "message": "Thanks! We'll get back to you soon."}
    raise HTTPException(status_code=500, detail="Failed to send message")


# ============================================================================
# STARTUP IDEA VALIDATOR ENDPOINTS
# ============================================================================

class IdeaValidationRequest(BaseModel):
    idea: str
    max_similar: Optional[int] = 10

class IdeaValidationResponse(BaseModel):
    similar_companies: List[dict]
    total_similar: int
    market_indicator: str  # "green", "yellow", or "crowded"
    market_analysis: str
    industry_breakdown: dict
    batch_timeline: List[dict]
    market_size_percentage: float


# ============================================================================
# GAMIFIED SUCCESS PREDICTOR MODELS
# ============================================================================

class FounderInfo(BaseModel):
    count: Optional[int] = None
    expertise: Optional[List[str]] = None
    has_repeat_founder: Optional[bool] = False
    has_complementary_skills: Optional[bool] = False


class GamifiedPredictionRequest(BaseModel):
    idea_description: str
    industry: str
    market_type: Optional[str] = "B2B"
    location: Optional[str] = None
    founder_info: Optional[FounderInfo] = None
    max_matches: Optional[int] = 10


class GamifiedPredictionResponse(BaseModel):
    prediction_id: str
    idea_score: int
    team_score: Optional[int]
    market_score: int
    combined_score: int
    percentile: int
    tier: str
    tier_emoji: str
    similar_companies: List[dict]
    achievements: List[dict]
    challenges: List[dict]
    leaderboard_position: int


@app.post("/api/validate-idea", response_model=IdeaValidationResponse)
async def validate_startup_idea(request: IdeaValidationRequest, request_obj: Request):
    """
    Validate a startup idea by finding similar companies in the YC portfolio

    Uses semantic similarity search with OpenAI embeddings to find companies
    working on similar problems/solutions.

    Returns market analysis including:
    - List of similar companies with similarity scores
    - Market indicator (green/yellow/crowded)
    - Industry breakdown
    - Batch timeline showing when similar companies were founded
    - Market size as percentage of total YC portfolio
    """
    try:
        _enforce_rate_limit(validate_idea_limiter, request_obj, "idea validation")

        # Validate input
        if not request.idea or len(request.idea.strip()) < 10:
            raise HTTPException(
                status_code=400,
                detail="Idea description must be at least 10 characters"
            )

        idea_text = request.idea.strip()
        max_similar = min(request.max_similar, 50)  # Cap at 50

        # Filter generic AI words before embedding (they add little discriminative value)
        search_text = get_search_text_for_embedding(idea_text, min_length=10)

        logger.info(f"Validating idea (length: {len(idea_text)} chars, search_text: {len(search_text)} chars, max_similar: {max_similar})")

        # Step 1: Generate embedding for the user's idea (using filtered text)
        try:
            embedding_service = get_embedding_service()
            idea_embedding = embedding_service.generate_embedding_for_idea(search_text)
            logger.info(f"Generated embedding with {len(idea_embedding)} dimensions")
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate embedding for idea: {str(e)}"
            )

        # Step 2: Find similar companies using vector similarity search
        try:
            # Check if embeddings exist: if none, return helpful error
            with_embeddings = db.count_companies_with_embeddings()
            if with_embeddings == 0:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Company embeddings not yet generated. Run this one-time setup: "
                        "python scripts/generate_embeddings.py (requires OPENAI_API_KEY)"
                    )
                )
            similar_companies = db.find_similar_companies_by_embedding(
                embedding=idea_embedding,
                limit=max_similar,
                min_similarity=0.32,  # Lower threshold to catch pasted descriptions & near-matches
                source_filter="yc",   # Hero verdict is YC-framed (market-size % = % of YC companies)
            )
            logger.info(f"Found {len(similar_companies)} similar companies (embedding)")

            # Fallback: when embedding returns nothing, try text search (catches pasted company descriptions)
            if len(similar_companies) == 0 and hasattr(db, 'find_companies_by_text_search'):
                text_matches = db.find_companies_by_text_search(idea_text, limit=max_similar, source_filter="yc")
                if text_matches:
                    similar_companies = text_matches
                    logger.info(f"Fallback text search found {len(similar_companies)} companies")
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to search for similar companies: {str(e)}"
            )

        # Step 3: Analyze the market based on findings
        try:
            market_analysis = db.get_market_analysis(similar_companies)
            logger.info(f"Market indicator: {market_analysis['market_indicator']}")
        except Exception as e:
            logger.error(f"Market analysis failed: {e}")
            # Continue with basic analysis if detailed analysis fails
            market_analysis = {
                "total_similar": len(similar_companies),
                "market_indicator": "yellow",
                "market_analysis": f"Found {len(similar_companies)} similar companies",
                "industry_breakdown": {},
                "batch_timeline": [],
                "market_size_percentage": 0
            }

        # Step 4: Return comprehensive validation result
        return {
            "similar_companies": similar_companies,
            "total_similar": market_analysis["total_similar"],
            "market_indicator": market_analysis["market_indicator"],
            "market_analysis": market_analysis["market_analysis"],
            "industry_breakdown": market_analysis["industry_breakdown"],
            "batch_timeline": market_analysis["batch_timeline"],
            "market_size_percentage": market_analysis["market_size_percentage"]
        }

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error in idea validation: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )


# ============================================================================
# HERO ANSWER BOX ENDPOINT — instant, deterministic, cached
# ============================================================================

class HeroAnswerRequest(BaseModel):
    idea: str


@app.post("/api/hero-answer")
async def hero_answer(req: HeroAnswerRequest, request: Request):
    """
    Instant deterministic answer for the homepage hero box.

    Uses pgvector similarity search + build_verdict() — NO LLM chat calls.
    Results are cached by SHA-1 of the lowercased idea for 24 hours.
    """
    idea = (req.idea or "").strip()
    if len(idea) < 10:
        raise HTTPException(status_code=400, detail="Describe the idea in a bit more detail.")

    ip = request.client.host if request.client else "unknown"
    allowed, retry = ratelimit.check_rate_limit(f"hero:{ip}", limit=15, window_seconds=60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Slow down — try again in {retry}s.")

    key = hashlib.sha1(idea.lower().encode()).hexdigest()

    # Return cached result if available. Cache read is non-fatal: if the
    # idea_answer_cache table doesn't exist yet (migration not applied), or any
    # transient DB issue occurs, degrade to computing a fresh answer rather than
    # 500-ing the search.
    if hasattr(db, "get_idea_answer_cache"):
        try:
            cached = db.get_idea_answer_cache(key)
            # Self-heal stale entries: a cache row written before the breakdown
            # enrichment shipped lacks "all_matches". Treat those as a miss so we
            # recompute and re-cache the full payload (companies + charts).
            if cached and cached.get("all_matches") is not None:
                return {**cached, "cached": True}
        except Exception as e:
            logger.warning(f"hero cache read failed (non-fatal): {e}")

    # Guard: require embeddings to be present
    if not hasattr(db, "count_companies_with_embeddings"):
        raise HTTPException(status_code=503, detail="Semantic search unavailable in this environment.")
    if db.count_companies_with_embeddings() == 0:
        raise HTTPException(status_code=503, detail="Company embeddings not yet generated.")

    # Embed → similarity search → verdict (zero LLM chat calls).
    # Wrap in try/except so an embedding/search failure (e.g. OpenAI quota,
    # transient DB error) returns a handled 503 — which passes through the CORS
    # middleware — instead of a raw 500 that arrives at the browser without CORS
    # headers (surfacing as a confusing cross-origin error).
    # source_filter="yc": the hero verdict is YC-framed (market-size % = % of YC).
    try:
        search_text = get_search_text_for_embedding(idea)
        embedding = get_embedding_service().generate_embedding_for_idea(search_text)
        similar = db.find_similar_companies_by_embedding(embedding, limit=12, min_similarity=0.32, source_filter="yc")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"hero-answer search failed: {e}")
        raise HTTPException(
            status_code=503,
            detail="Search is temporarily unavailable — please try again shortly.",
        )

    # Portfolio total: use YC-only count so the denominator matches the YC-only
    # numerator in market_size_percentage (both must be source='yc').
    portfolio_total = db.get_yc_company_count() if hasattr(db, "get_yc_company_count") else 6000

    verdict = build_verdict(idea, similar, portfolio_total)

    # Enrich with the full match set + breakdowns so the dedicated /idea page can
    # render charts and the complete company grid WITHOUT re-embedding (reuses the
    # `similar` set we already retrieved). Cheap: pure Python + one COUNT query.
    # Non-fatal — the compact answer card doesn't depend on these.
    try:
        if hasattr(db, "get_market_analysis"):
            analysis = db.get_market_analysis(similar)
            verdict["all_matches"] = similar
            verdict["industry_breakdown"] = analysis.get("industry_breakdown", {})
            verdict["batch_timeline"] = analysis.get("batch_timeline", [])
            verdict["market_indicator"] = analysis.get("market_indicator")
    except Exception as e:
        logger.warning(f"hero breakdown enrichment failed (non-fatal): {e}")

    # Write cache (non-fatal)
    if hasattr(db, "set_idea_answer_cache"):
        try:
            db.set_idea_answer_cache(key, verdict, ttl_hours=24)
        except Exception as e:
            logger.error(f"hero cache write failed (non-fatal): {e}")

    return {**verdict, "cached": False, "prose": None}


# ============================================================================
# GAMIFIED SUCCESS PREDICTOR ENDPOINT
# ============================================================================

@app.post("/api/gamified-predict", response_model=GamifiedPredictionResponse)
async def gamified_startup_prediction(request: GamifiedPredictionRequest, request_obj: Request):
    """
    Predict startup success using gamification scoring.

    Combines:
    1. Idea quality based on semantic similarity to successful YC companies
    2. Team profile scoring (if provided)
    3. Market potential analysis
    4. Achievements and challenges unlocked

    Returns a gamified response with scores, tier, matched companies, and challenges.
    """
    try:
        _enforce_rate_limit(gamified_predict_limiter, request_obj, "predictions")
        # Validate input
        if not request.idea_description or len(request.idea_description.strip()) < 10:
            raise HTTPException(
                status_code=400,
                detail="Idea description must be at least 10 characters"
            )

        if not request.industry or len(request.industry.strip()) < 3:
            raise HTTPException(
                status_code=400,
                detail="Industry must be provided"
            )

        idea_text = request.idea_description.strip()
        industry = request.industry.strip()

        # Initialize gamification scorer
        scorer = GamificationScorer()

        # Step 1: Find similar companies (reuse idea validation logic)
        search_text = get_search_text_for_embedding(idea_text, min_length=10)
        logger.info(f"Predicting success for idea in {industry}")

        try:
            embedding_service = get_embedding_service()
            idea_embedding = embedding_service.generate_embedding_for_idea(search_text)
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate embedding: {str(e)}"
            )

        # Find similar companies
        try:
            with_embeddings = db.count_companies_with_embeddings()
            if with_embeddings == 0:
                raise HTTPException(
                    status_code=503,
                    detail="Company embeddings not yet generated"
                )

            max_matches = min(request.max_matches or 10, 50)
            matched_companies = db.find_similar_companies_by_embedding(
                embedding=idea_embedding,
                limit=max_matches,
                min_similarity=0.32,
                source_filter="yc",   # gamified predictor scores against YC portfolio
            )

            # Fallback to text search if needed
            if len(matched_companies) == 0 and hasattr(db, 'find_companies_by_text_search'):
                matched_companies = db.find_companies_by_text_search(idea_text, limit=max_matches, source_filter="yc")

        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to search for similar companies: {str(e)}"
            )

        if not matched_companies:
            raise HTTPException(
                status_code=400,
                detail="No similar companies found. Try rewording your idea."
            )

        # Step 2: Get market analysis
        try:
            market_analysis = db.get_market_analysis(matched_companies)
            market_indicator = market_analysis.get("market_indicator", "yellow")
        except Exception as e:
            logger.error(f"Market analysis failed: {e}")
            market_indicator = "yellow"

        # Step 3: Calculate scores
        # Idea quality score
        idea_score = scorer.calculate_idea_quality_score(
            idea_description=idea_text,
            market_indicator=market_indicator,
            similarity_score=max([c.get("similarity", 0) for c in matched_companies], default=0.5),
            matched_companies_count=len(matched_companies)
        )

        # Team profile score (if provided)
        team_score = None
        if request.founder_info:
            team_score = scorer.calculate_team_profile_score(
                founder_count=request.founder_info.count,
                founder_expertise=request.founder_info.expertise,
                has_repeat_founder=request.founder_info.has_repeat_founder or False,
                has_complementary_skills=request.founder_info.has_complementary_skills or False
            )

        # Market potential score
        market_score = scorer.calculate_market_potential_score(
            market_type=request.market_type or "B2B",
            industry_growth_tier=market_analysis.get("market_indicator", "yellow"),
            industry_name=industry,
            competition_level=market_indicator
        )

        # Combined score
        combined_score = scorer.calculate_combined_success_score(
            idea_score=idea_score,
            team_score=team_score,
            market_score=market_score
        )

        # Step 4: Get tier
        tier = scorer.get_tier(combined_score)
        tier_emoji = scorer.get_tier_emoji(tier)

        # Step 5: Calculate percentile
        # Get all YC company success scores for comparison
        all_company_scores = db.get_all_company_success_scores() if hasattr(db, 'get_all_company_success_scores') else []
        percentile = scorer.calculate_percentile(combined_score, all_company_scores) if all_company_scores else 50

        # Step 6: Determine achievements
        achievements = scorer.determine_achievements(
            idea_score=idea_score,
            team_score=team_score,
            market_score=market_score,
            combined_score=combined_score,
            market_indicator=market_indicator,
            industry_name=industry,
            idea_description=idea_text,
            matched_companies=matched_companies,
            has_repeat_founder=request.founder_info and request.founder_info.has_repeat_founder or False
        )

        # Step 7: Determine challenges
        challenges = scorer.determine_challenges(
            combined_score=combined_score,
            matched_companies=matched_companies,
            industry_name=industry,
            all_yc_scores=all_company_scores if all_company_scores else [50] * 100
        )

        # Step 8: Store prediction in database
        prediction_id = None
        leaderboard_position = 0
        try:
            founder_info_json = request.founder_info.dict() if request.founder_info else None
            prediction_id = db.store_prediction(
                idea_description=idea_text,
                team_info=founder_info_json,
                industry=industry,
                location=request.location,
                market_type=request.market_type,
                idea_score=idea_score,
                team_score=team_score,
                market_score=market_score,
                combined_score=combined_score,
                percentile=percentile,
                tier=tier,
                top_matches=matched_companies,
                achievements=achievements,
                challenges=challenges
            )

            # Get leaderboard position
            if hasattr(db, 'get_prediction_leaderboard_position'):
                leaderboard_position = db.get_prediction_leaderboard_position(combined_score)

        except Exception as e:
            logger.warning(f"Failed to store prediction: {e}")
            # Continue without storing - prediction is still valid

        return {
            "prediction_id": prediction_id or "temp",
            "idea_score": idea_score,
            "team_score": team_score,
            "market_score": market_score,
            "combined_score": combined_score,
            "percentile": percentile,
            "tier": tier,
            "tier_emoji": tier_emoji,
            "similar_companies": matched_companies[:5],  # Return top 5 matches
            "achievements": achievements,
            "challenges": challenges,
            "leaderboard_position": leaderboard_position
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in gamified prediction: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )


# ============================================================================
# GAMIFIED PREDICTOR LEADERBOARD & SOCIAL ENDPOINTS
# ============================================================================

@app.get("/api/leaderboard")
async def get_leaderboard(
    industry: Optional[str] = None,
    timeframe: str = "all-time",
    limit: int = 100
):
    """
    Get the leaderboard of startup predictions.

    Optional filters:
    - industry: Filter by specific industry
    - timeframe: 'all-time', 'this-week', 'this-month'
    - limit: Number of results (max 100)
    """
    try:
        limit = min(limit, 100)  # Cap at 100

        if hasattr(db, 'get_leaderboard'):
            leaderboard = db.get_leaderboard(
                industry=industry,
                timeframe=timeframe,
                limit=limit
            )
            return {"leaderboard": leaderboard, "count": len(leaderboard)}

        # Fallback response
        return {"leaderboard": [], "count": 0}

    except Exception as e:
        logger.error(f"Error fetching leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch leaderboard")


@app.get("/api/predictions/{prediction_id}")
async def get_prediction(prediction_id: str):
    """Get a specific prediction result."""
    try:
        if hasattr(db, 'get_prediction'):
            prediction = db.get_prediction(prediction_id)
            if prediction:
                return prediction

        raise HTTPException(status_code=404, detail="Prediction not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching prediction: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch prediction")


class SharePredictionRequest(BaseModel):
    is_public: bool = True
    share_message: Optional[str] = None


@app.post("/api/predictions/{prediction_id}/share")
async def share_prediction(prediction_id: str, request: SharePredictionRequest):
    """Make a prediction public and shareable."""
    try:
        if hasattr(db, 'update_prediction_sharing'):
            db.update_prediction_sharing(prediction_id, request.is_public)

            # Generate share token
            share_token = secrets.token_urlsafe(32)

            if hasattr(db, 'set_prediction_share_token'):
                db.set_prediction_share_token(prediction_id, share_token)

            return {
                "success": True,
                "prediction_id": prediction_id,
                "share_token": share_token,
                "share_url": f"https://exploreyc.com/predictor/shared/{share_token}"
            }

        raise HTTPException(status_code=500, detail="Failed to share prediction")

    except Exception as e:
        logger.error(f"Error sharing prediction: {e}")
        raise HTTPException(status_code=500, detail="Failed to share prediction")


@app.get("/api/predictions/shared/{share_token}")
async def get_shared_prediction(share_token: str):
    """Get a publicly shared prediction by token."""
    try:
        if hasattr(db, 'get_prediction_by_share_token'):
            prediction = db.get_prediction_by_share_token(share_token)
            if prediction:
                return prediction

        raise HTTPException(status_code=404, detail="Shared prediction not found or expired")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching shared prediction: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch prediction")


@app.get("/api/challenges")
async def get_active_challenges():
    """Get all active challenges in the gamification system."""
    try:
        from gamification_scoring import GamificationScorer
        scorer = GamificationScorer()

        return {
            "challenges": [
                {
                    "id": challenge_id,
                    "name": challenge["name"],
                    "description": challenge["description"],
                    "icon": challenge["icon"],
                    "reward_xp": challenge["reward_xp"]
                }
                for challenge_id, challenge in scorer.CHALLENGES.items()
            ]
        }

    except Exception as e:
        logger.error(f"Error fetching challenges: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch challenges")


# ============================================================================
# BATCH WRAPPED ENDPOINTS
# ============================================================================

def normalize_batch_name(batch_name: str) -> str:
    """
    Convert batch name to database format
    Examples:
      - "W24" -> "Winter 2024"
      - "S23" -> "Summer 2023"
      - "Winter 2024" -> "Winter 2024" (unchanged)
    """
    batch = batch_name.strip()

    # If already in full format, return as-is
    if any(season in batch for season in ["Winter", "Summer"]):
        return batch

    # Convert short format (e.g., "W24", "S23")
    if len(batch) >= 2:
        season_code = batch[0].upper()
        year_suffix = batch[1:]

        # Map season codes
        season_map = {
            'W': 'Winter',
            'S': 'Summer',
        }

        if season_code in season_map:
            # Convert 2-digit year to 4-digit
            try:
                year_num = int(year_suffix)
                # Assume 2000s for now (YC started in 2005)
                full_year = 2000 + year_num if year_num < 100 else year_num
                return f"{season_map[season_code]} {full_year}"
            except ValueError:
                pass

    # Return original if conversion fails
    return batch

class BatchWrappedResponse(BaseModel):
    batch: str
    total_companies: int
    hiring_count: int
    hiring_percentage: float
    top_industries: List[dict]
    top_countries: List[dict]
    avg_team_size: Optional[float]
    notable_companies: List[dict]
    fun_fact: str


@app.get("/api/batch/{batch_name}/wrapped", response_model=BatchWrappedResponse)
async def get_batch_wrapped(batch_name: str):
    """
    Get Wrapped-style statistics for a specific YC batch

    Returns comprehensive stats including:
    - Total companies and hiring statistics
    - Top 5 industries with percentages
    - Top 5 countries with percentages
    - Average team size
    - Notable companies
    - Fun facts about the batch
    """
    try:
        # Normalize batch name (e.g., "W24" -> "Winter 2024")
        batch_normalized = normalize_batch_name(batch_name)

        logger.info(f"Fetching wrapped stats for batch: {batch_normalized} (from {batch_name})")

        # Get batch stats from database
        stats = db.get_batch_wrapped_stats(batch_normalized)

        if not stats:
            raise HTTPException(
                status_code=404,
                detail=f"Batch '{batch_name}' not found or has no companies"
            )

        logger.info(f"Successfully retrieved stats for {batch_normalized}: {stats['total_companies']} companies")

        return stats

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching batch wrapped: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch batch wrapped stats: {str(e)}"
        )


@app.get("/api/batch/{batch_name}/og-image")
async def get_batch_og_image(batch_name: str):
    """
    Generate Open Graph image for batch wrapped page

    Returns a PNG image (1200x630px) suitable for social media sharing.
    The image includes batch stats in a visually appealing format.
    """
    try:
        # Normalize batch name (e.g., "W24" -> "Winter 2024")
        batch_normalized = normalize_batch_name(batch_name)

        logger.info(f"Generating OG image for batch: {batch_normalized} (from {batch_name})")

        # Get batch stats
        stats = db.get_batch_wrapped_stats(batch_normalized)

        if not stats:
            raise HTTPException(
                status_code=404,
                detail=f"Batch '{batch_name}' not found or has no companies"
            )

        # Generate OG image using Playwright
        og_generator = get_og_image_generator()
        image_bytes = await og_generator.generate_batch_wrapped_og_image(stats)

        logger.info(f"OG image generated for {batch_normalized}, size: {len(image_bytes)} bytes")

        # Return PNG image
        return StreamingResponse(
            io.BytesIO(image_bytes),
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
                "Content-Disposition": f"inline; filename={batch_normalized}_wrapped.png"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OG image generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate OG image: {str(e)}"
        )


# ============================================================================
# ROADMAP VOTING ENDPOINTS
# ============================================================================

class VoteRequest(BaseModel):
    user_identifier: str  # IP hash or session ID from frontend


@app.get("/api/roadmap/votes")
async def get_roadmap_votes():
    """Get vote counts for all features"""
    try:
        vote_counts = db.get_vote_counts()
        return {"votes": vote_counts}
    except Exception as e:
        logger.error(f"Get votes error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/roadmap/vote/{feature_id}")
async def vote_for_feature(feature_id: str, request: VoteRequest):
    """Vote for a roadmap feature"""
    try:
        success = db.add_vote(feature_id, request.user_identifier)
        if success:
            return {"success": True, "message": "Vote added"}
        else:
            return {"success": False, "message": "Already voted for this feature"}
    except Exception as e:
        logger.error(f"Vote error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/roadmap/vote/{feature_id}")
async def remove_vote_for_feature(feature_id: str, request: VoteRequest):
    """Remove vote for a roadmap feature"""
    try:
        success = db.remove_vote(feature_id, request.user_identifier)
        if success:
            return {"success": True, "message": "Vote removed"}
        else:
            return {"success": False, "message": "Vote not found"}
    except Exception as e:
        logger.error(f"Remove vote error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/roadmap/user-votes/{user_identifier}")
async def get_user_votes(user_identifier: str):
    """Get all features a user has voted for"""
    try:
        votes = db.get_user_votes(user_identifier)
        return {"feature_ids": votes}
    except Exception as e:
        logger.error(f"Get user votes error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class FeatureInterestRequest(BaseModel):
    feature: str = "db-export"          # which paused feature the interest is for
    email: Optional[str] = None         # optional — for "notify me when it's back"
    user_identifier: Optional[str] = None  # stable per-browser id to dedupe clicks


@app.post("/api/feature-interest")
async def register_feature_interest(request: FeatureInterestRequest):
    """Record that a user wants a currently-unavailable feature (e.g. data export).

    Deduplicated per (feature, user_identifier) so one browser counts once.
    Returns the running interest count so the UI can show demand.
    """
    feature = (request.feature or "").strip() or "db-export"
    email = (request.email or "").strip() or None
    try:
        result = db.record_feature_interest(
            feature=feature,
            user_identifier=(request.user_identifier or "").strip() or None,
            email=email,
        )
        return {
            "success": True,
            "feature": feature,
            "already_registered": not result["created"],
            "count": result["count"],
        }
    except Exception as e:
        logger.error(f"Feature interest error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# CRON JOB ENDPOINTS (Protected by secret token)
# ============================================================================

def _verify_cron_secret(request: Request):
    """Verify cron endpoints are called with correct secret"""
    cron_secret = (os.environ.get("CRON_SECRET") or "").strip()
    if not cron_secret:
        raise HTTPException(status_code=500, detail="CRON_SECRET not configured")
    expected = f"Bearer {cron_secret}"
    got = (request.headers.get("Authorization") or "").strip()
    if not got or got != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing Authorization")


async def _run_daily_scrape():
    """Background task: scrape YC API and update DB. Runs after response."""

    try:
        job_id = db.create_scrape_job({})
        total_scraped = await scraper.scrape_companies(
            job_id=job_id,
            hits_per_page=1000,
            max_pages=20,
        )
        company_cache.refresh(db)

        # Cleanup old changes (keep last 90 days only)
        deleted = db.cleanup_old_changes(days_to_keep=90)
        if deleted > 0:
            logger.info(f"Cleaned up {deleted} old change log entries (>90 days old)")

        # Generate embeddings for new companies using batch API
        embeddings_generated = 0
        try:
            if hasattr(db, "get_companies_for_embedding"):
                missing = db.get_companies_for_embedding(only_missing=True, limit=2000)
                if missing:
                    embedding_service = get_embedding_service()
                    texts = [get_search_text_for_embedding(db.build_company_embedding_text(c)) for c in missing]
                    vectors = embedding_service.generate_embeddings_batch(texts)
                    embeddings_generated = db.update_company_embeddings_batch([(c["id"], v) for c, v in zip(missing, vectors)])
                    logger.info(f"Daily embedding backfill: embedded {embeddings_generated} new companies")
                else:
                    logger.info("Daily embedding backfill: all companies already have embeddings")
        except Exception as e:
            logger.error(f"Daily embedding backfill failed (non-fatal): {e}")

        logger.info(f"Daily scrape completed: {total_scraped} companies, {embeddings_generated} embeddings, {deleted} changes cleaned")
        return {"scraped": total_scraped, "embeddings_generated": embeddings_generated, "cleaned_up": deleted}
    except Exception as e:
        logger.error(f"Daily scrape error: {e}")
        raise


@app.post("/api/cron/daily-scrape")
@app.post("/api/cron/daily-scrape-and-snapshot")  # Legacy alias for backward compatibility
async def daily_scrape(request: Request, background_tasks: BackgroundTasks):
    """Scrape YC for latest companies and update DB. Run daily before send-digests.
    Returns immediately in background (cron); use ?sync=1 for manual testing to wait for completion."""
    _verify_cron_secret(request)

    # ?sync=1 for manual testing: run in foreground so you get the result (curl can wait)
    sync_mode = request.query_params.get("sync", "").lower() in ("1", "true", "yes")

    if sync_mode:
        result = await _run_daily_scrape()
        return {
            "success": True,
            "status": "completed",
            "message": "Daily scrape completed (sync mode)",
            "scraped": result.get("scraped", 0),
            "embeddings_generated": result.get("embeddings_generated", 0),
            "cleaned_up": result.get("cleaned_up", 0),
        }

    background_tasks.add_task(_run_daily_scrape)
    return {
        "success": True,
        "status": "started",
        "message": "Daily scrape started in background. Check logs for completion.",
    }


async def _run_source_sync(full: bool = False):
    """Background task: pull new companies from all registered sources, embed, refresh."""
    from ingestion import sync_service
    # Guard: the multi-source migration must be applied first. Probe the sync_state
    # table so a missing migration surfaces a clear, actionable message rather than a
    # cryptic 500 mid-sync.
    try:
        db.get_sync_cursor("__schema_probe__")
    except Exception as e:
        msg = (
            "Multi-source schema not found — apply migration "
            "supabase/migrations/20260711130000_multi_source_sync.sql "
            "(adds companies.dedupe_key + the sync_state table) before syncing. "
            f"Underlying error: {e}"
        )
        logger.error(f"Source sync blocked: {msg}")
        raise HTTPException(status_code=503, detail=msg)
    try:
        db.backfill_dedupe_keys()
        results = sync_service.run_sync(db, full=full)
        embedded = sync_service.embed_missing(db)
        company_cache.refresh(db)
        logger.info(f"Source sync completed: {results}, embedded {embedded}")
        return {"results": results, "embedded": embedded}
    except Exception as e:
        logger.error(f"Source sync error: {e}")
        raise


@app.post("/api/cron/sync-sources")
async def cron_sync_sources(request: Request, background_tasks: BackgroundTasks):
    """Pull new companies from non-YC sources (Hacker News, ...), backfill dedupe_key
    + embeddings, and refresh the cache. ?full=1 forces a full backfill; ?sync=1 waits."""
    _verify_cron_secret(request)
    full = request.query_params.get("full", "").lower() in ("1", "true", "yes")
    sync_mode = request.query_params.get("sync", "").lower() in ("1", "true", "yes")

    if sync_mode:
        result = await _run_source_sync(full=full)
        return {"success": True, "status": "completed", **result}

    background_tasks.add_task(_run_source_sync, full)
    return {
        "success": True,
        "status": "started",
        "message": "Source sync started in background. Check logs for completion.",
    }


@app.post("/api/cron/update-hiring-board")
async def update_hiring_board_cron(request: Request, background_tasks: BackgroundTasks):
    """Update hiring board data from WorkAtAStartup API (triggered by daily cron)"""
    _verify_cron_secret(request)

    # ?sync=1 for manual testing: run in foreground
    sync_mode = request.query_params.get("sync", "").lower() in ("1", "true", "yes")

    async def _update_hiring():
        try:
            hiring_service = get_hiring_service()
            success = hiring_service.update_hiring_data(db)
            logger.info(f"Hiring board update {'completed' if success else 'failed'}")
            return {"success": success}
        except Exception as e:
            logger.error(f"Hiring board update error: {e}")
            return {"success": False, "error": str(e)}

    if sync_mode:
        result = await _update_hiring()
        return {
            "success": result.get("success", False),
            "status": "completed",
            "message": "Hiring board updated (sync mode)"
        }

    background_tasks.add_task(_update_hiring)
    return {
        "success": True,
        "status": "started",
        "message": "Hiring board update started in background"
    }


@app.post("/api/cron/send-digests")
async def send_daily_digests(request: Request):
    """Send daily email digests (triggered by cron)"""
    _verify_cron_secret(request)

    try:
        # Get changes from the last 24 hours using change log
        new_companies_raw = db.get_changes_by_type('created', hours=24)
        newly_hiring_raw = db.get_changes_by_type('hiring_started', hours=24)
        batch_changes_raw = db.get_changes_by_type('batch_changed', hours=24)

        new_companies = [
            {
                "id": change["company_id"],
                "name": change["company_name"],
                "batch": change.get("batch", ""),
                "one_liner": change.get("one_liner", ""),
                "website": change.get("website", ""),
                "slug": change.get("company_slug", ""),
                "logo": change.get("logo", ""),
            }
            for change in new_companies_raw
        ]

        newly_hiring = [
            {
                "id": change["company_id"],
                "name": change["company_name"],
                "batch": change.get("batch", ""),
                "one_liner": change.get("one_liner", ""),
                "website": change.get("website", ""),
                "slug": change.get("company_slug", ""),
                "logo": change.get("logo", ""),
                "is_hiring": True,
            }
            for change in newly_hiring_raw
        ]

        batch_changes = [
            {
                "id": change["company_id"],
                "name": change["company_name"],
                "old_batch": change.get("old_value", ""),
                "new_batch": change.get("new_value", ""),
                "slug": change.get("company_slug", ""),
            }
            for change in batch_changes_raw
        ]

        subscribers = db.get_active_subscriptions()

        sent_count = 0
        for subscriber in subscribers:
            # Filter changes by subscriber preferences
            prefs = subscriber.get("preferences") or {}
            if isinstance(prefs, str):
                try:
                    prefs = json.loads(prefs) if prefs else {}
                except json.JSONDecodeError:
                    prefs = {}
            filtered_new = new_companies if prefs.get("digest_new_companies", True) else []
            filtered_hiring = newly_hiring if prefs.get("digest_newly_hiring", True) else []
            filtered_batch = batch_changes if prefs.get("digest_batch_changes", True) else []

            # Send digest email
            success = email_service.send_daily_digest(
                email=subscriber["email"],
                unsubscribe_token=subscriber["unsubscribe_token"],
                new_companies=filtered_new,
                newly_hiring=filtered_hiring,
                batch_changes=filtered_batch
            )

            if success:
                sent_count += 1

        logger.info(f"Sent {sent_count} digest emails")

        return {
            "success": True,
            "emails_sent": sent_count,
            "changes": {
                "new_companies": len(new_companies),
                "newly_hiring": len(newly_hiring),
                "batch_changes": len(batch_changes)
            }
        }
    except Exception as e:
        logger.error(f"Send digests error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/digest-preview")
async def get_digest_preview(format: str = "html"):
    """Preview what would be sent in the daily digest (no emails sent).

    Defaults to rendering the actual email HTML so admins can verify the design
    in a browser tab. Pass ?format=json for raw counts and sample payloads.
    Falls back to sample data when no real changes exist in the last 24h.
    """
    try:
        new_companies_raw = db.get_changes_by_type('created', hours=24)
        newly_hiring_raw = db.get_changes_by_type('hiring_started', hours=24)
        batch_changes_raw = db.get_changes_by_type('batch_changed', hours=24)

        new_companies = [
            {
                "id": change["company_id"],
                "name": change["company_name"],
                "batch": change.get("batch", ""),
                "one_liner": change.get("one_liner", ""),
                "website": change.get("website", ""),
                "slug": change.get("company_slug", ""),
                "logo": change.get("logo", ""),
            }
            for change in new_companies_raw
        ]

        newly_hiring = [
            {
                "id": change["company_id"],
                "name": change["company_name"],
                "batch": change.get("batch", ""),
                "one_liner": change.get("one_liner", ""),
                "website": change.get("website", ""),
                "slug": change.get("company_slug", ""),
                "logo": change.get("logo", ""),
                "is_hiring": True,
            }
            for change in newly_hiring_raw
        ]

        batch_changes = [
            {
                "id": change["company_id"],
                "name": change["company_name"],
                "old_batch": change.get("old_value", ""),
                "new_batch": change.get("new_value", ""),
                "slug": change.get("company_slug", ""),
            }
            for change in batch_changes_raw
        ]

        if format == "json":
            sample_size = 5
            return {
                "new_companies": len(new_companies),
                "newly_hiring": len(newly_hiring),
                "batch_changes": len(batch_changes),
                "sample": {
                    "new_companies": new_companies[:sample_size],
                    "newly_hiring": newly_hiring[:sample_size],
                    "batch_changes": batch_changes[:sample_size],
                },
            }

        # HTML preview: if nothing changed in the last 24h, show illustrative
        # samples so the design can still be reviewed end-to-end.
        if not new_companies and not newly_hiring and not batch_changes:
            new_companies = [
                {
                    "id": 1, "name": "Acme AI", "batch": "S25",
                    "one_liner": "Self-hosted LLM gateway for regulated industries.",
                    "website": "https://acme.example", "slug": "acme-ai", "logo": "",
                },
                {
                    "id": 2, "name": "Lumen Robotics", "batch": "S25",
                    "one_liner": "Warehouse picking arms that retrain themselves overnight.",
                    "website": "https://lumen.example", "slug": "lumen-robotics", "logo": "",
                },
            ]
            newly_hiring = [
                {
                    "id": 3, "name": "Pebble Data", "batch": "W25",
                    "one_liner": "Postgres-native feature store.",
                    "website": "https://pebble.example", "slug": "pebble-data", "logo": "",
                    "is_hiring": True,
                },
            ]
            batch_changes = [
                {
                    "id": 4, "name": "Northstar Labs",
                    "old_batch": "W24", "new_batch": "S25", "slug": "northstar-labs",
                },
            ]

        html = email_service._render_daily_digest(
            new_companies=new_companies,
            newly_hiring=newly_hiring,
            batch_changes=batch_changes,
            unsubscribe_link=f"{email_service.frontend_url}/unsubscribe?token=preview",
        )
        return HTMLResponse(content=html)
    except Exception as e:
        logger.error(f"Digest preview error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/change-log-status")
async def get_change_log_status():
    """Get status of change log (for monitoring)"""
    try:
        # Get change statistics for the last 7 days
        stats = db.get_change_stats(days=7)

        return {
            "change_stats": stats,
            "subscriber_count": len(db.get_active_subscriptions()),
            "recent_changes_24h": {
                "created": len(db.get_changes_by_type('created', hours=24)),
                "hiring_started": len(db.get_changes_by_type('hiring_started', hours=24)),
                "hiring_stopped": len(db.get_changes_by_type('hiring_stopped', hours=24)),
                "batch_changed": len(db.get_changes_by_type('batch_changed', hours=24)),
            }
        }
    except Exception as e:
        logger.error(f"Change log status error: {e}")
        return {"error": str(e)}


@app.post("/api/admin/cleanup-changes")
async def cleanup_old_changes_manual(days_to_keep: int = 90):
    """Manually cleanup old change log entries (admin endpoint)

    Args:
        days_to_keep: Number of days of changes to retain (default: 90)

    Returns:
        Number of rows deleted
    """
    try:
        if days_to_keep < 30:
            raise HTTPException(
                status_code=400,
                detail="days_to_keep must be at least 30 to ensure email digests work"
            )

        deleted = db.cleanup_old_changes(days_to_keep=days_to_keep)
        logger.info(f"Manual cleanup: deleted {deleted} change log entries (older than {days_to_keep} days)")

        return {
            "success": True,
            "deleted_rows": deleted,
            "days_kept": days_to_keep,
            "message": f"Cleaned up {deleted} change log entries older than {days_to_keep} days"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cleanup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# FUNDING DATA ENDPOINTS (Coresignal Integration)
# ============================================================================

@app.get("/api/funding/stats")
async def get_funding_stats():
    """Get funding statistics across all YC companies"""
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Total funded companies
            cursor.execute("""
                SELECT COUNT(*) FROM companies
                WHERE funding_total_usd IS NOT NULL AND funding_total_usd > 0
            """)
            total_funded = cursor.fetchone()[0] or 0

            # Total funding raised
            cursor.execute("SELECT SUM(funding_total_usd) FROM companies WHERE funding_total_usd IS NOT NULL")
            total_funding = cursor.fetchone()[0] or 0

            # Average funding per company
            avg_funding = (total_funding / total_funded) if total_funded > 0 else 0

            # Top funded companies
            cursor.execute("""
                SELECT name, slug, funding_total_usd, batch, industry, valuation_usd
                FROM companies
                WHERE funding_total_usd IS NOT NULL
                ORDER BY funding_total_usd DESC
                LIMIT 20
            """)
            top_funded_rows = cursor.fetchall()
            top_funded = []
            for row in top_funded_rows:
                if hasattr(row, 'keys'):
                    top_funded.append(dict(row))
                else:
                    top_funded.append({
                        'name': row[0],
                        'slug': row[1],
                        'funding_total_usd': float(row[2]) if row[2] else 0,
                        'batch': row[3],
                        'industry': row[4],
                        'valuation_usd': float(row[5]) if row[5] else None
                    })

            # Funding by batch
            cursor.execute("""
                SELECT batch,
                       SUM(funding_total_usd) as total,
                       COUNT(*) FILTER (WHERE funding_total_usd IS NOT NULL AND funding_total_usd > 0) as funded_count
                FROM companies
                WHERE batch IS NOT NULL
                GROUP BY batch
                ORDER BY batch DESC
            """)
            funding_by_batch = {}
            for row in cursor.fetchall():
                if hasattr(row, 'keys'):
                    funding_by_batch[row['batch']] = {
                        'total': float(row['total']) if row['total'] else 0,
                        'funded_count': row['funded_count'] or 0
                    }
                else:
                    funding_by_batch[row[0]] = {
                        'total': float(row[1]) if row[1] else 0,
                        'funded_count': row[2] or 0
                    }

            # Funding by industry
            cursor.execute("""
                SELECT industry,
                       SUM(funding_total_usd) as total,
                       COUNT(*) as count
                FROM companies
                WHERE funding_total_usd IS NOT NULL AND industry IS NOT NULL
                GROUP BY industry
                ORDER BY total DESC
                LIMIT 15
            """)
            funding_by_industry = {}
            for row in cursor.fetchall():
                if hasattr(row, 'keys'):
                    funding_by_industry[row['industry']] = {
                        'total': float(row['total']) if row['total'] else 0,
                        'count': row['count'] or 0
                    }
                else:
                    funding_by_industry[row[0]] = {
                        'total': float(row[1]) if row[1] else 0,
                        'count': row[2] or 0
                    }

            # Recent fundings (last 6 months)
            cursor.execute("""
                SELECT name, slug, funding_last_round_usd, funding_last_round_date, funding_last_round_name, batch
                FROM companies
                WHERE funding_last_round_date IS NOT NULL
                ORDER BY funding_last_round_date DESC
                LIMIT 50
            """)
            recent_fundings_rows = cursor.fetchall()
            recent_fundings = []
            for row in recent_fundings_rows:
                if hasattr(row, 'keys'):
                    recent_fundings.append(dict(row))
                else:
                    recent_fundings.append({
                        'name': row[0],
                        'slug': row[1],
                        'funding_last_round_usd': float(row[2]) if row[2] else 0,
                        'funding_last_round_date': row[3],
                        'funding_last_round_name': row[4],
                        'batch': row[5]
                    })

            return {
                "total_funded_companies": total_funded,
                "total_funding_usd": float(total_funding),
                "avg_funding_per_company": float(avg_funding),
                "top_funded_companies": top_funded,
                "funding_by_batch": funding_by_batch,
                "funding_by_industry": funding_by_industry,
                "recent_fundings": recent_fundings
            }

    except Exception as e:
        logger.error(f"Error getting funding stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/funding/network")
async def get_funding_network():
    """Get network graph data (companies, investors, connections)"""
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Get companies with funding (nodes)
            cursor.execute("""
                SELECT id, name, slug, funding_total_usd, valuation_usd,
                       funding_last_round_name, batch, industry, small_logo_thumb_url,
                       funding_last_round_date, employee_count
                FROM companies
                WHERE funding_total_usd IS NOT NULL AND funding_total_usd > 0
                ORDER BY funding_total_usd DESC
                LIMIT 500
            """)
            companies_rows = cursor.fetchall()
            companies = []
            for row in companies_rows:
                if hasattr(row, 'keys'):
                    companies.append(dict(row))
                else:
                    companies.append({
                        'id': row[0],
                        'name': row[1],
                        'slug': row[2],
                        'funding_total_usd': float(row[3]) if row[3] else 0,
                        'valuation_usd': float(row[4]) if row[4] else None,
                        'funding_stage': row[5],
                        'batch': row[6],
                        'industry': row[7],
                        'logo': row[8],
                        'last_funding_date': row[9],
                        'employee_count': row[10]
                    })

            # TODO: Get investors and connections from company_investors table
            # For now, return empty arrays - will be populated after enrichment
            investors = []
            connections = []

            return {
                "companies": companies,
                "investors": investors,
                "connections": connections,
                "total_companies": len(companies),
                "total_investors": len(investors),
                "total_connections": len(connections)
            }

    except Exception as e:
        logger.error(f"Error getting funding network: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/companies/{company_id}/funding")
async def get_company_funding(company_id: int):
    """Get detailed funding information for a specific company"""
    try:
        company = company_cache.get_company_by_id(company_id)

        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        # Extract funding fields
        funding_data = {
            "company_id": company_id,
            "company_name": company.get("name"),
            "funding_total_usd": company.get("funding_total_usd"),
            "funding_last_round_usd": company.get("funding_last_round_usd"),
            "funding_last_round_date": company.get("funding_last_round_date"),
            "funding_last_round_name": company.get("funding_last_round_name"),
            "funding_rounds_count": company.get("funding_rounds_count"),
            "investors_count": company.get("investors_count"),
            "valuation_usd": company.get("valuation_usd"),
            "employee_count": company.get("employee_count"),
            "employee_growth_6m": company.get("employee_growth_6m"),
            "last_updated": company.get("coresignal_last_updated")
        }

        # TODO: Get funding rounds and investor details from company_investors table
        funding_data["funding_rounds"] = []
        funding_data["investors"] = []

        return funding_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting company funding: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/enrich-funding/bulk")
async def enrich_companies_bulk(
    background_tasks: BackgroundTasks,
    batch: Optional[str] = None,
    limit: int = 50,
    top_only: bool = False,
    force_refresh: bool = False,
    refresh_days: int = 30,
    session: dict = Depends(verify_admin_session)
):
    """Enrich multiple companies with Coresignal funding data (admin endpoint)

    Args:
        batch: Filter by YC batch (e.g., W25, S24)
        limit: Max number of companies to enrich (default: 50, max: 200)
        top_only: Only enrich top companies (default: False)
        force_refresh: Re-enrich companies even if already enriched (default: False)
        refresh_days: Only refresh if data is older than this many days (default: 30, only used if force_refresh=True)
    """
    try:
        if not coresignal_service.enabled:
            raise HTTPException(
                status_code=503,
                detail="Coresignal service not configured. Add CORESIGNAL_API_KEY environment variable in Vercel settings."
            )

        # Validate API key works before starting bulk enrichment
        logger.info("Validating Coresignal API key before bulk enrichment...")
        test_result = await coresignal_service.search_company("Airbnb", "airbnb.com")
        if test_result is None:
            raise HTTPException(
                status_code=401,
                detail="Coresignal API key validation failed. Please check your API key in Vercel environment variables."
            )

        # Cap the limit
        limit = min(limit, 200)

        # Get companies to enrich (prioritize newer companies for better viewer engagement)
        with db.get_connection() as conn:
            cursor = conn.cursor()

            query = """
                SELECT id, name, website, coresignal_last_updated, batch
                FROM companies
                WHERE 1=1
            """
            params = []

            if batch:
                query += " AND batch = ?"
                params.append(batch)

            if top_only:
                query += " AND top_company = TRUE"

            # Safety check: Skip already-enriched companies unless force_refresh is True
            if not force_refresh:
                query += " AND coresignal_last_updated IS NULL"
                logger.info("🛡️ Safety mode: Only enriching companies that haven't been enriched yet")
            elif refresh_days > 0:
                # Only refresh if data is older than refresh_days
                # PostgreSQL syntax
                query += f" AND (coresignal_last_updated IS NULL OR coresignal_last_updated < NOW() - INTERVAL '{refresh_days} days')"
                logger.info(f"🔄 Refresh mode: Enriching companies with data older than {refresh_days} days")
            else:
                logger.info("⚠️ Force refresh mode: Re-enriching ALL companies (including already enriched)")

            # Prioritize NEWER companies first (newest batches = more viewer interest)
            # Parse batch into sortable format: W25 → 202501, S24 → 202406
            # This ensures chronological ordering: W25 > S24 > W24 > S23
            query += """
                ORDER BY
                    CASE WHEN coresignal_last_updated IS NULL THEN 0 ELSE 1 END,
                    (
                        CASE
                            -- Short format: W25, S24, etc. (2-3 char length)
                            WHEN batch GLOB '[WS][0-9][0-9]' THEN
                                (2000 + CAST(SUBSTR(batch, 2, 2) AS INTEGER)) * 100 +
                                CASE WHEN batch LIKE 'W%' THEN 1 ELSE 6 END
                            -- Long format: Winter 2025, Summer 2024, etc.
                            WHEN batch LIKE 'Winter%' THEN
                                CAST(REPLACE(REPLACE(batch, 'Winter ', ''), ' ', '') AS INTEGER) * 100 + 1
                            WHEN batch LIKE 'Summer%' THEN
                                CAST(REPLACE(REPLACE(batch, 'Summer ', ''), ' ', '') AS INTEGER) * 100 + 6
                            ELSE 0
                        END
                    ) DESC,
                    CASE WHEN funding_total_usd IS NULL THEN 0 ELSE 1 END,
                    CASE WHEN team_size IS NOT NULL THEN team_size ELSE 0 END DESC
            """
            query += f" LIMIT {limit}"

            logger.info("📊 Enrichment priority: Unenriched companies → Newest batches → Companies without funding → Larger teams")

            cursor.execute(query, params)
            rows = cursor.fetchall()

            companies = []
            for row in rows:
                if hasattr(row, 'keys'):
                    companies.append(dict(row))
                else:
                    companies.append({
                        'id': row[0],
                        'name': row[1],
                        'website': row[2],
                        'already_enriched': row[3] is not None,  # coresignal_last_updated
                        'batch': row[4] if len(row) > 4 else None
                    })

        if not companies:
            if not force_refresh:
                message = "No unenriched companies found matching criteria. All matching companies have already been enriched! Use force_refresh=true to re-enrich."
            else:
                message = "No companies found matching criteria"

            return {
                "status": "complete",
                "message": message,
                "total": 0
            }

        # Log safety summary
        already_enriched_count = sum(1 for c in companies if c.get('already_enriched', False))
        new_companies_count = len(companies) - already_enriched_count

        if force_refresh and already_enriched_count > 0:
            logger.warning(f"⚠️ Re-enriching {already_enriched_count} companies that were already enriched")

        logger.info(f"📊 Enrichment batch: {new_companies_count} new + {already_enriched_count} re-enriching = {len(companies)} total")

        # Log batch distribution to show newest-first prioritization
        from collections import Counter
        batch_counts = Counter(c.get('batch', 'Unknown') for c in companies)
        logger.info(f"🎯 Batches being enriched (newest first): {dict(sorted(batch_counts.items(), reverse=True))}")

        # Enrich companies in background
        async def enrich_bulk_task():
            success_count = 0
            error_count = 0
            auth_failed = False

            for company in companies:
                try:
                    batch_info = f" (batch: {company.get('batch', 'unknown')})" if company.get('batch') else ""
                    logger.info(f"Enriching company {company['id']}: {company['name']}{batch_info}")
                    funding_data = await coresignal_service.enrich_company(
                        company['name'],
                        company.get('website')
                    )

                    if funding_data:
                        # Use database-specific placeholder (PostgreSQL uses %s, SQLite uses ?)
                        placeholder = "%s" if hasattr(db, '__class__') and 'Postgres' in db.__class__.__name__ else "?"

                        with db.get_connection() as conn:
                            cursor = conn.cursor()
                            query = f"""
                                UPDATE companies
                                SET funding_total_usd = {placeholder},
                                    funding_last_round_usd = {placeholder},
                                    funding_last_round_date = {placeholder},
                                    funding_last_round_name = {placeholder},
                                    funding_rounds_count = {placeholder},
                                    investors_count = {placeholder},
                                    valuation_usd = {placeholder},
                                    employee_count = {placeholder},
                                    employee_growth_6m = {placeholder},
                                    coresignal_last_updated = {placeholder}
                                WHERE id = {placeholder}
                            """
                            cursor.execute(query, (
                                funding_data.get("funding_total_usd"),
                                funding_data.get("funding_last_round_usd"),
                                funding_data.get("funding_last_round_date"),
                                funding_data.get("funding_last_round_name"),
                                funding_data.get("funding_rounds_count"),
                                funding_data.get("investors_count"),
                                funding_data.get("valuation_usd"),
                                funding_data.get("employee_count"),
                                funding_data.get("employee_growth_6m"),
                                funding_data.get("coresignal_last_updated"),
                                company['id']
                            ))
                            conn.commit()
                        success_count += 1
                    else:
                        error_count += 1

                    # Rate limiting: wait 1 second between requests
                    await asyncio.sleep(1)

                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"Error enriching company {company['id']}: {error_msg}")

                    # Stop immediately on auth failures
                    if "CORESIGNAL_AUTH_FAILED" in error_msg:
                        auth_failed = True
                        logger.error("❌ Stopping bulk enrichment due to authentication failure")
                        logger.error("Please check that CORESIGNAL_API_KEY is set correctly in Vercel environment variables")
                        break

                    error_count += 1

            # Refresh cache after enrichments
            if success_count > 0:
                company_cache.refresh(db)

            if auth_failed:
                logger.error(f"Bulk enrichment FAILED - Authentication error. Enriched {success_count} companies before failure.")
            else:
                logger.info(f"Bulk enrichment complete: {success_count} success, {error_count} errors")

        background_tasks.add_task(enrich_bulk_task)

        return {
            "status": "started",
            "total": len(companies),
            "message": f"Started enriching {len(companies)} companies in background",
            "companies": [{"id": c['id'], "name": c['name']} for c in companies]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk enrichment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/enrich-funding/{company_id}")
async def enrich_company_funding(company_id: int, background_tasks: BackgroundTasks, session: dict = Depends(verify_admin_session)):
    """Enrich a single company with Coresignal funding data (admin endpoint)"""
    try:
        if not coresignal_service.enabled:
            raise HTTPException(status_code=503, detail="Coresignal service not configured. Add CORESIGNAL_API_KEY environment variable.")

        company = company_cache.get_company_by_id(company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        # Enrich in background
        async def enrich_task():
            try:
                logger.info(f"Enriching company {company_id}: {company.get('name')}")
                funding_data = await coresignal_service.enrich_company(
                    company.get("name"),
                    company.get("website")
                )

                if funding_data:
                    # Use database-specific placeholder (PostgreSQL uses %s, SQLite uses ?)
                    placeholder = "%s" if hasattr(db, '__class__') and 'Postgres' in db.__class__.__name__ else "?"

                    # Update company in database
                    with db.get_connection() as conn:
                        cursor = conn.cursor()
                        query = f"""
                            UPDATE companies
                            SET funding_total_usd = {placeholder},
                                funding_last_round_usd = {placeholder},
                                funding_last_round_date = {placeholder},
                                funding_last_round_name = {placeholder},
                                funding_rounds_count = {placeholder},
                                investors_count = {placeholder},
                                valuation_usd = {placeholder},
                                employee_count = {placeholder},
                                employee_growth_6m = {placeholder},
                                coresignal_last_updated = {placeholder}
                            WHERE id = {placeholder}
                        """
                        cursor.execute(query, (
                            funding_data.get("funding_total_usd"),
                            funding_data.get("funding_last_round_usd"),
                            funding_data.get("funding_last_round_date"),
                            funding_data.get("funding_last_round_name"),
                            funding_data.get("funding_rounds_count"),
                            funding_data.get("investors_count"),
                            funding_data.get("valuation_usd"),
                            funding_data.get("employee_count"),
                            funding_data.get("employee_growth_6m"),
                            funding_data.get("coresignal_last_updated"),
                            company_id
                        ))
                        conn.commit()

                    # Refresh cache
                    company_cache.refresh(db)
                    logger.info(f"Successfully enriched company {company_id}")
                else:
                    logger.warning(f"No funding data found for company {company_id}")

            except Exception as e:
                logger.error(f"Error enriching company {company_id}: {e}")

        background_tasks.add_task(enrich_task)

        return {
            "status": "started",
            "company_id": company_id,
            "company_name": company.get("name")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting enrichment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HIRING BOARD ENDPOINTS
# ============================================================================

@app.get("/api/hiring/board")
async def get_hiring_board():
    """Get hiring board data (companies and jobs) from memory cache"""
    try:
        hiring_service = get_hiring_service()
        data = hiring_service.get_hiring_board()
        return data
    except Exception as e:
        logger.error(f"Error fetching hiring board: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch hiring board data")


@app.get("/api/hiring/stats")
async def get_hiring_stats():
    """Get aggregated hiring statistics from memory cache"""
    try:
        hiring_service = get_hiring_service()
        stats = hiring_service.get_hiring_stats()
        return stats
    except Exception as e:
        logger.error(f"Error getting hiring stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get hiring stats")


@app.get("/api/hiring/analytics")
async def get_hiring_analytics():
    """Get comprehensive hiring analytics"""
    try:
        hiring_service = get_hiring_service()
        analytics = hiring_service.cache.get_analytics()
        if not analytics:
            raise HTTPException(status_code=500, detail="Analytics not yet computed")
        return analytics
    except Exception as e:
        logger.error(f"Error getting hiring analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get hiring analytics")


@app.get("/api/hiring/jobs/paginated")
async def get_hiring_jobs_paginated(
    page: int = 1,
    per_page: int = 20,
    sort_by: str = "recent",
    role: Optional[str] = None,
    location: Optional[str] = None,
    remote: Optional[bool] = None,
    batch: Optional[str] = None,
    job_type: Optional[str] = None,
    company_id: Optional[int] = None,
    company_name: Optional[str] = None,
):
    """Get paginated hiring jobs with filtering and sorting"""
    try:
        hiring_service = get_hiring_service()
        jobs = hiring_service.get_jobs()

        # Get companies map for filtering (with type safety for IDs)
        companies_map = {}
        for c in hiring_service.get_companies():
            company_id_map = c.get('id')
            # Ensure ID is a valid type (not a list)
            if isinstance(company_id_map, list):
                company_id_map = company_id_map[0] if company_id_map else None
            if company_id_map is not None:
                companies_map[company_id_map] = c

        # Filter
        if company_id is not None:
            jobs = [j for j in jobs if j.get('company_id') == company_id]
        if company_name:
            company_name_lower = company_name.lower()
            jobs = [j for j in jobs if company_name_lower in _safe_string(companies_map.get(j.get('company_id'), {}).get('name', '')).lower()]
        if role:
            jobs = [j for j in jobs if _safe_string(j.get('pretty_role', '')).lower() == role.lower()]
        if location:
            jobs = [j for j in jobs if location.lower() in (_safe_string(j.get('pretty_location_or_remote', '')) or '').lower()]
        if remote is not None:
            jobs = [j for j in jobs if (j.get('remote') == 'yes') == remote]
        if batch:
            batch_str = _safe_string(batch)
            jobs = [j for j in jobs if _safe_string(companies_map.get(j.get('company_id'), {}).get('batch', '')) == batch_str]
        if job_type:
            jobs = [j for j in jobs if _safe_string(j.get('pretty_job_type', '')).lower() == job_type.lower()]

        # Sort
        if sort_by == "recent":
            jobs = sorted(jobs, key=lambda j: j.get('pretty_updated_at', ''), reverse=True)
        elif sort_by == "salary_high":
            jobs = sorted(jobs, key=lambda j: j.get('salary_max') or 0, reverse=True)
        elif sort_by == "salary_low":
            jobs = sorted(jobs, key=lambda j: j.get('salary_min') or 0)

        # Paginate
        total = len(jobs)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_jobs = jobs[start:end]

        # Add company info to each job
        for job in paginated_jobs:
            if 'company' not in job:
                job['company'] = companies_map.get(job.get('company_id'), {})

        return {
            "jobs": paginated_jobs,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page,
            "has_next": end < total,
            "has_prev": page > 1,
        }
    except Exception as e:
        logger.error(f"Error fetching paginated jobs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch jobs")


@app.post("/api/admin/update-hiring-board")
async def admin_update_hiring_board(
    background_tasks: BackgroundTasks,
    session: dict = Depends(verify_admin_session)
):
    """Admin endpoint to manually trigger hiring board update from WorkAtAStartup API"""
    try:
        hiring_service = get_hiring_service()

        async def update_task():
            try:
                success = hiring_service.update_hiring_data(db)
                logger.info(f"Admin-triggered hiring board update {'completed' if success else 'failed'}")
            except Exception as e:
                logger.error(f"Admin hiring board update error: {e}")

        background_tasks.add_task(update_task)

        return {
            "status": "started",
            "message": "Hiring board update started in background"
        }
    except Exception as e:
        logger.error(f"Error starting hiring board update: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class UploadHiringDataRequest(BaseModel):
    """Request body for browser-based hiring data upload"""
    companies: List[dict]
    jobs: List[dict]


@app.post("/api/hiring/upload-from-browser")
async def upload_hiring_data_from_browser(request: UploadHiringDataRequest):
    """
    Accept hiring data fetched from browser and save to database.
    Can be called from browser console to upload companies and jobs.
    """
    try:
        companies = request.companies or []
        jobs = request.jobs or []

        if not companies:
            raise HTTPException(status_code=400, detail="No companies provided")

        logger.info(f"📥 Uploading {len(companies)} companies and {len(jobs)} jobs from browser...")

        db = get_database()
        inserted_companies = 0
        skipped_companies = 0
        inserted_jobs = 0
        skipped_jobs = 0

        # Insert companies
        if hasattr(db, 'get_connection'):
            # PostgreSQL
            with db.get_connection() as conn:
                with conn.cursor() as cur:
                    for company in companies:
                        try:
                            company_id = company.get('id')
                            cur.execute("SELECT id FROM hiring_companies WHERE id = %s", (company_id,))
                            if cur.fetchone():
                                skipped_companies += 1
                                continue

                            company_data = {k: v for k, v in company.items() if k != 'jobs'}

                            cur.execute("""
                                INSERT INTO hiring_companies
                                (id, name, slug, batch, team_size, location, logo_url, small_logo_url, website, one_liner, primary_vertical, raw_json, updated_at)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
                            """, (
                                company_data.get('id'), company_data.get('name'), company_data.get('slug'),
                                company_data.get('batch'), company_data.get('team_size'), company_data.get('location'),
                                company_data.get('logo_url'), company_data.get('small_logo_url'), company_data.get('website'),
                                company_data.get('one_liner'), company_data.get('primary_vertical'), json.dumps(company_data)
                            ))
                            inserted_companies += 1
                        except Exception as e:
                            if "slug" in str(e).lower():
                                skipped_companies += 1
        else:
            # SQLite fallback
            for company in companies:
                try:
                    company_id = company.get('id')
                    if db.get_company_by_id(company_id):
                        skipped_companies += 1
                        continue
                    company_data = {k: v for k, v in company.items() if k != 'jobs'}
                    db.insert_hiring_company(company_data)
                    inserted_companies += 1
                except Exception as e:
                    if "slug" in str(e).lower():
                        skipped_companies += 1

        # Insert jobs
        if hasattr(db, 'get_connection'):
            # PostgreSQL
            with db.get_connection() as conn:
                with conn.cursor() as cur:
                    for job in jobs:
                        try:
                            job_id = job.get('id')
                            company_id = job.get('company_id')

                            cur.execute("SELECT id FROM hiring_jobs WHERE id = %s", (job_id,))
                            if cur.fetchone():
                                skipped_jobs += 1
                                continue

                            cur.execute("SELECT id FROM hiring_companies WHERE id = %s", (company_id,))
                            if not cur.fetchone():
                                skipped_jobs += 1
                                continue

                            locations_json = json.dumps(job.get('locations', []))

                            cur.execute("""
                                INSERT INTO hiring_jobs
                                (id, company_id, title, description, pretty_role, salary_min, salary_max,
                                 job_type, remote, locations, pretty_location_or_remote, pretty_job_type,
                                 pretty_min_experience, pretty_updated_at, show_path, raw_json, updated_at)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                                ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()
                            """, (
                                job_id, company_id, job.get('title'), job.get('description'),
                                job.get('pretty_role'), job.get('salary_min'), job.get('salary_max'),
                                job.get('job_type'), job.get('remote'), locations_json,
                                job.get('pretty_location_or_remote'), job.get('pretty_job_type'),
                                job.get('pretty_min_experience'), job.get('pretty_updated_at'),
                                job.get('show_path'), json.dumps(job)
                            ))
                            inserted_jobs += 1
                        except Exception as e:
                            pass

        # Refresh hiring cache
        hiring_service = get_hiring_service()
        hiring_service.cache.load(db)

        logger.info(f"✅ Upload complete: {inserted_companies} companies (+{skipped_companies} skipped), {inserted_jobs} jobs (+{skipped_jobs} skipped)")

        return {
            "status": "success",
            "message": "Hiring data uploaded successfully",
            "companies": {
                "inserted": inserted_companies,
                "skipped": skipped_companies
            },
            "jobs": {
                "inserted": inserted_jobs,
                "skipped": skipped_jobs
            }
        }

    except Exception as e:
        logger.error(f"Error uploading hiring data: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to upload hiring data: {str(e)}")


# Research Endpoints - Perplexity AI Integration
class ResearchRequest(BaseModel):
    """Request body for company research"""
    company_name: str


class ResearchResponse(BaseModel):
    """Response model for research results"""
    company_name: str
    research: str
    citations: List[str] = []
    timestamp: str
    model: str
    success: bool
    error: Optional[str] = None


@app.post("/api/research/company", response_model=ResearchResponse)
async def research_company(request: ResearchRequest, request_obj: Request):
    """
    Research a YC company using Perplexity AI
    Returns latest news, funding updates, and key developments
    Uses cache to avoid redundant API calls
    Rate limited: 5 requests per minute per IP
    """
    try:
        # Check cache first (no rate limit for cached results)
        cached = db.get_cached_research(request.company_name)
        if cached:
            db.increment_research_view_count(request.company_name)
            # Extract response_data from cached result
            response_data = cached.get("response_data", {})
            return ResearchResponse(
                company_name=response_data.get("company_name", ""),
                research=response_data.get("research", ""),
                citations=response_data.get("citations", []),
                timestamp=response_data.get("timestamp", ""),
                model=response_data.get("model", ""),
                success=response_data.get("success", False)
            )

        # Rate limit check for new research requests
        client_ip = request_obj.client.host if request_obj.client else "unknown"
        if not research_rate_limiter.is_allowed(client_ip):
            reset_time = research_rate_limiter.get_reset_time(client_ip)
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. You can make 5 research requests per minute. Please try again in {reset_time} seconds. In the meantime, explore other research in the Explore Hub."
            )

        perplexity = get_perplexity_service()

        if not perplexity.is_enabled():
            raise HTTPException(
                status_code=503,
                detail="Research feature is not available - API key not configured"
            )

        # Perform research
        result = perplexity.research_company(request.company_name)

        if not result:
            raise HTTPException(status_code=500, detail="Failed to research company")

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Research failed"))

        # Store in cache
        try:
            logger.info(f"Storing research result. Citations type: {type(result.get('citations'))}, value: {result.get('citations')}")
            db.store_research(request.company_name, "company", result)
        except Exception as e:
            logger.warning(f"Failed to cache research result: {e}")
            import traceback
            logger.warning(f"Cache storage traceback: {traceback.format_exc()}")

        # Return as ResearchResponse model
        return ResearchResponse(
            company_name=result.get("company_name", ""),
            research=result.get("research", ""),
            citations=result.get("citations", []),
            timestamp=result.get("timestamp", ""),
            model=result.get("model", ""),
            success=result.get("success", False)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error researching company: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to research company")


class ResearchQueryRequest(BaseModel):
    """Request body for custom research queries"""
    query: str


@app.post("/api/research/query")
async def research_query(request: ResearchQueryRequest, request_obj: Request):
    """
    Perform custom research on any topic
    Returns factual, current information with sources
    """
    try:
        _enforce_rate_limit(research_query_limiter, request_obj, "research queries")
        perplexity = get_perplexity_service()

        if not perplexity.is_enabled():
            raise HTTPException(
                status_code=503,
                detail="Research feature is not available - API key not configured"
            )

        # Perform research
        result = perplexity.research_market(request.query)

        if not result:
            raise HTTPException(status_code=500, detail="Failed to research query")

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Research failed"))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error researching query: {e}")
        raise HTTPException(status_code=500, detail="Failed to research query")


@app.get("/api/research/status")
async def research_status():
    """Check if research feature is available"""
    perplexity = get_perplexity_service()
    return {
        "available": perplexity.is_enabled(),
        "message": "Research feature is available" if perplexity.is_enabled() else "Research feature is not configured"
    }


@app.get("/api/research/history")
async def get_research_history(limit: int = 50, offset: int = 0, sort_by: str = "recent"):
    """
    Get all research history visible to all users
    sorted by recent (default), popular, or oldest
    """
    try:
        results = db.get_all_research_history(limit=limit, offset=offset, sort_by=sort_by)
        stats = db.get_research_stats()

        return {
            "results": results,
            "total": stats["total_searches"],
            "total_views": stats["total_views"],
            "limit": limit,
            "offset": offset,
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Error fetching research history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch research history")


@app.get("/api/research/popular")
async def get_popular_research(limit: int = 10):
    """
    Get most popular research queries
    """
    try:
        results = db.get_popular_research(limit=limit)
        return {"results": results}
    except Exception as e:
        logger.error(f"Error fetching popular research: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch popular research")


class ResearchSearchRequest(BaseModel):
    """Request body for research search"""
    query: str


@app.post("/api/research/search")
async def search_research_history(request: ResearchSearchRequest):
    """
    Search through research history by company name or keywords
    """
    try:
        if not request.query.strip():
            raise HTTPException(status_code=400, detail="Search query cannot be empty")

        results = db.search_research_history(request.query, limit=20)
        return {"results": results, "query": request.query}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching research history: {e}")
        raise HTTPException(status_code=500, detail="Failed to search research")


# ============================================================================
# PUBLIC API: developer accounts, API keys, admin management, sub-app mount
# ============================================================================
import re as _re
from password_utils import hash_password, verify_password, hash_token
from plans import plan_limit, is_valid_plan, PLAN_META, PLAN_LIMITS
from public_api import create_public_api

API_KEY_PREFIX = "eyc_live_"
DEV_SESSION_TTL = timedelta(days=30)
_EMAIL_RE = _re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class DevSignupRequest(BaseModel):
    email: str
    password: str
    company_name: Optional[str] = None


class DevLoginRequest(BaseModel):
    email: str
    password: str


class CreateKeyRequest(BaseModel):
    name: Optional[str] = None


class SetPlanRequest(BaseModel):
    plan: str


class SetStatusRequest(BaseModel):
    status: str


class ProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    avatar_url: Optional[str] = None  # small base64 data URL (client-resized)


def _dev_user_public(user: dict) -> dict:
    limit = plan_limit(user.get("plan"))
    return {
        "id": user["id"], "email": user["email"], "company_name": user.get("company_name"),
        "plan": user.get("plan", "free"),
        "plan_name": PLAN_META.get(user.get("plan", "free"), {}).get("name"),
        "status": user.get("status", "active"), "email_verified": bool(user.get("email_verified")),
        "avatar_url": user.get("avatar_url"),
        "daily_limit": limit,
    }


def verify_dev_session(authorization: Optional[str] = Header(None)) -> dict:
    """DB-backed developer session (multi-instance safe, unlike admin_sessions)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    session = db.get_api_session(hash_token(authorization[7:].strip()))
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    if session.get("user_status") != "active":
        raise HTTPException(status_code=403, detail="Account suspended")
    return session


@app.post("/api/dev/signup")
async def dev_signup(req: DevSignupRequest, request_obj: Request):
    _enforce_rate_limit(dev_auth_limiter, request_obj, "signup")
    email = (req.email or "").strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    if len(req.password or "") < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if db.get_api_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    verification_token = secrets.token_urlsafe(32)
    user_id = db.create_api_user(email, hash_password(req.password), req.company_name, verification_token)
    try:
        if hasattr(email_service, "send_dev_verification_email"):
            email_service.send_dev_verification_email(email, verification_token)
    except Exception as e:
        logger.warning(f"dev verification email failed: {e}")
    token = secrets.token_urlsafe(32)
    db.create_api_session(user_id, hash_token(token), datetime.now(timezone.utc) + DEV_SESSION_TTL)
    return {"token": token, "user": _dev_user_public(db.get_api_user_by_id(user_id))}


@app.post("/api/dev/login")
async def dev_login(req: DevLoginRequest, request_obj: Request):
    _enforce_rate_limit(dev_auth_limiter, request_obj, "login")
    email = (req.email or "").strip().lower()
    user = db.get_api_user_by_email(email)
    if not user or not verify_password(req.password or "", user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Account suspended")
    token = secrets.token_urlsafe(32)
    db.create_api_session(user["id"], hash_token(token), datetime.now(timezone.utc) + DEV_SESSION_TTL)
    return {"token": token, "user": _dev_user_public(user)}


@app.post("/api/dev/logout")
async def dev_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        db.delete_api_session(hash_token(authorization[7:].strip()))
    return {"success": True}


@app.get("/api/dev/me")
async def dev_me(session: dict = Depends(verify_dev_session)):
    user = db.get_api_user_by_id(session["user_id"])
    info = _dev_user_public(user)
    keys = db.list_api_keys_for_user(user["id"])
    used = 0
    for k in keys:
        if k.get("is_active"):
            count, _ = db.count_api_usage_since(k["id"], datetime.now(timezone.utc) - timedelta(hours=24))
            used += count
    info["usage"] = {"used_24h": used, "limit": info["daily_limit"],
                     "remaining": max(0, info["daily_limit"] - used)}
    info["keys"] = keys
    return info


@app.get("/api/dev/verify-email/{token}")
async def dev_verify_email(token: str):
    if not db.verify_api_user_email(token):
        raise HTTPException(status_code=404, detail="Invalid or expired verification token")
    return {"success": True}


@app.get("/api/dev/usage")
async def dev_usage(days: int = 7, session: dict = Depends(verify_dev_session)):
    """Per-day request counts + top endpoints for the caller's keys (for the dashboard chart)."""
    days = max(1, min(days, 90))
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = db.get_api_usage_timeseries(session["user_id"], since)
    by_endpoint = db.get_api_usage_by_endpoint(session["user_id"], since)
    counts = {str(r["day"]): int(r["count"]) for r in rows}
    today = datetime.now(timezone.utc).date()
    series = []
    for i in range(days - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        series.append({"date": d, "count": counts.get(d, 0)})
    return {
        "days": days,
        "series": series,
        "total": sum(s["count"] for s in series),
        "by_endpoint": [{"endpoint": r["endpoint"], "count": int(r["count"])} for r in by_endpoint],
    }


@app.post("/api/dev/profile")
async def dev_update_profile(req: ProfileUpdate, session: dict = Depends(verify_dev_session)):
    avatar = req.avatar_url
    if avatar:
        if not avatar.startswith("data:image/"):
            raise HTTPException(status_code=400, detail="avatar_url must be a data:image/* URL")
        if len(avatar) > 400_000:
            raise HTTPException(status_code=400, detail="Image too large (max ~300KB). Please crop or shrink it.")
    db.update_api_user_profile(session["user_id"], company_name=req.company_name, avatar_url=avatar)
    return _dev_user_public(db.get_api_user_by_id(session["user_id"]))


@app.post("/api/dev/keys")
async def dev_create_key(req: CreateKeyRequest, session: dict = Depends(verify_dev_session)):
    raw = API_KEY_PREFIX + secrets.token_urlsafe(32)
    prefix = raw[:16]
    key_id = db.create_api_key(session["user_id"], prefix, hash_token(raw), req.name)
    return {"id": key_id, "api_key": raw, "key_prefix": prefix, "name": req.name,
            "warning": "Store this key now — it will not be shown again."}


@app.get("/api/dev/keys")
async def dev_list_keys(session: dict = Depends(verify_dev_session)):
    return {"keys": db.list_api_keys_for_user(session["user_id"])}


@app.post("/api/dev/keys/{key_id}/revoke")
async def dev_revoke_key(key_id: int, session: dict = Depends(verify_dev_session)):
    if not db.revoke_api_key(key_id, user_id=session["user_id"]):
        raise HTTPException(status_code=404, detail="Key not found")
    return {"success": True}


# ---- Admin management of API users/keys ----
@app.get("/api/admin/api-users")
async def admin_list_api_users(session: dict = Depends(verify_admin_session)):
    return {"users": db.list_api_users()}


@app.get("/api/admin/api-keys")
async def admin_list_api_keys(session: dict = Depends(verify_admin_session)):
    return {"keys": db.list_all_api_keys()}


@app.post("/api/admin/api-keys/{key_id}/revoke")
async def admin_revoke_api_key(key_id: int, session: dict = Depends(verify_admin_session)):
    if not db.revoke_api_key(key_id):
        raise HTTPException(status_code=404, detail="Key not found")
    return {"success": True}


@app.post("/api/admin/api-users/{user_id}/plan")
async def admin_set_plan(user_id: int, req: SetPlanRequest, session: dict = Depends(verify_admin_session)):
    if not is_valid_plan(req.plan):
        raise HTTPException(status_code=400, detail=f"Invalid plan. Valid: {list(PLAN_LIMITS)}")
    if not db.set_api_user_plan(user_id, req.plan):
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "plan": req.plan}


@app.post("/api/admin/api-users/{user_id}/status")
async def admin_set_status(user_id: int, req: SetStatusRequest, session: dict = Depends(verify_admin_session)):
    if req.status not in ("active", "suspended"):
        raise HTTPException(status_code=400, detail="status must be 'active' or 'suspended'")
    if not db.set_api_user_status(user_id, req.status):
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "status": req.status}


# ---- Cron: bound api_usage / api_sessions growth ----
@app.post("/api/cron/cleanup-api")
async def cron_cleanup_api(request: Request):
    _verify_cron_secret(request)
    usage_deleted = db.cleanup_api_usage(datetime.now(timezone.utc) - timedelta(days=30))
    sessions_deleted = db.delete_expired_api_sessions()
    return {"usage_deleted": usage_deleted, "sessions_deleted": sessions_deleted}


# ---- Mount the public API sub-app (own docs + CORS at /api/v1) ----
app.mount("/api/v1", create_public_api(db, company_cache))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
