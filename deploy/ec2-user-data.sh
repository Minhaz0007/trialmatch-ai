#!/bin/bash
# EC2 user-data script for TrialMatch AI backend
# Run once on a fresh Ubuntu 22.04 t2.micro instance
# The EBS volume for ChromaDB must be attached at /dev/xvdf before running

set -euo pipefail
exec > /var/log/trialmatch-setup.log 2>&1

# ── System packages ───────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y git curl unzip docker.io docker-compose-v2

systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# Wait for Docker daemon to be ready before any docker commands
until docker info >/dev/null 2>&1; do
  echo "Waiting for Docker daemon..."
  sleep 2
done

# ── Mount persistent EBS volume for ChromaDB ─────────────────────────────────
DEVICE=/dev/xvdf
MOUNT=/data/chroma

if ! blkid "$DEVICE" &>/dev/null; then
  mkfs.ext4 "$DEVICE"
fi
mkdir -p "$MOUNT"
mount "$DEVICE" "$MOUNT"

# Persist mount across reboots
grep -q "$DEVICE" /etc/fstab || echo "$DEVICE $MOUNT ext4 defaults,nofail 0 2" >> /etc/fstab

# ── Clone repo ────────────────────────────────────────────────────────────────
cd /home/ubuntu
git clone https://github.com/minhaz0007/trialmatch-ai.git app
cd app

# ── Write .env ────────────────────────────────────────────────────────────────
# Replace GROQ_API_KEY value before running, or set it later via the UI
cat > .env <<'ENVEOF'
GROQ_API_KEY=
LANGCHAIN_TRACING_V2=false
API_KEY=
ENVEOF

# ── docker-compose override: bind EBS volume ──────────────────────────────────
cat > docker-compose.override.yml <<'DCEOF'
version: "3.9"
services:
  backend:
    volumes:
      - /data/chroma:/app/data/chroma_store
DCEOF

# ── Start backend ─────────────────────────────────────────────────────────────
docker compose up -d --build

echo "TrialMatch AI backend started. Check: docker compose logs -f"
