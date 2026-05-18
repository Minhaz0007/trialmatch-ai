"use client";

import { useState } from "react";

interface RagasScore {
  context_precision: number;
  faithfulness: number;
  answer_relevance: number;
  overall_score: number;
}

const METRICS = [
  {
    key: "context_precision" as const,
    label: "Context Precision",
    tooltip: "How much of the retrieved trial criteria was relevant to this decision.",
  },
  {
    key: "faithfulness" as const,
    label: "Faithfulness",
    tooltip: "Whether the reasoning is grounded in the trial criteria without hallucination.",
  },
  {
    key: "answer_relevance" as const,
    label: "Answer Relevance",
    tooltip: "How directly the summary answers 'Does this patient meet the criteria?'",
  },
];

function MetricBar({ label, value, tooltip }: { label: string; value: number; tooltip: string }) {
  const [show, setShow] = useState(false);
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400";
  const textColor = pct >= 80 ? "text-green-700" : pct >= 60 ? "text-amber-700" : "text-red-600";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 relative">
          <span className="text-xs text-slate-500">{label}</span>
          <button
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 text-[9px] flex items-center justify-center hover:bg-slate-300 transition-colors"
          >?</button>
          {show && (
            <div className="absolute bottom-5 left-0 z-20 w-52 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl leading-relaxed">
              {tooltip}
              <div className="absolute -bottom-1 left-4 w-2 h-2 bg-slate-800 rotate-45" />
            </div>
          )}
        </div>
        <span className={`text-xs font-bold tabular-nums ${textColor}`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function RagasPanel({ ragas }: { ragas: RagasScore | null }) {
  if (!ragas) {
    return (
      <div className="mt-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-400 italic">
        RAGAS evaluation unavailable
      </div>
    );
  }

  const overallPct = Math.round(ragas.overall_score * 100);
  const overallColor = overallPct >= 80 ? "text-green-700 bg-green-50 ring-green-200"
    : overallPct >= 60 ? "text-amber-700 bg-amber-50 ring-amber-200"
    : "text-red-700 bg-red-50 ring-red-200";

  return (
    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">RAGAS Eval</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ring-1 ${overallColor}`}>
          {overallPct}% overall
        </span>
      </div>
      {METRICS.map((m) => (
        <MetricBar key={m.key} label={m.label} value={ragas[m.key]} tooltip={m.tooltip} />
      ))}
    </div>
  );
}
