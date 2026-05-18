"""RAGAS evaluation of eligibility determinations."""

import os
from typing import Optional

from backend.schemas.models import EligibilityResult, TrialCandidate, RagasScore


def evaluate_match(
    trial: TrialCandidate,
    eligibility: EligibilityResult,
) -> Optional[RagasScore]:
    try:
        return _run_ragas(trial, eligibility)
    except Exception:
        return None


def _run_ragas(
    trial: TrialCandidate,
    eligibility: EligibilityResult,
) -> Optional[RagasScore]:
    try:
        from datasets import Dataset
        from ragas import evaluate
        from ragas.metrics import LLMContextRecall, Faithfulness, FactualCorrectness
        from ragas.llms import LangchainLLMWrapper
        from langchain_groq import ChatGroq
    except ImportError:
        return None

    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0,
        groq_api_key=os.environ.get("GROQ_API_KEY"),
    )
    evaluator_llm = LangchainLLMWrapper(llm)

    question = "Does this patient meet the trial eligibility criteria?"
    context = trial.eligibility_criteria[:2000]
    answer = eligibility.summary

    ground_truth = (
        "The patient is eligible for the trial."
        if eligibility.overall == "ELIGIBLE"
        else "The patient does not clearly meet all trial eligibility criteria."
    )

    data = {
        "question": [question],
        "contexts": [[context]],
        "answer": [answer],
        "ground_truth": [ground_truth],
    }
    dataset = Dataset.from_dict(data)

    metrics = [
        LLMContextRecall(llm=evaluator_llm),
        Faithfulness(llm=evaluator_llm),
        FactualCorrectness(llm=evaluator_llm),
    ]

    result = evaluate(dataset, metrics=metrics)
    result_df = result.to_pandas()

    row = result_df.iloc[0]

    context_precision = float(row.get("context_recall", row.get("LLMContextRecall", 0.5)))
    faithfulness = float(row.get("faithfulness", row.get("Faithfulness", 0.5)))
    answer_relevance = float(row.get("factual_correctness", row.get("FactualCorrectness", 0.5)))

    overall = round((context_precision + faithfulness + answer_relevance) / 3, 4)

    return RagasScore(
        context_precision=round(context_precision, 4),
        faithfulness=round(faithfulness, 4),
        answer_relevance=round(answer_relevance, 4),
        overall_score=overall,
    )
