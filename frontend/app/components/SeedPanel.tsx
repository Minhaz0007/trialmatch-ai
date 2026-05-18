"use client";

import { useState, useRef, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type SeedState = "idle" | "uploading" | "success" | "error";

interface SeedResult {
  trials_ingested: number;
  chunks_stored: number;
  message: string;
}

export default function SeedPanel() {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<SeedState>("idle");
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".json")) {
      setError("Please upload a .json file.");
      return;
    }
    setFile(f);
    setFileName(f.name);
    setError(null);
    setState("idle");
    setResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!file) return;
    setState("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/admin/seed`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || `Server error ${response.status}`);
      }
      setResult(data);
      setState("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      setState("error");
    }
  };

  return (
    <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16M10 12h4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Seed Database</p>
            <p className="text-xs text-slate-500">Upload a ClinicalTrials.gov JSON file to populate the vector store</p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="p-5 bg-white border-t border-slate-200 space-y-4">
          {/* Download instructions */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 space-y-2">
            <p className="font-semibold">Step 1 — Get the data file (free, no account needed)</p>
            <p>Run this command from the repo root to download trial data from ClinicalTrials.gov:</p>
            <code className="block bg-blue-100 rounded px-3 py-2 text-xs font-mono mt-1 select-all">
              python scripts/download_trials.py
            </code>
            <p className="text-xs text-blue-600 mt-1">
              This saves <strong>backend/data/trials.json</strong> — then upload it below.
            </p>
          </div>

          {/* Drop zone */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Step 2 — Upload trials.json</p>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-slate-500 bg-slate-50"
                  : fileName
                  ? "border-green-400 bg-green-50"
                  : "border-slate-300 hover:border-slate-400"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {fileName ? (
                <div>
                  <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-medium text-green-700 text-sm">{fileName}</p>
                  <p className="text-xs text-green-600 mt-0.5">Ready to upload</p>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-slate-600 font-medium">Drop trials.json here</p>
                  <p className="text-xs text-slate-400 mt-0.5">or click to browse</p>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Success */}
          {state === "success" && result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-semibold text-green-800">{result.message}</p>
              <div className="flex gap-6 mt-2 text-xs text-green-700">
                <span>Trials ingested: <strong>{result.trials_ingested}</strong></span>
                <span>Chunks stored: <strong>{result.chunks_stored}</strong></span>
              </div>
            </div>
          )}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={!file || state === "uploading"}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {state === "uploading" ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Embedding and storing trials...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Seed Database
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
