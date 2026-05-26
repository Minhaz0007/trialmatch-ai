# TrialMatch AI — Clinical Trial Patient Matching Agent

> Matching patients to recruiting clinical trials in seconds using multi-agent RAG, LangGraph orchestration, and RAGAS evaluation.

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi)
![LangChain](https://img.shields.io/badge/LangChain-0.3-blueviolet)
![LangGraph](https://img.shields.io/badge/LangGraph-0.2-orange)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Docker](https://img.shields.io/badge/Docker-ready-blue?logo=docker)

## Problem Statement

**80% of clinical trials face recruitment delays**, and manual chart review to assess eligibility takes an average of **44.7 hours per patient**. TrialMatch AI reduces that to **~8 seconds** by automating the full pipeline: patient profile parsing → semantic trial retrieval → structured eligibility checking → RAGAS-evaluated results.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TrialMatch AI                            │
│                                                                 │
│  ┌──────────┐    ┌───────────────────────────────────────────┐  │
│  │ Next.js  │───▶│              FastAPI Backend               │  │
│  │ Frontend │    │                                           │  │
│  └──────────┘    │  ┌─────────────────────────────────────┐  │  │
│                  │  │        LangGraph Pipeline            │  │  │
│                  │  │                                     │  │  │
│                  │  │  PatientInput                       │  │  │
│                  │  │      │                              │  │  │
│                  │  │      ▼                              │  │  │
│                  │  │  [profile_parser]                   │  │  │
│                  │  │  FHIR R4 → PatientProfile           │  │  │
│                  │  │      │                              │  │  │
│                  │  │      ▼                              │  │  │
│                  │  │  [trial_retriever]                  │  │  │
│                  │  │  ChromaDB cosine similarity         │  │  │
│                  │  │      │ (retry if 0 results)         │  │  │
│                  │  │      ▼                              │  │  │
│                  │  │  [eligibility_checker]              │  │  │
│                  │  │  Claude claude-sonnet-4-20250514 structured │  │  │
│                  │  │      │                              │  │  │
│                  │  │      ▼                              │  │  │
│                  │  │  [evaluator]                        │  │  │
│                  │  │  RAGAS metrics                      │  │  │
│                  │  │      │                              │  │  │
│                  │  │      ▼                              │  │  │
│                  │  │   MatchResponse                     │  │  │
│                  │  └─────────────────────────────────────┘  │  │
│                  │                                           │  │
│                  │  ChromaDB ←── ClinicalTrials.gov API v2   │  │
│                  │  (300 recruiting trials, embedded)        │  │
│                  └───────────────────────────────────────────┘  │
│                                                                 │
│  LangSmith: full trace observability on every request           │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | Claude claude-sonnet-4-20250514 (Anthropic) |
| Embeddings | OpenAI text-embedding-3-small |
| Orchestration | LangGraph 0.2 + LangChain 0.3 |
| Vector Store | ChromaDB (persistent) |
| Evaluation | RAGAS (context precision, faithfulness, answer relevance) |
| Observability | LangSmith tracing |
| API | FastAPI + Pydantic v2 + slowapi |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Deployment | Docker + EC2/EBS (backend) + AWS Amplify (frontend) |

## Setup

```bash
# 1. Clone and configure
git clone https://github.com/Minhaz0007/trialmatch-ai.git
cd trialmatch-ai
cp .env.example .env
# Edit .env with your API keys

# 2. Install backend dependencies
cd backend
pip install -r requirements.txt

# 3. Seed the vector store (fetches ~300 recruiting trials from ClinicalTrials.gov)
cd ..
python scripts/seed_trials.py

# 4. Start the backend
uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000

# 5. Start the frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Docker (alternative)

```bash
cp .env.example .env
# Fill in .env
docker-compose up --build
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/match` | Match a patient to recruiting trials |
| `GET` | `/trials/{nct_id}` | Fetch trial detail from vector store |
| `GET` | `/health` | Health check + ChromaDB collection count |

### Example Request

```bash
curl -X POST http://localhost:8000/match \
  -H "Content-Type: application/json" \
  -d '{
    "age": 58,
    "sex": "female",
    "conditions": ["Type 2 diabetes", "hypertension"],
    "medications": ["metformin 1000mg", "lisinopril 10mg"],
    "labs": {"HbA1c": 8.4, "eGFR": 62}
  }'
```

## RAGAS Evaluation

Each match result is evaluated along three dimensions:

| Metric | What it measures |
|--------|-----------------|
| **Context Precision** | How much of the retrieved trial criteria was relevant to the eligibility decision |
| **Faithfulness** | Whether the eligibility reasoning is grounded in the trial criteria text |
| **Answer Relevance** | How directly the eligibility summary answers the matching question |

Scores are color-coded: **green** (>80%), **amber** (60–80%), **red** (<60%).

## Live Demo

🔗 AWS Amplify URL available after deployment *(see `deploy/AWS_DEPLOY.md`)*

## Author

**Minhaz Uddin** — [Darkmoon AI Solutions](https://darkmoon.ai)

Built as a portfolio project demonstrating production multi-agent RAG system design with real-world clinical trial data.
