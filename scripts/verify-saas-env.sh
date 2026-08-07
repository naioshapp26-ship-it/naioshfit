#!/bin/bash

echo "SaaS Multi-Tenant Configuration Verification"
echo "============================================="
echo ""

# Check if Railway environment variables are set
echo "Checking Railway environment variables..."
echo ""

REQUIRED_VARS=(
  "CENTRAL_DATABASE_URL"
  "TENANT_DB_ENCRYPTION_KEY"
  "TENANT_DATABASE_URL_TEMPLATE"
  "PROVISIONING_ADMIN_DATABASE_URL"
  "MAIN_DOMAIN"
  "SAAS_ADMIN_TOKEN"
)

API_TOKEN="3f9f58d2-0e50-4522-a874-8e1d0e87a228"
PROJECT_ID="a7bb478d-d496-474f-b91b-2cd412f168f0"
ENVIRONMENT_ID="57adbed2-79de-474e-ab6a-113dd60bd17a"

echo "Fetching environment variables from Railway..."
echo ""

for var in "${REQUIRED_VARS[@]}"; do
  result=$(curl -s -X POST \
    "https://backboard.railway.app/graphql/v2" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"query { variables(projectId: \\\"$PROJECT_ID\\\", environmentId: \\\"$ENVIRONMENT_ID\\\") { edges { node { name } } } }\"}" \
    | jq -r ".data.variables.edges[] | select(.node.name == \"$var\") | .node.name" 2>/dev/null)
  
  if [ -n "$result" ]; then
    echo "✓ $var is set"
  else
    echo "✗ $var is NOT set"
  fi
done

echo ""
echo "Verification complete!"
echo ""
echo "To manually verify, check Railway dashboard:"
echo "  Project: $PROJECT_ID"
echo "  Environment: $ENVIRONMENT_ID"
