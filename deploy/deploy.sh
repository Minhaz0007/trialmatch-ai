#!/usr/bin/env bash
# =============================================================================
# deploy.sh — TrialMatch AI — Full AWS Deployment from Scratch
# =============================================================================
#
# What this script does:
#   1. Creates an EC2 key pair (saves .pem locally)
#   2. Creates a security group (ports 22, 80, 3000, 8000)
#   3. Looks up the latest Ubuntu 22.04 LTS AMI via SSM
#   4. Launches a t2.micro EC2 instance
#   5. Creates and attaches a gp3 EBS volume for ChromaDB persistence
#   6. Waits for the instance to be SSH-reachable
#   7. Deploys the backend (FastAPI + ChromaDB via Docker Compose)
#   8. Deploys the frontend — either on the same EC2 (Node.js + PM2)
#      or via AWS Amplify (pass --amplify --github-token <TOKEN>)
#   9. Runs health checks and prints a summary
#
# Prerequisites:
#   - AWS CLI v2  (aws configure  OR  environment variables)
#   - jq
#   - ssh, scp, ssh-keygen
#   - curl
#
# Usage:
#   chmod +x deploy/deploy.sh
#   ./deploy/deploy.sh                        # interactive prompts
#   ./deploy/deploy.sh --groq-key gsk_xxx     # non-interactive
#   ./deploy/deploy.sh --amplify --github-token ghp_xxx   # Amplify frontend
#
# Environment variable overrides (alternative to flags):
#   GROQ_API_KEY, AWS_REGION, GITHUB_TOKEN
# =============================================================================

set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
success() { echo -e "${GREEN}✔${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
fail()    { echo -e "${RED}✘${NC}  $*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${NC}"; }
die()     { fail "$1"; exit 1; }

banner() {
  echo -e "${BOLD}${CYAN}"
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║          TrialMatch AI — AWS Deployment Script               ║"
  echo "║          Backend: EC2 (FastAPI + Docker)                     ║"
  echo "║          Frontend: EC2 (Next.js + PM2) or AWS Amplify        ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

# ── Script directory (project root is one level up) ────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ── Defaults ───────────────────────────────────────────────────────────────────
APP_NAME="trialmatch-ai"
REGION="${AWS_REGION:-us-east-1}"
INSTANCE_TYPE="t2.micro"
KEY_NAME="trialmatch-key"
SG_NAME="trialmatch-sg"
GITHUB_REPO="https://github.com/minhaz0007/trialmatch-ai.git"
BRANCH="main"
DEPLOY_FRONTEND="ec2"   # ec2 | amplify | skip
GROQ_KEY="${GROQ_API_KEY:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
LANGCHAIN_KEY=""
LANGCHAIN_TRACING="false"
API_KEY=""
EBS_SIZE=8
ROOT_SIZE=20
PEM_FILE="${KEY_NAME}.pem"

# Runtime state (set during execution)
INSTANCE_ID=""
VOLUME_ID=""
SG_ID=""
AZ=""
AMI_ID=""
PUBLIC_IP=""
AMPLIFY_URL=""
AMPLIFY_APP_ID=""

# ── Parse CLI arguments ────────────────────────────────────────────────────────
usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --groq-key KEY          Groq API key (prompted if not set)
  --region REGION         AWS region (default: us-east-1)
  --instance-type TYPE    EC2 instance type (default: t2.micro)
  --key-name NAME         EC2 key pair name (default: trialmatch-key)
  --amplify               Deploy frontend to AWS Amplify (needs --github-token)
  --github-token TOKEN    GitHub personal access token with 'repo' scope
  --github-repo URL       GitHub repo URL (default: minhaz0007/trialmatch-ai)
  --skip-frontend         Skip frontend deployment entirely
  --langchain-key KEY     LangSmith API key (enables tracing)
  --api-key KEY           Optional rate-limiting API key for the backend
  --help                  Show this help

Environment variable shortcuts:
  GROQ_API_KEY=xxx ./deploy.sh
  AWS_REGION=eu-west-1 ./deploy.sh
  GITHUB_TOKEN=ghp_xxx ./deploy.sh --amplify
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --groq-key)      GROQ_KEY="$2";      shift 2 ;;
    --region)        REGION="$2";        shift 2 ;;
    --instance-type) INSTANCE_TYPE="$2"; shift 2 ;;
    --key-name)      KEY_NAME="$2"; PEM_FILE="${KEY_NAME}.pem"; shift 2 ;;
    --amplify)       DEPLOY_FRONTEND="amplify"; shift ;;
    --github-token)  GITHUB_TOKEN="$2";  shift 2 ;;
    --github-repo)   GITHUB_REPO="$2";   shift 2 ;;
    --skip-frontend) DEPLOY_FRONTEND="skip"; shift ;;
    --langchain-key) LANGCHAIN_KEY="$2"; LANGCHAIN_TRACING="true"; shift 2 ;;
    --api-key)       API_KEY="$2";       shift 2 ;;
    --help|-h)       usage ;;
    *) die "Unknown option: $1. Use --help for usage." ;;
  esac
done

# ── Cleanup / state file ───────────────────────────────────────────────────────
STATE_FILE=".trialmatch-deploy-state"

save_state() {
  cat > "$STATE_FILE" <<EOF
INSTANCE_ID=${INSTANCE_ID}
VOLUME_ID=${VOLUME_ID}
SG_ID=${SG_ID}
PUBLIC_IP=${PUBLIC_IP}
KEY_NAME=${KEY_NAME}
PEM_FILE=${PEM_FILE}
REGION=${REGION}
AMPLIFY_APP_ID=${AMPLIFY_APP_ID}
AMPLIFY_URL=${AMPLIFY_URL}
EOF
}

# ── Step 0: Prerequisites ──────────────────────────────────────────────────────
check_prereqs() {
  step "Checking prerequisites"
  local missing=0
  for cmd in aws jq ssh ssh-keygen curl; do
    if command -v "$cmd" &>/dev/null; then
      success "$cmd"
    else
      fail "$cmd not found — please install it"
      missing=1
    fi
  done
  [[ $missing -eq 1 ]] && die "Install missing tools and retry."

  if aws sts get-caller-identity --region "$REGION" &>/dev/null; then
    local acct
    acct=$(aws sts get-caller-identity --region "$REGION" --query 'Account' --output text)
    success "AWS credentials valid (account: $acct, region: $REGION)"
  else
    die "AWS CLI not configured. Run: aws configure"
  fi
}

# ── Collect required inputs interactively if missing ──────────────────────────
collect_inputs() {
  step "Configuration"

  if [[ -z "$GROQ_KEY" ]]; then
    echo -n "  Groq API key (https://console.groq.com/keys): "
    read -r -s GROQ_KEY; echo ""
    [[ -z "$GROQ_KEY" ]] && die "GROQ_API_KEY is required"
  fi
  success "Groq API key set"

  if [[ "$DEPLOY_FRONTEND" == "amplify" && -z "$GITHUB_TOKEN" ]]; then
    echo -n "  GitHub personal access token (repo scope): "
    read -r -s GITHUB_TOKEN; echo ""
    [[ -z "$GITHUB_TOKEN" ]] && die "GitHub token is required for Amplify deployment"
    success "GitHub token set"
  fi

  echo ""
  log "  Region:        $REGION"
  log "  Instance type: $INSTANCE_TYPE"
  log "  Key pair:      $KEY_NAME"
  log "  Frontend:      $DEPLOY_FRONTEND"
  log "  GitHub repo:   $GITHUB_REPO"
  echo ""
}

# ── Step 1: SSH Key Pair ───────────────────────────────────────────────────────
create_key_pair() {
  step "Step 1/8: SSH Key Pair"

  local key_exists_aws=false
  if aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" &>/dev/null 2>&1; then
    key_exists_aws=true
  fi

  if [[ -f "$PEM_FILE" ]]; then
    chmod 400 "$PEM_FILE"
    if $key_exists_aws; then
      success "Key pair '$KEY_NAME' already exists (local PEM: $PEM_FILE)"
    else
      # Import local public key into AWS
      local pub
      pub=$(ssh-keygen -y -f "$PEM_FILE")
      aws ec2 import-key-pair \
        --key-name "$KEY_NAME" \
        --public-key-material "$(echo "$pub" | base64 | tr -d '\n')" \
        --region "$REGION" &>/dev/null
      success "Imported existing PEM as key pair '$KEY_NAME'"
    fi
    return
  fi

  if $key_exists_aws; then
    die "Key pair '$KEY_NAME' exists in AWS but ${PEM_FILE} is missing locally. Delete the AWS key pair or use --key-name with a different name."
  fi

  aws ec2 create-key-pair \
    --key-name "$KEY_NAME" \
    --query 'KeyMaterial' \
    --output text \
    --region "$REGION" > "$PEM_FILE"
  chmod 400 "$PEM_FILE"
  success "Created key pair '$KEY_NAME' → $(pwd)/$PEM_FILE"
}

# ── Step 2: Security Group ────────────────────────────────────────────────────
create_security_group() {
  step "Step 2/8: Security Group"

  local existing
  existing=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$SG_NAME" \
    --query 'SecurityGroups[0].GroupId' \
    --output text \
    --region "$REGION" 2>/dev/null)

  if [[ -n "$existing" && "$existing" != "None" ]]; then
    warn "Security group '$SG_NAME' already exists ($existing) — reusing"
    SG_ID="$existing"
    save_state
    return
  fi

  SG_ID=$(aws ec2 create-security-group \
    --group-name "$SG_NAME" \
    --description "TrialMatch AI — backend + frontend" \
    --region "$REGION" \
    --query 'GroupId' \
    --output text)

  # Helper to add ingress rule
  add_rule() {
    aws ec2 authorize-security-group-ingress \
      --group-id "$SG_ID" \
      --protocol tcp --port "$1" --cidr 0.0.0.0/0 \
      --region "$REGION" &>/dev/null
  }

  add_rule 22    # SSH
  add_rule 80    # HTTP (Nginx if used)
  add_rule 3000  # Next.js frontend
  add_rule 8000  # FastAPI backend

  success "Created security group '$SG_NAME' ($SG_ID) with ports 22, 80, 3000, 8000"
  save_state
}

# ── Step 3: Ubuntu 22.04 LTS AMI ─────────────────────────────────────────────
find_ami() {
  step "Step 3/8: Ubuntu 22.04 LTS AMI"

  AMI_ID=$(aws ssm get-parameter \
    --name "/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id" \
    --query 'Parameter.Value' \
    --output text \
    --region "$REGION" 2>/dev/null || echo "")

  [[ -z "$AMI_ID" ]] && die "Could not find Ubuntu 22.04 AMI in region $REGION via SSM"
  success "AMI: $AMI_ID (Ubuntu 22.04 LTS, $REGION)"
}

# ── Step 4: Launch EC2 Instance ───────────────────────────────────────────────
launch_instance() {
  step "Step 4/8: Launching EC2 Instance ($INSTANCE_TYPE)"

  # Minimal bootstrap: install Docker + Node.js 20 + PM2
  # The full app setup is done via SSH in later steps for visibility
  local user_data
  user_data=$(cat <<'BOOTSTRAP'
#!/bin/bash
set -euo pipefail
exec > /var/log/trialmatch-bootstrap.log 2>&1

apt-get update -y
apt-get install -y git curl unzip docker.io docker-compose-v2

systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "BOOTSTRAP_DONE" > /tmp/bootstrap_done
BOOTSTRAP
)

  INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --user-data "$user_data" \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":${ROOT_SIZE},\"VolumeType\":\"gp3\",\"DeleteOnTermination\":true}}]" \
    --tag-specifications \
      "ResourceType=instance,Tags=[{Key=Name,Value=${APP_NAME}},{Key=App,Value=${APP_NAME}}]" \
    --region "$REGION" \
    --query 'Instances[0].InstanceId' \
    --output text)

  AZ=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].Placement.AvailabilityZone' \
    --output text \
    --region "$REGION")

  success "Instance launched: $INSTANCE_ID (AZ: $AZ)"
  save_state
}

# ── Step 5: EBS Volume for ChromaDB ──────────────────────────────────────────
attach_ebs() {
  step "Step 5/8: EBS Volume for ChromaDB"

  VOLUME_ID=$(aws ec2 create-volume \
    --size "$EBS_SIZE" \
    --volume-type gp3 \
    --availability-zone "$AZ" \
    --tag-specifications \
      "ResourceType=volume,Tags=[{Key=Name,Value=${APP_NAME}-chroma},{Key=App,Value=${APP_NAME}}]" \
    --region "$REGION" \
    --query 'VolumeId' \
    --output text)

  log "Waiting for volume $VOLUME_ID to be available..."
  aws ec2 wait volume-available --volume-ids "$VOLUME_ID" --region "$REGION"

  aws ec2 attach-volume \
    --volume-id "$VOLUME_ID" \
    --instance-id "$INSTANCE_ID" \
    --device /dev/xvdf \
    --region "$REGION" &>/dev/null

  success "EBS volume $VOLUME_ID attached as /dev/xvdf"
  save_state
}

# ── Step 6: Wait for instance SSH ────────────────────────────────────────────
wait_for_instance() {
  step "Step 6/8: Waiting for Instance to be Ready"

  log "Waiting for instance to enter 'running' state..."
  aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

  PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text \
    --region "$REGION")

  success "Instance running at $PUBLIC_IP"
  save_state

  log "Waiting for SSH (up to 5 min)..."
  local attempts=0
  until ssh -i "$PEM_FILE" \
      -o StrictHostKeyChecking=no \
      -o ConnectTimeout=5 \
      -o BatchMode=yes \
      "ubuntu@${PUBLIC_IP}" "true" 2>/dev/null; do
    attempts=$((attempts + 1))
    [[ $attempts -gt 60 ]] && die "SSH not available after 5 min. Check security group ${SG_ID}."
    printf "."
    sleep 5
  done
  echo ""; success "SSH ready"

  log "Waiting for cloud-init bootstrap to finish (Docker + Node.js install)..."
  local init_attempts=0
  until ssh -i "$PEM_FILE" \
      -o StrictHostKeyChecking=no \
      -o BatchMode=yes \
      "ubuntu@${PUBLIC_IP}" "test -f /tmp/bootstrap_done" 2>/dev/null; do
    init_attempts=$((init_attempts + 1))
    [[ $init_attempts -gt 72 ]] && die "Bootstrap did not finish in 6 min. SSH in and check /var/log/trialmatch-bootstrap.log"
    printf "."
    sleep 5
  done
  echo ""; success "Bootstrap complete"
}

# ── SSH/SCP helpers ───────────────────────────────────────────────────────────
ssh_run() {
  ssh -i "$PEM_FILE" \
    -o StrictHostKeyChecking=no \
    -o BatchMode=yes \
    "ubuntu@${PUBLIC_IP}" "$@"
}

ssh_script() {
  # Run a local heredoc as a script on the remote host
  ssh -i "$PEM_FILE" \
    -o StrictHostKeyChecking=no \
    -o BatchMode=yes \
    "ubuntu@${PUBLIC_IP}" bash
}

# ── Step 7: Deploy Backend ────────────────────────────────────────────────────
deploy_backend() {
  step "Step 7/8: Deploying Backend (FastAPI + ChromaDB)"

  # ── Mount EBS volume ──
  log "Mounting ChromaDB EBS volume..."
  ssh_run bash <<'REMOTE'
set -euo pipefail
# Detect device name (Xen = /dev/xvdf, Nitro = /dev/nvme1n1)
if   [[ -b /dev/xvdf ]];    then DEVICE=/dev/xvdf
elif [[ -b /dev/nvme1n1 ]]; then DEVICE=/dev/nvme1n1
else
  echo "EBS device not found yet, waiting 10s..."
  sleep 10
  DEVICE=$(lsblk -o NAME -d -n | awk 'NR>1{print "/dev/"$1}' | head -1)
fi
echo "Using device: $DEVICE"

MOUNT=/data/chroma
if ! blkid "$DEVICE" &>/dev/null; then
  sudo mkfs.ext4 "$DEVICE"
fi
sudo mkdir -p "$MOUNT"
sudo mount "$DEVICE" "$MOUNT" 2>/dev/null || true
sudo chown ubuntu:ubuntu "$MOUNT"
grep -q "$DEVICE" /etc/fstab \
  || echo "$DEVICE $MOUNT ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab > /dev/null
echo "Mounted $DEVICE at $MOUNT"
REMOTE
  success "ChromaDB EBS mounted at /data/chroma"

  # ── Clone repo ──
  log "Cloning repository..."
  ssh_run "rm -rf ~/app && git clone ${GITHUB_REPO} ~/app"
  success "Repository cloned"

  # ── Write .env (variables expanded by local shell before sending) ──
  log "Writing .env..."
  ssh_run bash <<ENV_SCRIPT
cat > ~/app/.env <<'ENVEOF'
GROQ_API_KEY=${GROQ_KEY}
LANGCHAIN_TRACING_V2=${LANGCHAIN_TRACING}
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_API_KEY=${LANGCHAIN_KEY}
LANGCHAIN_PROJECT=trialmatch-ai
API_KEY=${API_KEY}
ENVEOF
ENV_SCRIPT
  success ".env written"

  # ── Docker Compose override: use EBS mount instead of named volume ──
  log "Creating docker-compose override..."
  ssh_run bash <<'REMOTE'
cat > ~/app/docker-compose.override.yml <<'DCEOF'
version: "3.9"
services:
  backend:
    volumes:
      - /data/chroma:/app/data/chroma_store
DCEOF
REMOTE
  success "docker-compose.override.yml created"

  # ── Build and start backend ──
  log "Building Docker image and starting backend (3-5 min for first build)..."
  ssh_run "cd ~/app && sudo docker compose up -d --build"
  success "Backend container started"
}

# ── Step 8a: Frontend on EC2 (PM2) ───────────────────────────────────────────
deploy_frontend_ec2() {
  log "Building and starting Next.js frontend with PM2..."

  # Pass PUBLIC_IP via heredoc interpolation (not single-quoted)
  ssh_run bash <<REMOTE
set -euo pipefail
cd ~/app/frontend

# Set backend URL env var for the build
export NEXT_PUBLIC_API_URL="http://${PUBLIC_IP}:8000"

# Install dependencies and build
npm ci
npm run build

# Start (or restart) with PM2
pm2 delete frontend 2>/dev/null || true
pm2 start npm --name "frontend" -- start -- -p 3000
pm2 save

# Enable PM2 on reboot
(pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>&1 | grep -E '^sudo' | bash) || true
REMOTE
  success "Frontend running on http://${PUBLIC_IP}:3000 (PM2)"
}

# ── Step 8b: Frontend on AWS Amplify ─────────────────────────────────────────
deploy_frontend_amplify() {
  log "Creating AWS Amplify app for frontend..."

  # Strip trailing .git from URL
  local repo_https="${GITHUB_REPO%.git}"

  # Read amplify.yml build spec from project root
  local build_spec
  build_spec=$(cat "${PROJECT_ROOT}/amplify.yml")

  # Create Amplify app linked to GitHub repo
  local app_json
  app_json=$(aws amplify create-app \
    --name "${APP_NAME}-frontend" \
    --repository "$repo_https" \
    --access-token "$GITHUB_TOKEN" \
    --platform WEB \
    --environment-variables "NEXT_PUBLIC_API_URL=http://${PUBLIC_IP}:8000" \
    --build-spec "$build_spec" \
    --region "$REGION" \
    --output json)

  AMPLIFY_APP_ID=$(echo "$app_json" | jq -r '.app.appId')
  local default_domain
  default_domain=$(echo "$app_json" | jq -r '.app.defaultDomain')

  success "Amplify app created: $AMPLIFY_APP_ID"

  # Connect branch
  aws amplify create-branch \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "$BRANCH" \
    --region "$REGION" &>/dev/null
  success "Branch connected: $BRANCH"

  # Trigger initial deployment
  aws amplify start-job \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "$BRANCH" \
    --job-type RELEASE \
    --region "$REGION" &>/dev/null
  success "Amplify build triggered"

  AMPLIFY_URL="https://${BRANCH}.${default_domain}"
  save_state

  log "Frontend is building on Amplify (~3-5 min). Monitor at:"
  log "  https://${REGION}.console.aws.amazon.com/amplify/home#/apps/${AMPLIFY_APP_ID}"
}

# ── Step 8: Deploy Frontend ───────────────────────────────────────────────────
deploy_frontend() {
  step "Step 8/8: Deploying Frontend ($DEPLOY_FRONTEND)"
  case "$DEPLOY_FRONTEND" in
    ec2)     deploy_frontend_ec2 ;;
    amplify) deploy_frontend_amplify ;;
    skip)    warn "Frontend deployment skipped (--skip-frontend)" ;;
  esac
}

# ── Health checks ─────────────────────────────────────────────────────────────
run_health_checks() {
  step "Health Checks"

  log "Waiting for backend /health (up to 4 min — first run auto-seeds from ClinicalTrials.gov)..."
  local attempts=0
  until curl -sf "http://${PUBLIC_IP}:8000/health" &>/dev/null; do
    attempts=$((attempts + 1))
    if [[ $attempts -gt 48 ]]; then
      warn "Backend health check timed out after 4 min."
      warn "Check logs: ssh -i $PEM_FILE ubuntu@${PUBLIC_IP} 'cd ~/app && sudo docker compose logs -f'"
      break
    fi
    printf "."
    sleep 5
  done
  echo ""

  if curl -sf "http://${PUBLIC_IP}:8000/health" &>/dev/null; then
    local health
    health=$(curl -s "http://${PUBLIC_IP}:8000/health")
    success "Backend healthy: $health"
  fi

  if [[ "$DEPLOY_FRONTEND" == "ec2" ]]; then
    local fe_attempts=0
    until curl -sf "http://${PUBLIC_IP}:3000" &>/dev/null; do
      fe_attempts=$((fe_attempts + 1))
      [[ $fe_attempts -gt 12 ]] && {
        warn "Frontend not yet responding on port 3000 — it may still be starting"
        warn "Check: ssh -i $PEM_FILE ubuntu@${PUBLIC_IP} 'pm2 logs frontend --lines 30'"
        break
      }
      printf "."
      sleep 5
    done
    echo ""
    if curl -sf "http://${PUBLIC_IP}:3000" &>/dev/null; then
      success "Frontend healthy at http://${PUBLIC_IP}:3000"
    fi
  fi
}

# ── Summary ───────────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${BOLD}${GREEN}"
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║                  Deployment Complete!                        ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  echo -e "${BOLD}AWS Resources:${NC}"
  echo "  EC2 Instance:   $INSTANCE_ID"
  echo "  EBS Volume:     $VOLUME_ID"
  echo "  Security Group: $SG_ID"
  echo "  Public IP:      $PUBLIC_IP"
  echo "  Region:         $REGION"
  echo "  PEM key:        $(pwd)/$PEM_FILE"
  echo ""

  echo -e "${BOLD}Service URLs:${NC}"
  echo "  Backend API:    http://${PUBLIC_IP}:8000"
  echo "  Health check:   http://${PUBLIC_IP}:8000/health"
  echo "  Swagger docs:   http://${PUBLIC_IP}:8000/docs"
  case "$DEPLOY_FRONTEND" in
    ec2)     echo "  Frontend:       http://${PUBLIC_IP}:3000" ;;
    amplify) echo "  Frontend:       ${AMPLIFY_URL} (may still be building)" ;;
    skip)    echo "  Frontend:       (not deployed)" ;;
  esac
  echo ""

  echo -e "${BOLD}SSH access:${NC}"
  echo "  ssh -i $PEM_FILE ubuntu@${PUBLIC_IP}"
  echo ""

  echo -e "${BOLD}Useful commands:${NC}"
  echo "  Backend logs:    ssh -i $PEM_FILE ubuntu@${PUBLIC_IP} 'cd ~/app && sudo docker compose logs -f'"
  echo "  Backend restart: ssh -i $PEM_FILE ubuntu@${PUBLIC_IP} 'cd ~/app && sudo docker compose restart'"
  [[ "$DEPLOY_FRONTEND" == "ec2" ]] && \
    echo "  Frontend logs:   ssh -i $PEM_FILE ubuntu@${PUBLIC_IP} 'pm2 logs frontend'"
  echo "  Stop instance:   aws ec2 stop-instances --instance-ids $INSTANCE_ID --region $REGION"
  echo "  Start instance:  aws ec2 start-instances --instance-ids $INSTANCE_ID --region $REGION"
  echo ""

  echo -e "${BOLD}Next steps:${NC}"
  echo "  1. Open the frontend URL in your browser"
  echo "  2. In Setup → API Key panel, confirm your Groq key is active"
  echo "  3. In Seed Database panel, click 'Fetch from ClinicalTrials.gov'"
  echo "     (or wait ~60 s — the backend auto-seeds on first start)"
  echo "  4. Enter a patient profile and run a match!"
  echo ""

  echo -e "${YELLOW}Cost tip:${NC} Stop the EC2 instance when not in use (~\$0/hr stopped vs ~\$0.01/hr running on t2.micro)"
  echo "  aws ec2 stop-instances --instance-ids $INSTANCE_ID --region $REGION"
  echo ""

  echo -e "${CYAN}State saved to: ${STATE_FILE}${NC}"
}

# ── Teardown helper (not called during deploy, printed for reference) ──────────
print_teardown_hint() {
  echo ""
  echo -e "${YELLOW}To destroy all resources when done:${NC}"
  echo "  aws ec2 terminate-instances --instance-ids $INSTANCE_ID --region $REGION"
  echo "  aws ec2 wait instance-terminated --instance-ids $INSTANCE_ID --region $REGION"
  echo "  aws ec2 delete-volume --volume-id $VOLUME_ID --region $REGION"
  echo "  aws ec2 delete-security-group --group-id $SG_ID --region $REGION"
  echo "  aws ec2 delete-key-pair --key-name $KEY_NAME --region $REGION"
  [[ -n "$AMPLIFY_APP_ID" ]] && \
    echo "  aws amplify delete-app --app-id $AMPLIFY_APP_ID --region $REGION"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  banner
  check_prereqs
  collect_inputs
  create_key_pair
  create_security_group
  find_ami
  launch_instance
  attach_ebs
  wait_for_instance
  deploy_backend
  deploy_frontend
  run_health_checks
  print_summary
  print_teardown_hint
}

main "$@"
