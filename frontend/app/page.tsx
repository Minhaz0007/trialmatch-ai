import PatientForm from "./components/PatientForm";
import ApiKeyPanel from "./components/ApiKeyPanel";
import SeedPanel from "./components/SeedPanel";

const STACK = [
  {
    label: "LangGraph",
    desc: "Multi-agent orchestration",
    color: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-400",
  },
  {
    label: "Groq / Llama 3.3",
    desc: "Free LLM inference",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-400",
  },
  {
    label: "ChromaDB",
    desc: "Vector similarity search",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-400",
  },
  {
    label: "RAGAS",
    desc: "Result quality evaluation",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-400",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Parse Profile",
    desc: "FHIR R4 bundle or manual input is parsed into a structured PatientProfile.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Semantic Retrieval",
    desc: "Cosine similarity search across 300+ embedded trial eligibility criteria chunks.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "AI Eligibility Check",
    desc: "Llama 3.3 70B evaluates each inclusion and exclusion criterion with structured output.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    n: "04",
    title: "RAGAS Evaluation",
    desc: "Context precision, faithfulness, and answer relevance are scored for each match.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <div className="animate-fade-in">
      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden">
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 hero-grid opacity-100 pointer-events-none" />
        {/* Radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.18),transparent)] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          {/* Tag */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 text-blue-200 text-xs font-medium px-4 py-1.5 rounded-full mb-7 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
            Multi-Agent RAG · Zero Paid APIs · Open Source
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] mb-5 tracking-tight text-balance">
            Clinical Trial Patient
            <br />
            <span className="gradient-text">Matching AI</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300/90 max-w-2xl mx-auto mb-12 text-balance leading-relaxed">
            Match patient profiles to actively recruiting clinical trials in seconds using
            multi-agent RAG, semantic vector search, and structured AI eligibility analysis.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            {[
              { value: "300+", label: "Recruiting Trials", sub: "from ClinicalTrials.gov" },
              { value: "~8s", label: "Match Time", sub: "end-to-end pipeline" },
              { value: "$0", label: "API Cost", sub: "free Groq inference" },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white/8 border border-white/10 rounded-2xl py-4 px-3 backdrop-blur-sm hover:bg-white/12 transition-colors duration-200"
              >
                <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{s.value}</p>
                <p className="text-xs font-semibold text-blue-200 mt-0.5">{s.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Scroll hint */}
          <div className="mt-12 flex justify-center">
            <div className="flex flex-col items-center gap-1 text-slate-500">
              <span className="text-xs">Setup below</span>
              <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-12">

        {/* ── Setup ── */}
        <section>
          <div className="section-header">
            <span className="section-title">Setup</span>
            <div className="section-divider" />
            <span className="text-xs text-slate-400 shrink-0">One-time configuration</span>
          </div>

          {/* Setup description */}
          <p className="text-sm text-slate-500 mb-5 max-w-2xl">
            Complete both steps once. Your Groq key enables AI analysis; the database holds the trial index.
            The database auto-seeds on backend startup — the button is for manual refresh or custom datasets.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <ApiKeyPanel />
            <SeedPanel />
          </div>
        </section>

        {/* ── Patient Form ── */}
        <section>
          <div className="section-header">
            <span className="section-title">Patient Matching</span>
            <div className="section-divider" />
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Form */}
            <div className="lg:col-span-3 card">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center">
                  <svg className="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Patient Information</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Enter manually or upload a FHIR R4 bundle</p>
                </div>
              </div>
              <PatientForm />
            </div>

            {/* Side info */}
            <div className="lg:col-span-2 space-y-4">
              {/* Sample patient */}
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-amber-400 rounded-full" />
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Sample Patient</p>
                </div>
                <div className="space-y-2 text-xs text-amber-800">
                  <div className="flex justify-between">
                    <span className="text-amber-600 font-medium">Age / Sex</span>
                    <span className="font-semibold">58 · Female</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-amber-600 font-medium shrink-0">Conditions</span>
                    <span className="font-semibold text-right">Type 2 diabetes, Hypertension</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-amber-600 font-medium shrink-0">Medications</span>
                    <span className="font-semibold text-right">metformin 1000mg, lisinopril 10mg</span>
                  </div>
                  <div className="pt-1 border-t border-amber-200 flex justify-between gap-2">
                    <span className="text-amber-600 font-medium shrink-0">Labs</span>
                    <span className="font-mono font-semibold text-right text-[11px]">HbA1c: 8.4 · eGFR: 62</span>
                  </div>
                </div>
              </div>

              {/* Tech stack */}
              <div className="card p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Tech Stack</p>
                <div className="space-y-2">
                  {STACK.map((s) => (
                    <div key={s.label} className={`flex items-center gap-2 p-2 rounded-lg border ${s.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                      <span className="text-xs font-semibold flex-1">{s.label}</span>
                      <span className="text-[10px] opacity-70">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* FHIR tip */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-blue-800 mb-0.5">FHIR R4 Support</p>
                    <p className="text-xs text-blue-600">Use the &quot;Upload FHIR Bundle&quot; tab to import a Synthea-generated patient bundle for automated parsing.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section>
          <div className="section-header">
            <span className="section-title">How It Works</span>
            <div className="section-divider" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, i) => (
              <div key={step.n} className="card-hover p-5 relative group">
                {/* Step number */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white shadow-sm group-hover:shadow-blue-200 group-hover:shadow-md transition-shadow duration-200">
                    {step.icon}
                  </div>
                  <span className="text-xs font-bold text-slate-200 font-mono">{step.n}</span>
                </div>

                <p className="text-sm font-semibold text-slate-800 mb-1.5">{step.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>

                {/* Connector arrow */}
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-4 h-4 bg-white border border-slate-200 rounded-full items-center justify-center shadow-sm">
                    <svg className="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
