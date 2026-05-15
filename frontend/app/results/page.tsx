"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MatchCard from "../components/MatchCard";

interface MatchResult {
  trial: {
    nct_id: string;
    title: string;
    phase: string | null;
    sponsor: string | null;
    conditions: string[];
    eligibility_criteria: string;
    locations: string[];
    similarity_score: number;
  };
  eligibility: {
    nct_id: string;
    overall: "ELIGIBLE" | "EXCLUDED" | "UNCERTAIN";
    criteria_results: Array<{
      criterion: string;
      decision: "ELIGIBLE" | "EXCLUDED" | "UNCERTAIN";
      reasoning: string;
      criterion_type: "inclusion" | "exclusion";
    }>;
    confidence: number;
    summary: string;
  };
  ragas: {
    context_precision: number;
    faithfulness: number;
    answer_relevance: number;
    overall_score: number;
  } | null;
  matched_at: string;
}

interface MatchResponse {
  patient_id: string;
  matches: MatchResult[];
  total_trials_searched: number;
  processing_time_seconds: number;
  trace_id: string;
}

type SortKey = "confidence" | "phase" | "sponsor" | "similarity";

export default function ResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<MatchResponse | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("confidence");
  const [eligibleOnly, setEligibleOnly] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("matchResults");
    if (!raw) {
      router.push("/");
      return;
    }
    try {
      setData(JSON.parse(raw));
    } catch {
      router.push("/");
    }
  }, [router]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  let matches = [...data.matches];

  if (eligibleOnly) {
    matches = matches.filter((m) => m.eligibility.overall === "ELIGIBLE");
  }

  matches.sort((a, b) => {
    switch (sortBy) {
      case "confidence":
        return b.eligibility.confidence - a.eligibility.confidence;
      case "phase":
        return (a.trial.phase || "z").localeCompare(b.trial.phase || "z");
      case "sponsor":
        return (a.trial.sponsor || "z").localeCompare(b.trial.sponsor || "z");
      case "similarity":
        return b.trial.similarity_score - a.trial.similarity_score;
      default:
        return 0;
    }
  });

  const eligibleCount = data.matches.filter((m) => m.eligibility.overall === "ELIGIBLE").length;
  const uncertainCount = data.matches.filter((m) => m.eligibility.overall === "UNCERTAIN").length;
  const excludedCount = data.matches.filter((m) => m.eligibility.overall === "EXCLUDED").length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          New search
        </button>

        <h1 className="text-2xl font-bold text-slate-900">
          Matching Results for Patient{" "}
          <span className="text-blue-600">{data.patient_id}</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Searched {data.total_trials_searched} candidate trials · Completed in{" "}
          <strong>{data.processing_time_seconds.toFixed(1)}s</strong> · Trace{" "}
          <code className="text-xs bg-slate-100 px-1 rounded">{data.trace_id.slice(0, 8)}</code>
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center py-4 border-l-4 border-l-green-500">
          <p className="text-2xl font-bold text-green-600">{eligibleCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Eligible</p>
        </div>
        <div className="card text-center py-4 border-l-4 border-l-amber-500">
          <p className="text-2xl font-bold text-amber-600">{uncertainCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Uncertain</p>
        </div>
        <div className="card text-center py-4 border-l-4 border-l-red-500">
          <p className="text-2xl font-bold text-red-600">{excludedCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Excluded</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="confidence">Confidence Score</option>
            <option value="similarity">Semantic Similarity</option>
            <option value="phase">Trial Phase</option>
            <option value="sponsor">Sponsor</option>
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => setEligibleOnly(!eligibleOnly)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              eligibleOnly ? "bg-green-500" : "bg-slate-300"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                eligibleOnly ? "translate-x-5" : ""
              }`}
            />
          </div>
          <span className="text-sm text-slate-600">Eligible only</span>
        </label>
      </div>

      {/* Results list */}
      {matches.length === 0 ? (
        <div className="card text-center py-12 text-slate-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium">No matches found with current filters</p>
          <button
            onClick={() => setEligibleOnly(false)}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            Show all results
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match, i) => (
            <MatchCard key={match.trial.nct_id} match={match} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
