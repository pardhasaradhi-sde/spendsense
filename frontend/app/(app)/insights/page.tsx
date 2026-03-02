"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Sparkles, AlertTriangle, Lightbulb, TrendingUp, ListChecks, ChevronRight, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { SpendingInsightResponse } from "@/types/api";

// ─── Empty / Generate prompt ─────────────────────────────────────────────────
function GeneratePrompt({ onGenerate, loading }: { onGenerate: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-6">
      <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
        <Sparkles size={24} className="text-white" />
      </div>
      <div className="max-w-sm">
        <h2 className="text-[20px] font-black tracking-tight">AI-Powered Insights</h2>
        <p className="text-[var(--muted-foreground)] text-sm mt-2 leading-relaxed">
          Get a personalized analysis of your spending patterns, anomaly detection, and budget recommendations — powered by Google Gemini.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onGenerate}
          disabled={loading}
          className="flex items-center gap-2 bg-black text-white text-[13px] font-semibold px-6 py-3 rounded hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Analyzing your spending…
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generate Insights
              <ChevronRight size={14} />
            </>
          )}
        </button>
        <p className="text-[11px] text-[var(--muted-foreground)]">Usually takes 3–5 seconds</p>
      </div>
    </div>
  );
}

// ─── Catchy Loading Screen ───────────────────────────────────────────────────
function LoadingState() {
  const [step, setStep] = useState(0);
  const steps = [
    "Gathering latest transactions...",
    "Categorizing spending behavior...",
    "Detecting unusual patterns...",
    "Formulating recommendations...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-500">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 rounded-full border-[3px] border-[var(--muted)] animate-ping opacity-75" />
        <div className="absolute inset-0 rounded-full border-[3px] border-black border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-black">
          <Sparkles size={32} className="animate-pulse" />
        </div>
      </div>
      <h3 className="text-[20px] font-bold text-black mb-2 tracking-tight">Analyzing your finances</h3>
      <p className="text-[14px] font-medium text-[var(--muted-foreground)] min-h-[20px] transition-all duration-300">
        {steps[step]}
      </p>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function InsightCard({
  title,
  items,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  items: string[];
  icon: React.ElementType;
  variant?: "default" | "warning";
}) {
  if (!items || items.length === 0) return null;

  return (
    <div
      className={`rounded border p-5 ${
        variant === "warning"
          ? "border-[var(--warning)] bg-[var(--warning-muted)]"
          : "border-[var(--border)] bg-white"
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className={`w-7 h-7 rounded flex items-center justify-center ${
            variant === "warning" ? "bg-[var(--warning)] text-white" : "bg-black text-white"
          }`}
        >
          <Icon size={13} />
        </div>
        <h2 className="text-[13px] font-bold uppercase tracking-widest">{title}</h2>
        <span className="ml-auto text-[11px] font-semibold text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-[7px] w-1 h-1 rounded-full bg-[var(--muted-foreground)] flex-shrink-0" />
            <p className="text-[13px] leading-relaxed text-[var(--foreground)]">{item}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const { getToken } = useAuth();
  
  const [enabled, setEnabled] = useState(false);
  const [runId, setRunId] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-load on mount — backend Redis/DB handles 48h caching
  useEffect(() => {
    setEnabled(true);
  }, []);

  const { data: qInsights, isLoading: loadingInsights, isError } = useQuery({
    queryKey: ["ai-insights", runId],
    queryFn: () => apiFetch<SpendingInsightResponse>("/ai/insights", getToken),
    enabled,
    staleTime: Infinity,
    retry: false,
  });

  const loading = loadingInsights || refreshing;
  const insights = qInsights;
  const hasData = !!insights;

  async function handleGenerate() {
    // If already generated, call the refresh endpoint to bust Redis + DB and get fresh data
    if (enabled && insights) {
      setRefreshing(true);
      try {
        await apiFetch<SpendingInsightResponse>("/ai/insights/refresh", getToken, { method: "POST" });
      } catch {}
      setRefreshing(false);
    } else {
      setEnabled(true);
    }
    setRunId((k) => k + 1);
  }

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Header — only show when data is loaded */}
      {hasData && !loading && (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-black tracking-tight">AI Insights</h1>
            <p className="text-[var(--muted-foreground)] text-sm mt-1">
              Powered by Google Gemini 
              {!loading && hasData && <span className="ml-2 inline-block px-2 py-0.5 bg-[var(--muted)] text-[10px] uppercase font-bold tracking-widest rounded-full">Cached 48h</span>}
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 border border-[var(--border)] text-[13px] font-semibold px-4 py-2.5 rounded hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Regenerate
          </button>
        </div>
      )}

      {/* Not yet triggered and no cached data */}
      {!hasData && !loading && (
        <div>
          <div className="mb-6">
            <h1 className="text-[28px] font-black tracking-tight">AI Insights</h1>
            <p className="text-[var(--muted-foreground)] text-sm mt-1">Powered by Google Gemini</p>
          </div>
          <GeneratePrompt onGenerate={handleGenerate} loading={loading} />
        </div>
      )}

      {/* Loading state with catchy screen */}
      {loading && (
        <div>
          <div className="mb-6">
            <h1 className="text-[28px] font-black tracking-tight">AI Insights</h1>
          </div>
          <LoadingState />
        </div>
      )}

      {/* Error */}
      {isError && !loading && (
        <div className="border border-[var(--danger)] bg-[var(--danger-muted)] rounded p-5 flex items-start gap-3">
          <AlertTriangle size={16} className="text-[var(--danger)] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-bold text-[var(--danger)]">Analysis Failed</p>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
              Make sure you have transactions to analyze, then try again.
            </p>
            <button
              onClick={handleGenerate}
              className="mt-3 text-[12px] font-semibold underline underline-offset-2 text-[var(--danger)]"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {hasData && !loading && (
        <div className="space-y-4">
          {/* Summary — black hero card */}
          {insights.summary && (
            <div className="bg-black text-white rounded p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={14} className="text-neutral-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Spending Summary
                </p>
              </div>
              <p className="text-[15px] leading-relaxed font-normal">{insights.summary}</p>
            </div>
          )}

          {/* 2-col grid for recommendations + patterns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InsightCard
              title="Recommendations"
              items={insights.recommendations}
              icon={Lightbulb}
            />
            <InsightCard
              title="Spending Patterns"
              items={insights.patterns}
              icon={TrendingUp}
            />
          </div>

          {/* Top categories */}
          {insights.topCategories && insights.topCategories.length > 0 && (
            <div className="border border-[var(--border)] rounded p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded bg-black text-white flex items-center justify-center">
                  <ListChecks size={13} />
                </div>
                <h2 className="text-[13px] font-bold uppercase tracking-widest">Top Categories</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {insights.topCategories.map((cat, i) => (
                  <span
                    key={i}
                    className="text-[12px] font-medium bg-[var(--muted)] px-3 py-1.5 rounded-full"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
