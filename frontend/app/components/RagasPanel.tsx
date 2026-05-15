"use client";

import { useState } from "react";

interface RagasScore {
  context_precision: number;
  faithfulness: number;
  answer_relevance: number;
  overall_score: number;
}

interface RagasPanelProps {
  ragas: RagasScore | null;
}

const METRIC_TOOLTIPS: Record<string, string> = {
  "Context Precision":
    "How much of the retrieved trial criteria text was actually relevant to the eligibility decision. High = focused retrieval.",
  Faithfulness:
    "Whether the eligibility reasoning is grounded in the trial criteria text without hallucination.",
  "Answer Relevance":
    "How directly the eligibility summary answers 'Does this patient meet the trial criteria?'",
};

function ScoreBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const pct = Math.round(value * 100);

  const color =
    pct >= 80
      ? "bg-green-500"
      : pct >= 60
      ? "bg-amber-500"
      : "bg-red-500";

  const textColor =
    pct >= 80
      ? "text-green-700"
      : pct >= 60
      ? "text-amber-700"
      : "text-red-700";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 relative">
          <span className="text-xs font-medium text-slate-600">{label}</span>
          <button
            className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-xs flex items-center justify-center hover:bg-slate-300 transition-colors"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
          >
            ?
          </button>
          {showTooltip && (
            <div className="absolute bottom-6 left-0 z-10 w-56 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg">
              {METRIC_TOOLTIPS[label]}
              <div className="absolute -bottom-1 left-3 w-2 h-2 bg-slate-800 rotate-45" />
            </div>
          )}
        </div>
        <span className={`text-xs font-bold ${textColor}`}>{pct}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div
          className={`${color} h-1.5 rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function RagasPanel({ ragas }: RagasPanelProps) {
  if (!ragas) {
    return (
      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs text-slate-400 italic">RAGAS evaluation unavailable</p>
      </div>
    );
  }

  const overallPct = Math.round(ragas.overall_score * 100);
  const overallColor =
    overallPct >= 80
      ? "text-green-600 bg-green-50 border-green-200"
      : overallPct >= 60
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : "text-red-600 bg-red-50 border-red-200";

  return (
    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          RAGAS Evaluation
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${overallColor}`}>
          Overall {overallPct}%
        </span>
      </div>
      <div className="space-y-2">
        <ScoreBar label="Context Precision" value={ragas.context_precision} />
        <ScoreBar label="Faithfulness" value={ragas.faithfulness} />
        <ScoreBar label="Answer Relevance" value={ragas.answer_relevance} />
      </div>
    </div>
  );
}
