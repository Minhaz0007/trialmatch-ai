"""FastAPI application for TrialMatch AI."""

import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

os.environ.setdefault("LANGCHAIN_TRACING_V2", os.getenv("LANGCHAIN_TRACING_V2", "false"))
os.environ.setdefault("LANGCHAIN_PROJECT", os.getenv("LANGCHAIN_PROJECT", "trialmatch-ai"))

from fastapi import FastAPI, HTTPException, Request, Header, UploadFile, File, Body
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from langchain_text_splitters import RecursiveCharacterTextSplitter

from backend.schemas.models import PatientInput, MatchResponse
from backend.graph.pipeline import run_pipeline
from backend.data.ingest_trials import (
    collection_count,
    get_chroma_client,
    get_or_create_collection,
    COLLECTION_NAME,
)

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

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=600,
    chunk_overlap=80,
    separators=["\n\nInclusion Criteria", "\n\nExclusion Criteria", "\n\n", "\n", ". "],
)


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


@app.post("/admin/seed")
@limiter.limit("5/minute")
async def seed_database(
    request: Request,
    file: UploadFile = File(...),
    x_api_key: str | None = Header(default=None),
):
    """Accept a ClinicalTrials.gov JSON file and ingest into ChromaDB."""
    _check_api_key(x_api_key)

    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only .json files are accepted.")

    raw = await file.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file.")

    studies = data.get("studies", [])
    if not studies:
        raise HTTPException(
            status_code=400,
            detail="No studies found. File must be a ClinicalTrials.gov API v2 JSON response.",
        )

    client = get_chroma_client()

    # Clear existing collection for fresh ingest
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    collection = get_or_create_collection(client)

    batch_docs: list[str] = []
    batch_metas: list[dict] = []
    batch_ids: list[str] = []
    trials_ingested = 0

    for study in studies:
        trial = _parse_trial(study)
        if not trial:
            continue

        chunks = _splitter.split_text(trial["eligibility_criteria"])
        if not chunks:
            chunks = [trial["eligibility_criteria"][:600]]

        meta = {
            "nct_id": trial["nct_id"],
            "title": trial["title"][:500],
            "phase": trial["phase"] or "",
            "sponsor": trial["sponsor"] or "",
            "conditions": json.dumps(trial["conditions"][:10]),
            "locations": json.dumps(trial["locations"][:5]),
        }

        for chunk_idx, chunk in enumerate(chunks):
            doc_id = f"{trial['nct_id']}_chunk_{chunk_idx}"
            batch_docs.append(chunk)
            batch_metas.append(meta)
            batch_ids.append(doc_id)

        trials_ingested += 1

    if not batch_docs:
        raise HTTPException(status_code=400, detail="No valid trials with eligibility criteria found in file.")

    # ChromaDB embeds automatically using DefaultEmbeddingFunction
    BATCH = 100
    for i in range(0, len(batch_docs), BATCH):
        collection.add(
            documents=batch_docs[i : i + BATCH],
            metadatas=batch_metas[i : i + BATCH],
            ids=batch_ids[i : i + BATCH],
        )

    logger.info("Seeded %d trials → %d chunks into ChromaDB", trials_ingested, len(batch_docs))

    return {
        "status": "ok",
        "trials_ingested": trials_ingested,
        "chunks_stored": len(batch_docs),
        "message": f"Successfully ingested {trials_ingested} trials into ChromaDB.",
    }


def _parse_trial(study: dict) -> dict | None:
    try:
        proto = study.get("protocolSection", {})
        id_mod = proto.get("identificationModule", {})
        sponsor_mod = proto.get("sponsorCollaboratorsModule", {})
        cond_mod = proto.get("conditionsModule", {})
        design_mod = proto.get("designModule", {})
        elig_mod = proto.get("eligibilityModule", {})
        contacts_mod = proto.get("contactsLocationsModule", {})

        nct_id = id_mod.get("nctId", "")
        if not nct_id:
            return None

        eligibility_criteria = elig_mod.get("eligibilityCriteria", "").strip()
        if not eligibility_criteria:
            return None

        phases = design_mod.get("phases", [])
        phase = phases[0].replace("PHASE", "Phase ").replace("_", "/") if phases else None

        locations = []
        for loc in contacts_mod.get("locations", [])[:5]:
            city = loc.get("city", "")
            country = loc.get("country", "")
            if city or country:
                locations.append(f"{city}, {country}".strip(", "))

        return {
            "nct_id": nct_id,
            "title": id_mod.get("briefTitle", "Unknown"),
            "phase": phase,
            "sponsor": sponsor_mod.get("leadSponsor", {}).get("name"),
            "conditions": cond_mod.get("conditions", []),
            "eligibility_criteria": eligibility_criteria,
            "locations": locations,
        }
    except Exception:
        return None


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
        raise HTTPException(status_code=503, detail="Vector store unavailable. Seed the database first.")

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


class ConfigInput(BaseModel):
    groq_api_key: str


@app.post("/admin/config")
async def set_config(body: ConfigInput):
    """Store the Groq API key in the server process environment."""
    key = body.groq_api_key.strip()
    if not key.startswith("gsk_"):
        raise HTTPException(status_code=400, detail="Invalid Groq API key — must start with gsk_")

    os.environ["GROQ_API_KEY"] = key

    # Clear cached LLM so the next request picks up the new key
    from backend.agents.eligibility_checker import _get_llm
    _get_llm.cache_clear()

    logger.info("Groq API key updated via admin/config")
    return {
        "status": "ok",
        "message": "Groq API key saved. You can now run patient matching.",
        "preview": f"gsk_...{key[-6:]}",
    }


@app.get("/admin/config")
async def get_config():
    """Return whether the Groq API key is currently set (never returns the key itself)."""
    key = os.environ.get("GROQ_API_KEY", "")
    return {
        "groq_api_key_set": bool(key),
        "preview": f"gsk_...{key[-6:]}" if key else None,
    }


@app.get("/health")
async def health_check():
    count = collection_count()
    groq_key = os.environ.get("GROQ_API_KEY", "")
    return {
        "status": "ok",
        "chroma_collection_count": count,
        "groq_key_set": bool(groq_key),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }
