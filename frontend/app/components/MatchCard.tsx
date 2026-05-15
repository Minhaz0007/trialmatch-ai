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

interface MatchCardProps {
  match: MatchResult;
  rank: number;
}

const VERDICT_STYLES = {
  ELIGIBLE: {
    badge: "badge-eligible",
    border: "border-l-green-500",
    icon: (
      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  EXCLUDED: {
    badge: "badge-excluded",
    border: "border-l-red-500",
    icon: (
      <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  UNCERTAIN: {
    badge: "badge-uncertain",
    border: "border-l-amber-500",
    icon: (
      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

function CriterionBadge({ decision }: { decision: "ELIGIBLE" | "EXCLUDED" | "UNCERTAIN" }) {
  const classes = {
    ELIGIBLE: "badge-eligible",
    EXCLUDED: "badge-excluded",
    UNCERTAIN: "badge-uncertain",
  };
  return <span className={classes[decision]}>{decision}</span>;
}

export default function MatchCard({ match, rank }: MatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { trial, eligibility, ragas } = match;
  const style = VERDICT_STYLES[eligibility.overall];
  const confidencePct = Math.round(eligibility.confidence * 100);
  const similarityPct = Math.round(trial.similarity_score * 100);

  const inclusionCriteria = eligibility.criteria_results.filter(
    (c) => c.criterion_type === "inclusion"
  );
  const exclusionCriteria = eligibility.criteria_results.filter(
    (c) => c.criterion_type === "exclusion"
  );

  return (
    <div className={`card border-l-4 ${style.border} transition-shadow hover:shadow-md`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-sm flex items-center justify-center">
            {rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <a
                href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                {trial.nct_id}
              </a>
              {trial.phase && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  {trial.phase}
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium text-slate-800 leading-snug mb-1">
              {trial.title}
            </h3>
            {trial.sponsor && (
              <p className="text-xs text-slate-500">{trial.sponsor}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {style.icon}
            <span className={style.badge}>{eligibility.overall}</span>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">
              Confidence <span className="font-semibold text-slate-700">{confidencePct}%</span>
            </div>
            <div className="text-xs text-slate-500">
              Similarity <span className="font-semibold text-slate-700">{similarityPct}%</span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600 leading-relaxed">{eligibility.summary}</p>

      {trial.locations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {trial.locations.slice(0, 3).map((loc, i) => (
            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {loc}
            </span>
          ))}
          {trial.locations.length > 3 && (
            <span className="text-xs text-slate-400">+{trial.locations.length - 3} more</span>
          )}
        </div>
      )}

      <RagasPanel ragas={ragas} />

      {eligibility.criteria_results.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {expanded ? "Hide" : "Show"} criteria breakdown (
            {eligibility.criteria_results.length} criteria)
          </button>

          {expanded && (
            <div className="mt-3 space-y-3">
              {inclusionCriteria.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Inclusion Criteria
                  </h4>
                  <div className="space-y-2">
                    {inclusionCriteria.map((c, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <CriterionBadge decision={c.decision} />
                        <div>
                          <p className="font-medium text-slate-700">{c.criterion}</p>
                          <p className="text-slate-500 mt-0.5">{c.reasoning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {exclusionCriteria.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Exclusion Criteria
                  </h4>
                  <div className="space-y-2">
                    {exclusionCriteria.map((c, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <CriterionBadge decision={c.decision} />
                        <div>
                          <p className="font-medium text-slate-700">{c.criterion}</p>
                          <p className="text-slate-500 mt-0.5">{c.reasoning}</p>
                        </div>
                      </div>
                    ))}
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
