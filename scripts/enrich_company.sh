#!/bin/bash
# Script to enrich a single company with funding data from Coresignal
#
# Usage:
#   ./scripts/enrich_company.sh 12345
#   where 12345 is the company ID
#
# Or with company name search:
#   ./scripts/enrich_company.sh "Airbnb"

set -e

BACKEND_URL="${BACKEND_URL:-https://your-backend-url.vercel.app}"
COMPANY_ID="$1"

if [ -z "$COMPANY_ID" ]; then
    echo "Error: Company ID or name required"
    echo "Usage: $0 <company_id_or_name>"
    echo "Example: $0 12345"
    echo "Example: $0 'Airbnb'"
    exit 1
fi

echo "🔍 Enriching company: $COMPANY_ID"
echo "📡 Backend: $BACKEND_URL"
echo ""

# Make the API call
response=$(curl -s -X POST "$BACKEND_URL/api/admin/enrich-funding/$COMPANY_ID" \
    -H "Content-Type: application/json")

# Check if successful
if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ Success!"
    echo "$response" | jq '.'
else
    echo "❌ Error:"
    echo "$response" | jq '.'
    exit 1
fi
