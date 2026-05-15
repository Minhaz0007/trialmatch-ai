"""Retrieve candidate clinical trials from ChromaDB using semantic search."""

import json
from typing import Optional

from backend.schemas.models import PatientProfile, TrialCandidate
from backend.data.ingest_trials import get_chroma_client, COLLECTION_NAME


def retrieve_trials(
    profile: PatientProfile,
    top_k: int = 10,
    broad: bool = False,
) -> list[TrialCandidate]:
    client = get_chroma_client()

    try:
        collection = client.get_collection(COLLECTION_NAME)
    except Exception:
        raise RuntimeError(
            "ChromaDB collection 'clinical_trials' not found. "
            "Run `python scripts/seed_trials.py` to populate the vector store."
        )

    if collection.count() == 0:
        raise RuntimeError(
            "ChromaDB collection is empty. "
            "Run `python scripts/seed_trials.py` to populate the vector store."
        )

    query = _build_query(profile, broad=broad)

    results = collection.query(
        query_texts=[query],
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    candidates: list[TrialCandidate] = []
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for doc, meta, dist in zip(documents, metadatas, distances):
        similarity = max(0.0, 1.0 - float(dist))

        conditions_raw = meta.get("conditions", "[]")
        if isinstance(conditions_raw, str):
            try:
                conditions_list = json.loads(conditions_raw)
            except json.JSONDecodeError:
                conditions_list = [conditions_raw]
        else:
            conditions_list = conditions_raw

        locations_raw = meta.get("locations", "[]")
        if isinstance(locations_raw, str):
            try:
                locations_list = json.loads(locations_raw)
            except json.JSONDecodeError:
                locations_list = [locations_raw]
        else:
            locations_list = locations_raw

        candidates.append(
            TrialCandidate(
                nct_id=meta.get("nct_id", "UNKNOWN"),
                title=meta.get("title", "Unknown Trial"),
                phase=meta.get("phase") or None,
                sponsor=meta.get("sponsor") or None,
                conditions=conditions_list,
                eligibility_criteria=doc,
                locations=locations_list,
                similarity_score=round(similarity, 4),
            )
        )

    return candidates


def _build_query(profile: PatientProfile, broad: bool = False) -> str:
    parts = []

    if profile.conditions:
        parts.append("Conditions: " + ", ".join(profile.conditions[:5]))

    if not broad:
        parts.append(f"Age: {profile.age} years old")
        parts.append(f"Sex: {profile.sex}")

    if profile.medications and not broad:
        parts.append("Medications: " + ", ".join(profile.medications[:3]))

    if profile.labs and not broad:
        lab_str = ", ".join(f"{k}={v}" for k, v in list(profile.labs.items())[:3])
        parts.append(f"Labs: {lab_str}")

    if broad and profile.icd10_codes:
        parts.append("ICD10: " + ", ".join(profile.icd10_codes[:5]))

    return ". ".join(parts) + ". recruiting clinical trial eligibility"
