"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type SaveState = "idle" | "saving" | "success" | "error";

export default function ApiKeyPanel() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [keyIsSet, setKeyIsSet] = useState(false);

  // Check on mount whether a key is already loaded on the server
  useEffect(() => {
    fetch(`${API_URL}/admin/config`)
      .then((r) => r.json())
      .then((data) => {
        setKeyIsSet(data.groq_api_key_set);
        setCurrentPreview(data.preview ?? null);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!key.trim()) return;
    setSaveState("saving");
    setError(null);

    try {
      const response = await fetch(`${API_URL}/admin/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groq_api_key: key.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to save key.");
      setCurrentPreview(data.preview);
      setKeyIsSet(true);
      setSaveState("success");
      setKey("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save key.");
      setSaveState("error");
    }
  };

  return (
    <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">Groq API Key</p>
              {keyIsSet ? (
                <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                  Active {currentPreview}
                </span>
              ) : (
                <span className="text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
                  Not set
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">Required for AI eligibility analysis</p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="p-5 bg-white border-t border-slate-200 space-y-4">
          {/* Instructions */}
          <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-800">
            <p className="font-semibold mb-1">Get your free Groq API key</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-violet-700">
              <li>Go to <strong>console.groq.com</strong></li>
              <li>Sign up — free, no credit card required</li>
              <li>Click <strong>API Keys → Create API Key</strong></li>
              <li>Copy the key starting with <code className="bg-violet-100 px-1 rounded">gsk_</code></li>
            </ol>
          </div>

          {/* Key input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Paste your Groq API key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={key}
                  onChange={(e) => { setKey(e.target.value); setSaveState("idle"); setError(null); }}
                  placeholder="gsk_..."
                  className="tag-input w-full pr-10 font-mono text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={!key.trim() || saveState === "saving"}
                className="btn-primary flex items-center gap-1.5 whitespace-nowrap"
              >
                {saveState === "saving" ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Saving...
                  </>
                ) : "Save Key"}
              </button>
            </div>
          </div>

          {/* Success */}
          {saveState === "success" && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Key saved. AI eligibility analysis is now active.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-400">
            The key is stored in server memory only — never logged or persisted to disk.
            Re-enter it if the server restarts.
          </p>
        </div>
      )}
    </div>
  );
}
