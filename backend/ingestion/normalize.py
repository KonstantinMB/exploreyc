"""Shared normalization helpers for source adapters.

Python port of the sync-PR's normalize.ts. Every adapter maps raw source data
into ExploreYC's canonical column names; these helpers produce the domain,
slug, and cross-source `dedupe_key` used for read-time merge.
"""

from urllib.parse import urlparse
import re
import unicodedata

# Hosts shared by many unrelated projects. A company whose only "website" is a
# shared host must NOT merge with another on the same host (the meaningful
# identity there is the URL path, e.g. github.com/<user>/<repo>), so we fall back
# to a source-scoped dedupe key. Entries are registrable (last-two-label) domains.
SHARED_HOST_DENYLIST = {
    # Code / project hosts (very common in Show HN links)
    "github.com", "github.io", "githubusercontent.com", "gitlab.com", "bitbucket.org",
    "sourceforge.net", "codeberg.org", "gitea.com", "npmjs.com", "pypi.org", "crates.io",
    "huggingface.co", "kaggle.com", "codepen.io", "codesandbox.io", "stackblitz.com",
    "glitch.me", "jsfiddle.net", "observablehq.com",
    # Site builders / app-hosting platforms
    "notion.site", "vercel.app", "netlify.app", "webflow.io", "wixsite.com",
    "gitbook.io", "herokuapp.com", "pages.dev", "framer.website", "carrd.co",
    "bubbleapps.io", "replit.app", "replit.com", "onrender.com", "web.app",
    "firebaseapp.com", "square.site", "godaddysites.com", "streamlit.app", "fly.dev",
    "railway.app", "surge.sh", "github.dev",
    # Publishing / social / content platforms
    "substack.com", "medium.com", "dev.to", "hashnode.dev", "blogspot.com",
    "wordpress.com", "tumblr.com", "youtube.com", "youtu.be", "vimeo.com",
    "twitter.com", "x.com", "reddit.com", "linkedin.com", "facebook.com",
    "instagram.com", "threads.net", "producthunt.com", "news.ycombinator.com",
    "arxiv.org", "t.me", "discord.gg", "discord.com", "slack.com",
    # Docs / paste / forms / stores
    "docs.google.com", "drive.google.com", "sites.google.com", "google.com",
    "notion.so", "figma.com", "loom.com", "typeform.com", "airtable.com",
    "apps.apple.com", "apple.com", "play.google.com", "gumroad.com", "itch.io",
    # App / extension marketplaces (path is the identity, not the host)
    "visualstudio.com", "mozilla.org", "atlassian.com", "shopify.com", "chrome.com",
}


def norm_domain(url):
    """Strip scheme/www/path/port -> bare lowercase host, or None if unparseable."""
    if not url:
        return None
    raw = url.strip()
    if not re.match(r"^https?://", raw, re.I):
        raw = "https://" + raw
    try:
        host = urlparse(raw).hostname
    except ValueError:
        return None
    if not host:
        return None
    host = host.lower()
    if host.startswith("www."):
        host = host[4:]
    # Reject non-domains: a real company host has only [a-z0-9.-] and a dot.
    if not host or "." not in host or not re.match(r"^[a-z0-9.-]+$", host):
        return None
    return host


def _registrable_suffix(host):
    """Last two labels of a host, e.g. 'a.github.io' -> 'github.io'."""
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def slugify(name):
    """URL/id-safe slug from a display name."""
    s = unicodedata.normalize("NFKD", name or "")
    s = s.encode("ascii", "ignore").decode("ascii").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:80]


def dedupe_key(domain, source, source_slug):
    """Merge key across sources: the domain when it's a real (non-shared) host,
    else a source-scoped fallback so unrelated same-named companies never collide."""
    if domain and _registrable_suffix(domain) not in SHARED_HOST_DENYLIST:
        return domain
    return f"{source}:{source_slug}"


def country_from_locations(loc):
    """Best-effort country from a 'City, ST, Country; ...' locations string."""
    if not loc:
        return None
    first = loc.split(";")[0].strip()
    parts = [p.strip() for p in first.split(",") if p.strip()]
    return parts[-1] if parts else None
