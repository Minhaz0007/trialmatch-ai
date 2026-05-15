"""Tests for Pydantic schema models."""

import pytest
from datetime import datetime
from backend.schemas.models import (
    PatientProfile,
    TrialCandidate,
    CriterionResult,
    EligibilityResult,
    RagasScore,
    MatchResult,
    PatientInput,
    MatchResponse,
)


def test_patient_profile_valid():
    p = PatientProfile(
        patient_id="TEST-001",
        age=55,
        sex="female",
        conditions=["Type 2 diabetes"],
        icd10_codes=["E11.9"],
        medications=["metformin 1000mg"],
        labs={"HbA1c": 8.1},
        medical_history=["Diagnosed 5 years ago"],
    )
    assert p.patient_id == "TEST-001"
    assert p.age == 55
    assert p.sex == "female"


def test_patient_profile_sex_validation():
    with pytest.raises(Exception):
        PatientProfile(
            patient_id="X",
            age=30,
            sex="invalid_sex",
            conditions=[],
            icd10_codes=[],
            medications=[],
            labs={},
            medical_history=[],
        )


def test_trial_candidate_valid():
    t = TrialCandidate(
        nct_id="NCT12345678",
        title="Test Trial for Diabetes",
        phase="Phase 3",
        sponsor="Test Pharma Inc.",
        conditions=["Type 2 Diabetes"],
        eligibility_criteria="Age 18-75. HbA1c > 7.5. No severe kidney disease.",
        locations=["Boston, US"],
        similarity_score=0.87,
    )
    assert t.nct_id == "NCT12345678"
    assert t.similarity_score == 0.87


def test_eligibility_result_overall_values():
    for verdict in ("ELIGIBLE", "EXCLUDED", "UNCERTAIN"):
        e = EligibilityResult(
            nct_id="NCT00000001",
            overall=verdict,
            criteria_results=[
                CriterionResult(
                    criterion="Age 18-75",
                    decision="ELIGIBLE",
                    reasoning="Patient is 55",
                    criterion_type="inclusion",
                )
            ],
            confidence=0.9,
            summary=f"Patient is {verdict}",
        )
        assert e.overall == verdict


def test_ragas_score_fields():
    r = RagasScore(
        context_precision=0.85,
        faithfulness=0.92,
        answer_relevance=0.78,
        overall_score=0.85,
    )
    assert r.overall_score == 0.85
    assert 0.0 <= r.context_precision <= 1.0


def test_patient_input_fhir_none():
    pi = PatientInput(
        age=45,
        sex="male",
        conditions=["hypertension"],
        medications=["lisinopril 10mg"],
        labs={"creatinine": 0.9},
    )
    assert pi.fhir_json is None
    assert pi.age == 45


def test_match_response_has_defaults():
    mr = MatchResponse(
        patient_id="P1",
        matches=[],
        total_trials_searched=10,
        processing_time_seconds=3.5,
        trace_id="abc-123",
    )
    assert mr.matches == []
    assert mr.processing_time_seconds == 3.5


def test_match_result_timestamp():
    trial = TrialCandidate(
        nct_id="NCT99999999",
        title="Dummy Trial",
        phase=None,
        sponsor=None,
        conditions=[],
        eligibility_criteria="None",
        locations=[],
        similarity_score=0.5,
    )
    elig = EligibilityResult(
        nct_id="NCT99999999",
        overall="UNCERTAIN",
        criteria_results=[],
        confidence=0.5,
        summary="Uncertain",
    )
    m = MatchResult(trial=trial, eligibility=elig)
    assert isinstance(m.matched_at, datetime)
    assert m.ragas is None
