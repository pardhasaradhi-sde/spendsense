"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AnalyticsResponse, TransactionResponse, Page, BudgetResponse } from "@/types/api";
import StatCard from "@/components/stat-card";
import { TrendingUp, DollarSign, ArrowDownLeft, ArrowUpRight, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";

const PALETTE = ["#0a0a0a", "#525252", "#a3a3a3", "#d4d4d4", "#e5e5e5", "#f5f5f5"];

// ─── Custom Tooltip for Bar Chart ─────────────────────────────────────────────
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[var(--border)] rounded px-3 py-2 text-[12px] shadow-sm">
      <p className="text-[var(--muted-foreground)] mb-1 font-medium">{label}</p>
      <p className="font-bold">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// ─── Custom Tooltip for Pie / Donut ──────────────────────────────────────────
function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-white border border-[var(--border)] rounded px-3 py-2 text-[12px] shadow-sm">
      <p className="font-bold truncate max-w-[160px]">{name}</p>
      <p className="text-[var(--muted-foreground)] mt-0.5">{formatCurrency(value)}</p>
    </div>
  );
}

// ─── Custom Donut Legend ──────────────────────────────────────────────────────
function DonutLegend({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="space-y-2 mt-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[11px] text-[var(--muted-foreground)] truncate">{item.name}</span>
          </div>
          <span className="text-[11px] font-semibold tabular-nums flex-shrink-0">
            {formatCurrency(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ["analytics", 6],
    queryFn: () => apiFetch<AnalyticsResponse>("/analytics?months=6", getToken),
  });

  const { data: budget } = useQuery({
    queryKey: ["budget-dash"],
    queryFn: () => apiFetch<BudgetResponse>("/budget", getToken).catch(() => null),
  });

  const { data: recentTxns, isLoading: loadingTxns } = useQuery({
    queryKey: ["transactions", 0, 8],
    queryFn: () =>
      apiFetch<Page<TransactionResponse>>(
        "/transactions?page=0&size=8&direction=desc",
        getToken
      ),
  });

  // Build bar chart data (always 6 months)
  const trendData = useMemo(() => {
    if (!analytics?.monthlyTrends) return [];
    
    // Generate the last 6 months in format YYYY-MM
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const displayStr = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      months.push({ raw: mStr, display: displayStr });
    }

    return months.map(m => ({
      month: m.display,
      expense: analytics.monthlyTrends[m.raw] ?? 0,
    }));
  }, [analytics]);

  // Build donut data
  const donutData = analytics?.categoryBreakdown
    ? Object.entries(analytics.categoryBreakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
        .map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }))
    : [];

  const Spinner = () => (
    <div className="h-48 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await apiFetch<AnalyticsResponse>("/analytics?months=6&refresh=true", getToken);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["budget-dash"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] })
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="w-full space-y-8">
      {/* Header and Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-black tracking-tight">Dashboard</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">Your financial overview</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loadingAnalytics}
          className="flex items-center gap-2 border border-[var(--border)] text-[13px] font-semibold px-4 py-2.5 rounded hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh Data
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Income" value={analytics ? formatCurrency(analytics.totalIncome) : "—"} icon={ArrowUpRight} />
        <StatCard label="Total Expense" value={analytics ? formatCurrency(analytics.totalExpense) : "—"} icon={ArrowDownLeft} />
        <StatCard label="Net Savings" value={analytics ? formatCurrency(analytics.netSavings) : "—"} icon={DollarSign} />
        <StatCard
          label="Savings Rate"
          value={analytics ? `${analytics.savingsRate.toFixed(1)}%` : "—"}
          icon={TrendingUp}
          variant="inverted"
        />
      </div>

      {/* Budget widget */}
      {budget && (
        <div className="relative bg-white border border-[var(--border)] rounded-xl p-6 shadow-sm group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg overflow-hidden">
          {/* Subtle Hover Gradient */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-tr from-[var(--brand-muted)] via-transparent to-transparent" />
          
          <div className="relative z-10 flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[14px] font-bold">Monthly Budget</h2>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                {formatCurrency(analytics?.totalExpense ?? 0)} spent of {formatCurrency(budget.amount)}
              </p>
            </div>
            <div className="text-right">
              {(() => {
                const pct = budget.amount > 0 ? Math.min(((analytics?.totalExpense ?? 0) / budget.amount) * 100, 100) : 0;
                const over = (analytics?.totalExpense ?? 0) > budget.amount;
                return (
                  <p className={`text-[20px] font-black tabular-nums ${
                    over ? "text-[var(--danger)]" : pct >= 80 ? "text-[var(--warning)]" : "text-[var(--success)]"
                  }`}>
                    {pct.toFixed(0)}%
                  </p>
                );
              })()}
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {budget.amount > 0 && (analytics?.totalExpense ?? 0) <= budget.amount
                  ? `${formatCurrency(budget.amount - (analytics?.totalExpense ?? 0))} left`
                  : budget.amount > 0 ? `${formatCurrency((analytics?.totalExpense ?? 0) - budget.amount)} over budget` : ""}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          {(() => {
            const pct = budget.amount > 0 ? Math.min(((analytics?.totalExpense ?? 0) / budget.amount) * 100, 100) : 0;
            const over = (analytics?.totalExpense ?? 0) > budget.amount;
            return (
              <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    over ? "bg-[var(--danger)]" : pct >= 80 ? "bg-[var(--warning)]" : "bg-[var(--success)]"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Area Chart — Monthly Spending */}
        <div className="relative lg:col-span-3 bg-white border border-[var(--border)] rounded-xl p-6 shadow-sm group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg overflow-hidden">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-tr from-[var(--brand-muted)] via-transparent to-transparent" />
          
          <div className="relative z-10 mb-6">
            <h2 className="text-[15px] font-bold">Monthly Spending</h2>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">Last 6 months</p>
          </div>
          {loadingAnalytics ? (
            <Spinner />
          ) : trendData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-[13px] text-[var(--muted-foreground)]">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#a3a3a3" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#a3a3a3" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: "#f5f5f5" }} />
                <Bar
                  dataKey="expense"
                  fill="#0a0a0a"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut — By Category */}
        <div className="relative lg:col-span-2 bg-white border border-[var(--border)] rounded-xl p-6 shadow-sm group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg overflow-hidden">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-tr from-[var(--brand-muted)] via-transparent to-transparent" />
          
          <div className="relative z-10 mb-4">
            <h2 className="text-[15px] font-bold">By Category</h2>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">Top 6 categories</p>
          </div>
          {loadingAnalytics ? (
            <Spinner />
          ) : donutData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-[13px] text-[var(--muted-foreground)]">
              No data yet
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((item, i) => (
                      <Cell key={i} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <DonutLegend data={donutData} />
            </>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="relative bg-white border border-[var(--border)] rounded-xl shadow-sm group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg overflow-hidden">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-tr from-[var(--brand-muted)] via-transparent to-transparent" />
        
        <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-[15px] font-bold">Recent Transactions</h2>
          <Link
            href="/transactions"
            className="text-[12px] font-semibold underline underline-offset-4 hover:text-neutral-500 transition-colors"
          >
            View all
          </Link>
        </div>
        {loadingTxns ? (
          <div className="p-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !recentTxns?.content.length ? (
          <div className="p-8 text-center text-[var(--muted-foreground)] text-sm">
            No transactions yet.{" "}
            <Link href="/transactions" className="underline text-black">Add one</Link>
          </div>
        ) : (
          <div className="relative z-10 divide-y divide-[var(--border)]">
            {recentTxns.content.map((txn) => (
              <div key={txn.id} className="flex items-center gap-4 px-6 py-3.5">
                <div
                  className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                    txn.type === "INCOME" ? "bg-[var(--success-muted)]" : "bg-[var(--danger-muted)]"
                  }`}
                >
                  {txn.type === "INCOME" ? (
                    <ArrowUpRight size={14} className="text-[var(--success)]" />
                  ) : (
                    <ArrowDownLeft size={14} className="text-[var(--danger)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{txn.description || txn.category}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                    {txn.category} · {txn.accountName}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={`text-[13px] font-bold tabular-nums ${
                      txn.type === "INCOME" ? "text-[var(--success)]" : ""
                    }`}
                  >
                    {txn.type === "INCOME" ? "+" : "-"}
                    {formatCurrency(txn.amount)}
                  </p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{formatDate(txn.date)}</p>
                </div>
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    txn.status === "COMPLETED"
                      ? "bg-[var(--success)]"
                      : txn.status === "PENDING"
                      ? "bg-[var(--warning)]"
                      : "bg-[var(--danger)]"
                  }`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
