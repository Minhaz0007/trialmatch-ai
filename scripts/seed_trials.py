#!/usr/bin/env python3
"""Fetch recruiting clinical trials from ClinicalTrials.gov API v2 and ingest into ChromaDB."""

import json
import sys
import time
from pathlib import Path

import httpx

# Allow running from repo root
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from backend.data.ingest_trials import get_chroma_client, get_or_create_collection

BASE_URL = "https://clinicaltrials.gov/api/v2/studies"
PARAMS_BASE = {
    "filter.overallStatus": "RECRUITING",
    "query.cond": "diabetes OR cancer OR hypertension OR heart failure OR alzheimer",
    "fields": "NCTId,BriefTitle,Phase,LeadSponsorName,Condition,EligibilityCriteria,LocationCity,LocationCountry",
    "pageSize": 100,
    "format": "json",
}
MAX_PAGES = 3


def fetch_page(page_token: str | None = None) -> tuple[list[dict], str | None]:
    params = dict(PARAMS_BASE)
    if page_token:
        params["pageToken"] = page_token

    for attempt in range(4):
        try:
            response = httpx.get(BASE_URL, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            studies = data.get("studies", [])
            next_token = data.get("nextPageToken")
            return studies, next_token
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                wait = 2 ** (attempt + 1)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"  HTTP error: {e}")
                return [], None
        except Exception as e:
            print(f"  Request error: {e}")
            if attempt < 3:
                time.sleep(2 ** attempt)

    return [], None


def parse_trial(study: dict) -> dict | None:
    try:
        proto = study.get("protocolSection", {})
        id_mod = proto.get("identificationModule", {})
        status_mod = proto.get("statusModule", {})
        sponsor_mod = proto.get("sponsorCollaboratorsModule", {})
        cond_mod = proto.get("conditionsModule", {})
        design_mod = proto.get("designModule", {})
        elig_mod = proto.get("eligibilityModule", {})
        contacts_mod = proto.get("contactsLocationsModule", {})

        nct_id = id_mod.get("nctId", "")
        if not nct_id:
            return None

        title = id_mod.get("briefTitle", "Unknown")
        phase = None
        phases = design_mod.get("phases", [])
        if phases:
            phase = phases[0].replace("PHASE", "Phase ").replace("_", "/")

        sponsor = sponsor_mod.get("leadSponsor", {}).get("name")
        conditions = cond_mod.get("conditions", [])
        eligibility_criteria = elig_mod.get("eligibilityCriteria", "").strip()

        if not eligibility_criteria:
            return None

        locations = []
        for loc in contacts_mod.get("locations", [])[:5]:
            city = loc.get("city", "")
            country = loc.get("country", "")
            if city or country:
                locations.append(f"{city}, {country}".strip(", "))

        return {
            "nct_id": nct_id,
            "title": title,
            "phase": phase,
            "sponsor": sponsor,
            "conditions": conditions,
            "eligibility_criteria": eligibility_criteria,
            "locations": locations,
        }
    except Exception as e:
        print(f"  Parse error: {e}")
        return None


def main():
    print("Initializing embeddings (OpenAI text-embedding-3-small)...")
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=600,
        chunk_overlap=80,
        separators=["\n\nInclusion Criteria", "\n\nExclusion Criteria", "\n\n", "\n", ". "],
    )

    client = get_chroma_client()
    collection = get_or_create_collection(client)

    existing_count = collection.count()
    if existing_count > 0:
        print(f"Collection already has {existing_count} chunks. Clearing for fresh ingest...")
        client.delete_collection("clinical_trials")
        from backend.data.ingest_trials import COLLECTION_NAME
        collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    all_trials: list[dict] = []
    page_token = None

    for page_num in range(1, MAX_PAGES + 1):
        print(f"\nFetching page {page_num}/{MAX_PAGES}...")
        studies, page_token = fetch_page(page_token)

        for study in studies:
            trial = parse_trial(study)
            if trial:
                all_trials.append(trial)

        print(f"  Retrieved {len(studies)} studies, parsed {len(all_trials)} valid so far")
        time.sleep(0.5)

        if not page_token:
            print("  No more pages available")
            break

    print(f"\nTotal valid trials: {len(all_trials)}")
    print("Chunking eligibility criteria and embedding...")

    batch_docs: list[str] = []
    batch_metas: list[dict] = []
    batch_ids: list[str] = []
    batch_embeddings: list[list[float]] = []

    ingested = 0
    EMBED_BATCH = 50

    for i, trial in enumerate(all_trials):
        chunks = splitter.split_text(trial["eligibility_criteria"])
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

            if len(batch_docs) >= EMBED_BATCH:
                vecs = embeddings.embed_documents(batch_docs)
                collection.add(
                    documents=batch_docs,
                    embeddings=vecs,
                    metadatas=batch_metas,
                    ids=batch_ids,
                )
                ingested += len(batch_docs)
                batch_docs, batch_metas, batch_ids = [], [], []

        print(f"  Processed trial {i + 1}/{len(all_trials)}: {trial['nct_id']}")

    if batch_docs:
        vecs = embeddings.embed_documents(batch_docs)
        collection.add(
            documents=batch_docs,
            embeddings=vecs,
            metadatas=batch_metas,
            ids=batch_ids,
        )
        ingested += len(batch_docs)

    final_count = collection.count()
    print(f"\nIngestion complete!")
    print(f"  Trials processed: {len(all_trials)}")
    print(f"  Chunks stored: {final_count}")
    print(f"  ChromaDB path: backend/data/chroma_store/")
    print("\nReady to run: uvicorn backend.api.main:app --reload")


if __name__ == "__main__":
    main()
