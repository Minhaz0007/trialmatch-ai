import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NavStatus from "./components/NavStatus";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TrialMatch AI — Clinical Trial Patient Matching",
  description:
    "Multi-agent RAG system that matches patients to recruiting clinical trials using LangGraph, Groq, and RAGAS evaluation.",
  keywords: ["clinical trials", "patient matching", "AI", "RAG", "healthcare"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased min-h-screen bg-slate-50 flex flex-col">
        {/* Navbar */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-blue-200 group-hover:shadow-md transition-shadow duration-200">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div className="leading-none">
                <span className="font-bold text-slate-900 text-sm tracking-tight">TrialMatch</span>
                <span className="font-bold text-blue-600 text-sm tracking-tight"> AI</span>
              </div>
            </a>

            {/* Live status badges */}
            <NavStatus />

            {/* Right actions */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden md:flex items-center gap-1.5">
                {["LangGraph", "Groq", "RAGAS"].map((t) => (
                  <span key={t} className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded-md">
                    {t}
                  </span>
                ))}
              </div>
              <a
                href="https://github.com/Minhaz0007/trialmatch-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all duration-150"
                aria-label="GitHub"
              >
                <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-blue-700 rounded flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="font-semibold text-slate-700">TrialMatch AI</span>
              <span className="text-slate-300">·</span>
              <span>Built by <strong className="text-slate-700">Minhaz Uddin</strong></span>
            </div>
            <p className="text-xs text-slate-400 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full font-medium">
              ⚠ Research prototype · Synthetic data · Not for clinical use
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
