import PatientForm from "./components/PatientForm";
import ApiKeyPanel from "./components/ApiKeyPanel";
import SeedPanel from "./components/SeedPanel";

const STACK = [
  { label: "LangGraph", desc: "Multi-agent orchestration" },
  { label: "Groq / Llama 3.3", desc: "Eligibility reasoning (free)" },
  { label: "ChromaDB", desc: "Vector similarity search" },
  { label: "RAGAS", desc: "Result quality evaluation" },
];

const STEPS = [
  { n: "1", title: "Parse Profile", desc: "FHIR R4 bundle or manual input → structured PatientProfile" },
  { n: "2", title: "Semantic Search", desc: "Cosine similarity against 300+ embedded trial criteria" },
  { n: "3", title: "AI Analysis", desc: "Llama 3.3 70B evaluates each inclusion & exclusion criterion" },
  { n: "4", title: "RAGAS Evaluation", desc: "Context precision, faithfulness, and relevance scoring" },
];

export default function HomePage() {
  return (
    <div>
      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-blue-200 text-xs font-medium px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Multi-Agent RAG · Zero Paid APIs · Open Source
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4 text-balance">
            Clinical Trial Patient
            <span className="text-blue-400"> Matching AI</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 text-balance">
            Match patient profiles to actively recruiting clinical trials in seconds using
            multi-agent RAG, semantic search, and structured AI eligibility analysis.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
            {[
              { value: "300+", label: "Recruiting Trials" },
              { value: "~8 sec", label: "Match Time" },
              { value: "$0", label: "API Cost" },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 border border-white/10 rounded-2xl py-4 px-3 backdrop-blur-sm">
                <p className="text-2xl font-extrabold text-white">{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* ── Setup ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Setup</h2>
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">One-time configuration</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <ApiKeyPanel />
            <SeedPanel />
          </div>
        </section>

        {/* ── Patient Form ── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Patient Matching</h2>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Form */}
            <div className="lg:col-span-3 card">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-slate-800">Patient Information</h3>
              </div>
              <PatientForm />
            </div>

            {/* Side info */}
            <div className="lg:col-span-2 space-y-4">
              {/* Sample */}
              <div className="card bg-amber-50 border-amber-200 p-4">
                <p className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide">Sample Patient</p>
                <div className="space-y-1.5 text-xs text-amber-700">
                  <p><span className="font-semibold">Age/Sex:</span> 58 · Female</p>
                  <p><span className="font-semibold">Conditions:</span> Type 2 diabetes, Hypertension</p>
                  <p><span className="font-semibold">Meds:</span> metformin 1000mg, lisinopril 10mg</p>
                  <p><span className="font-semibold">Labs:</span> HbA1c 8.4 · eGFR 62</p>
                </div>
              </div>

              {/* Tech stack */}
              <div className="card p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Tech Stack</p>
                <div className="space-y-2">
                  {STACK.map((s) => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">{s.label}</span>
                      <span className="text-xs text-slate-400">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">How It Works</h2>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, i) => (
              <div key={step.n} className="card p-4 relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-7 -right-2 z-10">
                    <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
                <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xs font-bold mb-3">
                  {step.n}
                </div>
                <p className="text-sm font-semibold text-slate-800 mb-1">{step.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
