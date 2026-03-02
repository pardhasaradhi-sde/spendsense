"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Mail, FileText, Table } from "lucide-react";
import { API_BASE } from "@/lib/api";

export default function ExportPage() {
  const { getToken } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [emailLoading, setEmailLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);

  function buildQuery() {
    const p = new URLSearchParams();
    if (startDate) p.set("startDate", startDate + "T00:00:00");
    if (endDate) p.set("endDate", endDate + "T23:59:59");
    return p.toString() ? `?${p.toString()}` : "";
  }

  async function handleDownload(type: "csv" | "pdf") {
    setDownloadLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/export/${type}${buildQuery()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions_${Date.now()}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} downloaded.`);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setDownloadLoading(false);
    }
  }

  async function handleEmail() {
    setEmailLoading(true);
    try {
      const token = await getToken();
      const p = new URLSearchParams({ format });
      if (startDate) p.set("startDate", startDate + "T00:00:00");
      if (endDate) p.set("endDate", endDate + "T23:59:59");

      const res = await fetch(`${API_BASE}/export/email?${p.toString()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Export will be sent to your email shortly.");
    } catch {
      toast.error("Could not send email. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-[28px] font-black tracking-tight">Export</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Download or email your transaction history.
        </p>
      </div>

      {/* Date range */}
      <div className="border border-[var(--border)] rounded p-5 space-y-4">
        <h2 className="text-[14px] font-bold">Date Range (optional)</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-[var(--border)] rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1.5">
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-[var(--border)] rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-black"
            />
          </div>
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(""); setEndDate(""); }}
            className="text-[12px] text-[var(--muted-foreground)] hover:text-black underline"
          >
            Clear dates (export all)
          </button>
        )}
      </div>

      {/* Direct download options */}
      <div className="border border-[var(--border)] rounded p-5 space-y-4">
        <h2 className="text-[14px] font-bold">Direct Download</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleDownload("csv")}
            disabled={downloadLoading}
            className="flex items-center gap-3 border border-[var(--border)] rounded p-4 hover:border-black hover:bg-[var(--muted)] transition-all disabled:opacity-50 text-left"
          >
            <Table size={18} />
            <div>
              <p className="text-[13px] font-bold">CSV</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">Spreadsheet format</p>
            </div>
            <Download size={14} className="ml-auto text-[var(--muted-foreground)]" />
          </button>
          <button
            onClick={() => handleDownload("pdf")}
            disabled={downloadLoading}
            className="flex items-center gap-3 border border-[var(--border)] rounded p-4 hover:border-black hover:bg-[var(--muted)] transition-all disabled:opacity-50 text-left"
          >
            <FileText size={18} />
            <div>
              <p className="text-[13px] font-bold">PDF</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">Print-ready report</p>
            </div>
            <Download size={14} className="ml-auto text-[var(--muted-foreground)]" />
          </button>
        </div>
      </div>

      {/* Email export */}
      <div className="border border-[var(--border)] rounded p-5 space-y-4">
        <h2 className="text-[14px] font-bold">Send via Email</h2>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Generate the export and receive a secure download link in your inbox.
        </p>
        <div className="flex items-center gap-3">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "csv" | "pdf")}
            className="border border-[var(--border)] rounded px-3 py-2.5 text-[13px] focus:outline-none focus:border-black bg-white"
          >
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
          <button
            onClick={handleEmail}
            disabled={emailLoading}
            className="flex items-center gap-2 bg-black text-white text-[13px] font-semibold px-5 py-2.5 rounded hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            <Mail size={14} />
            {emailLoading ? "Sending…" : "Send to Email"}
          </button>
        </div>
      </div>
    </div>
  );
}
