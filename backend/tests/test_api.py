"""Tests for FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture
def client():
    from backend.api.main import app
    return TestClient(app)


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "chroma_collection_count" in data
    assert "timestamp" in data
    assert isinstance(data["chroma_collection_count"], int)


def test_health_returns_version(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["version"] == "1.0.0"


def test_match_missing_body(client):
    response = client.post("/match", json={})
    assert response.status_code == 422


def test_match_empty_patient_input(client):
    response = client.post("/match", json={"fhir_json": None})
    assert response.status_code == 422


def test_trial_not_found(client):
    response = client.get("/trials/NCT00000000_NONEXISTENT")
    assert response.status_code in (404, 503)


def test_match_with_mocked_pipeline(client):
    from backend.schemas.models import (
        MatchResponse, MatchResult, TrialCandidate, EligibilityResult
    )
    from datetime import datetime, timezone

    mock_trial = TrialCandidate(
        nct_id="NCT12345678",
        title="Test Diabetes Trial",
        phase="Phase 3",
        sponsor="Test Pharma",
        conditions=["Type 2 Diabetes"],
        eligibility_criteria="Age 18-75. HbA1c > 7.5.",
        locations=["Boston, US"],
        similarity_score=0.85,
    )
    mock_elig = EligibilityResult(
        nct_id="NCT12345678",
        overall="ELIGIBLE",
        criteria_results=[],
        confidence=0.9,
        summary="Patient meets all criteria",
    )
    mock_match = MatchResult(trial=mock_trial, eligibility=mock_elig, ragas=None)

    mock_state = {
        "patient_profile": MagicMock(patient_id="MANUAL-ABCD1234"),
        "candidate_trials": [mock_trial],
        "eligibility_results": [mock_elig],
        "match_results": [mock_match],
        "error": None,
        "trace_id": "test-trace-id",
    }

    with patch("backend.api.main.run_pipeline", return_value=mock_state):
        response = client.post(
            "/match",
            json={
                "age": 55,
                "sex": "female",
                "conditions": ["Type 2 diabetes"],
                "medications": ["metformin 1000mg"],
                "labs": {"HbA1c": 8.4},
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["patient_id"] == "MANUAL-ABCD1234"
    assert len(data["matches"]) == 1
    assert data["matches"][0]["eligibility"]["overall"] == "ELIGIBLE"
    assert "trace_id" in data
