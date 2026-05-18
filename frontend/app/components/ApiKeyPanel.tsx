"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type SaveState = "idle" | "saving" | "success" | "error";

interface Props {
  onStatusChange?: (set: boolean) => void;
}

export default function ApiKeyPanel({ onStatusChange }: Props) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSet, setIsSet] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/admin/config`)
      .then((r) => r.json())
      .then((d) => {
        setIsSet(d.groq_api_key_set);
        setPreview(d.preview ?? null);
        onStatusChange?.(d.groq_api_key_set);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!key.trim()) return;
    setSaveState("saving");
    setError(null);
    try {
      const r = await fetch(`${API_URL}/admin/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groq_api_key: key.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Failed to save key.");
      setPreview(d.preview);
      setIsSet(true);
      setSaveState("success");
      setKey("");
      setEditing(false);
      onStatusChange?.(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save key.");
      setSaveState("error");
    }
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`step-dot ${isSet ? "step-dot-done" : "step-dot-active"}`}>
            {isSet ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : "1"}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Groq API Key</h3>
            <p className="text-xs text-slate-500 mt-0.5">Powers AI eligibility analysis</p>
          </div>
        </div>
        {isSet && !editing && (
          <span className="badge-eligible">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Active
          </span>
        )}
      </div>

      {/* Active state (not editing) */}
      {isSet && !editing ? (
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <code className="text-xs text-slate-600 font-mono">{preview}</code>
          </div>
          <button onClick={() => setEditing(true)} className="btn-ghost btn-sm text-slate-500">
            Change
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Instructions */}
          {!isSet && (
            <div className="text-xs text-slate-500 space-y-1 p-3 bg-violet-50 rounded-xl border border-violet-100">
              <p className="font-medium text-violet-700">Get your free key at <strong>console.groq.com</strong></p>
              <p>Sign up free → API Keys → Create API Key → copy the <code className="bg-violet-100 px-1 rounded">gsk_...</code> key</p>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => { setKey(e.target.value); setSaveState("idle"); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="gsk_..."
                className="input input-mono pr-10"
                autoFocus={editing}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKey ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={!key.trim() || saveState === "saving"}
              className="btn-primary shrink-0"
            >
              {saveState === "saving" ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : "Save"}
            </button>
            {editing && (
              <button onClick={() => { setEditing(false); setKey(""); setError(null); }} className="btn-secondary shrink-0">
                Cancel
              </button>
            )}
          </div>

          {error && <p className="text-xs text-red-600 flex items-center gap-1"><span>⚠</span> {error}</p>}
          <p className="text-xs text-slate-400">Stored in server memory only · never logged · re-enter if server restarts</p>
        </div>
      )}
    </div>
  );
}
