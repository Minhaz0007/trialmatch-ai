"""Tests for patient profile parsing (FHIR and manual)."""

import pytest
from backend.agents.profile_parser import parse_patient_profile, _normalize_sex
from backend.schemas.models import PatientInput


SAMPLE_FHIR_BUNDLE = {
    "resourceType": "Bundle",
    "type": "collection",
    "entry": [
        {
            "resource": {
                "resourceType": "Patient",
                "id": "fhir-patient-001",
                "gender": "female",
                "birthDate": "1970-03-15",
            }
        },
        {
            "resource": {
                "resourceType": "Condition",
                "code": {
                    "coding": [
                        {
                            "system": "http://hl7.org/fhir/sid/icd-10-cm",
                            "code": "E11.9",
                            "display": "Type 2 diabetes mellitus without complications",
                        }
                    ],
                    "text": "Type 2 diabetes mellitus without complications",
                },
                "clinicalStatus": {"coding": [{"code": "active"}]},
            }
        },
        {
            "resource": {
                "resourceType": "MedicationRequest",
                "status": "active",
                "medicationCodeableConcept": {
                    "coding": [{"display": "Metformin 1000 MG Oral Tablet"}],
                    "text": "Metformin 1000 MG Oral Tablet",
                },
            }
        },
        {
            "resource": {
                "resourceType": "Observation",
                "code": {
                    "coding": [
                        {
                            "display": "Hemoglobin A1c/Hemoglobin.total in Blood",
                            "system": "http://loinc.org",
                        }
                    ],
                    "text": "HbA1c",
                },
                "valueQuantity": {"value": 8.4, "unit": "%"},
            }
        },
    ],
}


def test_parse_fhir_bundle():
    profile = parse_patient_profile(PatientInput(fhir_json=SAMPLE_FHIR_BUNDLE))
    assert profile.patient_id == "fhir-patient-001"
    assert profile.sex == "female"
    assert profile.age > 0
    assert any("diabetes" in c.lower() for c in profile.conditions)
    assert any("E11.9" in code for code in profile.icd10_codes)
    assert any("metformin" in m.lower() for m in profile.medications)
    assert "HbA1c" in profile.labs
    assert profile.labs["HbA1c"] == 8.4


def test_parse_manual_input():
    patient_input = PatientInput(
        age=45,
        sex="male",
        conditions=["hypertension", "Type 2 diabetes"],
        medications=["lisinopril 10mg", "metformin 500mg"],
        labs={"HbA1c": 7.5, "eGFR": 75},
    )
    profile = parse_patient_profile(patient_input)
    assert profile.age == 45
    assert profile.sex == "male"
    assert "hypertension" in profile.conditions
    assert profile.labs["HbA1c"] == 7.5
    assert profile.patient_id.startswith("MANUAL-")


def test_parse_empty_manual_input():
    patient_input = PatientInput(age=30, sex="unknown")
    profile = parse_patient_profile(patient_input)
    assert profile.age == 30
    assert profile.conditions == []
    assert profile.medications == []
    assert profile.labs == {}


def test_normalize_sex():
    assert _normalize_sex("male") == "male"
    assert _normalize_sex("FEMALE") == "female"
    assert _normalize_sex("M") == "male"
    assert _normalize_sex("F") == "female"
    assert _normalize_sex(None) == "unknown"
    assert _normalize_sex("nonbinary") == "unknown"


def test_fhir_missing_resources():
    minimal_bundle = {
        "resourceType": "Bundle",
        "entry": [
            {
                "resource": {
                    "resourceType": "Patient",
                    "id": "minimal-001",
                    "gender": "male",
                    "birthDate": "1985-01-01",
                }
            }
        ],
    }
    profile = parse_patient_profile(PatientInput(fhir_json=minimal_bundle))
    assert profile.patient_id == "minimal-001"
    assert profile.sex == "male"
    assert profile.conditions == []
    assert profile.medications == []
    assert profile.labs == {}
