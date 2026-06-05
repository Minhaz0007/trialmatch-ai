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
        <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading results...</p>
      </div>
    );
  }

  let matches = [...data.matches];
  if (eligibleOnly) matches = matches.filter((m) => m.eligibility.overall === "ELIGIBLE");
  matches.sort((a, b) => {
    if (sort === "confidence") return b.eligibility.confidence - a.eligibility.confidence;
    if (sort === "similarity") return b.trial.similarity_score - a.trial.similarity_score;
    if (sort === "phase")      return (a.trial.phase ?? "z").localeCompare(b.trial.phase ?? "z");
    if (sort === "sponsor")    return (a.trial.sponsor ?? "z").localeCompare(b.trial.sponsor ?? "z");
    return 0;
  });

  const eligible  = data.matches.filter((m) => m.eligibility.overall === "ELIGIBLE").length;
  const uncertain = data.matches.filter((m) => m.eligibility.overall === "UNCERTAIN").length;
  const excluded  = data.matches.filter((m) => m.eligibility.overall === "EXCLUDED").length;
  const avgRagas  = (() => {
    const scores = data.matches.map((m) => m.ragas?.overall_score).filter((s): s is number => s != null);
    return scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100)
      : null;
  })();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div>
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-5 group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          New search
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Match Results</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs text-slate-500">Patient</span>
              <code className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md text-xs font-mono text-slate-700">
                {data.patient_id}
              </code>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">{data.total_trials_searched} candidates searched</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">{data.processing_time_seconds.toFixed(1)}s</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-400 font-mono">trace: {data.trace_id.slice(0, 8)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            value: eligible,
            label: "Eligible",
            sub: "meets all criteria",
            track: "border-l-emerald-500",
            val: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            value: uncertain,
            label: "Uncertain",
            sub: "needs review",
            track: "border-l-amber-400",
            val: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            value: excluded,
            label: "Excluded",
            sub: "criteria not met",
            track: "border-l-red-500",
            val: "text-red-600",
            bg: "bg-red-50",
          },
          {
            value: avgRagas != null ? `${avgRagas}%` : "—",
            label: "Avg RAGAS",
            sub: "retrieval quality",
            track: "border-l-blue-500",
            val: "text-blue-600",
            bg: "bg-blue-50",
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`${s.bg} rounded-2xl border border-slate-200 border-l-4 ${s.track} shadow-sm px-4 py-3.5`}
          >
            <p className={`text-2xl font-extrabold tracking-tight ${s.val}`}>{s.value}</p>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">{s.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500">Sort by</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="confidence">Confidence</option>
            <option value="similarity">Similarity</option>
            <option value="phase">Phase</option>
            <option value="sponsor">Sponsor</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {matches.length} of {data.matches.length} results
          </span>
          <button
            onClick={() => setEligibleOnly(!eligibleOnly)}
            className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
              eligibleOnly
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className={`w-7 h-3.5 rounded-full transition-colors relative ${eligibleOnly ? "bg-emerald-500" : "bg-slate-300"}`}>
              <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${eligibleOnly ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </div>
            Eligible only
          </button>
        </div>
      </div>

      {/* ── Match list ── */}
      {matches.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-semibold text-slate-500 text-base">No matches with current filters</p>
          <p className="text-sm text-slate-400 mt-1">Try removing the &quot;Eligible only&quot; filter to see all results.</p>
          <button onClick={() => setEligibleOnly(false)} className="mt-4 btn-secondary text-sm">
            Show all results
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((m, i) => <MatchCard key={m.trial.nct_id} match={m} rank={i + 1} />)}
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => router.push("/")}
          className="btn-secondary text-sm gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Start a new search
        </button>
      </div>
    </div>
  );
}
