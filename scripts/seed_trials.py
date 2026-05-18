#!/usr/bin/env python3
"""Fetch trials from ClinicalTrials.gov and ingest directly into ChromaDB.
No external embedding API needed — ChromaDB uses built-in all-MiniLM-L6-v2.
"""

import json
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from langchain_text_splitters import RecursiveCharacterTextSplitter
from backend.data.ingest_trials import get_chroma_client, get_or_create_collection, COLLECTION_NAME

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
            r = httpx.get(BASE_URL, params=params, timeout=30)
            r.raise_for_status()
            data = r.json()
            return data.get("studies", []), data.get("nextPageToken")
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
        nct_id = id_mod.get("nctId", "")
        if not nct_id:
            return None
        eligibility = proto.get("eligibilityModule", {}).get("eligibilityCriteria", "").strip()
        if not eligibility:
            return None
        phases = proto.get("designModule", {}).get("phases", [])
        phase = phases[0].replace("PHASE", "Phase ").replace("_", "/") if phases else None
        locations = []
        for loc in proto.get("contactsLocationsModule", {}).get("locations", [])[:5]:
            city, country = loc.get("city", ""), loc.get("country", "")
            if city or country:
                locations.append(f"{city}, {country}".strip(", "))
        return {
            "nct_id": nct_id,
            "title": id_mod.get("briefTitle", "Unknown"),
            "phase": phase,
            "sponsor": proto.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name"),
            "conditions": proto.get("conditionsModule", {}).get("conditions", []),
            "eligibility_criteria": eligibility,
            "locations": locations,
        }
    except Exception as e:
        print(f"  Parse error: {e}")
        return None


def main():
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=600,
        chunk_overlap=80,
        separators=["\n\nInclusion Criteria", "\n\nExclusion Criteria", "\n\n", "\n", ". "],
    )

    client = get_chroma_client()
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    collection = get_or_create_collection(client)

    all_trials: list[dict] = []
    page_token = None

    for page_num in range(1, MAX_PAGES + 1):
        print(f"\nFetching page {page_num}/{MAX_PAGES} from ClinicalTrials.gov...")
        studies, page_token = fetch_page(page_token)
        for study in studies:
            trial = parse_trial(study)
            if trial:
                all_trials.append(trial)
        print(f"  {len(studies)} studies fetched, {len(all_trials)} valid so far")
        time.sleep(0.5)
        if not page_token:
            break

    print(f"\nTotal valid trials: {len(all_trials)}")
    print("Chunking and embedding (ChromaDB built-in, no API key needed)...")

    batch_docs, batch_metas, batch_ids = [], [], []
    BATCH = 100

    for i, trial in enumerate(all_trials):
        chunks = splitter.split_text(trial["eligibility_criteria"]) or [trial["eligibility_criteria"][:600]]
        meta = {
            "nct_id": trial["nct_id"],
            "title": trial["title"][:500],
            "phase": trial["phase"] or "",
            "sponsor": trial["sponsor"] or "",
            "conditions": json.dumps(trial["conditions"][:10]),
            "locations": json.dumps(trial["locations"][:5]),
        }
        for j, chunk in enumerate(chunks):
            batch_docs.append(chunk)
            batch_metas.append(meta)
            batch_ids.append(f"{trial['nct_id']}_chunk_{j}")

        if len(batch_docs) >= BATCH:
            collection.add(documents=batch_docs, metadatas=batch_metas, ids=batch_ids)
            batch_docs, batch_metas, batch_ids = [], [], []

        print(f"  Processed {i + 1}/{len(all_trials)}: {trial['nct_id']}")

    if batch_docs:
        collection.add(documents=batch_docs, metadatas=batch_metas, ids=batch_ids)

    print(f"\nDone! {collection.count()} chunks stored in ChromaDB.")
    print("Ready: uvicorn backend.api.main:app --reload")


if __name__ == "__main__":
    main()
