"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MatchCard from "../components/MatchCard";

interface MatchResult {
  trial: {
    nct_id: string; title: string; phase: string | null; sponsor: string | null;
    conditions: string[]; eligibility_criteria: string; locations: string[];
    similarity_score: number;
  };
  eligibility: {
    nct_id: string;
    overall: "ELIGIBLE" | "EXCLUDED" | "UNCERTAIN";
    criteria_results: Array<{ criterion: string; decision: "ELIGIBLE" | "EXCLUDED" | "UNCERTAIN"; reasoning: string; criterion_type: "inclusion" | "exclusion"; }>;
    confidence: number; summary: string;
  };
  ragas: { context_precision: number; faithfulness: number; answer_relevance: number; overall_score: number; } | null;
  matched_at: string;
}
interface MatchResponse {
  patient_id: string; matches: MatchResult[]; total_trials_searched: number;
  processing_time_seconds: number; trace_id: string;
}
type SortKey = "confidence" | "similarity" | "phase" | "sponsor";

export default function ResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<MatchResponse | null>(null);
  const [sort, setSort] = useState<SortKey>("confidence");
  const [eligibleOnly, setEligibleOnly] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("matchResults");
    if (!raw) { router.push("/"); return; }
    try { setData(JSON.parse(raw)); } catch { router.push("/"); }
  }, [router]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading results...</p>
      </div>
    );
  }

  let matches = [...data.matches];
  if (eligibleOnly) matches = matches.filter((m) => m.eligibility.overall === "ELIGIBLE");
  matches.sort((a, b) => {
    switch (sort) {
      case "confidence": return b.eligibility.confidence - a.eligibility.confidence;
      case "similarity": return b.trial.similarity_score - a.trial.similarity_score;
      case "phase": return (a.trial.phase || "z").localeCompare(b.trial.phase || "z");
      case "sponsor": return (a.trial.sponsor || "z").localeCompare(b.trial.sponsor || "z");
    }
  });

  const eligible = data.matches.filter((m) => m.eligibility.overall === "ELIGIBLE").length;
  const uncertain = data.matches.filter((m) => m.eligibility.overall === "UNCERTAIN").length;
  const excluded = data.matches.filter((m) => m.eligibility.overall === "EXCLUDED").length;
  const avgRagas = (() => {
    const scores = data.matches.map((m) => m.ragas?.overall_score).filter((s): s is number => s != null);
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) : null;
  })();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <button onClick={() => router.push("/")}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4 group">
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          New search
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Match Results</h1>
            <p className="text-sm text-slate-500 mt-1">
              Patient <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">{data.patient_id}</code>
              {" · "}{data.total_trials_searched} candidates · {data.processing_time_seconds.toFixed(1)}s
              {" · "}Trace <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">{data.trace_id.slice(0, 8)}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { value: eligible, label: "Eligible", color: "border-l-green-500 text-green-600" },
          { value: uncertain, label: "Uncertain", color: "border-l-amber-400 text-amber-600" },
          { value: excluded, label: "Excluded", color: "border-l-red-500 text-red-600" },
          { value: avgRagas != null ? `${avgRagas}%` : "—", label: "Avg RAGAS", color: "border-l-blue-500 text-blue-600" },
        ].map((s) => (
          <div key={s.label} className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${s.color} shadow-sm px-4 py-3`}>
            <p className={`text-2xl font-extrabold ${s.color.split(" ")[1]}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Sort by</label>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700">
            <option value="confidence">Confidence</option>
            <option value="similarity">Similarity</option>
            <option value="phase">Phase</option>
            <option value="sponsor">Sponsor</option>
          </select>
        </div>
        <button
          onClick={() => setEligibleOnly(!eligibleOnly)}
          className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-xl border transition-all ${
            eligibleOnly ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className={`w-8 h-4 rounded-full transition-colors relative ${eligibleOnly ? "bg-green-500" : "bg-slate-300"}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${eligibleOnly ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          Eligible only
        </button>
      </div>

      {/* Match list */}
      {matches.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-semibold text-slate-500">No matches with current filters</p>
          <button onClick={() => setEligibleOnly(false)} className="mt-3 text-sm text-blue-600 hover:underline">
            Show all results
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((m, i) => <MatchCard key={m.trial.nct_id} match={m} rank={i + 1} />)}
        </div>
      )}
    </div>
  );
}
