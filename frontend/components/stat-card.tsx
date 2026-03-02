"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: number;
  trendLabel?: string;
  variant?: "default" | "inverted";
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  variant = "default",
}: StatCardProps) {
  const inverted = variant === "inverted";

  const TrendIcon =
    trend === undefined ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor =
    trend === undefined
      ? ""
      : trend > 0
      ? "text-[var(--success)]"
      : trend < 0
      ? "text-[var(--danger)]"
      : "text-[var(--muted-foreground)]";

  return (
    <div
      className={cn(
        "relative rounded-xl p-5 flex flex-col gap-4 shadow-md overflow-hidden group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl",
        inverted
          ? "bg-gradient-to-br from-[#171717] to-[#0a0a0a] text-white border border-transparent"
          : "bg-white text-[var(--foreground)] border border-[var(--border)]"
      )}
    >
      {/* Interactive Hover Gradient */}
      <div 
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
          inverted 
            ? "bg-gradient-to-tr from-white/10 via-transparent to-white/5" 
            : "bg-gradient-to-tr from-[var(--brand-muted)] via-transparent to-transparent"
        )} 
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between">
        <p
          className={cn(
            "text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em]",
            inverted ? "text-neutral-400" : "text-[var(--muted-foreground)]"
          )}
        >
          {label}
        </p>
        {Icon && (
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shadow-sm shrink-0 transition-transform duration-300 group-hover:scale-110",
              inverted ? "bg-white/10 text-white" : "bg-[var(--muted)] text-black"
            )}
          >
            <Icon size={14} />
          </div>
        )}
      </div>

      {/* Main Value */}
      <div className="relative z-10 mt-auto">
        <p className={cn(
          "text-2xl sm:text-3xl font-black tracking-tight tabular-nums transition-transform duration-300 origin-left",
          "group-hover:scale-105"
        )}>
          {value}
        </p>
      </div>

      {/* Footer / Trend */}
      {trend !== undefined && TrendIcon && (
        <div className="relative z-10 flex items-center gap-1.5 mt-2">
          <TrendIcon size={14} className={trendColor} />
          <span className={cn("text-[13px] font-bold", trendColor)}>
            {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && (
            <span
              className={cn(
                "text-[12px] font-medium opacity-80",
                inverted ? "text-neutral-400" : "text-[var(--muted-foreground)]"
              )}
            >
              {trendLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
