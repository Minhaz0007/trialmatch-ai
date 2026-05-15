#!/usr/bin/env python3
"""Batch RAGAS evaluation across all synthetic patients."""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from backend.data.load_patients import get_all_patients
from backend.schemas.models import PatientInput
from backend.graph.pipeline import run_pipeline


def run_batch_eval():
    patients = get_all_patients()
    print(f"Running batch evaluation for {len(patients)} synthetic patients...\n")

    results = []
    for patient in patients:
        print(f"Processing {patient.patient_id} ({', '.join(patient.conditions[:2])})...")
        start = time.monotonic()

        patient_input = PatientInput(
            age=patient.age,
            sex=patient.sex,
            conditions=patient.conditions,
            medications=patient.medications,
            labs=patient.labs,
        )

        try:
            state = run_pipeline(patient_input)
            duration = round(time.monotonic() - start, 2)

            match_results = state.get("match_results", [])
            ragas_scores = [
                m.ragas for m in match_results if m.ragas is not None
            ]

            avg_ragas = None
            if ragas_scores:
                avg_ragas = round(
                    sum(r.overall_score for r in ragas_scores) / len(ragas_scores), 4
                )

            eligible_count = sum(
                1 for m in match_results if m.eligibility.overall == "ELIGIBLE"
            )

            result = {
                "patient_id": patient.patient_id,
                "conditions": patient.conditions[:2],
                "trials_searched": len(state.get("candidate_trials", [])),
                "matches_returned": len(match_results),
                "eligible_count": eligible_count,
                "avg_ragas_score": avg_ragas,
                "processing_time_s": duration,
                "error": state.get("error"),
            }

            print(
                f"  ✓ {len(match_results)} matches, {eligible_count} eligible, "
                f"RAGAS={avg_ragas}, {duration}s"
            )
        except Exception as exc:
            duration = round(time.monotonic() - start, 2)
            result = {
                "patient_id": patient.patient_id,
                "error": str(exc),
                "processing_time_s": duration,
            }
            print(f"  ✗ Error: {exc}")

        results.append(result)

    output_path = Path("eval_results.json")
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    successful = [r for r in results if not r.get("error")]
    if successful:
        avg_time = sum(r["processing_time_s"] for r in successful) / len(successful)
        ragas_scores = [r["avg_ragas_score"] for r in successful if r.get("avg_ragas_score")]
        avg_ragas_overall = round(sum(ragas_scores) / len(ragas_scores), 4) if ragas_scores else None

        print(f"\n{'='*50}")
        print(f"Batch Evaluation Summary")
        print(f"{'='*50}")
        print(f"Patients evaluated:     {len(patients)}")
        print(f"Successful:             {len(successful)}")
        print(f"Failed:                 {len(patients) - len(successful)}")
        print(f"Avg processing time:    {avg_time:.2f}s")
        print(f"Avg RAGAS score:        {avg_ragas_overall}")
        print(f"Results saved to:       {output_path.absolute()}")

    return results


if __name__ == "__main__":
    run_batch_eval()
