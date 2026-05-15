import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrialMatch AI — Clinical Trial Matching",
  description:
    "Match patients to recruiting clinical trials using multi-agent AI. Powered by LangGraph, Claude, and RAGAS evaluation.",
  keywords: ["clinical trials", "patient matching", "AI", "healthcare"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <span className="font-bold text-slate-900 text-lg">TrialMatch AI</span>
            </a>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span className="hidden sm:inline">Multi-Agent RAG · LangGraph · RAGAS</span>
              <a
                href="https://github.com/Minhaz0007/trialmatch-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="mt-16 py-8 border-t border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-slate-500">
            <p>
              Built by{" "}
              <span className="font-medium text-slate-700">Minhaz Uddin</span> ·{" "}
              <span className="text-slate-400">Darkmoon AI Solutions</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Portfolio project · Clinical data is synthetic · Not for actual medical use
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
