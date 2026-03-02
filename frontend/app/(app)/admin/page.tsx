"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Trash2, ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { UserResponse, UserRole } from "@/types/api";
import { useState } from "react";

export default function AdminPage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // Check current user role
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<UserResponse>("/users/me", getToken),
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<UserResponse[]>("/admin/users", getToken),
    enabled: me?.role === "ADMIN",
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      apiFetch<UserResponse>(`/admin/users/${id}/role?role=${role}`, getToken, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Role updated."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/admin/users/${id}`, getToken, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User deleted."); setDeleteUserId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (me && me.role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Shield size={32} className="text-[var(--muted-foreground)]" />
        <h2 className="text-[18px] font-bold">Access Denied</h2>
        <p className="text-[var(--muted-foreground)] text-sm">You don't have admin privileges.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[900px]">
      <div>
        <h1 className="text-[28px] font-black tracking-tight">Admin</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          {users.length} registered users
        </p>
      </div>

      <div className="border border-[var(--border)] rounded overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-[var(--border)] bg-[var(--muted)]">
          {["User", "Email", "Role", "Joined", "Actions"].map((h) => (
            <p key={h} className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              {h}
            </p>
          ))}
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !users.length ? (
          <div className="py-16 text-center text-[var(--muted-foreground)] text-sm">No users found.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {users.map((user) => (
              <div key={user.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-4 items-center hover:bg-[var(--muted)] transition-colors">
                {/* User */}
                <div className="flex items-center gap-3 min-w-0">
                  {user.imageUrl ? (
                    <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {user.name?.[0] ?? "U"}
                    </div>
                  )}
                  <p className="text-[13px] font-semibold truncate">{user.name ?? "—"}</p>
                </div>

                {/* Email */}
                <p className="text-[12px] text-[var(--muted-foreground)] truncate max-w-[200px]">
                  {user.email ?? "—"}
                </p>

                {/* Role select */}
                <div className="relative">
                  <select
                    value={user.role}
                    onChange={(e) => roleMutation.mutate({ id: user.id, role: e.target.value as UserRole })}
                    className={`appearance-none border rounded px-2.5 py-1.5 text-[11px] font-semibold pr-6 cursor-pointer transition-colors ${
                      user.role === "ADMIN"
                        ? "bg-black text-white border-black"
                        : "bg-[var(--muted)] border-[var(--border)]"
                    }`}
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                </div>

                {/* Joined */}
                <p className="text-[12px] text-[var(--muted-foreground)] whitespace-nowrap">
                  {formatDate(user.createdAt)}
                </p>

                {/* Delete */}
                <button
                  onClick={() => setDeleteUserId(user.id)}
                  disabled={user.id === me?.id}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--danger-muted)] hover:text-[var(--danger)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        onConfirm={() => deleteUserId && deleteMutation.mutate(deleteUserId)}
        loading={deleteMutation.isPending}
        title="Delete User?"
        message="This is irreversible. This user will lose all their accounts and transactions."
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
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
