"""FastAPI application for TrialMatch AI."""

import logging
import os
import time
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

os.environ.setdefault("LANGCHAIN_TRACING_V2", os.getenv("LANGCHAIN_TRACING_V2", "false"))
os.environ.setdefault("LANGCHAIN_PROJECT", os.getenv("LANGCHAIN_PROJECT", "trialmatch-ai"))

from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from backend.schemas.models import PatientInput, MatchResponse, MatchResult
from backend.graph.pipeline import run_pipeline
from backend.data.ingest_trials import collection_count, get_chroma_client, COLLECTION_NAME

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("trialmatch")

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="TrialMatch AI",
    description="Clinical trial patient matching using multi-agent RAG",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_API_KEY = os.environ.get("API_KEY", "")


def _check_api_key(x_api_key: str | None) -> None:
    if not _API_KEY:
        return
    if x_api_key != _API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key header")


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    trace_id = str(uuid.uuid4())
    request.state.trace_id = trace_id
    start = time.monotonic()
    response = await call_next(request)
    duration = round(time.monotonic() - start, 3)
    logger.info(
        "method=%s path=%s status=%d duration=%ss trace_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration,
        trace_id,
    )
    response.headers["X-Trace-Id"] = trace_id
    return response


@app.post("/match", response_model=MatchResponse)
@limiter.limit("10/minute")
async def match_patient(
    request: Request,
    patient_input: PatientInput,
    x_api_key: str | None = Header(default=None),
) -> MatchResponse:
    _check_api_key(x_api_key)

    trace_id = getattr(request.state, "trace_id", str(uuid.uuid4()))
    start = time.monotonic()

    if not patient_input.fhir_json and not any([
        patient_input.age,
        patient_input.conditions,
        patient_input.medications,
    ]):
        raise HTTPException(
            status_code=422,
            detail="Provide either fhir_json or at least one of: age, conditions, medications",
        )

    final_state = run_pipeline(patient_input, trace_id=trace_id)

    if final_state.get("error"):
        raise HTTPException(status_code=500, detail=final_state["error"])

    processing_time = round(time.monotonic() - start, 3)
    profile = final_state["patient_profile"]

    return MatchResponse(
        patient_id=profile.patient_id if profile else "unknown",
        matches=final_state["match_results"],
        total_trials_searched=len(final_state["candidate_trials"]),
        processing_time_seconds=processing_time,
        trace_id=trace_id,
    )


@app.get("/trials/{nct_id}")
@limiter.limit("30/minute")
async def get_trial(
    request: Request,
    nct_id: str,
    x_api_key: str | None = Header(default=None),
):
    _check_api_key(x_api_key)

    try:
        client = get_chroma_client()
        collection = client.get_collection(COLLECTION_NAME)
    except Exception:
        raise HTTPException(status_code=503, detail="Vector store unavailable. Run seed_trials.py first.")

    results = collection.get(
        where={"nct_id": nct_id},
        include=["documents", "metadatas"],
    )

    if not results["ids"]:
        raise HTTPException(status_code=404, detail=f"Trial {nct_id} not found in vector store")

    meta = results["metadatas"][0]
    doc = results["documents"][0]

    return {
        "nct_id": nct_id,
        "title": meta.get("title"),
        "phase": meta.get("phase"),
        "sponsor": meta.get("sponsor"),
        "conditions": meta.get("conditions"),
        "locations": meta.get("locations"),
        "eligibility_criteria_chunk": doc,
        "clinicaltrials_url": f"https://clinicaltrials.gov/study/{nct_id}",
    }


@app.get("/health")
async def health_check():
    count = collection_count()
    return {
        "status": "ok",
        "chroma_collection_count": count,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }
