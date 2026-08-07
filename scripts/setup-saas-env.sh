#!/bin/bash

# Railway API configuration
API_TOKEN="3f9f58d2-0e50-4522-a874-8e1d0e87a228"
PROJECT_ID="a7bb478d-d496-474f-b91b-2cd412f168f0"
ENVIRONMENT_ID="57adbed2-79de-474e-ab6a-113dd60bd17a"
SERVICE_ID="855d6117-7dbc-45ac-af57-7bcb89f7eb21"

# Database configuration
DB_URL="postgresql://postgres:wWLSoGvNpROTODgkatyFXfRVsNtavVAe@shuttle.proxy.rlwy.net:41026/railway"

# Generate secure keys
ENCRYPTION_KEY=$(openssl rand -hex 32)
ADMIN_TOKEN=$(openssl rand -hex 32)

echo "Generated TENANT_DB_ENCRYPTION_KEY: $ENCRYPTION_KEY"
echo "Generated SAAS_ADMIN_TOKEN: $ADMIN_TOKEN"

# Function to set environment variable
set_env_var() {
  local name=$1
  local value=$2
  
  echo "Setting $name..."
  
  curl -s -X POST \
    "https://backboard.railway.app/graphql/v2" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d @- <<EOF | jq -r '.data // .errors'
{
  "query": "mutation (\$input: VariableUpsertInput!) { variableUpsert(input: \$input) }",
  "variables": {
    "input": {
      "projectId": "$PROJECT_ID",
      "environmentId": "$ENVIRONMENT_ID",
      "serviceId": "$SERVICE_ID",
      "name": "$name",
      "value": "$value"
    }
  }
}
EOF
}

# Set all required environment variables
set_env_var "CENTRAL_DATABASE_URL" "$DB_URL?sslmode=require"
set_env_var "TENANT_DB_ENCRYPTION_KEY" "$ENCRYPTION_KEY"
set_env_var "TENANT_DATABASE_URL_TEMPLATE" "postgresql://postgres:wWLSoGvNpROTODgkatyFXfRVsNtavVAe@shuttle.proxy.rlwy.net:41026/{db}?sslmode=require"
set_env_var "PROVISIONING_ADMIN_DATABASE_URL" "$DB_URL?sslmode=require"
set_env_var "MAIN_DOMAIN" "naioshfit.com"
set_env_var "SAAS_ADMIN_TOKEN" "$ADMIN_TOKEN"

echo ""
echo "Environment variables set successfully!"
echo ""
echo "Save these for your records:"
echo "TENANT_DB_ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "SAAS_ADMIN_TOKEN=$ADMIN_TOKEN"
