"""Parse FHIR R4 Bundle JSON or manual PatientInput into PatientProfile."""

import uuid
from backend.schemas.models import PatientInput, PatientProfile
from backend.data.load_patients import parse_fhir_bundle


def parse_patient_profile(patient_input: PatientInput) -> PatientProfile:
    if patient_input.fhir_json:
        return parse_fhir_bundle(patient_input.fhir_json)

    return PatientProfile(
        patient_id=f"MANUAL-{uuid.uuid4().hex[:8].upper()}",
        age=patient_input.age or 0,
        sex=_normalize_sex(patient_input.sex),
        conditions=patient_input.conditions or [],
        icd10_codes=[],
        medications=patient_input.medications or [],
        labs=patient_input.labs or {},
        medical_history=[],
    )


def _normalize_sex(sex: str | None) -> str:
    if not sex:
        return "unknown"
    s = sex.lower().strip()
    if s in ("male", "m"):
        return "male"
    if s in ("female", "f"):
        return "female"
    return "unknown"
