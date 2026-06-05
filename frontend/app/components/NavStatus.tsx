"use client";

import { useEffect, useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type ConnectionState = "loading" | "online" | "offline";

interface HealthData {
  groq_key_set: boolean;
  chroma_collection_count: number;
}

export default function NavStatus() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [conn, setConn] = useState<ConnectionState>("loading");

  const fetchHealth = useCallback(() => {
    Promise.all([
      fetch(`${API_URL}/health`).then((r) => r.json()).catch(() => null),
      fetch(`${API_URL}/admin/config`).then((r) => r.json()).catch(() => null),
    ]).then(([h, cfg]) => {
      if (h) {
        setHealth({
          groq_key_set: cfg?.groq_api_key_set ?? false,
          chroma_collection_count: h.chroma_collection_count ?? 0,
        });
        setConn("online");
      } else {
        setConn("offline");
      }
    });
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 30_000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  if (conn === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
          <span>Connecting...</span>
        </div>
      </div>
    );
  }

  if (conn === "offline") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Backend Offline
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-1 justify-center">
      {/* Groq API key status */}
      <div className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
        health?.groq_key_set
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-red-50 text-red-600 ring-1 ring-red-200"
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${health?.groq_key_set ? "bg-emerald-500 animate-pulse-dot" : "bg-red-400"}`} />
        {health?.groq_key_set ? "Groq Active" : "Key Missing"}
      </div>

      {/* DB status */}
      <div className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
        (health?.chroma_collection_count ?? 0) > 0
          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
      }`}>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16" />
        </svg>
        {(health?.chroma_collection_count ?? 0) > 0
          ? `${(health!.chroma_collection_count).toLocaleString()} chunks`
          : "DB Empty"}
      </div>
    </div>
  );
}
