"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2, CreditCard, Building2, Star, ArrowRight } from "lucide-react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AccountResponse, CreateAccountRequest } from "@/types/api";


// ─── Schema ─────────────────────────────────────────────────────────────────────
const accountSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  type: z.enum(["CURRENT", "SAVINGS"]),
  balance: z.coerce.number().min(0, "Balance cannot be negative"),
  isDefault: z.boolean().optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

// ─── Account Card (ATM Style) ──────────────────────────────────────────────────
function AccountCard({
  account,
  onEdit,
  onDelete,
}: {
  account: AccountResponse;
  onEdit: (a: AccountResponse) => void;
  onDelete: (id: string) => void;
}) {
  // Derive gradient based on account type
  const isSavings = account.type === "SAVINGS";
  const bgClass = isSavings
    ? "bg-gradient-to-br from-[#ea580c] to-[#9a3412] text-white" // Saffron ATM card
    : "bg-gradient-to-br from-[#171717] to-[#0a0a0a] text-white"; // Black ATM card

  return (
    <div className={`rounded-xl p-5 flex flex-col justify-between relative shadow-lg h-48 group transition-transform hover:-translate-y-1 ${bgClass} z-10`}>
      {/* Decorative reflection overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none rounded-xl" />
      
      {/* Header: Chip and Menu */}
      <div className="flex items-start justify-between relative z-10 w-full">
        <div className="w-10 h-7 bg-gradient-to-br from-[#fcd34d] to-[#eab308] rounded-md flex items-center justify-center opacity-90 shadow-sm border border-[#ca8a04]/50 overflow-hidden">
          {/* SIM chip lines */}
          <div className="w-full h-full flex flex-col justify-between opacity-40 mix-blend-multiply py-[2px]">
            <div className="flex justify-between px-[2px] w-full">
               <div className="w-3 h-[1px] bg-black"></div>
               <div className="w-3 h-[1px] bg-black"></div>
            </div>
            <div className="flex justify-between px-[2px] w-full mt-auto">
               <div className="w-3 h-[1px] bg-black"></div>
               <div className="w-3 h-[1px] bg-black"></div>
            </div>
          </div>
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors outline-none data-[state=open]:bg-white/20">
              <MoreHorizontal size={15} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="bg-white border border-[var(--border)] rounded shadow-xl z-[100] w-32 overflow-hidden text-black p-1 animate-in fade-in slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-top-1"
            >
              <DropdownMenu.Item
                onClick={() => onEdit(account)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-[12px] font-semibold rounded cursor-pointer outline-none hover:bg-[var(--muted)] focus:bg-[var(--muted)] transition-colors select-none"
              >
                <Pencil size={12} /> Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => onDelete(account.id)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-[12px] font-semibold text-[var(--danger)] rounded cursor-pointer outline-none hover:bg-[var(--danger-muted)] focus:bg-[var(--danger-muted)] transition-colors select-none"
              >
                <Trash2 size={12} /> Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Middle: Balance */}
      <div className="relative z-10 flex-1 flex flex-col justify-center mt-2">
        <p className="text-[26px] font-black tracking-widest tabular-nums drop-shadow-sm">
          {formatCurrency(account.balance)}
        </p>
      </div>

      {/* Footer: Name, Type, and CTA */}
      <div className="relative z-10 flex items-end justify-between w-full">
        <div>
          <p className="text-[14px] font-bold uppercase tracking-widest leading-none mb-1 shadow-black/10">
            {account.name}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold opacity-70">
              {account.type}
            </p>
            {account.isDefault && (
              <span className="flex items-center gap-0.5 text-[9px] uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded-sm">
                <Star size={8} fill="currentColor" /> Default
              </span>
            )}
          </div>
        </div>
        
        <Link
          href={`/transactions?accountId=${account.id}&name=${encodeURIComponent(account.name)}&type=${account.type}`}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors border border-white/20 backdrop-blur-sm group/link shrink-0"
          title="View Transactions"
        >
          <ArrowRight size={14} className="group-hover/link:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}


// ─── Account Dialog ────────────────────────────────────────────────────────────
function AccountDialog({
  open,
  onClose,
  defaultValues,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  defaultValues?: Partial<AccountForm>;
  onSubmit: (data: AccountForm) => void;
  loading: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema) as any,
    defaultValues: defaultValues ?? { type: "CURRENT", balance: 0, isDefault: false },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded border border-[var(--border)] w-full max-w-md p-6 shadow-lg">
        <h2 className="text-[16px] font-bold mb-5">
          {defaultValues ? "Edit Account" : "New Account"}
        </h2>

        <form onSubmit={handleSubmit((d) => { onSubmit(d); reset(); })} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">
              Account Name
            </label>
            <input
              {...register("name")}
              placeholder="e.g. HDFC Savings"
              className="w-full border border-[var(--border)] rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors"
            />
            {errors.name && <p className="text-[11px] text-[var(--danger)] mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">
              Type
            </label>
            <select
              {...register("type")}
              className="w-full border border-[var(--border)] rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-black bg-white"
            >
              <option value="CURRENT">Current</option>
              <option value="SAVINGS">Savings</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">
              Initial Balance (₹)
            </label>
            <input
              {...register("balance")}
              type="number"
              step="0.01"
              placeholder="0.00"
              className="w-full border border-[var(--border)] rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-black transition-colors"
            />
            {errors.balance && <p className="text-[11px] text-[var(--danger)] mt-1">{errors.balance.message}</p>}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register("isDefault")} className="rounded" />
            <span className="text-[13px]">Set as default account</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-[var(--border)] rounded px-4 py-2.5 text-[13px] font-semibold hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-black text-white rounded px-4 py-2.5 text-[13px] font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({ open, onClose, onConfirm, loading, title, message }: { open: boolean, onClose: () => void, onConfirm: () => void, loading: boolean, title: string, message: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded border border-[var(--border)] w-full max-w-sm p-6 shadow-xl text-center">
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
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<AccountResponse | null>(null);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiFetch<AccountResponse[]>("/accounts", getToken),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateAccountRequest) =>
      apiFetch<AccountResponse>("/accounts", getToken, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account created.");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAccountRequest> }) =>
      apiFetch<AccountResponse>(`/accounts/${id}`, getToken, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account updated.");
      setEditAccount(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<null>(`/accounts/${id}`, getToken, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account deleted.");
      setDeleteAccountId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="space-y-8 max-w-[1000px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-black tracking-tight">Accounts</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">
            Total Balance:{" "}
            <span className="font-bold text-black">{formatCurrency(totalBalance)}</span>
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 bg-black text-white text-[13px] font-semibold px-4 py-2.5 rounded hover:bg-neutral-800 transition-colors"
        >
          <Plus size={14} />
          New Account
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              onEdit={(acc) => setEditAccount(acc)}
              onDelete={(id) => setDeleteAccountId(id)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />
      {editAccount && (
        <AccountDialog
          open={true}
          onClose={() => setEditAccount(null)}
          defaultValues={{
            name: editAccount.name,
            type: editAccount.type,
            balance: editAccount.balance,
            isDefault: editAccount.isDefault,
          }}
          onSubmit={(data) => updateMutation.mutate({ id: editAccount.id, data })}
          loading={updateMutation.isPending}
        />
      )}
      <DeleteConfirmDialog
        open={!!deleteAccountId}
        onClose={() => setDeleteAccountId(null)}
        onConfirm={() => deleteAccountId && deleteMutation.mutate(deleteAccountId)}
        loading={deleteMutation.isPending}
        title="Delete Account?"
        message="This action cannot be undone. All transactions associated with this account will be permanently lost."
      />
    </div>
  );
}
