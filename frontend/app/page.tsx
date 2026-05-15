import PatientForm from "./components/PatientForm";

export default function HomePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          Multi-Agent RAG · LangGraph · Claude claude-sonnet-4-20250514
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-3">
          Find Your Clinical Trial
        </h1>
        <p className="text-lg text-slate-600 max-w-xl mx-auto">
          Enter patient information and our AI will match against{" "}
          <strong className="text-slate-800">300+ actively recruiting trials</strong> from
          ClinicalTrials.gov, with structured eligibility analysis.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { value: "300+", label: "Recruiting Trials" },
          { value: "~8s", label: "Avg Match Time" },
          { value: "RAGAS", label: "Evaluated Results" },
        ].map((stat) => (
          <div key={stat.label} className="card text-center py-4">
            <p className="text-2xl font-bold text-blue-600">{stat.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Patient Information</h2>
        <PatientForm />
      </div>

      {/* Sample patients */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm font-medium text-amber-800 mb-2">Try a sample patient</p>
        <p className="text-xs text-amber-700">
          Female, 58 · Type 2 diabetes, hypertension · metformin 1000mg, lisinopril 10mg ·
          HbA1c: 8.4, eGFR: 62
        </p>
      </div>

      {/* How it works */}
      <div className="mt-10">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          How It Works
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { step: "1", title: "Parse Profile", desc: "FHIR or manual input → structured patient profile" },
            { step: "2", title: "Semantic Search", desc: "ChromaDB cosine similarity against 300+ trials" },
            { step: "3", title: "AI Analysis", desc: "Claude evaluates each eligibility criterion" },
            { step: "4", title: "RAGAS Score", desc: "Faithfulness & relevance evaluation of results" },
          ].map((item) => (
            <div key={item.step} className="card p-3 text-center">
              <div className="w-7 h-7 bg-blue-600 text-white rounded-full text-xs font-bold flex items-center justify-center mx-auto mb-2">
                {item.step}
              </div>
              <p className="text-xs font-semibold text-slate-700">{item.title}</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
