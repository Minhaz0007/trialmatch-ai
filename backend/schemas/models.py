from pydantic import BaseModel, Field
from typing import Literal, List, Dict, Optional
from datetime import datetime


class PatientProfile(BaseModel):
    patient_id: str
    age: int
    sex: Literal["male", "female", "unknown"]
    conditions: List[str]
    icd10_codes: List[str]
    medications: List[str]
    labs: Dict[str, float]
    medical_history: List[str]


class TrialCandidate(BaseModel):
    nct_id: str
    title: str
    phase: Optional[str]
    sponsor: Optional[str]
    conditions: List[str]
    eligibility_criteria: str
    locations: List[str]
    similarity_score: float


class CriterionResult(BaseModel):
    criterion: str
    decision: Literal["ELIGIBLE", "EXCLUDED", "UNCERTAIN"]
    reasoning: str
    criterion_type: Literal["inclusion", "exclusion"]


class EligibilityResult(BaseModel):
    nct_id: str
    overall: Literal["ELIGIBLE", "EXCLUDED", "UNCERTAIN"]
    criteria_results: List[CriterionResult]
    confidence: float
    summary: str


class RagasScore(BaseModel):
    context_precision: float
    faithfulness: float
    answer_relevance: float
    overall_score: float


class MatchResult(BaseModel):
    trial: TrialCandidate
    eligibility: EligibilityResult
    ragas: Optional[RagasScore] = None
    matched_at: datetime = Field(default_factory=datetime.utcnow)


class PatientInput(BaseModel):
    fhir_json: Optional[Dict] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    conditions: Optional[List[str]] = None
    medications: Optional[List[str]] = None
    labs: Optional[Dict[str, float]] = None


class MatchResponse(BaseModel):
    patient_id: str
    matches: List[MatchResult]
    total_trials_searched: int
    processing_time_seconds: float
    trace_id: str
