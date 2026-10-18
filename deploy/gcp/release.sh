#!/usr/bin/env bash
# =============================================================================
# Carbonexo - safe, repeatable release to an EXISTING GCP project.
#
# Replaces deploy/deploy.sh for releases. That script targets a different project
# (project-d1b98ab5-...), can create a DB user and new secrets, sets CORS to "*",
# deploys :latest and lets the app run Flyway on startup. This one never does any of that.
#
#   ./deploy/gcp/release.sh <command> --project carbonexo [options]
#
# Commands (all mutate nothing unless stated):
#   preflight            read-only checks: project, region, services, SA, secrets, backups, git
#   build                build backend + frontend images from a COMMIT (git archive, never the
#                        working tree) with Cloud Build; records digests        [creates images]
#   backup               on-demand Cloud SQL backup                            [creates backup]
#   migrate              create/update + execute the MIGRATE_ONLY Cloud Run job against the DB
#                        (requires --approve-db-migration and a backup < 6 h old) [changes schema]
#   deploy-candidate     deploy recorded digests as NO-TRAFFIC tagged revisions [new revisions]
#   promote              shift traffic to a tagged revision (requires --approve-production)
#   rollback             print the traffic rollback commands for the currently serving revisions
#   status               read-only: revisions, traffic, digests
#
# Options:
#   --project ID          required; must equal EXPECTED_PROJECT below
#   --commit SHA          commit to build (default: HEAD; must be committed, clean tree not needed)
#   --service backend|web which service for promote/rollback
#   --tag TAG             revision tag (default: rc-<shortsha>)
#   --percent N           promote traffic percent (default 100)
#   --dry-run             print mutating commands instead of running them
#   --approve-db-migration / --approve-production   explicit human approvals
# =============================================================================
set -euo pipefail

# ---- verified 2026-10-18 (see docs/gcp/GCP_CURRENT_INFRASTRUCTURE_AUDIT.md) ----
EXPECTED_PROJECT="carbonexo"
EXPECTED_PROJECT_NUMBER="95267034623"
REGION="asia-south1"
AR_REPO="carbonexo"
SQL_INSTANCE="carbonexo-db"
DB_NAME="ecotrack"
DB_USER="ecotrack"
BACKEND_SVC="carbonexo-backend"
WEB_SVC="carbonexo-web"
MIGRATE_JOB="carbonexo-migrate"
RUNTIME_SA="95267034623-compute@developer.gserviceaccount.com"   # TODO: dedicated least-privilege SA (see security audit)
GOOGLE_CLIENT_ID="95267034623-do8ogieusjpgl080q5kohfqethjgraha.apps.googleusercontent.com"
# Both URL forms of the web service reach the browser; CORS must accept both.
WEB_ORIGINS="https://carbonexo-web-yigbd35s3q-el.a.run.app,https://carbonexo-web-95267034623.asia-south1.run.app"
BACKEND_PUBLIC_URL="https://carbonexo-backend-95267034623.asia-south1.run.app"   # baked into the web bundle
DB_POOL_MAX=5          # x BACKEND_MAX_INSTANCES must stay under db-f1-micro max_connections (25) minus admin headroom
BACKEND_MAX_INSTANCES=3
# -----------------------------------------------------------------------------

AR_HOST="${REGION}-docker.pkg.dev"
STATE_DIR="deploy/gcp/state"
CMD="${1:-}"; shift || true
PROJECT=""; COMMIT="HEAD"; SERVICE=""; TAG=""; PERCENT=100; DRY=0; OK_DB=0; OK_PROD=0
while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2;;
    --commit) COMMIT="$2"; shift 2;;
    --service) SERVICE="$2"; shift 2;;
    --tag) TAG="$2"; shift 2;;
    --percent) PERCENT="$2"; shift 2;;
    --dry-run) DRY=1; shift;;
    --approve-db-migration) OK_DB=1; shift;;
    --approve-production) OK_PROD=1; shift;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac
done

die() { echo "ERROR: $*" >&2; exit 1; }
run() { if [ "$DRY" = 1 ]; then printf 'DRY-RUN:'; printf ' %q' "$@"; echo; else "$@"; fi; }
g() { gcloud --project="$PROJECT" "$@"; }

[ -n "$CMD" ] || die "command required (preflight|build|backup|migrate|deploy-candidate|promote|rollback|status)"
[ -n "$PROJECT" ] || die "--project is required"
[ "$PROJECT" = "$EXPECTED_PROJECT" ] || die "project '$PROJECT' is not the verified production project '$EXPECTED_PROJECT'"
NUM=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)' 2>/dev/null) || die "cannot describe project $PROJECT"
[ "$NUM" = "$EXPECTED_PROJECT_NUMBER" ] || die "project number $NUM != expected $EXPECTED_PROJECT_NUMBER"

SHA=$(git rev-parse --verify "${COMMIT}^{commit}") || die "unknown commit $COMMIT"
SHORT=${SHA:0:7}
TAG=${TAG:-rc-$SHORT}
mkdir -p "$STATE_DIR"
STATE="$STATE_DIR/$SHORT.env"

service_exists() { g run services describe "$1" --region="$REGION" --format='value(metadata.name)' >/dev/null 2>&1; }

preflight() {
  echo "== project $PROJECT ($NUM), region $REGION, commit $SHA"
  for s in "$BACKEND_SVC" "$WEB_SVC"; do service_exists "$s" || die "service $s not found in $REGION"; done
  local sa; sa=$(g run services describe "$BACKEND_SVC" --region="$REGION" --format='value(spec.template.spec.serviceAccountName)')
  [ "$sa" = "$RUNTIME_SA" ] || die "backend runs as $sa, script expects $RUNTIME_SA"
  for s in JWT_SECRET DB_PASSWORD; do
    g secrets versions list "$s" --filter=state=enabled --format='value(name)' --limit=1 | grep -q . || die "secret $s has no enabled version"
  done
  echo "   secrets present (values not read)"
  local backups; backups=$(g sql instances describe "$SQL_INSTANCE" --format='value(settings.backupConfiguration.enabled)')
  [ "$backups" = "True" ] || echo "   WARNING: automated backups are DISABLED on $SQL_INSTANCE - migrate will refuse to run"
  local last; last=$(g sql backups list --instance="$SQL_INSTANCE" --limit=1 --format='value(endTime)' 2>/dev/null || true)
  echo "   latest successful backup: ${last:-NONE}"
  local cur; cur=$(gcloud logging read "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$BACKEND_SVC\" AND textPayload:\"Current version of schema\"" \
      --project="$PROJECT" --limit=1 --freshness=30d --format='value(textPayload)' 2>/dev/null | grep -oE '[0-9]+$' || true)
  echo "   production schema version (from startup logs): ${cur:-unknown}"
  echo "   local migrations: $(git ls-tree --name-only "$SHA" database/migrations/ | grep -c 'V[0-9]*__')"
  git diff --quiet "$SHA" -- backend database deploy app components lib package.json package-lock.json \
    || echo "   NOTE: working tree differs from $SHORT; build uses the commit, not the working tree"
  echo "== preflight OK"
}

build() {
  local ctx; ctx=$(mktemp -d)
  trap 'rm -rf "$ctx"' RETURN
  git archive "$SHA" | tar -x -C "$ctx"
  local bimg="$AR_HOST/$PROJECT/$AR_REPO/backend:$SHORT" wimg="$AR_HOST/$PROJECT/$AR_REPO/web:$SHORT"
  run g builds submit "$ctx" --region="$REGION" --config="$ctx/deploy/cloudbuild.backend.yaml" --substitutions=_IMAGE="$bimg"
  run g builds submit "$ctx" --region="$REGION" --config="$ctx/deploy/cloudbuild.frontend.yaml" \
      --substitutions=_IMAGE="$wimg",_API_URL="$BACKEND_PUBLIC_URL",_GCID="$GOOGLE_CLIENT_ID"
  [ "$DRY" = 1 ] && return
  local bd wd
  bd=$(gcloud artifacts docker images describe "$bimg" --format='value(image_summary.fully_qualified_digest)')
  wd=$(gcloud artifacts docker images describe "$wimg" --format='value(image_summary.fully_qualified_digest)')
  printf 'COMMIT=%s\nBACKEND_IMAGE=%s\nWEB_IMAGE=%s\nBUILT_AT=%s\n' "$SHA" "$bd" "$wd" "$(date -u +%FT%TZ)" > "$STATE"
  echo "== recorded $STATE"; cat "$STATE"
}

load_state() { [ -f "$STATE" ] || die "no build record $STATE - run build first"; . "$STATE"; [ "$COMMIT" = "$SHA" ] || die "state commit mismatch"; }

backup() {
  run g sql backups create --instance="$SQL_INSTANCE" --description="pre-release $SHORT"
}

migrate() {
  [ "$OK_DB" = 1 ] || die "migrate changes the production schema; re-run with --approve-db-migration after reading GCP_DATABASE_MIGRATION_SAFETY.md"
  load_state
  local last age
  last=$(g sql backups list --instance="$SQL_INSTANCE" --filter="status=SUCCESSFUL" --limit=1 --format='value(endTime)')
  [ -n "$last" ] || die "no successful Cloud SQL backup exists - run: $0 backup --project $PROJECT"
  age=$(( $(date -u +%s) - $(date -u -d "$last" +%s) ))
  [ "$age" -lt 21600 ] || die "latest backup is $((age/3600)) h old; take a fresh one first"
  local verb=create
  g run jobs describe "$MIGRATE_JOB" --region="$REGION" >/dev/null 2>&1 && verb=update
  run g run jobs "$verb" "$MIGRATE_JOB" --region="$REGION" --image="$BACKEND_IMAGE" \
      --service-account="$RUNTIME_SA" --set-cloudsql-instances="$PROJECT:$REGION:$SQL_INSTANCE" \
      --max-retries=0 --task-timeout=600 --memory=512Mi --cpu=1 \
      --set-secrets="DB_PASSWORD=DB_PASSWORD:latest" \
      --set-env-vars="MIGRATE_ONLY=true,DB_USER=$DB_USER,DB_URL=jdbc:postgresql:///$DB_NAME?cloudSqlInstance=$PROJECT:$REGION:$SQL_INSTANCE&socketFactory=com.google.cloud.sql.postgres.SocketFactory"
  run g run jobs execute "$MIGRATE_JOB" --region="$REGION" --wait
  echo "== check the job log line 'MIGRATE_ONLY from=... to=... executed=...'"
}

deploy_candidate() {
  load_state
  local env="DB_URL=jdbc:postgresql:///$DB_NAME?cloudSqlInstance=$PROJECT:$REGION:$SQL_INSTANCE&socketFactory=com.google.cloud.sql.postgres.SocketFactory"
  env+="@DB_USER=$DB_USER@DB_POOL_MAX=$DB_POOL_MAX@FLYWAY_MODE=validate@AI_PROVIDER=gemini"
  env+="@GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID@GCP_PROJECT_ID=$PROJECT@GCP_LOCATION=$REGION"
  env+="@AI_DEFAULT_MODEL=gemini-2.5-flash@AI_FAST_MODEL=gemini-2.5-flash@AGENT_MODEL=gemini-3-flash-preview@AGENT_LOCATION=global"
  env+="@AGENT_EMBEDDING_LOCATION=$REGION@LOG_LEVEL_APP=INFO@CORS_ALLOWED_ORIGINS=$WEB_ORIGINS"
  # --no-traffic does NOT stop the revision from starting against the DB; FLYWAY_MODE=validate
  # makes it refuse to start (not migrate) if the schema is behind.
  run g run deploy "$BACKEND_SVC" --region="$REGION" --image="$BACKEND_IMAGE" --no-traffic --tag="$TAG" \
      --service-account="$RUNTIME_SA" --set-cloudsql-instances="$PROJECT:$REGION:$SQL_INSTANCE" \
      --cpu=1 --memory=1Gi --concurrency=40 --min-instances=0 --max-instances="$BACKEND_MAX_INSTANCES" \
      --cpu-boost --timeout=60 \
      --set-secrets="JWT_SECRET=JWT_SECRET:latest,DB_PASSWORD=DB_PASSWORD:latest" \
      --set-env-vars="^@^$env"
  run g run deploy "$WEB_SVC" --region="$REGION" --image="$WEB_IMAGE" --no-traffic --tag="$TAG" \
      --cpu=1 --memory=512Mi --min-instances=0 --max-instances=3 --cpu-boost --port=3000
  echo "== candidate URLs (no production traffic):"
  echo "   https://$TAG---carbonexo-backend-yigbd35s3q-el.a.run.app"
  echo "   https://$TAG---carbonexo-web-yigbd35s3q-el.a.run.app"
  echo "   NOTE: the web image calls $BACKEND_PUBLIC_URL (the production backend). Test the backend tag"
  echo "   directly with scripts/e2e, and the web tag only once the backend candidate holds 100%."
  print_rollback
}

current_revision() { g run services describe "$1" --region="$REGION" --format='value(status.traffic[0].revisionName)'; }

print_rollback() {
  echo "== rollback commands (traffic only - schema changes are NOT undone):"
  for s in "$BACKEND_SVC" "$WEB_SVC"; do
    local r; r=$(g run services describe "$s" --region="$REGION" --format='value(status.traffic.filter(percent>0).revisionName)' 2>/dev/null \
                 || current_revision "$s")
    echo "   gcloud run services update-traffic $s --project=$PROJECT --region=$REGION --to-revisions=${r%%;*}=100"
  done
}

promote() {
  [ -n "$SERVICE" ] || die "--service backend|web required"
  [ "$OK_PROD" = 1 ] || die "promote moves production traffic; re-run with --approve-production"
  local svc; svc=$([ "$SERVICE" = backend ] && echo "$BACKEND_SVC" || echo "$WEB_SVC")
  print_rollback
  run g run services update-traffic "$svc" --region="$REGION" --to-tags="$TAG=$PERCENT"
}

# Print-only by design: the operator picks and runs the rollback target explicitly.
rollback() {
  print_rollback
}

status() {
  for s in "$BACKEND_SVC" "$WEB_SVC"; do
    echo "== $s"; g run services describe "$s" --region="$REGION" --format='table(status.traffic[].revisionName,status.traffic[].percent,status.traffic[].tag)'
  done
  g run revisions list --region="$REGION" --limit=8 --format='table(metadata.name,status.imageDigest.basename(),metadata.creationTimestamp)'
}

case "$CMD" in
  preflight) preflight;;
  build) build;;
  backup) backup;;
  migrate) migrate;;
  deploy-candidate) deploy_candidate;;
  promote) promote;;
  rollback) rollback;;
  status) status;;
  *) die "unknown command $CMD";;
esac
