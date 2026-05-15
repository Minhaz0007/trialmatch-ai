"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface LabEntry {
  key: string;
  value: string;
}

export default function PatientForm() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"manual" | "fhir">("manual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual form state
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("unknown");
  const [conditionInput, setConditionInput] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [medInput, setMedInput] = useState("");
  const [medications, setMedications] = useState<string[]>([]);
  const [labs, setLabs] = useState<LabEntry[]>([{ key: "", value: "" }]);

  // FHIR upload state
  const [fhirDragOver, setFhirDragOver] = useState(false);
  const [fhirFileName, setFhirFileName] = useState<string | null>(null);
  const [fhirJson, setFhirJson] = useState<object | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addTag = (value: string, list: string[], setList: (v: string[]) => void) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
  };

  const removeTag = (idx: number, list: string[], setList: (v: string[]) => void) => {
    setList(list.filter((_, i) => i !== idx));
  };

  const handleFhirFile = useCallback((file: File) => {
    if (!file.name.endsWith(".json")) {
      setError("Please upload a .json FHIR bundle file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        setFhirJson(parsed);
        setFhirFileName(file.name);
        setError(null);
      } catch {
        setError("Invalid JSON file. Please upload a valid FHIR bundle.");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setFhirDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFhirFile(file);
    },
    [handleFhirFile]
  );

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      let body: Record<string, unknown>;

      if (activeTab === "fhir") {
        if (!fhirJson) {
          setError("Please upload a FHIR JSON bundle.");
          setLoading(false);
          return;
        }
        body = { fhir_json: fhirJson };
      } else {
        if (!age && conditions.length === 0 && medications.length === 0) {
          setError("Please enter at least age, conditions, or medications.");
          setLoading(false);
          return;
        }
        const labsObj: Record<string, number> = {};
        labs.forEach(({ key, value }) => {
          if (key.trim() && value.trim() && !isNaN(parseFloat(value))) {
            labsObj[key.trim()] = parseFloat(value);
          }
        });

        body = {
          age: age ? parseInt(age) : undefined,
          sex: sex !== "unknown" ? sex : undefined,
          conditions: conditions.length > 0 ? conditions : undefined,
          medications: medications.length > 0 ? medications : undefined,
          labs: Object.keys(labsObj).length > 0 ? labsObj : undefined,
        };
      }

      const response = await fetch(`${API_URL}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error ${response.status}`);
      }

      const data = await response.json();
      sessionStorage.setItem("matchResults", JSON.stringify(data));
      router.push("/results");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex border border-slate-200 rounded-lg p-1 bg-slate-50 gap-1">
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === "manual"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          Manual Entry
        </button>
        <button
          onClick={() => setActiveTab("fhir")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === "fhir"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          Upload FHIR Bundle
        </button>
      </div>

      {activeTab === "manual" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
              <input
                type="number"
                min="0"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 58"
                className="tag-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="tag-input"
              >
                <option value="unknown">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Conditions
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={conditionInput}
                onChange={(e) => setConditionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(conditionInput, conditions, setConditions);
                    setConditionInput("");
                  }
                }}
                placeholder="Type a condition and press Enter"
                className="tag-input flex-1"
              />
              <button
                type="button"
                onClick={() => {
                  addTag(conditionInput, conditions, setConditions);
                  setConditionInput("");
                }}
                className="btn-secondary text-sm"
              >
                Add
              </button>
            </div>
            {conditions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {conditions.map((c, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full"
                  >
                    {c}
                    <button
                      onClick={() => removeTag(i, conditions, setConditions)}
                      className="hover:text-blue-900 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Medications */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Medications
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={medInput}
                onChange={(e) => setMedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(medInput, medications, setMedications);
                    setMedInput("");
                  }
                }}
                placeholder="e.g. metformin 1000mg"
                className="tag-input flex-1"
              />
              <button
                type="button"
                onClick={() => {
                  addTag(medInput, medications, setMedications);
                  setMedInput("");
                }}
                className="btn-secondary text-sm"
              >
                Add
              </button>
            </div>
            {medications.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {medications.map((m, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 bg-purple-50 text-purple-700 text-xs px-2.5 py-1 rounded-full"
                  >
                    {m}
                    <button
                      onClick={() => removeTag(i, medications, setMedications)}
                      className="hover:text-purple-900 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Labs */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Lab Values
            </label>
            <div className="space-y-2">
              {labs.map((lab, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={lab.key}
                    onChange={(e) => {
                      const updated = [...labs];
                      updated[i] = { ...updated[i], key: e.target.value };
                      setLabs(updated);
                    }}
                    placeholder="Lab name (e.g. HbA1c)"
                    className="tag-input flex-1"
                  />
                  <input
                    type="number"
                    step="any"
                    value={lab.value}
                    onChange={(e) => {
                      const updated = [...labs];
                      updated[i] = { ...updated[i], value: e.target.value };
                      setLabs(updated);
                    }}
                    placeholder="Value"
                    className="tag-input w-28"
                  />
                  <button
                    onClick={() => setLabs(labs.filter((_, idx) => idx !== i))}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLabs([...labs, { key: "", value: "" }])}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                + Add lab value
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              fhirDragOver
                ? "border-blue-400 bg-blue-50"
                : fhirFileName
                ? "border-green-400 bg-green-50"
                : "border-slate-300 hover:border-slate-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setFhirDragOver(true);
            }}
            onDragLeave={() => setFhirDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFhirFile(file);
              }}
            />
            {fhirFileName ? (
              <div>
                <svg className="w-10 h-10 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium text-green-700">{fhirFileName}</p>
                <p className="text-sm text-green-600 mt-1">FHIR bundle loaded</p>
              </div>
            ) : (
              <div>
                <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="font-medium text-slate-600">Drop your FHIR JSON bundle here</p>
                <p className="text-sm text-slate-400 mt-1">or click to browse · .json files only</p>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Supports Synthea-generated FHIR R4 Bundle format
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Searching 300+ recruiting trials...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Find Matching Trials
          </>
        )}
      </button>
    </div>
  );
}
