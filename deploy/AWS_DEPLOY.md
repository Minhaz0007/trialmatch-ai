# AWS Deployment Guide — TrialMatch AI

## Architecture

```
Internet → EC2 (t2.micro, port 8000) ← FastAPI + ChromaDB on EBS
        → AWS Amplify                ← Next.js frontend
```

---

## Backend — EC2 + EBS

### 1. Launch EC2 instance

- **AMI**: Ubuntu Server 22.04 LTS
- **Instance type**: t2.micro (free tier)
- **Security group inbound rules**:
  - SSH (22) — your IP only
  - HTTP (8000) — 0.0.0.0/0 (or restrict to Amplify/CloudFront)
- **Storage**: 8 GB root + **add a second EBS volume** (8 GB gp3) for ChromaDB

### 2. Attach EBS volume

After launch, attach the second EBS volume in the EC2 console as `/dev/xvdf`.

### 3. SSH in and run setup

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Copy the user-data script and run it
curl -fsSL https://raw.githubusercontent.com/minhaz0007/trialmatch-ai/main/deploy/ec2-user-data.sh | sudo bash
```

Or paste the contents of `deploy/ec2-user-data.sh` manually.

### 4. Set your Groq API key

Either edit `/home/ubuntu/app/.env` before starting, or use the API key UI in the frontend after deployment.

### 5. Verify

```bash
curl http://<EC2_PUBLIC_IP>:8000/health
```

Expected: `{"status":"ok","chroma_collection_count":...}`

On first boot the server auto-seeds from ClinicalTrials.gov (~60s). Check progress with:

```bash
docker compose -f /home/ubuntu/app/docker-compose.yml logs -f
```

---

## Frontend — AWS Amplify

### 1. Connect repository

1. Go to **AWS Amplify → New App → Host web app**
2. Connect your GitHub repo (`minhaz0007/trialmatch-ai`)
3. Branch: `main`

### 2. Build settings

Amplify will auto-detect `amplify.yml` at the repository root (already present). If needed, paste it manually:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/.next
    files:
      - "**/*"
  cache:
    paths:
      - frontend/node_modules/**/*
```

### 3. Environment variable

In Amplify → App settings → Environment variables, add:

```
NEXT_PUBLIC_API_URL=http://<EC2_PUBLIC_IP>:8000
```

### 4. Deploy

Click **Save and deploy**. Amplify gives you a `*.amplifyapp.com` URL.

---

## After deployment

1. Open the Amplify URL in a browser
2. Enter your Groq API key in the **Setup → API Key** panel
3. Click **Fetch from ClinicalTrials.gov** in the **Seed Database** panel (or wait ~60s for auto-seed)
4. Run a patient match

---

## Cost estimate (AWS free tier, 12 months)

| Resource | Free tier | After free tier |
|---|---|---|
| EC2 t2.micro | 750 hrs/mo free | ~$8/mo |
| EBS 8 GB gp3 | 30 GB free | ~$0.64/mo |
| AWS Amplify | 1000 build mins + 15 GB serving free | ~$0.01/GB |
| Data transfer | 100 GB free | $0.09/GB |

Total after free tier: **~$9/mo**
