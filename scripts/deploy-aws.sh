#!/usr/bin/env bash
# Deploys the API to AWS Lambda (Function URL) and the client to AWS Amplify Hosting
# as a manual (zip) deployment. Re-running updates both in place.
#
# Required env: AWS credentials + AWS_REGION, SUPABASE_URL, SUPABASE_ANON_KEY,
#               SUPABASE_SERVICE_ROLE_KEY
# Optional env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, DISCOGS_TOKEN,
#               APP_NAME (default cratedig), BRANCH (default main)
set -euo pipefail

: "${AWS_REGION:?}" "${SUPABASE_URL:?}" "${SUPABASE_ANON_KEY:?}" "${SUPABASE_SERVICE_ROLE_KEY:?}"
APP_NAME=${APP_NAME:-cratedig}
BRANCH=${BRANCH:-main}
FN="$APP_NAME-api"
ROLE="$APP_NAME-api-lambda"
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
export AWS_DEFAULT_REGION=$AWS_REGION AWS_PAGER=""

# --- Amplify app (needed first: its domain is the API's CORS origin) ---
APP_ID=$(aws amplify list-apps --query "apps[?name=='$APP_NAME'].appId | [0]" --output text)
if [ "$APP_ID" = "None" ] || [ -z "$APP_ID" ]; then
  APP_ID=$(aws amplify create-app --name "$APP_NAME" --platform WEB \
    --query app.appId --output text)
fi
aws amplify get-branch --app-id "$APP_ID" --branch-name "$BRANCH" >/dev/null 2>&1 ||
  aws amplify create-branch --app-id "$APP_ID" --branch-name "$BRANCH" --stage PRODUCTION >/dev/null
SITE="https://$BRANCH.$APP_ID.amplifyapp.com"
echo "Amplify app $APP_ID -> $SITE"

# --- Lambda execution role ---
if ! ROLE_ARN=$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text 2>/dev/null); then
  ROLE_ARN=$(aws iam create-role --role-name "$ROLE" --query Role.Arn --output text \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}')
  aws iam attach-role-policy --role-name "$ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  sleep 10 # IAM propagation
fi

# --- API bundle ---
(cd "$ROOT/api" && npm ci --silent && npm run -s build:lambda)
(cd "$ROOT/api/dist-lambda" && zip -q "$WORK/api.zip" index.mjs)

ENV_JSON=$(node -e '
const keys = ["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY","VAPID_SUBJECT","DISCOGS_TOKEN"];
const v = { NODE_ENV: "production", CORS_ORIGIN: process.argv[1] };
for (const k of keys) if (process.env[k]) v[k] = process.env[k];
console.log(JSON.stringify({ Variables: v }));' "$SITE")

if aws lambda get-function --function-name "$FN" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FN" --zip-file "fileb://$WORK/api.zip" >/dev/null
  aws lambda wait function-updated --function-name "$FN"
  aws lambda update-function-configuration --function-name "$FN" --environment "$ENV_JSON" >/dev/null
else
  aws lambda create-function --function-name "$FN" --runtime nodejs22.x --handler index.handler \
    --role "$ROLE_ARN" --zip-file "fileb://$WORK/api.zip" --memory-size 512 --timeout 20 \
    --environment "$ENV_JSON" >/dev/null
fi
aws lambda wait function-updated --function-name "$FN"

if ! FN_URL=$(aws lambda get-function-url-config --function-name "$FN" --query FunctionUrl --output text 2>/dev/null); then
  FN_URL=$(aws lambda create-function-url-config --function-name "$FN" --auth-type NONE \
    --query FunctionUrl --output text)
  aws lambda add-permission --function-name "$FN" --statement-id public-url \
    --action lambda:InvokeFunctionUrl --principal '*' --function-url-auth-type NONE >/dev/null
  aws lambda add-permission --function-name "$FN" --statement-id public-invoke \
    --action lambda:InvokeFunction --principal '*' --invoked-via-function-url >/dev/null
fi
echo "API -> ${FN_URL}api/v1"

# --- Amplify rewrites and headers ---
RULES=$(node -e '
const api = process.argv[1].replace(/\/$/, "");
console.log(JSON.stringify([
  { source: "/api/<*>", target: api + "/api/<*>", status: "200" },
  { source: "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webmanifest)$)([^.]+$)/>", target: "/index.html", status: "200" },
]));' "$FN_URL")
aws amplify update-app --app-id "$APP_ID" --custom-rules "$RULES" \
  --custom-headers "$(cat "$ROOT/customHttp.yml")" >/dev/null

# --- Client build and manual deployment ---
(cd "$ROOT/client" && npm ci --silent &&
  VITE_SUPABASE_URL=$SUPABASE_URL VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY npm run -s build)
(cd "$ROOT/client/dist" && zip -qr "$WORK/site.zip" .)
read -r JOB_ID UPLOAD_URL < <(aws amplify create-deployment --app-id "$APP_ID" --branch-name "$BRANCH" \
  --query '[jobId, zipUploadUrl]' --output text)
curl -fsS -X PUT -H 'Content-Type: application/zip' --upload-file "$WORK/site.zip" "$UPLOAD_URL"
aws amplify start-deployment --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" >/dev/null
for _ in $(seq 60); do
  STATUS=$(aws amplify get-job --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" \
    --query job.summary.status --output text)
  case $STATUS in SUCCEED) break ;; FAILED|CANCELLED) echo "Deployment $STATUS" >&2; exit 1 ;; esac
  sleep 5
done
echo "Deployed: $SITE"
