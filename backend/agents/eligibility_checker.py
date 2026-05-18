"""Check patient eligibility against trial criteria using Groq (Llama 3.3 70B)."""

import os
from functools import lru_cache

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from backend.schemas.models import (
    PatientProfile,
    TrialCandidate,
    EligibilityResult,
    CriterionResult,
)

SYSTEM_PROMPT = """You are a clinical research coordinator expert. Evaluate whether a patient meets \
the eligibility criteria for a clinical trial. Be precise and conservative. Only mark ELIGIBLE if \
clearly met. Mark UNCERTAIN if information is missing or ambiguous. Mark EXCLUDED if any single \
exclusion criterion is clearly met.

For each criterion you identify, output a structured assessment with:
- The criterion text
- Your decision: ELIGIBLE, EXCLUDED, or UNCERTAIN
- Brief reasoning (1-2 sentences)
- Whether it's an inclusion or exclusion criterion

Provide an overall verdict and a confidence score 0.0-1.0."""


@lru_cache(maxsize=1)
def _get_llm() -> ChatGroq:
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0,
        max_tokens=2048,
        groq_api_key=os.environ.get("GROQ_API_KEY"),
    )


def check_eligibility(
    profile: PatientProfile,
    candidates: list[TrialCandidate],
    max_trials: int = 5,
) -> list[EligibilityResult]:
    structured_llm = _get_llm().with_structured_output(EligibilityResult)

    results: list[EligibilityResult] = []
    for trial in candidates[:max_trials]:
        try:
            result = _evaluate_single(structured_llm, profile, trial)
            results.append(result)
        except Exception as exc:
            results.append(
                EligibilityResult(
                    nct_id=trial.nct_id,
                    overall="UNCERTAIN",
                    criteria_results=[
                        CriterionResult(
                            criterion="Evaluation error",
                            decision="UNCERTAIN",
                            reasoning=f"Could not complete evaluation: {str(exc)[:200]}",
                            criterion_type="inclusion",
                        )
                    ],
                    confidence=0.0,
                    summary=f"Evaluation failed: {str(exc)[:200]}",
                )
            )

    return results


def _evaluate_single(
    structured_llm,
    profile: PatientProfile,
    trial: TrialCandidate,
) -> EligibilityResult:
    patient_summary = _format_patient(profile)
    criteria_text = trial.eligibility_criteria[:3000]

    user_prompt = f"""PATIENT PROFILE:
{patient_summary}

CLINICAL TRIAL: {trial.title} ({trial.nct_id})
Phase: {trial.phase or 'Not specified'}
Target conditions: {', '.join(trial.conditions)}

ELIGIBILITY CRITERIA:
{criteria_text}

Evaluate this patient's eligibility for this trial. The nct_id field must be "{trial.nct_id}"."""

    response = structured_llm.invoke(
        [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=user_prompt)]
    )

    if response.nct_id != trial.nct_id:
        response = response.model_copy(update={"nct_id": trial.nct_id})

    return response


def _format_patient(profile: PatientProfile) -> str:
    lines = [
        f"Patient ID: {profile.patient_id}",
        f"Age: {profile.age} years old",
        f"Sex: {profile.sex}",
        f"Conditions: {', '.join(profile.conditions) or 'None reported'}",
        f"ICD-10 codes: {', '.join(profile.icd10_codes) or 'None'}",
        f"Current medications: {', '.join(profile.medications) or 'None reported'}",
    ]
    if profile.labs:
        lab_str = ", ".join(f"{k}: {v}" for k, v in profile.labs.items())
        lines.append(f"Recent labs: {lab_str}")
    if profile.medical_history:
        lines.append(f"Medical history: {'; '.join(profile.medical_history[:5])}")
    return "\n".join(lines)
