from ingestion.normalize import (
    norm_domain, slugify, dedupe_key, country_from_locations, SHARED_HOST_DENYLIST,
)


def test_norm_domain_strips_scheme_www_path():
    assert norm_domain("https://www.Acme.com/careers") == "acme.com"
    assert norm_domain("acme.com") == "acme.com"
    assert norm_domain("http://sub.acme.co.uk:8080/x") == "sub.acme.co.uk"
    assert norm_domain(None) is None
    assert norm_domain("") is None
    assert norm_domain("not a url with spaces") is None


def test_slugify():
    assert slugify("Acme, Inc.") == "acme-inc"
    assert slugify("  Héllo World  ") == "hello-world"
    assert slugify("") == ""


def test_dedupe_key_prefers_domain_else_source_slug():
    assert dedupe_key("acme.com", "yc", "acme") == "acme.com"
    assert dedupe_key(None, "hackernews", "acme") == "hackernews:acme"


def test_dedupe_key_shared_host_falls_back_to_source_slug():
    # A shared host must not merge unrelated companies.
    assert "github.io" in SHARED_HOST_DENYLIST
    assert dedupe_key("myproj.github.io", "hackernews", "myproj") == "hackernews:myproj"


def test_dedupe_key_code_hosts_do_not_mega_merge():
    # Regression: Show HN posts linking github.com/<user>/<repo> must NOT collapse
    # into one card (the path is the identity, not the domain).
    assert dedupe_key("github.com", "hackernews", "trace") == "hackernews:trace"
    assert dedupe_key("github.com", "hackernews", "comcent-ce") == "hackernews:comcent-ce"
    # But a real product domain still merges on domain.
    assert dedupe_key("diagraw.com", "hackernews", "diagraw") == "diagraw.com"


def test_dedupe_key_platform_subdomains_denylisted_via_registrable_suffix():
    # play.google.com / apps.apple.com collapse to google.com / apple.com -> denylisted.
    assert dedupe_key(norm_domain("https://play.google.com/store/apps/x"),
                      "hackernews", "x") == "hackernews:x"


def test_country_from_locations():
    assert country_from_locations("San Francisco, CA, USA; Remote") == "USA"
    assert country_from_locations(None) is None
    assert country_from_locations("") is None
