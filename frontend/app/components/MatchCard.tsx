"use client";

import { useState } from "react";
import RagasPanel from "./RagasPanel";

interface CriterionResult {
  criterion: string;
  decision: "ELIGIBLE" | "EXCLUDED" | "UNCERTAIN";
  reasoning: string;
  criterion_type: "inclusion" | "exclusion";
}
interface EligibilityResult {
  nct_id: string;
  overall: "ELIGIBLE" | "EXCLUDED" | "UNCERTAIN";
  criteria_results: CriterionResult[];
  confidence: number;
  summary: string;
}
interface TrialCandidate {
  nct_id: string;
  title: string;
  phase: string | null;
  sponsor: string | null;
  conditions: string[];
  eligibility_criteria: string;
  locations: string[];
  similarity_score: number;
}
interface RagasScore {
  context_precision: number;
  faithfulness: number;
  answer_relevance: number;
  overall_score: number;
}
interface MatchResult {
  trial: TrialCandidate;
  eligibility: EligibilityResult;
  ragas: RagasScore | null;
  matched_at: string;
}

const VERDICT = {
  ELIGIBLE: {
    border: "border-l-green-500",
    badge: "badge-eligible",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  EXCLUDED: {
    border: "border-l-red-500",
    badge: "badge-excluded",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  UNCERTAIN: {
    border: "border-l-amber-400",
    badge: "badge-uncertain",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
      </svg>
    ),
  },
};

function CriterionRow({ c }: { c: CriterionResult }) {
  const cls = {
    ELIGIBLE: "bg-green-50 text-green-700 border-green-200",
    EXCLUDED: "bg-red-50 text-red-700 border-red-200",
    UNCERTAIN: "bg-amber-50 text-amber-700 border-amber-200",
  }[c.decision];

  return (
    <div className="flex gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border shrink-0 h-fit mt-0.5 ${cls}`}>
        {c.decision}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-700 leading-relaxed">{c.criterion}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{c.reasoning}</p>
      </div>
    </div>
  );
}

export default function MatchCard({ match, rank }: { match: MatchResult; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const { trial, eligibility, ragas } = match;
  const v = VERDICT[eligibility.overall];
  const confidencePct = Math.round(eligibility.confidence * 100);
  const similarityPct = Math.round(trial.similarity_score * 100);
  const inclusion = eligibility.criteria_results.filter((c) => c.criterion_type === "inclusion");
  const exclusion = eligibility.criteria_results.filter((c) => c.criterion_type === "exclusion");

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm border-l-4 ${v.border} overflow-hidden animate-slide-up`}>
      {/* Main content */}
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start gap-3">
          {/* Rank */}
          <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
            {rank}
          </span>

          {/* Trial info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <a
                href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline font-mono"
              >
                {trial.nct_id}
              </a>
              {trial.phase && (
                <span className="badge-slate">{trial.phase}</span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-slate-800 leading-snug mb-1">
              {trial.title}
            </h3>
            {trial.sponsor && (
              <p className="text-xs text-slate-400">{trial.sponsor}</p>
            )}
          </div>

          {/* Verdict badge */}
          <div className="shrink-0">
            <span className={`${v.badge} flex items-center gap-1`}>
              {v.icon}
              {eligibility.overall}
            </span>
          </div>
        </div>

        {/* Summary */}
        <p className="mt-3 text-sm text-slate-600 leading-relaxed pl-10">{eligibility.summary}</p>

        {/* Metrics row */}
        <div className="mt-3 pl-10 flex flex-wrap gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Confidence</p>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${confidencePct}%` }} />
              </div>
              <span className="text-xs font-semibold text-slate-700">{confidencePct}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Similarity</p>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${similarityPct}%` }} />
              </div>
              <span className="text-xs font-semibold text-slate-700">{similarityPct}%</span>
            </div>
          </div>
        </div>

        {/* Locations */}
        {trial.locations.length > 0 && (
          <div className="mt-3 pl-10 flex flex-wrap gap-1.5">
            {trial.locations.slice(0, 3).map((loc, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {loc}
              </span>
            ))}
            {trial.locations.length > 3 && (
              <span className="text-xs text-slate-400">+{trial.locations.length - 3} more</span>
            )}
          </div>
        )}

        {/* RAGAS */}
        <div className="pl-10">
          <RagasPanel ragas={ragas} />
        </div>
      </div>

      {/* Criteria toggle */}
      {eligibility.criteria_results.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-5 py-3 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span>
              {expanded ? "Hide" : "Show"} criteria breakdown
              <span className="ml-1.5 font-semibold text-slate-400">
                ({inclusion.length} inclusion · {exclusion.length} exclusion)
              </span>
            </span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="px-5 pb-5 space-y-4 animate-fade-in">
              {inclusion.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Inclusion Criteria
                  </p>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 px-3 divide-y divide-slate-100">
                    {inclusion.map((c, i) => <CriterionRow key={i} c={c} />)}
                  </div>
                </div>
              )}
              {exclusion.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Exclusion Criteria
                  </p>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 px-3 divide-y divide-slate-100">
                    {exclusion.map((c, i) => <CriterionRow key={i} c={c} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
