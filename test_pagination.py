#!/usr/bin/env python3
"""
Test Algolia API pagination to understand why we're only getting 1,000 companies
"""

import requests
import json
from urllib.parse import urlencode

ALGOLIA_URL = "https://45bwzj1sgc-dsn.algolia.net/1/indexes/*/queries"
APP_ID = "45BWZJ1SGC"
API_KEY = "NzllNTY5MzJiZGM2OTY2ZTQwMDEzOTNhYWZiZGRjODlhYzVkNjBmOGRjNzJiMWM4ZTU0ZDlhYTZjOTJiMjlhMWFuYWx5dGljc1RhZ3M9eWNkYyZyZXN0cmljdEluZGljZXM9WUNDb21wYW55X3Byb2R1Y3Rpb24lMkNZQ0NvbXBhbnlfQnlfTGF1bmNoX0RhdGVfcHJvZHVjdGlvbiZ0YWdGaWx0ZXJzPSU1QiUyMnljZGNfcHVibGljJTIyJTVE"

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://www.ycombinator.com',
    'Referer': 'https://www.ycombinator.com/'
})

# Test with page 0
params = {
    'facetFilters': '',
    'facets': json.dumps([
        "app_answers", "app_video_public", "batch", "demo_day_video_public",
        "industries", "isHiring", "nonprofit", "question_answers",
        "regions", "subindustry", "top_company"
    ]),
    'hitsPerPage': 100,  # Try smaller page size first
    'maxValuesPerFacet': 1000,
    'page': 0,
    'query': '',
    'tagFilters': '',
    'analyticsTags': 'ycdc',
    'restrictIndices': 'YCCompany_production,YCCompany_By_Launch_Date_production',
    'tagFilters': '["ycdc_public"]'
}

request_body = {
    "requests": [
        {
            "indexName": "YCCompany_production",
            "params": urlencode(params)
        }
    ]
}

url = f"{ALGOLIA_URL}?x-algolia-agent=Algolia%20for%20JavaScript%20(3.35.1)&x-algolia-application-id={APP_ID}&x-algolia-api-key={API_KEY}"

response = session.post(url, json=request_body)
response.raise_for_status()
data = response.json()

result = data['results'][0]
print("=" * 80)
print("ALGOLIA API PAGINATION TEST")
print("=" * 80)
print(f"Hits per page: {params['hitsPerPage']}")
print(f"Current page: {params['page']}")
print(f"Hits returned: {len(result.get('hits', []))}")
print(f"Total hits (nbHits): {result.get('nbHits', 'N/A')}")
print(f"Total pages (nbPages): {result.get('nbPages', 'N/A')}")
print(f"Hits per page limit: {result.get('hitsPerPage', 'N/A')}")
print("=" * 80)
print()

# Test what happens with page 1
params['page'] = 1
request_body = {
    "requests": [
        {
            "indexName": "YCCompany_production",
            "params": urlencode(params)
        }
    ]
}

response = session.post(url, json=request_body)
data = response.json()
result = data['results'][0]

print("Page 1 test:")
print(f"Hits returned: {len(result.get('hits', []))}")
print()

# Test with 1000 hits per page
params['hitsPerPage'] = 1000
params['page'] = 0
request_body = {
    "requests": [
        {
            "indexName": "YCCompany_production",
            "params": urlencode(params)
        }
    ]
}

response = session.post(url, json=request_body)
data = response.json()
result = data['results'][0]

print("With 1000 hits per page:")
print(f"Hits returned: {len(result.get('hits', []))}")
print(f"Total hits (nbHits): {result.get('nbHits', 'N/A')}")
print(f"Total pages (nbPages): {result.get('nbPages', 'N/A')}")
print()
