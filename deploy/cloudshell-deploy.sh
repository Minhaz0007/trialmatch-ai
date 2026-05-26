#!/bin/bash
# ==============================================================================
# TrialMatch AI — One-Command Deployment via AWS CloudShell
# ==============================================================================
#
# HOW TO USE:
#   1. Open AWS Console → CloudShell (top-right toolbar)
#   2. Paste this entire script and press Enter
#   3. Enter your Groq API key when prompted
#   4. Wait ~10-12 minutes — everything deploys automatically
#
# What it creates:
#   • EC2 t3.micro (Ubuntu 22.04) — backend + frontend
#   • 8 GB gp3 EBS volume  — ChromaDB persistence
#   • Security group        — ports 22, 3000, 8000
#   • SSH key pair          — saved to ~/trialmatch-key.pem
#
# No SSH required — all setup runs via EC2 user-data on first boot.
# Estimated cost: FREE on AWS free tier (750 hrs/mo for 12 months)
# ==============================================================================

set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
ok()   { echo -e "${GREEN}✔${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
step() { echo -e "\n${BOLD}${CYAN}── $* ──${NC}"; }
die()  { echo -e "${RED}✘  $*${NC}" >&2; exit 1; }

# ── Config (change these if needed) ──────────────────────────────────────────
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
INSTANCE_TYPE="t3.micro"
KEY_NAME="trialmatch-key"
SG_NAME="trialmatch-sg"
GITHUB_REPO="https://github.com/minhaz0007/trialmatch-ai.git"
PEM_FILE="${HOME}/${KEY_NAME}.pem"

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║       TrialMatch AI — AWS CloudShell Deployment          ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "  Region: ${BOLD}${REGION}${NC}  |  Instance: ${BOLD}${INSTANCE_TYPE}${NC}"
echo ""

# ── Collect Groq API key ──────────────────────────────────────────────────────
if [[ -n "${GROQ_API_KEY:-}" ]]; then
  GROQ_KEY="$GROQ_API_KEY"
  ok "Using GROQ_API_KEY from environment"
else
  read -rsp "  Groq API key (https://console.groq.com/keys): " GROQ_KEY
  echo ""
fi
[[ -z "$GROQ_KEY" ]] && die "Groq API key is required"

# Base64-encode so the key passes safely through the user-data heredoc
# (avoids issues with special characters like +, /, =)
GROQ_KEY_B64=$(echo -n "$GROQ_KEY" | base64 | tr -d '\n')

# ==============================================================================
# STEP 1 — SSH Key Pair
# ==============================================================================
step "Step 1/6: SSH Key Pair"

if aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" \
    &>/dev/null 2>&1; then
  if [[ -f "$PEM_FILE" ]]; then
    ok "Key pair '${KEY_NAME}' already exists and PEM found at ${PEM_FILE}"
  else
    # Key exists in AWS but PEM is gone — delete it and recreate so we have the private key
    warn "Key pair '${KEY_NAME}' exists in AWS but PEM is missing locally — recreating it"
    aws ec2 delete-key-pair --key-name "$KEY_NAME" --region "$REGION"
    aws ec2 create-key-pair \
      --key-name "$KEY_NAME" \
      --query 'KeyMaterial' \
      --output text \
      --region "$REGION" > "$PEM_FILE"
    chmod 400 "$PEM_FILE"
    ok "Key pair recreated → ${PEM_FILE}"
  fi
else
  aws ec2 create-key-pair \
    --key-name "$KEY_NAME" \
    --query 'KeyMaterial' \
    --output text \
    --region "$REGION" > "$PEM_FILE"
  chmod 400 "$PEM_FILE"
  ok "Key pair created → ${PEM_FILE}"
fi

# ==============================================================================
# STEP 2 — Security Group
# ==============================================================================
step "Step 2/6: Security Group"

SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=${SG_NAME}" \
  --query 'SecurityGroups[0].GroupId' \
  --output text --region "$REGION" 2>/dev/null || echo "")

if [[ -z "$SG_ID" || "$SG_ID" == "None" ]]; then
  SG_ID=$(aws ec2 create-security-group \
    --group-name "$SG_NAME" \
    --description "TrialMatch AI" \
    --region "$REGION" \
    --query 'GroupId' --output text)
  for PORT in 22 3000 8000; do
    aws ec2 authorize-security-group-ingress \
      --group-id "$SG_ID" --protocol tcp --port "$PORT" \
      --cidr 0.0.0.0/0 --region "$REGION" &>/dev/null
  done
  ok "Security group created: ${SG_ID}  (ports 22, 3000, 8000)"
else
  ok "Reusing existing security group: ${SG_ID}"
fi

# ==============================================================================
# STEP 3 — Find Ubuntu 22.04 LTS AMI
# ==============================================================================
step "Step 3/6: Ubuntu 22.04 LTS AMI"

AMI_ID=$(aws ssm get-parameter \
  --name "/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id" \
  --query 'Parameter.Value' --output text --region "$REGION")
[[ -z "$AMI_ID" ]] && die "Could not find Ubuntu 22.04 AMI in region ${REGION}"
ok "AMI: ${AMI_ID}"

# ==============================================================================
# STEP 4 — Build EC2 User-Data Script
# ==============================================================================
# This script runs automatically on first boot and fully deploys:
#   • Docker + docker-compose (backend via FastAPI container)
#   • Node.js 20 + PM2 (frontend via Next.js)
#   • 2 GB swap file (t2.micro only has 1 GB RAM; Next.js build needs ~1.5 GB)
#   • EBS mount for ChromaDB persistence
#
# Variable escaping guide:
#   ${VAR}    — expanded HERE in CloudShell (e.g. GROQ_KEY_B64, GITHUB_REPO)
#   \${VAR}   — kept as literal ${VAR}, expanded on the EC2 instance at runtime
# ==============================================================================
USER_DATA=$(cat <<SCRIPT_END
#!/bin/bash
set -euo pipefail
exec >> /var/log/trialmatch-setup.log 2>&1
echo "=== TrialMatch AI boot setup started: \$(date) ==="

# ── Add 2 GB swap (prevents OOM during Next.js build on t2.micro 1 GB RAM) ───
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo "Swap enabled: \$(free -h | grep Swap)"

# ── Wait for EBS device to be attached (attached right after launch) ──────────
echo "Waiting for EBS device..."
for i in \$(seq 1 30); do
  [[ -b /dev/xvdf ]] || [[ -b /dev/nvme1n1 ]] && break
  echo "  attempt \${i}/30 — no EBS device yet, sleeping 10s..."
  sleep 10
done
if   [[ -b /dev/xvdf ]];    then DEVICE=/dev/xvdf
elif [[ -b /dev/nvme1n1 ]]; then DEVICE=/dev/nvme1n1
else echo "ERROR: EBS device not found after 5 min" >&2; exit 1
fi
echo "EBS device: \${DEVICE}"

# ── System packages ────────────────────────────────────────────────────────────
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  git curl docker.io docker-compose-v2

systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

# ── Mount EBS for ChromaDB ─────────────────────────────────────────────────────
MOUNT=/data/chroma
if ! blkid "\${DEVICE}" &>/dev/null; then
  echo "Formatting \${DEVICE}..."
  mkfs.ext4 "\${DEVICE}"
fi
mkdir -p "\${MOUNT}"
mount "\${DEVICE}" "\${MOUNT}"
chown ubuntu:ubuntu "\${MOUNT}"
grep -q "\${DEVICE}" /etc/fstab \
  || echo "\${DEVICE} \${MOUNT} ext4 defaults,nofail 0 2" >> /etc/fstab
echo "Mounted \${DEVICE} at \${MOUNT}"

# ── Clone repository ──────────────────────────────────────────────────────────
cd /home/ubuntu
sudo -u ubuntu git clone ${GITHUB_REPO} app
cd app

# ── Write .env  (GROQ key is base64-encoded to survive the heredoc) ───────────
GROQ_API_KEY=\$(echo "${GROQ_KEY_B64}" | base64 -d)
cat > .env <<ENVEOF
GROQ_API_KEY=\${GROQ_API_KEY}
LANGCHAIN_TRACING_V2=false
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=trialmatch-ai
API_KEY=
ENVEOF
chown ubuntu:ubuntu .env
echo ".env written (GROQ key length: \${#GROQ_API_KEY})"

# ── Docker Compose override: bind EBS volume instead of named volume ──────────
cat > docker-compose.override.yml <<DCEOF
version: "3.9"
services:
  backend:
    volumes:
      - /data/chroma:/app/data/chroma_store
DCEOF
chown ubuntu:ubuntu docker-compose.override.yml

# ── Start backend container ───────────────────────────────────────────────────
echo "Building and starting backend (this takes 3-5 min)..."
docker compose up -d --build
echo "Backend container started"

# ── Build and start frontend ──────────────────────────────────────────────────
PUBLIC_IP=\$(curl -s --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Public IP from metadata: \${PUBLIC_IP}"

cd /home/ubuntu/app/frontend

sudo -u ubuntu bash -c "
  export NEXT_PUBLIC_API_URL=http://\${PUBLIC_IP}:8000
  export NEXT_TELEMETRY_DISABLED=1
  export NODE_OPTIONS='--max-old-space-size=768'
  npm ci
  npm run build
"

sudo -u ubuntu bash -c "
  pm2 delete frontend 2>/dev/null || true
  pm2 start npm --name frontend -- start -- -p 3000
  pm2 save
"

# Register PM2 to start on reboot
env PATH=\$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu \
  | grep '^sudo' | bash || true

echo "Frontend started on port 3000"
echo "=== TrialMatch AI setup complete: \$(date) ==="
touch /tmp/trialmatch_done
SCRIPT_END
)

# ==============================================================================
# STEP 5 — Launch EC2 Instance + Attach EBS Volume
# ==============================================================================
step "Step 5/6: Launch EC2 + Attach EBS"

log "Launching ${INSTANCE_TYPE} instance..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --user-data "$USER_DATA" \
  --block-device-mappings \
    '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
  --tag-specifications \
    "ResourceType=instance,Tags=[{Key=Name,Value=trialmatch-ai},{Key=App,Value=trialmatch-ai}]" \
  --region "$REGION" \
  --query 'Instances[0].InstanceId' --output text)
ok "Instance launched: ${INSTANCE_ID}"

# Get AZ for EBS (must be the same AZ as the instance)
AZ=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].Placement.AvailabilityZone' \
  --output text --region "$REGION")

log "Creating 8 GB gp3 EBS volume in ${AZ}..."
VOLUME_ID=$(aws ec2 create-volume \
  --size 8 \
  --volume-type gp3 \
  --availability-zone "$AZ" \
  --tag-specifications \
    "ResourceType=volume,Tags=[{Key=Name,Value=trialmatch-chroma},{Key=App,Value=trialmatch-ai}]" \
  --region "$REGION" \
  --query 'VolumeId' --output text)

log "Waiting for volume ${VOLUME_ID} to become available..."
aws ec2 wait volume-available --volume-ids "$VOLUME_ID" --region "$REGION"

aws ec2 attach-volume \
  --volume-id "$VOLUME_ID" \
  --instance-id "$INSTANCE_ID" \
  --device /dev/xvdf \
  --region "$REGION" &>/dev/null
ok "EBS volume ${VOLUME_ID} attached as /dev/xvdf"

log "Waiting for instance to reach 'running' state..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text --region "$REGION")
ok "Instance running at ${PUBLIC_IP}"

# ==============================================================================
# STEP 6 — Wait for Application to Come Up
# ==============================================================================
step "Step 6/6: Waiting for Application (10-12 min)"

echo ""
echo -e "  ${YELLOW}The EC2 instance is now:${NC}"
echo "    1. Installing Docker + Node.js"
echo "    2. Mounting EBS volume"
echo "    3. Cloning repo + writing .env"
echo "    4. Building Docker image  (~3-4 min)"
echo "    5. Auto-seeding ChromaDB from ClinicalTrials.gov  (~1 min)"
echo "    6. Building Next.js frontend  (~2-3 min)"
echo ""
echo -e "  Polling ${CYAN}http://${PUBLIC_IP}:8000/health${NC} every 15 seconds..."
echo ""

ATTEMPTS=0
MAX_ATTEMPTS=72   # 18 min hard ceiling
until curl -sf "http://${PUBLIC_IP}:8000/health" &>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [[ $ATTEMPTS -gt $MAX_ATTEMPTS ]]; then
    warn "Health check timed out after 18 min — setup may still be in progress"
    warn "Check setup log:"
    echo "  ssh -i ${PEM_FILE} ubuntu@${PUBLIC_IP} 'sudo cat /var/log/trialmatch-setup.log'"
    break
  fi
  ELAPSED=$((ATTEMPTS * 15))
  printf "\r  ${BLUE}[%4ds elapsed]${NC}  still starting...  " "$ELAPSED"
  sleep 15
done
echo ""

BACKEND_OK=false
FRONTEND_OK=false

if curl -sf "http://${PUBLIC_IP}:8000/health" &>/dev/null; then
  HEALTH=$(curl -s "http://${PUBLIC_IP}:8000/health")
  ok "Backend healthy  →  ${HEALTH}"
  BACKEND_OK=true
fi

# Frontend takes a few extra minutes after the backend
log "Checking frontend on port 3000..."
for i in $(seq 1 12); do
  if curl -sf "http://${PUBLIC_IP}:3000" &>/dev/null; then
    ok "Frontend healthy  →  http://${PUBLIC_IP}:3000"
    FRONTEND_OK=true
    break
  fi
  printf "."
  sleep 15
done
echo ""
$FRONTEND_OK || warn "Frontend still starting — check: ssh -i ${PEM_FILE} ubuntu@${PUBLIC_IP} 'pm2 logs frontend'"

# ==============================================================================
# Save deploy state
# ==============================================================================
STATE="${HOME}/trialmatch-deploy.env"
cat > "$STATE" <<STATE_EOF
INSTANCE_ID=${INSTANCE_ID}
VOLUME_ID=${VOLUME_ID}
SG_ID=${SG_ID}
PUBLIC_IP=${PUBLIC_IP}
REGION=${REGION}
KEY_NAME=${KEY_NAME}
PEM_FILE=${PEM_FILE}
STATE_EOF
ok "State saved → ${STATE}"

# ==============================================================================
# Summary
# ==============================================================================
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║                 Deployment Complete!                     ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}AWS Resources:${NC}"
printf "  %-18s %s\n" "Instance:"    "$INSTANCE_ID"
printf "  %-18s %s\n" "EBS Volume:"  "$VOLUME_ID"
printf "  %-18s %s\n" "Security Grp:" "$SG_ID"
printf "  %-18s %s\n" "Public IP:"   "$PUBLIC_IP"
printf "  %-18s %s\n" "Region:"      "$REGION"
printf "  %-18s %s\n" "SSH Key:"     "$PEM_FILE"
echo ""
echo -e "${BOLD}URLs:${NC}"
echo "  Frontend    →  http://${PUBLIC_IP}:3000"
echo "  Backend API →  http://${PUBLIC_IP}:8000"
echo "  Swagger     →  http://${PUBLIC_IP}:8000/docs"
echo "  Health      →  http://${PUBLIC_IP}:8000/health"
echo ""
echo -e "${BOLD}SSH into the instance:${NC}"
echo "  ssh -i ${PEM_FILE} ubuntu@${PUBLIC_IP}"
echo ""
echo -e "${BOLD}Useful remote commands:${NC}"
echo "  # View full setup log"
echo "  ssh -i ${PEM_FILE} ubuntu@${PUBLIC_IP} 'sudo cat /var/log/trialmatch-setup.log'"
echo ""
echo "  # Stream backend (FastAPI) logs"
echo "  ssh -i ${PEM_FILE} ubuntu@${PUBLIC_IP} 'cd ~/app && sudo docker compose logs -f'"
echo ""
echo "  # Stream frontend (Next.js) logs"
echo "  ssh -i ${PEM_FILE} ubuntu@${PUBLIC_IP} 'pm2 logs frontend'"
echo ""
echo -e "${BOLD}Stop / Start instance (saves ~\$0.01/hr when idle):${NC}"
echo "  aws ec2 stop-instances  --instance-ids ${INSTANCE_ID} --region ${REGION}"
echo "  aws ec2 start-instances --instance-ids ${INSTANCE_ID} --region ${REGION}"
echo ""
echo -e "${BOLD}Destroy all resources when done:${NC}"
echo "  aws ec2 terminate-instances --instance-ids ${INSTANCE_ID} --region ${REGION}"
echo "  aws ec2 wait instance-terminated --instance-ids ${INSTANCE_ID} --region ${REGION}"
echo "  aws ec2 delete-volume        --volume-id ${VOLUME_ID}   --region ${REGION}"
echo "  aws ec2 delete-security-group --group-id ${SG_ID}       --region ${REGION}"
echo "  aws ec2 delete-key-pair      --key-name  ${KEY_NAME}    --region ${REGION}"
echo "  rm -f ${PEM_FILE} ${STATE}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo "  1. Open  http://${PUBLIC_IP}:3000  in your browser"
echo "  2. Go to Setup → API Key and confirm your Groq key is active"
echo "  3. Click 'Fetch from ClinicalTrials.gov' in the Seed Database panel"
echo "  4. Run a patient match!"
echo ""
