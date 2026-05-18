#!/usr/bin/env python3
"""Download recruiting trials from ClinicalTrials.gov and save as trials.json.
No API key needed. Run this once, then upload trials.json via the frontend.

Usage:
    python scripts/download_trials.py
    # → saves backend/data/trials.json
"""

import json
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent))

BASE_URL = "https://clinicaltrials.gov/api/v2/studies"
PARAMS_BASE = {
    "filter.overallStatus": "RECRUITING",
    "query.cond": "diabetes OR cancer OR hypertension OR heart failure OR alzheimer",
    "fields": "NCTId,BriefTitle,Phase,LeadSponsorName,Condition,EligibilityCriteria,LocationCity,LocationCountry",
    "pageSize": 100,
    "format": "json",
}
MAX_PAGES = 3
OUTPUT_PATH = Path(__file__).parent.parent / "backend" / "data" / "trials.json"


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
            print(f"  Error: {e}")
            if attempt < 3:
                time.sleep(2 ** attempt)
    return [], None


def main():
    all_studies = []
    page_token = None

    for page_num in range(1, MAX_PAGES + 1):
        print(f"Fetching page {page_num}/{MAX_PAGES}...")
        studies, page_token = fetch_page(page_token)
        all_studies.extend(studies)
        print(f"  {len(studies)} studies fetched, {len(all_studies)} total so far")
        time.sleep(0.5)
        if not page_token:
            break

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump({"studies": all_studies}, f)

    print(f"\nSaved {len(all_studies)} studies to {OUTPUT_PATH}")
    print("Now upload this file via the frontend Seed Database page.")


if __name__ == "__main__":
    main()
