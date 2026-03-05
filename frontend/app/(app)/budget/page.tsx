"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Target, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { BudgetResponse } from "@/types/api";

function BudgetForm({
  defaultAmount,
  onSubmit,
  loading,
  label,
}: {
  defaultAmount?: number;
  onSubmit: (amount: number) => void;
  loading: boolean;
  label: string;
}) {
  const [amount, setAmount] = useState(defaultAmount?.toString() ?? "");

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); const n = parseFloat(amount); if (!isNaN(n) && n > 0) onSubmit(n); }}
      className="flex gap-3"
    >
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] text-sm">₹</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          step="0.01"
          min="0.01"
          placeholder="e.g. 50000"
          className="w-full border border-[var(--border)] rounded pl-7 pr-4 py-2.5 text-[13px] focus:outline-none focus:border-black"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white px-5 py-2.5 rounded text-[13px] font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50"
      >
        {loading ? "Saving…" : label}
      </button>
    </form>
  );
}

export default function BudgetPage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: budget, isLoading, error } = useQuery({
    queryKey: ["budget"],
    queryFn: () => apiFetch<BudgetResponse>("/budget", getToken),
    retry: (count, err: Error) => {
      if (err.message.includes("404") || err.message.includes("not found")) return false;
      return count < 2;
    },
  });

  const createMutation = useMutation({
    mutationFn: (amount: number) =>
      apiFetch<BudgetResponse>("/budget", getToken, { method: "POST", body: JSON.stringify({ amount }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budget"] }); toast.success("Budget set!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (amount: number) =>
      apiFetch<BudgetResponse>("/budget", getToken, { method: "PUT", body: JSON.stringify({ amount }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget"] });
      setEditing(false);
      toast.success("Budget updated!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch<null>("/budget", getToken, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget"] });
      toast.success("Budget removed.");
      setShowDeleteConfirm(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasBudget = !!budget && !error;
  const spent = budget?.spentThisMonth ?? 0;
  const pct = budget?.percentUsed ?? 0;
  const isOverBudget = hasBudget && budget && spent > budget.amount;
  const isNearLimit = pct >= 80 && !isOverBudget;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[640px] space-y-8">
      <div>
        <h1 className="text-[28px] font-black tracking-tight">Budget</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Set a monthly spending limit and track your progress.
        </p>
      </div>

      {!hasBudget ? (
        /* No budget set */
        <div className="border border-dashed border-[var(--border)] rounded p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-[var(--muted)] rounded-full flex items-center justify-center mx-auto">
            <Target size={20} />
          </div>
          <div>
            <h2 className="text-[16px] font-bold">No Budget Set</h2>
            <p className="text-[var(--muted-foreground)] text-sm mt-1">
              Set a monthly limit to track your spending.
            </p>
          </div>
          <div className="max-w-sm mx-auto">
            <BudgetForm
              onSubmit={createMutation.mutate}
              loading={createMutation.isPending}
              label="Set Budget"
            />
          </div>
        </div>
      ) : (
        /* Budget exists */
        <div className="space-y-6">
          {/* Alert */}
          {(isOverBudget || isNearLimit) && (
            <div
              className={`flex items-start gap-3 p-4 rounded border ${
                isOverBudget
                  ? "bg-[var(--danger-muted)] border-[var(--danger)]"
                  : "bg-[var(--warning-muted)] border-[var(--warning)]"
              }`}
            >
              <AlertTriangle size={16} className={isOverBudget ? "text-[var(--danger)]" : "text-[var(--warning)]"} />
              <div>
                <p className={`text-[13px] font-bold ${isOverBudget ? "text-[var(--danger)]" : "text-[var(--warning)]"}`}>
                  {isOverBudget ? "Over Budget" : "Approaching Limit"}
                </p>
                <p className="text-[12px] mt-0.5 text-[var(--muted-foreground)]">
                  {isOverBudget
                    ? `You've exceeded your budget by ${formatCurrency(spent - budget!.amount)}.`
                    : `You've used ${pct.toFixed(0)}% of your monthly budget.`}
                </p>
              </div>
            </div>
          )}

          {/* Budget card */}
          <div className="border border-[var(--border)] rounded p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Monthly Budget
                </p>
                <p className="text-[36px] font-black tracking-tight tabular-nums mt-1">
                  {formatCurrency(budget!.amount)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-8 h-8 flex items-center justify-center rounded border border-[var(--border)] hover:bg-[var(--danger-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-[12px]">
                <span className="text-[var(--muted-foreground)]">Spent this month</span>
                <span className="font-semibold">{formatCurrency(spent)} / {formatCurrency(budget!.amount)}</span>
              </div>
              <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOverBudget
                      ? "bg-[var(--danger)]"
                      : isNearLimit
                      ? "bg-[var(--warning)]"
                      : "bg-black"
                  }`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[var(--muted-foreground)]">
                <span>{pct.toFixed(0)}% used</span>
                <span>{formatCurrency(Math.max(0, budget!.amount - spent))} remaining</span>
              </div>
            </div>

            {budget.lastAlertSent && (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Last alert sent: {formatDateTime(budget.lastAlertSent)}
              </p>
            )}
          </div>

          {/* Edit form */}
          {editing && (
            <div className="border border-[var(--border)] rounded p-5">
              <p className="text-[13px] font-bold mb-4">Update Budget</p>
              <BudgetForm
                defaultAmount={budget?.amount}
                onSubmit={updateMutation.mutate}
                loading={updateMutation.isPending}
                label="Update"
              />
              <button
                onClick={() => setEditing(false)}
                className="mt-3 text-[12px] text-[var(--muted-foreground)] hover:text-black underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="Remove Budget?"
        message="This action cannot be undone. You won't receive any more budget alerts until you create a new one."
      />
    </div>
  );
}

function DeleteConfirmDialog({ open, onClose, onConfirm, loading, title, message }: { open: boolean, onClose: () => void, onConfirm: () => void, loading: boolean, title: string, message: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded border border-[var(--border)] w-full max-w-sm p-6 shadow-xl text-center m-4">
        <div className="w-12 h-12 bg-[var(--danger-muted)] text-[var(--danger)] rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} />
        </div>
        <h2 className="text-[16px] font-bold mb-2">{title}</h2>
        <p className="text-[13px] text-[var(--muted-foreground)] mb-6">
          {message}
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border border-[var(--border)] rounded px-4 py-2.5 text-[13px] font-semibold hover:bg-[var(--muted)] transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="flex-1 bg-[var(--danger)] text-white rounded px-4 py-2.5 text-[13px] font-semibold hover:bg-red-700 disabled:opacity-50">
            {loading ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
