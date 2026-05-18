"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface LabEntry { key: string; value: string; }

export default function PatientForm() {
  const router = useRouter();
  const [tab, setTab] = useState<"manual" | "fhir">("manual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual fields
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("unknown");
  const [condInput, setCondInput] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [medInput, setMedInput] = useState("");
  const [medications, setMedications] = useState<string[]>([]);
  const [labs, setLabs] = useState<LabEntry[]>([{ key: "", value: "" }]);

  // FHIR
  const [dragOver, setDragOver] = useState(false);
  const [fhirName, setFhirName] = useState<string | null>(null);
  const [fhirJson, setFhirJson] = useState<object | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addTag = (val: string, list: string[], set: (v: string[]) => void) => {
    const t = val.trim();
    if (t && !list.includes(t)) set([...list, t]);
  };
  const removeTag = (i: number, list: string[], set: (v: string[]) => void) =>
    set(list.filter((_, idx) => idx !== i));

  const handleFhir = useCallback((f: File) => {
    if (!f.name.endsWith(".json")) { setError("Upload a .json FHIR bundle."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        setFhirJson(JSON.parse(e.target?.result as string));
        setFhirName(f.name);
        setError(null);
      } catch { setError("Invalid JSON file."); }
    };
    reader.readAsText(f);
  }, []);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      let body: Record<string, unknown>;
      if (tab === "fhir") {
        if (!fhirJson) { setError("Please upload a FHIR bundle."); setLoading(false); return; }
        body = { fhir_json: fhirJson };
      } else {
        if (!age && conditions.length === 0 && medications.length === 0) {
          setError("Enter at least one of: age, conditions, or medications.");
          setLoading(false); return;
        }
        const labsObj: Record<string, number> = {};
        labs.forEach(({ key, value }) => {
          if (key.trim() && value.trim() && !isNaN(parseFloat(value)))
            labsObj[key.trim()] = parseFloat(value);
        });
        body = {
          age: age ? parseInt(age) : undefined,
          sex: sex !== "unknown" ? sex : undefined,
          conditions: conditions.length ? conditions : undefined,
          medications: medications.length ? medications : undefined,
          labs: Object.keys(labsObj).length ? labsObj : undefined,
        };
      }

      const r = await fetch(`${API_URL}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || `Server error ${r.status}`);
      }
      const data = await r.json();
      sessionStorage.setItem("matchResults", JSON.stringify(data));
      router.push("/results");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const TagList = ({ items, set, color }: { items: string[]; set: (v: string[]) => void; color: string }) => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((item, i) => (
        <span key={i} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>
          {item}
          <button onClick={() => removeTag(i, items, set)} className="opacity-60 hover:opacity-100 font-bold leading-none">×</button>
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="tab-bar">
        <button className={tab === "manual" ? "tab-active" : "tab"} onClick={() => setTab("manual")}>
          Manual Entry
        </button>
        <button className={tab === "fhir" ? "tab-active" : "tab"} onClick={() => setTab("fhir")}>
          Upload FHIR Bundle
        </button>
      </div>

      {tab === "manual" ? (
        <div className="space-y-5">
          {/* Demographics */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Age</label>
              <input
                type="number" min="0" max="120" value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 58" className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Sex</label>
              <select value={sex} onChange={(e) => setSex(e.target.value)} className="select">
                <option value="unknown">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Conditions</label>
            <div className="flex gap-2">
              <input
                type="text" value={condInput}
                onChange={(e) => setCondInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(condInput, conditions, setConditions); setCondInput(""); }}}
                placeholder="Type condition and press Enter"
                className="input flex-1"
              />
              <button type="button" className="btn-secondary shrink-0"
                onClick={() => { addTag(condInput, conditions, setConditions); setCondInput(""); }}>
                Add
              </button>
            </div>
            {conditions.length > 0 && <TagList items={conditions} set={setConditions} color="bg-blue-50 text-blue-700 border border-blue-200" />}
          </div>

          {/* Medications */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Medications</label>
            <div className="flex gap-2">
              <input
                type="text" value={medInput}
                onChange={(e) => setMedInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(medInput, medications, setMedications); setMedInput(""); }}}
                placeholder="e.g. metformin 1000mg"
                className="input flex-1"
              />
              <button type="button" className="btn-secondary shrink-0"
                onClick={() => { addTag(medInput, medications, setMedications); setMedInput(""); }}>
                Add
              </button>
            </div>
            {medications.length > 0 && <TagList items={medications} set={setMedications} color="bg-violet-50 text-violet-700 border border-violet-200" />}
          </div>

          {/* Labs */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Lab Values</label>
            <div className="space-y-2">
              {labs.map((lab, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" value={lab.key} placeholder="Lab name (e.g. HbA1c)"
                    onChange={(e) => { const u = [...labs]; u[i] = { ...u[i], key: e.target.value }; setLabs(u); }}
                    className="input flex-1" />
                  <input type="number" step="any" value={lab.value} placeholder="Value"
                    onChange={(e) => { const u = [...labs]; u[i] = { ...u[i], value: e.target.value }; setLabs(u); }}
                    className="input w-28" />
                  <button onClick={() => setLabs(labs.filter((_, idx) => idx !== i))}
                    className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setLabs([...labs, { key: "", value: "" }])}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                + Add lab value
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
              dragOver ? "border-blue-400 bg-blue-50" : fhirName ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-slate-300"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFhir(f); }}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFhir(f); }} />
            {fhirName ? (
              <>
                <svg className="w-10 h-10 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-semibold text-green-700">{fhirName}</p>
                <p className="text-sm text-green-600 mt-1">FHIR bundle loaded — ready to match</p>
              </>
            ) : (
              <>
                <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="font-semibold text-slate-600">Drop your FHIR R4 Bundle here</p>
                <p className="text-sm text-slate-400 mt-1">or click to browse · .json files only</p>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">Supports Synthea-generated FHIR R4 Bundle format</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading} className="btn-primary btn-lg w-full">
        {loading ? (
          <>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Searching 300+ recruiting trials...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Find Matching Trials
          </>
        )}
      </button>
    </div>
  );
}
