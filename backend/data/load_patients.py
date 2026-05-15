"""Synthetic patient profiles and FHIR R4 Bundle parser."""

import uuid
from datetime import date, datetime
from typing import Optional
from dateutil.relativedelta import relativedelta

from backend.schemas.models import PatientProfile


def _age_from_birthdate(birth_date_str: str) -> int:
    try:
        birth = date.fromisoformat(birth_date_str[:10])
        today = date.today()
        return relativedelta(today, birth).years
    except Exception:
        return 0


def parse_fhir_bundle(fhir_json: dict) -> PatientProfile:
    """Parse a Synthea FHIR R4 Bundle into a PatientProfile."""
    entries = fhir_json.get("entry", [])
    resources = [e.get("resource", {}) for e in entries]

    patient_res = next((r for r in resources if r.get("resourceType") == "Patient"), {})
    patient_id = patient_res.get("id", str(uuid.uuid4()))

    birth_date = patient_res.get("birthDate", "")
    age = _age_from_birthdate(birth_date) if birth_date else 0

    gender = patient_res.get("gender", "unknown")
    if gender == "male":
        sex = "male"
    elif gender == "female":
        sex = "female"
    else:
        sex = "unknown"

    conditions: list[str] = []
    icd10_codes: list[str] = []
    for r in resources:
        if r.get("resourceType") == "Condition":
            code_obj = r.get("code", {})
            for coding in code_obj.get("coding", []):
                display = coding.get("display", "")
                code = coding.get("code", "")
                system = coding.get("system", "")
                if display and display not in conditions:
                    conditions.append(display)
                if "icd" in system.lower() and code:
                    icd10_codes.append(code)
            text = code_obj.get("text", "")
            if text and text not in conditions:
                conditions.append(text)

    medications: list[str] = []
    for r in resources:
        if r.get("resourceType") in ("MedicationRequest", "MedicationStatement"):
            status = r.get("status", "")
            if status not in ("active", ""):
                continue
            med = r.get("medicationCodeableConcept", {})
            if not med:
                med = r.get("medication", {}).get("concept", {})
            name = med.get("text", "") or (
                med.get("coding", [{}])[0].get("display", "") if med.get("coding") else ""
            )
            if name and name not in medications:
                medications.append(name)

    lab_map = {
        "hemoglobin a1c": "HbA1c",
        "hba1c": "HbA1c",
        "egfr": "eGFR",
        "estimated glomerular filtration rate": "eGFR",
        "glucose": "glucose",
        "creatinine": "creatinine",
        "blood pressure": "systolic_bp",
    }
    labs: dict[str, float] = {}
    for r in resources:
        if r.get("resourceType") == "Observation":
            code_obj = r.get("code", {})
            code_text = code_obj.get("text", "").lower()
            for coding in code_obj.get("coding", []):
                display = coding.get("display", "").lower()
                for key, label in lab_map.items():
                    if key in display or key in code_text:
                        value_quantity = r.get("valueQuantity", {})
                        val = value_quantity.get("value")
                        if val is not None:
                            labs[label] = float(val)

    medical_history: list[str] = []
    for r in resources:
        if r.get("resourceType") == "Procedure":
            code_obj = r.get("code", {})
            text = code_obj.get("text", "")
            if text:
                medical_history.append(text)

    return PatientProfile(
        patient_id=patient_id,
        age=age,
        sex=sex,
        conditions=conditions[:20],
        icd10_codes=list(set(icd10_codes))[:20],
        medications=medications[:15],
        labs=labs,
        medical_history=medical_history[:10],
    )


SYNTHETIC_PATIENTS: list[PatientProfile] = [
    PatientProfile(
        patient_id="PAT-001",
        age=58,
        sex="female",
        conditions=["Type 2 diabetes mellitus", "Essential hypertension", "Obesity"],
        icd10_codes=["E11.9", "I10", "E66.9"],
        medications=["metformin 1000mg", "lisinopril 10mg", "atorvastatin 40mg"],
        labs={"HbA1c": 8.4, "eGFR": 62, "glucose": 178, "creatinine": 1.1},
        medical_history=["Diagnosed with T2DM 8 years ago", "Hypertension controlled on medication"],
    ),
    PatientProfile(
        patient_id="PAT-002",
        age=67,
        sex="male",
        conditions=["Heart failure with reduced ejection fraction", "Atrial fibrillation", "Chronic kidney disease stage 3"],
        icd10_codes=["I50.20", "I48.91", "N18.3"],
        medications=["carvedilol 25mg", "furosemide 40mg", "warfarin 5mg", "sacubitril-valsartan 97/103mg"],
        labs={"eGFR": 38, "BNP": 450, "creatinine": 1.8, "potassium": 4.2},
        medical_history=["EF 30% on echo 3 months ago", "AF on anticoagulation", "Hospitalized for HF exacerbation last year"],
    ),
    PatientProfile(
        patient_id="PAT-003",
        age=45,
        sex="female",
        conditions=["HER2-positive breast cancer stage II", "Anxiety disorder"],
        icd10_codes=["C50.911", "F41.1"],
        medications=["trastuzumab 6mg/kg", "pertuzumab 420mg", "docetaxel 75mg/m2", "sertraline 50mg"],
        labs={"WBC": 4.2, "hemoglobin": 11.8, "platelets": 210, "ALT": 28},
        medical_history=["Diagnosed 4 months ago", "Currently on neoadjuvant chemotherapy", "BRCA1/2 negative"],
    ),
    PatientProfile(
        patient_id="PAT-004",
        age=72,
        sex="male",
        conditions=["Alzheimer's disease mild stage", "Type 2 diabetes mellitus", "Benign prostatic hyperplasia"],
        icd10_codes=["G30.0", "E11.9", "N40.0"],
        medications=["donepezil 10mg", "memantine 20mg", "metformin 500mg", "tamsulosin 0.4mg"],
        labs={"HbA1c": 7.1, "creatinine": 1.0, "eGFR": 72, "glucose": 132},
        medical_history=["MMSE score 22/30 last month", "Lives with spouse", "No prior stroke"],
    ),
    PatientProfile(
        patient_id="PAT-005",
        age=61,
        sex="male",
        conditions=["COPD moderate (GOLD Stage II)", "Chronic bronchitis", "Current smoker"],
        icd10_codes=["J44.1", "J42", "F17.210"],
        medications=["tiotropium 18mcg inhaled", "salmeterol-fluticasone inhaler", "albuterol PRN"],
        labs={"FEV1_percent": 55, "FVC": 3.1, "oxygen_saturation": 94},
        medical_history=["40 pack-year smoking history", "2 exacerbations in past year", "Pulmonary rehab completed"],
    ),
    PatientProfile(
        patient_id="PAT-006",
        age=52,
        sex="female",
        conditions=["Multiple sclerosis relapsing-remitting", "Depression", "Vitamin D deficiency"],
        icd10_codes=["G35", "F32.1", "E55.9"],
        medications=["natalizumab 300mg IV monthly", "sertraline 100mg", "vitamin D3 2000IU"],
        labs={"vitamin_D": 18, "lymphocytes": 1.8, "JC_virus_antibody_index": 0.9},
        medical_history=["Diagnosed with RRMS 5 years ago", "1 relapse in last 2 years", "MRI stable last 6 months"],
    ),
    PatientProfile(
        patient_id="PAT-007",
        age=39,
        sex="male",
        conditions=["Crohn's disease moderate", "Iron deficiency anemia"],
        icd10_codes=["K50.10", "D50.9"],
        medications=["adalimumab 40mg biweekly", "azathioprine 150mg", "ferrous sulfate 325mg"],
        labs={"hemoglobin": 10.2, "ferritin": 8, "CRP": 22, "albumin": 3.4},
        medical_history=["Ileocolonic Crohn's", "Failed infliximab due to antibodies", "No prior surgeries"],
    ),
    PatientProfile(
        patient_id="PAT-008",
        age=65,
        sex="female",
        conditions=["Non-small cell lung cancer stage IIIA", "Hypertension", "Osteoporosis"],
        icd10_codes=["C34.12", "I10", "M81.0"],
        medications=["pembrolizumab 200mg", "amlodipine 5mg", "alendronate 70mg weekly"],
        labs={"PD_L1_TPS": 65, "hemoglobin": 11.5, "creatinine": 0.9, "ALT": 32},
        medical_history=["KRAS mutant, PD-L1 TPS 65%", "Never-smoker", "ECOG PS 1"],
    ),
    PatientProfile(
        patient_id="PAT-009",
        age=48,
        sex="male",
        conditions=["Rheumatoid arthritis moderate-severe", "Hypertension", "Hyperlipidemia"],
        icd10_codes=["M05.79", "I10", "E78.5"],
        medications=["methotrexate 20mg weekly", "hydroxychloroquine 400mg", "prednisone 5mg", "lisinopril 20mg"],
        labs={"RF": 120, "anti_CCP": 85, "CRP": 18, "ESR": 45, "eGFR": 78},
        medical_history=["Seropositive RA diagnosed 6 years ago", "Failed leflunomide", "DAS28 score 4.2"],
    ),
    PatientProfile(
        patient_id="PAT-010",
        age=55,
        sex="female",
        conditions=["Chronic myeloid leukemia chronic phase", "Hypothyroidism"],
        icd10_codes=["C92.10", "E03.9"],
        medications=["imatinib 400mg", "levothyroxine 100mcg"],
        labs={"WBC": 12.4, "BCR_ABL_ratio": 0.8, "hemoglobin": 12.1, "platelets": 380, "TSH": 2.1},
        medical_history=["Newly diagnosed CML 2 months ago", "BCR-ABL positive", "Sokal score low risk"],
    ),
]


def get_all_patients() -> list[PatientProfile]:
    return SYNTHETIC_PATIENTS


def get_patient_by_id(patient_id: str) -> Optional[PatientProfile]:
    return next((p for p in SYNTHETIC_PATIENTS if p.patient_id == patient_id), None)
