"""LangGraph multi-agent pipeline for clinical trial matching."""

import os
import uuid
from typing import TypedDict, List, Optional

from langgraph.graph import StateGraph, END

from backend.schemas.models import (
    PatientInput,
    PatientProfile,
    TrialCandidate,
    EligibilityResult,
    MatchResult,
)
from backend.agents.profile_parser import parse_patient_profile
from backend.agents.trial_retriever import retrieve_trials
from backend.agents.eligibility_checker import check_eligibility
from backend.agents.evaluator import evaluate_match


class AgentState(TypedDict):
    patient_input: PatientInput
    patient_profile: Optional[PatientProfile]
    candidate_trials: List[TrialCandidate]
    eligibility_results: List[EligibilityResult]
    match_results: List[MatchResult]
    retry_count: int
    trace_id: str
    error: Optional[str]


# ── Node functions ────────────────────────────────────────────────────────────

def node_parse_profile(state: AgentState) -> AgentState:
    try:
        profile = parse_patient_profile(state["patient_input"])
        return {**state, "patient_profile": profile, "error": None}
    except Exception as exc:
        return {**state, "error": f"Profile parsing failed: {exc}"}


def node_retrieve_trials(state: AgentState) -> AgentState:
    if state.get("error"):
        return state
    try:
        broad = state["retry_count"] > 0
        candidates = retrieve_trials(state["patient_profile"], top_k=10, broad=broad)
        return {**state, "candidate_trials": candidates, "error": None}
    except Exception as exc:
        return {**state, "error": f"Trial retrieval failed: {exc}"}


def node_check_eligibility(state: AgentState) -> AgentState:
    if state.get("error"):
        return state
    try:
        results = check_eligibility(
            state["patient_profile"],
            state["candidate_trials"],
            max_trials=5,
        )
        return {**state, "eligibility_results": results, "error": None}
    except Exception as exc:
        return {**state, "error": f"Eligibility checking failed: {exc}"}


def node_evaluate_matches(state: AgentState) -> AgentState:
    if state.get("error"):
        return state

    trial_map = {t.nct_id: t for t in state["candidate_trials"]}
    match_results: list[MatchResult] = []

    for elig in state["eligibility_results"]:
        trial = trial_map.get(elig.nct_id)
        if not trial:
            continue
        ragas_score = evaluate_match(trial, elig)
        match_results.append(
            MatchResult(trial=trial, eligibility=elig, ragas=ragas_score)
        )

    match_results.sort(key=lambda m: m.eligibility.confidence, reverse=True)
    return {**state, "match_results": match_results}


# ── Conditional routing ───────────────────────────────────────────────────────

def route_after_retrieval(state: AgentState) -> str:
    if state.get("error"):
        return "check_eligibility"
    candidates = state.get("candidate_trials", [])
    retry_count = state.get("retry_count", 0)
    if len(candidates) == 0 and retry_count < 2:
        return "retry_retrieve"
    return "check_eligibility"


def node_retry_retrieve(state: AgentState) -> AgentState:
    return {**state, "retry_count": state["retry_count"] + 1, "error": None}


# ── Build graph ───────────────────────────────────────────────────────────────

def _build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("parse_profile", node_parse_profile)
    graph.add_node("retrieve_trials", node_retrieve_trials)
    graph.add_node("retry_retrieve", node_retry_retrieve)
    graph.add_node("check_eligibility", node_check_eligibility)
    graph.add_node("evaluate_matches", node_evaluate_matches)

    graph.set_entry_point("parse_profile")
    graph.add_edge("parse_profile", "retrieve_trials")

    graph.add_conditional_edges(
        "retrieve_trials",
        route_after_retrieval,
        {
            "retry_retrieve": "retry_retrieve",
            "check_eligibility": "check_eligibility",
        },
    )

    graph.add_edge("retry_retrieve", "retrieve_trials")
    graph.add_edge("check_eligibility", "evaluate_matches")
    graph.add_edge("evaluate_matches", END)

    return graph.compile()


_compiled_graph = None


def _get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = _build_graph()
    return _compiled_graph


def run_pipeline(patient_input: PatientInput, trace_id: Optional[str] = None) -> AgentState:
    if trace_id is None:
        trace_id = str(uuid.uuid4())

    initial_state: AgentState = {
        "patient_input": patient_input,
        "patient_profile": None,
        "candidate_trials": [],
        "eligibility_results": [],
        "match_results": [],
        "retry_count": 0,
        "trace_id": trace_id,
        "error": None,
    }

    graph = _get_graph()

    config = {}
    langsmith_api_key = os.environ.get("LANGCHAIN_API_KEY")
    if langsmith_api_key and os.environ.get("LANGCHAIN_TRACING_V2", "").lower() == "true":
        config["run_name"] = f"trialmatch-{trace_id[:8]}"
        config["tags"] = ["trialmatch-ai", "patient-matching"]
        config["metadata"] = {"trace_id": trace_id}

    final_state = graph.invoke(initial_state, config=config if config else None)
    return final_state
