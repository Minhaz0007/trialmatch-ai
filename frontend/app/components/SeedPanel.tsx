"use client";

import { useState, useRef, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type SeedState = "idle" | "uploading" | "fetching" | "success" | "error";

interface SeedResult { trials_ingested: number; chunks_stored: number; message: string; }
interface Props { onStatusChange?: (count: number) => void; }

export default function SeedPanel({ onStatusChange }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<SeedState>("idle");
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".json")) { setError("Please upload a .json file."); return; }
    setFile(f); setError(null); setState("idle"); setResult(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  const handleUpload = async () => {
    if (!file) return;
    setState("uploading"); setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await fetch(`${API_URL}/admin/seed`, { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || `Error ${r.status}`);
      setResult(d); setState("success");
      onStatusChange?.(d.chunks_stored);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setState("error");
    }
  };

  const handleFetch = async () => {
    setState("fetching"); setError(null); setResult(null);
    try {
      const r = await fetch(`${API_URL}/admin/fetch-and-seed`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || `Error ${r.status}`);
      setResult(d); setState("success");
      onStatusChange?.(d.chunks_stored);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fetch failed. Is the backend running?");
      setState("error");
    }
  };

  const handleReset = () => {
    setState("idle");
    setResult(null);
    setError(null);
    setFile(null);
  };

  const busy = state === "uploading" || state === "fetching";
  const done = state === "success" && result != null;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`step-dot ${done ? "step-dot-done" : "step-dot-idle"}`}>
            {done ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : "2"}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Seed Database</h3>
            <p className="text-xs text-slate-400 mt-0.5">Load clinical trial data into ChromaDB</p>
          </div>
        </div>
        {done && result && (
          <span className="badge-blue">{result.trials_ingested} trials</span>
        )}
      </div>

      {/* Success state */}
      {done && result ? (
        <div className="space-y-3">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-emerald-800">Database ready</p>
            </div>
            <div className="flex gap-4 text-xs text-emerald-700">
              <span className="flex items-center gap-1">
                <span className="font-bold text-emerald-900">{result.trials_ingested}</span> trials ingested
              </span>
              <span className="flex items-center gap-1">
                <span className="font-bold text-emerald-900">{result.chunks_stored}</span> chunks stored
              </span>
            </div>
          </div>
          <button onClick={handleReset} className="btn-secondary w-full text-xs">
            Re-seed database
          </button>
        </div>
      ) : (
        <>
          {/* Primary: fetch from ClinicalTrials.gov */}
          <button
            onClick={handleFetch}
            disabled={busy}
            className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === "fetching" ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Fetching from ClinicalTrials.gov...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Fetch from ClinicalTrials.gov
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative flex items-center mb-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="mx-3 text-xs text-slate-400 font-medium">or upload a file</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 mb-3 ${
              dragOver ? "border-blue-400 bg-blue-50" :
              file ? "border-emerald-400 bg-emerald-50" :
              "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-emerald-700">{file.name}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-xs text-slate-500">Drop <strong className="text-slate-700">trials.json</strong> or click to browse</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-3 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || busy}
            className="btn-primary w-full"
          >
            {state === "uploading" ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Embedding and storing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload &amp; Seed
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
