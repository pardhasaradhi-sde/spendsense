"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, Suspense, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Plus, ScanLine, ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight,
  Trash2, Pencil, RefreshCw, RotateCcw, Search, X, ChevronUp, ChevronDown,
  CreditCard, Building2, ArrowLeft, Sparkles, Camera, Calendar
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, CATEGORIES, toBackendDate } from "@/lib/utils";
import type {
  TransactionResponse, Page, AccountResponse, CreateTransactionRequest,
  ReceiptScanResponse, RecurringInterval,
} from "@/types/api";
import * as Select from "@radix-ui/react-select";

// ─── Form schema ─────────────────────────────────────────────────────────────
const txnSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().min(0.01),
  description: z.string().max(500).optional(),
  date: z.string().min(1),
  category: z.string().min(1),
  accountId: z.string().min(1),
  receiptUrl: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringInterval: z.string().optional(),
}).refine((data) => !data.isRecurring || (!!data.recurringInterval && data.recurringInterval !== ""), {
  message: "Please select an interval",
  path: ["recurringInterval"]
});
type TxnForm = z.infer<typeof txnSchema>;
type SortField = "date" | "amount" | "category";
type SortDir = "asc" | "desc";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TransactionResponse["status"] }) {
  const s = {
    COMPLETED: "bg-[var(--success-muted)] text-[var(--success)]",
    PENDING: "bg-[var(--warning-muted)] text-[var(--warning)]",
    FAILED: "bg-[var(--danger-muted)] text-[var(--danger)]",
  };
  return <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded ${s[status]}`}>{status}</span>;
}

function RecurringBadge({ isRecurring, interval }: { isRecurring: boolean; interval?: string | null }) {
  if (isRecurring) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100">
        <RotateCcw size={9} />
        {interval ?? "Recurring"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
      One-time
    </span>
  );
}

function SortBtn({ field, current, dir, onClick, label }: { field: SortField; current: SortField; dir: SortDir; onClick: () => void; label: string }) {
  const active = field === current;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest transition-colors ${active ? "text-black" : "text-[var(--muted-foreground)] hover:text-black"}`}
    >
      {label}
      <span className="flex flex-col -gap-0.5">
        <ChevronUp size={9} className={active && dir === "asc" ? "opacity-100" : "opacity-25"} />
        <ChevronDown size={9} className={active && dir === "desc" ? "opacity-100" : "opacity-25"} />
      </span>
    </button>
  );
}

// ─── Bar chart custom tooltip ─────────────────────────────────────────────────
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[var(--border)] rounded px-3 py-2 shadow-sm text-[12px]">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }} className="font-medium">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function Pill({
  label, active, onClick, children,
}: { label: string; active: boolean; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-all select-none ${
        active
          ? "bg-black text-white border-black"
          : "bg-white text-[var(--muted-foreground)] border-[var(--border)] hover:border-neutral-400 hover:text-black"
      }`}
    >
      {children ?? label}
      <ChevronDown size={11} className={`transition-transform ${active ? "opacity-60" : "opacity-40"}`} />
    </button>
  );
}

function DropdownPill({
  label, active, options, value, onSelect,
}: {
  label: string; active: boolean;
  options: { value: string; label: string }[];
  value: string; onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-all select-none ${
          active
            ? "bg-black text-white border-black"
            : "bg-white text-[var(--muted-foreground)] border-[var(--border)] hover:border-neutral-400 hover:text-black"
        }`}
      >
        {current?.label ?? label}
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""} ${active ? "opacity-60" : "opacity-40"}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white border border-[var(--border)] rounded shadow-md z-30 min-w-[140px] overflow-hidden">
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onSelect(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[12px] font-medium transition-colors ${
                value === o.value
                  ? "bg-black text-white"
                  : "hover:bg-[var(--muted)] text-[var(--foreground)]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DatePill({
  label, value, onChange, active,
}: { label: string; value: string; onChange: (v: string) => void; active: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => inputRef.current?.showPicker()}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-all ${
          active
            ? "bg-black text-white border-black"
            : "bg-white text-[var(--muted-foreground)] border-[var(--border)] hover:border-neutral-400 hover:text-black"
        }`}
      >
        <Calendar size={11} className={active ? "opacity-60" : "opacity-40"} />
        {active && value ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : label}
        {active && (
          <span
            className="ml-0.5 opacity-50 hover:opacity-100"
            onClick={e => { e.stopPropagation(); onChange(""); }}
          >
            <X size={10} />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
      />
    </div>
  );
}

function FilterBar({
  search, onSearch,
  filterType, onType,
  filterRecurring, onRecurring,
  filterDateFrom, onDateFrom,
  filterDateTo, onDateTo,
  hasFilters, onClear,
}: {
  search: string; onSearch: (v: string) => void;
  filterType: "ALL" | "INCOME" | "EXPENSE"; onType: (v: "ALL" | "INCOME" | "EXPENSE") => void;
  filterRecurring: "ALL" | "YES" | "NO"; onRecurring: (v: "ALL" | "YES" | "NO") => void;
  filterDateFrom: string; onDateFrom: (v: string) => void;
  filterDateTo: string; onDateTo: (v: string) => void;
  hasFilters: boolean; onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search transactions…"
          className="w-full pl-9 pr-8 py-2 text-[12px] bg-white border border-[var(--border)] rounded-full focus:outline-none focus:border-black transition-colors placeholder:text-[var(--muted-foreground)]"
        />
        {search && (
          <button onClick={() => onSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-black">
            <X size={11} />
          </button>
        )}
      </div>

      {/* Type dropdown */}
      <DropdownPill
        label="Type"
        active={filterType !== "ALL"}
        value={filterType}
        options={[
          { value: "ALL", label: "All types" },
          { value: "INCOME", label: "↑ Income" },
          { value: "EXPENSE", label: "↓ Expense" },
        ]}
        onSelect={v => onType(v as any)}
      />

      {/* Recurring dropdown */}
      <DropdownPill
        label="Recurring"
        active={filterRecurring !== "ALL"}
        value={filterRecurring}
        options={[
          { value: "ALL", label: "All" },
          { value: "YES", label: "↺ Recurring" },
          { value: "NO", label: "One-time" },
        ]}
        onSelect={v => onRecurring(v as any)}
      />

      {/* Date pills */}
      <DatePill label="Start date" value={filterDateFrom} onChange={onDateFrom} active={!!filterDateFrom} />
      <DatePill label="End date" value={filterDateTo} onChange={onDateTo} active={!!filterDateTo} />

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-[11px] font-semibold text-[var(--danger)] px-2 py-1.5 rounded-full hover:bg-red-50 transition-colors"
        >
          <X size={10} /> Clear
        </button>
      )}
    </div>
  );
}


function TransactionDialog({
  open, onClose, accounts, defaultAccountId, defaultValues, onSubmit, loading, onScanReceipt, scanning,
}: {
  open: boolean; onClose: () => void; accounts: AccountResponse[];
  defaultAccountId?: string; defaultValues?: Partial<TxnForm>;
  onSubmit: (d: TxnForm) => void; loading: boolean;
  onScanReceipt: (f: File) => Promise<ReceiptScanResponse | null>; scanning: boolean;
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<TxnForm>({
    resolver: zodResolver(txnSchema) as any,
    defaultValues: defaultValues ?? {
      type: "EXPENSE",
      date: (function() {
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      })(),
      isRecurring: false,
      accountId: defaultAccountId ?? "",
    },
  });
  const isRecurring = watch("isRecurring");
  if (!open) return null;

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const r = await onScanReceipt(file);
    if (r) {
      setValue("amount", r.amount);
      setValue("category", r.category ?? "");
      setValue("description", r.merchantName ?? r.description ?? "");
      setValue("receiptUrl", r.receiptUrl ?? "");
      if (r.transactionDate) setValue("date", r.transactionDate.slice(0, 16));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded border border-[var(--border)] w-full max-w-lg shadow-xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-[15px] font-bold">{defaultValues ? "Edit Transaction" : "New Transaction"}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--muted)]"><X size={15} /></button>
        </div>

        {/* AI Receipt Scan CTA */}
        {!defaultValues && (
          <label className={`mx-6 mt-4 flex items-center gap-3 border-2 rounded-lg px-4 py-3 cursor-pointer transition-all
            ${scanning
              ? "border-black bg-black text-white"
              : "border-black bg-black text-white hover:bg-neutral-800"}`}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              {scanning ? <RefreshCw size={14} className="animate-spin" /> : <Camera size={14} />}
            </div>
            <div>
              <p className="text-[13px] font-bold">
                {scanning ? "Scanning receipt with AI…" : "Scan Receipt with AI"}
              </p>
              <p className="text-[11px] opacity-70 mt-0.5">
                {scanning ? "Extracting amount, category and date…" : "Auto-fill amount, date & category instantly"}
              </p>
            </div>
            <Sparkles size={14} className="ml-auto opacity-60 flex-shrink-0" />
            <input type="file" accept="image/*" className="hidden" onChange={handleScan} />
          </label>
        )}

        <form onSubmit={handleSubmit((d) => { onSubmit(d); reset(); })} className="p-6 space-y-4">
          {/* Type */}
          <div className="grid grid-cols-2 gap-2">
            {(["EXPENSE", "INCOME"] as const).map((t) => (
              <div key={t} onClick={() => setValue("type", t)}
                className={`border rounded-lg px-3 py-3 text-[13px] font-bold text-center cursor-pointer transition-all ${
                  watch("type") === t
                    ? t === "EXPENSE" ? "bg-black text-white border-black" : "bg-[var(--success)] text-white border-[var(--success)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-neutral-400"}`}
              >
                {t === "EXPENSE" ? "− Expense" : "+ Income"}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">Amount (₹)</label>
              <input {...register("amount")} type="number" step="0.01" placeholder="0.00"
                className="w-full border border-[var(--border)] rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-black" />
              {errors.amount && <p className="text-[11px] text-[var(--danger)] mt-1">Required</p>}
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">Date & Time</label>
              <input {...register("date")} type="datetime-local"
                className="w-full border border-[var(--border)] rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-black" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">Category</label>
              <select {...register("category")} className="w-full border border-[var(--border)] rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-black bg-white">
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.category && <p className="text-[11px] text-[var(--danger)] mt-1">Required</p>}
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">Account</label>
              <select {...register("accountId")} className="w-full border border-[var(--border)] rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-black bg-white">
                <option value="">Select…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {errors.accountId && <p className="text-[11px] text-[var(--danger)] mt-1">Required</p>}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">Description (optional)</label>
            <input {...register("description")} placeholder="e.g. Dinner with team"
              className="w-full border border-[var(--border)] rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-black" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register("isRecurring")} />
            <span className="text-[13px] flex items-center gap-1.5 font-medium"><RotateCcw size={12} /> Recurring</span>
          </label>
          {isRecurring && (
            <div>
              <select {...register("recurringInterval")} className="w-full border border-[var(--border)] rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-black bg-white">
                <option value="">Interval…</option>
                {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as RecurringInterval[]).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.recurringInterval && <p className="text-[11px] text-[var(--danger)] mt-1">{errors.recurringInterval.message as string}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-[var(--border)] rounded px-4 py-2.5 text-[13px] font-semibold hover:bg-[var(--muted)] transition-colors">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-black text-white rounded px-4 py-2.5 text-[13px] font-semibold hover:bg-neutral-800 disabled:opacity-50">
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({ open, onClose, onConfirm, loading }: { open: boolean, onClose: () => void, onConfirm: () => void, loading: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded border border-[var(--border)] w-full max-w-sm p-6 shadow-xl text-center">
        <div className="w-12 h-12 bg-[var(--danger-muted)] text-[var(--danger)] rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} />
        </div>
        <h2 className="text-[16px] font-bold mb-2">Delete Transaction?</h2>
        <p className="text-[13px] text-[var(--muted-foreground)] mb-6">
          This action cannot be undone. This will permanently delete the transaction and update your account balance.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border border-[var(--border)] rounded px-4 py-2.5 text-[13px] font-semibold hover:bg-[var(--muted)] transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="flex-1 bg-[var(--danger)] text-white rounded px-4 py-2.5 text-[13px] font-semibold hover:bg-red-700 disabled:opacity-50">
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function TransactionsInner() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL-based account scoping
  const scopedAccountId = searchParams.get("accountId") ?? "";
  const scopedAccountName = searchParams.get("name") ?? "";
  const scopedAccountType = searchParams.get("type") ?? "";
  const isScoped = !!scopedAccountId;

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "COMPLETED" | "FAILED">("ALL");
  const [filterRecurring, setFilterRecurring] = useState<"ALL" | "YES" | "NO">("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Bar chart click filter
  const [chartDateFilter, setChartDateFilter] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"Last Week" | "Last Month" | "Last 3 Months" | "Last 6 Months" | "All">("Last Month");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<TransactionResponse | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [page, setPage] = useState(0);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiFetch<AccountResponse[]>("/accounts", getToken),
  });

  // Fetch scoped or all transactions with pagination
  const endpoint = isScoped
    ? `/transactions/account/${scopedAccountId}?page=${page}&size=10&direction=desc`
    : `/transactions?page=${page}&size=10&direction=desc`;

  const { data: txnPage, isLoading } = useQuery({
    queryKey: ["txns-view", scopedAccountId, page],
    queryFn: () => apiFetch<Page<TransactionResponse>>(endpoint, getToken),
  });

  // ─── Chart data: group by day, filtered by time range ────────────────────
  const chartData = useMemo(() => {
    const all = txnPage?.content ?? [];
    const now = new Date();
    const cutoff = new Date(now);
    if (timeRange === "Last Week") cutoff.setDate(now.getDate() - 7);
    else if (timeRange === "Last Month") cutoff.setMonth(now.getMonth() - 1);
    else if (timeRange === "Last 3 Months") cutoff.setMonth(now.getMonth() - 3);
    else if (timeRange === "Last 6 Months") cutoff.setMonth(now.getMonth() - 6);

    const ranged = timeRange === "All" ? all : all.filter(t => new Date(t.date) >= cutoff);
    const map: Record<string, { income: number; expense: number }> = {};
    ranged.forEach((t) => {
      const day = t.date.slice(0, 10);
      if (!map[day]) map[day] = { income: 0, expense: 0 };
      if (t.type === "INCOME") map[day].income += t.amount;
      else map[day].expense += t.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        label: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        ...v,
      }));
  }, [txnPage, timeRange]);

  // Stats for scoped view
  const totalIncome = (txnPage?.content ?? []).filter(t => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpense = (txnPage?.content ?? []).filter(t => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalExpense;

  // ─── Client-side filter + sort ────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = txnPage?.content ?? [];
    const q = search.trim().toLowerCase();

    if (chartDateFilter) list = list.filter(t => t.date.slice(0, 10) === chartDateFilter);
    if (q) list = list.filter(t =>
      t.description?.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.accountName.toLowerCase().includes(q) ||
      String(t.amount).includes(q)
    );
    if (filterType !== "ALL") list = list.filter(t => t.type === filterType);
    if (filterStatus !== "ALL") list = list.filter(t => t.status === filterStatus);
    if (filterRecurring !== "ALL") list = list.filter(t => filterRecurring === "YES" ? t.isRecurring : !t.isRecurring);
    if (filterDateFrom) list = list.filter(t => new Date(t.date) >= new Date(filterDateFrom));
    if (filterDateTo) list = list.filter(t => new Date(t.date) <= new Date(filterDateTo + "T23:59:59"));

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortField === "amount") cmp = a.amount - b.amount;
      if (sortField === "category") cmp = a.category.localeCompare(b.category);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [txnPage, search, filterType, filterStatus, filterRecurring, filterDateFrom, filterDateTo, sortField, sortDir, chartDateFilter]);

  function toggleSort(f: SortField) {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("desc"); }
  }

  const hasFilters = search || filterType !== "ALL" || filterStatus !== "ALL" || filterRecurring !== "ALL" || filterDateFrom || filterDateTo || chartDateFilter;

  function clearFilters() {
    setSearch(""); setFilterType("ALL"); setFilterStatus("ALL");
    setFilterRecurring("ALL"); setFilterDateFrom(""); setFilterDateTo("");
    setChartDateFilter(null);
    setPage(0);
  }

  const createMut = useMutation({
    mutationFn: (d: CreateTransactionRequest) =>
      apiFetch<TransactionResponse>("/transactions", getToken, { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["txns-view"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); toast.success("Added."); setDialogOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<CreateTransactionRequest> }) =>
      apiFetch<TransactionResponse>(`/transactions/${id}`, getToken, { method: "PUT", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["txns-view"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); toast.success("Updated."); setEditTxn(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/transactions/${id}`, getToken, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["txns-view"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); toast.success("Deleted."); setDeleteId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleScanReceipt(file: File): Promise<ReceiptScanResponse | null> {
    setScanning(true);
    try {
      const token = await getToken();
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/receipts/scan`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) throw new Error("Scan failed");
      const data: ReceiptScanResponse = await res.json();
      toast.success("Receipt scanned — form pre-filled.");
      return data;
    } catch { toast.error("Could not scan receipt."); return null; }
    finally { setScanning(false); }
  }

  function submitCreate(data: TxnForm) {
    createMut.mutate({
      type: data.type, amount: data.amount, description: data.description,
      date: data.date.length === 16 ? data.date + ":00" : data.date, category: data.category,
      accountId: data.accountId, receiptUrl: data.receiptUrl,
      isRecurring: data.isRecurring,
      recurringInterval: data.isRecurring && data.recurringInterval ? data.recurringInterval as RecurringInterval : undefined,
    });
  }

  const scopedAccount = accounts.find(a => a.id === scopedAccountId);

  return (
    <div className="w-full space-y-5">
      {/* ── Account scoped header ──────────────────────────────────────────── */}
      {isScoped ? (
        <div>
          <button
            onClick={() => router.push("/accounts")}
            className="flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)] hover:text-black transition-colors mb-4"
          >
            <ArrowLeft size={13} /> Back to Accounts
          </button>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black text-white rounded-lg flex items-center justify-center">
                {scopedAccountType === "SAVINGS" ? <Building2 size={20} /> : <CreditCard size={20} />}
              </div>
              <div>
                <h1 className="text-[28px] font-black tracking-tight">{scopedAccountName}</h1>
                <p className="text-[var(--muted-foreground)] text-sm capitalize">{scopedAccountType?.toLowerCase()} Account</p>
              </div>
            </div>
            <div className="text-right">
              {scopedAccount && (
                <p className="text-[28px] font-black tracking-tight tabular-nums">{formatCurrency(scopedAccount.balance)}</p>
              )}
              <p className="text-[var(--muted-foreground)] text-sm">{txnPage?.totalElements ?? 0} Transactions</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-black tracking-tight">Transactions</h1>
            <p className="text-[var(--muted-foreground)] text-sm mt-1">
              {filtered.length} of {txnPage?.totalElements ?? 0} transactions
            </p>
          </div>
          <button onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 bg-black text-white text-[13px] font-semibold px-4 py-2.5 rounded hover:bg-neutral-800 transition-colors">
            <Plus size={14} />Add Transaction
          </button>
        </div>
      )}

      {/* ── Chart overview ────────────────────────────────────────────────── */}
      <div className="bg-white border border-[var(--border)] rounded p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[14px] font-bold">
              {isScoped ? "Transaction Overview" : "Spending Overview"}
            </h2>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
              {chartDateFilter ? `Filtered to ${chartDateFilter}` : "Click a bar to filter"}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-right">
            {/* Time range dropdown moved here */}
            <Select.Root value={timeRange} onValueChange={(r: any) => { setTimeRange(r); setChartDateFilter(null); }}>
              <Select.Trigger className="flex items-center justify-between gap-2 border border-[var(--border)] bg-white rounded px-3 py-1.5 text-[12px] font-semibold hover:bg-[var(--muted)] hover:border-neutral-400 transition-all data-[state=open]:border-black data-[state=open]:ring-1 data-[state=open]:ring-black shadow-sm w-[110px] outline-none">
                <Select.Value />
                <Select.Icon><ChevronDown size={14} className="opacity-50" /></Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content position="popper" sideOffset={4} className="bg-white border border-[var(--border)] rounded shadow-xl z-50 w-[110px] overflow-hidden">
                  <Select.Viewport className="p-1">
                    {(["Last Week", "Last Month", "Last 3 Months", "Last 6 Months", "All"] as const).map(r => (
                      <Select.Item key={r} value={r} className="text-[12px] font-semibold px-2 py-1.5 rounded cursor-pointer outline-none hover:bg-[var(--muted)] focus:bg-[var(--muted)] data-[state=checked]:bg-black data-[state=checked]:text-white select-none">
                        <Select.ItemText>{r}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
            
            {/* Stats */}
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--muted-foreground)]">Income</p>
              <p className="text-[16px] font-black text-[var(--success)] tabular-nums">{formatCurrency(totalIncome)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--muted-foreground)]">Expense</p>
              <p className="text-[16px] font-black text-[var(--danger)] tabular-nums">{formatCurrency(totalExpense)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--muted-foreground)]">Net</p>
              <p className={`text-[16px] font-black tabular-nums ${net >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {net >= 0 ? "+" : ""}{formatCurrency(net)}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="h-36 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-36 flex items-center justify-center text-[13px] text-[var(--muted-foreground)]">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barGap={2} margin={{ left: -15, right: 8, top: 4, bottom: 0 }}
              onClick={(e) => {
                if (e?.activeLabel) {
                  const day = chartData.find(d => d.label === e.activeLabel)?.date;
                  setChartDateFilter(prev => prev === day ? null : (day ?? null));
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a3a3a3" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#a3a3a3" }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: "#f5f5f5" }} />
              <Bar dataKey="income" name="Income" radius={[3, 3, 0, 0]} maxBarSize={32}>
                {chartData.map((entry, i) => (
                  <Cell key={i}
                    fill={chartDateFilter === entry.date ? "#15803d" : "#86efac"}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Bar>
              <Bar dataKey="expense" name="Expense" radius={[3, 3, 0, 0]} maxBarSize={32}>
                {chartData.map((entry, i) => (
                  <Cell key={i}
                    fill={chartDateFilter === entry.date ? "#dc2626" : "#fca5a5"}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {chartDateFilter && (
          <button onClick={() => setChartDateFilter(null)}
            className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[var(--danger)] hover:underline">
            <X size={10} /> Clear date filter ({chartDateFilter})
          </button>
        )}
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <FilterBar
        search={search} onSearch={setSearch}
        filterType={filterType} onType={setFilterType}
        filterRecurring={filterRecurring} onRecurring={setFilterRecurring}
        filterDateFrom={filterDateFrom} onDateFrom={setFilterDateFrom}
        filterDateTo={filterDateTo} onDateTo={setFilterDateTo}
        hasFilters={!!hasFilters} onClear={clearFilters}
      />

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[var(--border)] rounded overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_120px_120px_150px_90px_100px_130px] gap-3 px-5 py-3 border-b border-[var(--border)] bg-[var(--muted)]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Transaction</span>
          <SortBtn field="category" current={sortField} dir={sortDir} onClick={() => toggleSort("category")} label="Category" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Account</span>
          <SortBtn field="date" current={sortField} dir={sortDir} onClick={() => toggleSort("date")} label="Date" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Status</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Recurring</span>
          <SortBtn field="amount" current={sortField} dir={sortDir} onClick={() => toggleSort("amount")} label="Amount" />
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !filtered.length ? (
          <div className="py-16 text-center text-[var(--muted-foreground)] text-sm">
            {hasFilters ? <>No results. <button onClick={clearFilters} className="underline text-black">Clear filters</button></> : <>No transactions. <button onClick={() => setDialogOpen(true)} className="underline text-black">Add one</button></>}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((txn) => (
              <div key={txn.id}
                className="grid grid-cols-[1fr_120px_120px_150px_90px_100px_130px] gap-3 px-5 py-3.5 items-center hover:bg-[var(--muted)] transition-colors group">
                {/* Description */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${txn.type === "INCOME" ? "bg-[var(--success-muted)]" : "bg-[var(--danger-muted)]"}`}>
                    {txn.type === "INCOME" ? <ArrowUpRight size={13} className="text-[var(--success)]" /> : <ArrowDownLeft size={13} className="text-[var(--danger)]" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold truncate">{txn.description || txn.category}</p>
                  </div>
                </div>
                {/* Category */}
                <span className="text-[11px] font-medium bg-[var(--muted)] px-2 py-1 rounded truncate block">{txn.category}</span>
                {/* Account */}
                <span className="text-[11px] text-[var(--muted-foreground)] truncate">{txn.accountName}</span>
                {/* Date */}
                <span className="text-[12px] text-[var(--muted-foreground)]">{formatDateTime(txn.date)}</span>
                {/* Status */}
                <StatusBadge status={txn.status} />
                {/* Recurring */}
                <RecurringBadge isRecurring={txn.isRecurring} interval={txn.recurringInterval} />
                {/* Amount + actions */}
                <div className="flex items-center gap-2 justify-end">
                  <span className={`text-[13px] font-bold tabular-nums ${txn.type === "INCOME" ? "text-[var(--success)]" : ""}`}>
                    {txn.type === "INCOME" ? "+" : "-"}{formatCurrency(txn.amount)}
                  </span>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button onClick={() => setEditTxn(txn)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-white"><Pencil size={10} /></button>
                    <button onClick={() => setDeleteId(txn.id)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--danger-muted)] text-[var(--danger)]"><Trash2 size={10} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between">
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Showing {filtered.length} transaction{filtered.length !== 1 ? "s" : ""} on this page
            {hasFilters && ` (filtered from ${txnPage?.totalElements ?? 0})`}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="px-2 py-1 text-[11px] border border-[var(--border)] rounded font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--muted)]"
              >
                Previous
              </button>
              <span className="px-2 py-1 text-[11px] font-semibold text-[var(--muted-foreground)]">
                Page {page + 1} {txnPage ? `of ${Math.max(1, txnPage.totalPages)}` : ""}
              </span>
              <button
                disabled={txnPage ? page >= txnPage.totalPages - 1 : true}
                onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 text-[11px] border border-[var(--border)] rounded font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--muted)]"
              >
                Next
              </button>
            </div>
            {isScoped && (
              <button onClick={() => setDialogOpen(true)}
                className="flex items-center gap-2 bg-black text-white text-[12px] font-semibold px-3 py-2 rounded hover:bg-neutral-800 transition-colors">
                <Plus size={12} />Add Transaction
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <TransactionDialog
        open={dialogOpen} onClose={() => setDialogOpen(false)} accounts={accounts}
        defaultAccountId={scopedAccountId || undefined}
        onSubmit={submitCreate} loading={createMut.isPending}
        onScanReceipt={handleScanReceipt} scanning={scanning}
      />
      {editTxn && (
        <TransactionDialog
          open={true} onClose={() => setEditTxn(null)} accounts={accounts}
          defaultValues={{
            type: editTxn.type, amount: editTxn.amount, description: editTxn.description,
            date: editTxn.date.slice(0, 16), category: editTxn.category, accountId: editTxn.accountId,
            receiptUrl: editTxn.receiptUrl ?? undefined,
            isRecurring: editTxn.isRecurring, recurringInterval: editTxn.recurringInterval ?? undefined,
          }}
          onSubmit={(data) => updateMut.mutate({
            id: editTxn.id,
            d: { ...data, date: data.date.length === 16 ? data.date + ":00" : data.date, recurringInterval: data.isRecurring && data.recurringInterval ? data.recurringInterval as RecurringInterval : undefined },
          })}
          loading={updateMut.isPending}
          onScanReceipt={handleScanReceipt} scanning={scanning}
        />
      )}
      <DeleteConfirmDialog 
        open={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={() => {
          if (deleteId) deleteMut.mutate(deleteId);
        }} 
        loading={deleteMut.isPending} 
      />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TransactionsInner />
    </Suspense>
  );
}
