#!/usr/bin/env bash
# deploy/aws-deploy.sh — Full AWS CLI deployment for TrialMatch AI
#
# Deploys from scratch:
#   Backend  → EC2 t2.micro (Ubuntu 22.04) + EBS 8 GB (ChromaDB)
#   Frontend → AWS Amplify (Next.js)
#
# Prerequisites:
#   - AWS CLI v2 installed and configured (aws configure)
#   - GROQ_API_KEY           (required)
#   - GITHUB_TOKEN           (GitHub PAT with repo scope — for Amplify ↔ GitHub)
#   - ANTHROPIC_API_KEY      (optional — for Claude LLM)
#   - OPENAI_API_KEY         (optional — for embeddings)
#
# Usage:
#   bash deploy/aws-deploy.sh
#   AWS_DEFAULT_REGION=eu-west-1 bash deploy/aws-deploy.sh

set -euo pipefail

# ── Terminal colors ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}▸${NC} $*"; }
ok()      { echo -e "${GREEN}✔${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
die()     { echo -e "${RED}✖${NC}  $*" >&2; exit 1; }
section() { echo -e "\n${BOLD}── $* ${NC}"; }

# ── Defaults (override via environment) ───────────────────────────────────────
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
APP_NAME="trialmatch-ai"
INSTANCE_TYPE="t2.micro"
KEY_NAME="${APP_NAME}-key"
KEY_FILE="${KEY_NAME}.pem"
SG_NAME="${APP_NAME}-sg"
GITHUB_REPO="Minhaz0007/trialmatch-ai"
GITHUB_BRANCH="main"

# ── 0. Pre-flight ─────────────────────────────────────────────────────────────
section "0/8  Pre-flight checks"

command -v aws >/dev/null 2>&1 \
  || die "AWS CLI not found. Install: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"

aws sts get-caller-identity >/dev/null 2>&1 \
  || die "AWS credentials not configured. Run: aws configure"

# Prompt for secrets not already in environment
if [[ -z "${GROQ_API_KEY:-}" ]]; then
  read -rsp "GROQ_API_KEY (required): " GROQ_API_KEY; echo
fi
[[ -n "${GROQ_API_KEY:-}" ]] || die "GROQ_API_KEY is required"

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  read -rsp "ANTHROPIC_API_KEY (leave blank to skip): " ANTHROPIC_API_KEY; echo
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  read -rsp "OPENAI_API_KEY for embeddings (leave blank to skip): " OPENAI_API_KEY; echo
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo
  warn "A GitHub Personal Access Token (PAT) with 'repo' scope is required"
  warn "for AWS Amplify to connect to GitHub. Create one at:"
  warn "https://github.com/settings/tokens"
  read -rsp "GITHUB_TOKEN: " GITHUB_TOKEN; echo
fi
[[ -n "${GITHUB_TOKEN:-}" ]] || die "GITHUB_TOKEN is required"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ok "Account: $ACCOUNT_ID | Region: $REGION"

# ── 1. Key pair ───────────────────────────────────────────────────────────────
section "1/8  EC2 key pair"

EXISTING_KEY=$(aws ec2 describe-key-pairs \
  --key-names "$KEY_NAME" \
  --region "$REGION" \
  --query 'KeyPairs[0].KeyName' \
  --output text 2>/dev/null || true)

if [[ "$EXISTING_KEY" == "$KEY_NAME" ]]; then
  warn "Key pair '$KEY_NAME' already exists — skipping creation"
  [[ -f "$KEY_FILE" ]] || warn "  Local $KEY_FILE not found; you will need it for SSH access"
else
  aws ec2 create-key-pair \
    --key-name "$KEY_NAME" \
    --region "$REGION" \
    --query 'KeyMaterial' \
    --output text > "$KEY_FILE"
  chmod 400 "$KEY_FILE"
  ok "Key pair created → $KEY_FILE"
fi

# ── 2. Security group ─────────────────────────────────────────────────────────
section "2/8  Security group"

SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=$SG_NAME" \
  --region "$REGION" \
  --query 'SecurityGroups[0].GroupId' \
  --output text 2>/dev/null || true)

if [[ -n "$SG_ID" && "$SG_ID" != "None" ]]; then
  warn "Security group '$SG_NAME' ($SG_ID) already exists — skipping"
else
  SG_ID=$(aws ec2 create-security-group \
    --group-name "$SG_NAME" \
    --description "TrialMatch AI — SSH + API" \
    --region "$REGION" \
    --query 'GroupId' \
    --output text)

  # SSH (consider restricting --cidr to your IP for production)
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" --protocol tcp --port 22 \
    --cidr 0.0.0.0/0 --region "$REGION" >/dev/null

  # FastAPI backend
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" --protocol tcp --port 8000 \
    --cidr 0.0.0.0/0 --region "$REGION" >/dev/null

  ok "Security group $SG_ID created (ports 22, 8000 open)"
fi

# ── 3. Latest Ubuntu 22.04 LTS AMI ───────────────────────────────────────────
section "3/8  Ubuntu 22.04 AMI lookup"

# Owner 099720109477 = Canonical (official Ubuntu)
AMI_ID=$(aws ec2 describe-images \
  --owners 099720109477 \
  --filters \
    "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
    "Name=state,Values=available" \
    "Name=architecture,Values=x86_64" \
  --region "$REGION" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

[[ -n "$AMI_ID" && "$AMI_ID" != "None" ]] \
  || die "No Ubuntu 22.04 AMI found in $REGION"
ok "AMI: $AMI_ID"

# ── 4. Build user-data script ────────────────────────────────────────────────
section "4/8  Preparing EC2 user-data"

TMPFILE=$(mktemp /tmp/trialmatch-userdata-XXXX.sh)
trap 'rm -f "$TMPFILE"' EXIT

# Safely embed the keys (escape special characters)
_GROQ=$(printf '%s' "$GROQ_API_KEY"       | sed 's/[&/\]/\\&/g')
_ANT=$(printf  '%s' "${ANTHROPIC_API_KEY:-}" | sed 's/[&/\]/\\&/g')
_OAI=$(printf  '%s' "${OPENAI_API_KEY:-}"    | sed 's/[&/\]/\\&/g')

cat > "$TMPFILE" <<USERDATA
#!/bin/bash
# TrialMatch AI — EC2 bootstrap (runs once on first launch)
set -euo pipefail
exec > /var/log/trialmatch-setup.log 2>&1

echo "==> Installing system packages"
apt-get update -y
apt-get install -y git curl unzip docker.io docker-compose-v2

systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

echo "==> Waiting for EBS data volume at /dev/xvdf"
# The volume is attached at launch via block-device-mappings, but the
# kernel may need a moment to expose the device node.
for i in \$(seq 1 12); do
  [ -b /dev/xvdf ] && break
  echo "  attempt \$i/12 — sleeping 5s"
  sleep 5
done
[ -b /dev/xvdf ] || { echo "ERROR: /dev/xvdf not available after 60s"; exit 1; }

echo "==> Formatting + mounting EBS volume"
if ! blkid /dev/xvdf &>/dev/null; then
  mkfs.ext4 /dev/xvdf
fi
mkdir -p /data/chroma
mount /dev/xvdf /data/chroma
grep -q /dev/xvdf /etc/fstab \
  || echo "/dev/xvdf /data/chroma ext4 defaults,nofail 0 2" >> /etc/fstab

echo "==> Cloning repository"
cd /home/ubuntu
git clone https://github.com/${GITHUB_REPO}.git app
cd app

echo "==> Writing .env"
cat > .env <<'ENVEOF'
GROQ_API_KEY=${_GROQ}
ANTHROPIC_API_KEY=${_ANT}
OPENAI_API_KEY=${_OAI}
LANGCHAIN_TRACING_V2=false
API_KEY=
ENVEOF

echo "==> Writing docker-compose.override.yml (bind EBS)"
cat > docker-compose.override.yml <<'DCEOF'
version: "3.9"
services:
  backend:
    volumes:
      - /data/chroma:/app/data/chroma_store
DCEOF

echo "==> Waiting for Docker daemon"
until docker info >/dev/null 2>&1; do sleep 2; done

echo "==> Starting backend"
docker compose up -d --build

echo "==> TrialMatch AI backend started. ChromaDB auto-seeds on first request."
USERDATA

ok "User-data written to $TMPFILE"

# ── 5. Launch EC2 instance ────────────────────────────────────────────────────
section "5/8  Launching EC2 instance"

# The 8 GB gp3 data volume at /dev/xvdf is attached at launch so it is
# present before user-data runs. DeleteOnTermination=false keeps ChromaDB
# data if the instance is replaced later.
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id         "$AMI_ID" \
  --instance-type    "$INSTANCE_TYPE" \
  --key-name         "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --user-data        "file://$TMPFILE" \
  --block-device-mappings \
    '[{"DeviceName":"/dev/xvdf","Ebs":{"VolumeSize":8,"VolumeType":"gp3","DeleteOnTermination":false}}]' \
  --tag-specifications \
    "ResourceType=instance,Tags=[{Key=Name,Value=${APP_NAME}-backend}]" \
  --region "$REGION" \
  --query  'Instances[0].InstanceId' \
  --output text)

ok "Instance $INSTANCE_ID launched — waiting for running state..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

EC2_PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

ok "Instance running — Public IP: $EC2_PUBLIC_IP"

# ── 6. Tag the ChromaDB EBS volume ───────────────────────────────────────────
section "6/8  Tagging ChromaDB EBS volume"

CHROMA_VOL_ID=$(aws ec2 describe-volumes \
  --filters \
    "Name=attachment.instance-id,Values=$INSTANCE_ID" \
    "Name=attachment.device,Values=/dev/xvdf" \
  --region "$REGION" \
  --query 'Volumes[0].VolumeId' \
  --output text 2>/dev/null || true)

if [[ -n "$CHROMA_VOL_ID" && "$CHROMA_VOL_ID" != "None" ]]; then
  aws ec2 create-tags \
    --resources "$CHROMA_VOL_ID" \
    --tags "Key=Name,Value=${APP_NAME}-chroma" \
    --region "$REGION"
  ok "ChromaDB volume: $CHROMA_VOL_ID"
else
  warn "Data volume not yet visible — it was created and is attached, but tagging can be done manually later"
  CHROMA_VOL_ID="(pending)"
fi

# ── 7. AWS Amplify — create app ───────────────────────────────────────────────
section "7/8  AWS Amplify (frontend)"

info "Creating Amplify app and connecting GitHub repo..."
AMPLIFY_APP_ID=$(aws amplify create-app \
  --name "$APP_NAME" \
  --repository "https://github.com/${GITHUB_REPO}" \
  --platform WEB \
  --oauth-token "$GITHUB_TOKEN" \
  --environment-variables "NEXT_PUBLIC_API_URL=http://${EC2_PUBLIC_IP}:8000" \
  --region "$REGION" \
  --query 'app.appId' \
  --output text)
ok "Amplify app created: $AMPLIFY_APP_ID"

aws amplify create-branch \
  --app-id "$AMPLIFY_APP_ID" \
  --branch-name "$GITHUB_BRANCH" \
  --region "$REGION" >/dev/null
ok "Branch '$GITHUB_BRANCH' connected"

# amplify.yml at the repository root is auto-detected by Amplify for build config.
JOB_ID=$(aws amplify start-job \
  --app-id "$AMPLIFY_APP_ID" \
  --branch-name "$GITHUB_BRANCH" \
  --job-type RELEASE \
  --region "$REGION" \
  --query 'jobSummary.jobId' \
  --output text)
ok "Build triggered — Job ID: $JOB_ID"

# ── 8. Summary ────────────────────────────────────────────────────────────────
section "8/8  Done"

AMPLIFY_URL="https://${GITHUB_BRANCH}.${AMPLIFY_APP_ID}.amplifyapp.com"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         TrialMatch AI — AWS Deployment Complete              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  BACKEND (EC2)"
echo "  ├─ Instance ID  : $INSTANCE_ID"
echo "  ├─ Public IP    : $EC2_PUBLIC_IP"
echo "  ├─ API          : http://${EC2_PUBLIC_IP}:8000"
echo "  ├─ Health check : http://${EC2_PUBLIC_IP}:8000/health"
echo "  ├─ ChromaDB EBS : $CHROMA_VOL_ID"
echo "  └─ SSH          : ssh -i ${KEY_FILE} ubuntu@${EC2_PUBLIC_IP}"
echo ""
echo "  FRONTEND (Amplify)"
echo "  ├─ App ID       : $AMPLIFY_APP_ID"
echo "  ├─ Build job    : $JOB_ID"
echo "  └─ URL          : $AMPLIFY_URL   ← live in ~3 min"
echo ""
echo "  NEXT STEPS"
echo "  1. Backend seeds ChromaDB automatically on first boot (~60 s)."
echo "     Monitor: ssh -i ${KEY_FILE} ubuntu@${EC2_PUBLIC_IP} \\"
echo "              'tail -f /var/log/trialmatch-setup.log'"
echo ""
echo "  2. Wait ~3 min for the Amplify build to finish, then open:"
echo "     $AMPLIFY_URL"
echo ""
echo "  3. In the app's API Key panel, enter your Groq key to start matching."
echo ""
