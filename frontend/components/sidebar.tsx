"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CreditCard, ArrowLeftRight, Target,
  Sparkles, Download, Shield, Menu, X, ChevronLeft, ChevronRight
} from "lucide-react";
import { UserButton, useUser, useAuth } from "@clerk/nextjs";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { UserResponse } from "@/types/api";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Accounts", href: "/accounts", icon: CreditCard },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { label: "Budget", href: "/budget", icon: Target },
  { label: "AI Insights", href: "/insights", icon: Sparkles },
  { label: "Export", href: "/export", icon: Download },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { getToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<UserResponse>("/users/me", getToken),
    staleTime: 5 * 60 * 1000, // 5 min — role rarely changes
  });

  const isAdmin = me?.role === "ADMIN";

  // Close sidebar on navigation on mobile
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.style.setProperty(
        "--sidebar-width",
        isCollapsed ? "80px" : "250px"
      );
    }
  }, [isCollapsed]);

  const SidebarContent = ({ isMobile = false }) => {
    // Mobile is never collapsed in the drawer.
    const collapse = !isMobile && isCollapsed;
    
    return (
      <div className="flex flex-col h-full w-full">
        {/* Logo Header */}
        <div className={cn("flex items-center h-20 border-b border-[var(--border)] shrink-0 relative transition-all duration-300", collapse ? "justify-center px-0" : "px-5 hover:bg-neutral-50")}>
          <Link href="/" className="flex items-center gap-3 overflow-hidden w-full">
            <Image src="/logo.png" alt="SpendSense Logo" width={38} height={38} className="object-contain shrink-0" />
            <span className={cn("text-[19px] font-black tracking-tight whitespace-nowrap transition-all duration-300", collapse ? "opacity-0 w-0" : "opacity-100")}>SpendSense</span>
          </Link>
          {/* Desktop Toggle Button */}
          {!isMobile && (
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="absolute -right-3 top-6 w-6 h-6 bg-white border border-[var(--border)] rounded-full flex items-center justify-center text-neutral-500 hover:text-black hover:shadow-sm transition-all z-10"
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
          <p className={cn("text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest px-3 mb-2 transition-all duration-300", collapse ? "opacity-0 text-center px-0" : "")}>
            {collapse ? "—" : "Menu"}
          </p>
          {nav.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center rounded text-[13px] font-medium transition-all group overflow-hidden whitespace-nowrap",
                  active
                    ? "bg-black text-white"
                    : "text-[var(--muted-foreground)] hover:text-black hover:bg-[var(--muted)]",
                  collapse ? "py-3 justify-center px-0" : "px-3 py-2.5 gap-3"
                )}
                title={collapse ? label : undefined}
              >
                <Icon size={collapse ? 20 : 15} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
                <span className={cn("transition-all duration-300", collapse ? "opacity-0 w-0" : "opacity-100 w-auto")}>{label}</span>
              </Link>
            );
          })}

          {isAdmin && (
          <div className="pt-4 mt-4 border-t border-[var(--border)]">
            <p className={cn("text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest px-3 mb-2 transition-all duration-300", collapse ? "opacity-0 text-center px-0" : "")}>
              {collapse ? "—" : "System"}
            </p>
            <Link
              href="/admin"
              className={cn(
                "flex items-center rounded text-[13px] font-medium transition-all group overflow-hidden whitespace-nowrap",
                pathname.startsWith("/admin")
                  ? "bg-black text-white"
                  : "text-[var(--muted-foreground)] hover:text-black hover:bg-[var(--muted)]",
                collapse ? "py-3 justify-center px-0" : "px-3 py-2.5 gap-3"
              )}
              title={collapse ? "Admin" : undefined}
            >
              <Shield size={collapse ? 20 : 15} className="shrink-0" />
              <span className={cn("transition-all duration-300", collapse ? "opacity-0 w-0" : "opacity-100 w-auto")}>Admin</span>
            </Link>
          </div>
          )}
        </nav>

        {/* User row */}
        <div className={cn("border-t border-[var(--border)] p-4 shrink-0 bg-neutral-50/50 transition-all duration-300", collapse ? "px-2" : "")}>
          <div className={cn("flex items-center", collapse ? "justify-center" : "gap-3")}>
            <div className="shrink-0">
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: collapse ? "w-10 h-10" : "w-8 h-8",
                    userButtonPopoverCard: "shadow-lg border border-[var(--border)] rounded",
                  },
                }}
              />
            </div>
            <div className={cn("min-w-0 transition-all duration-300 whitespace-nowrap overflow-hidden", collapse ? "opacity-0 w-0" : "opacity-100 flex-1")}>
              <p className="text-[13px] font-semibold truncate">{user?.fullName ?? "—"}</p>
              <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                {user?.primaryEmailAddress?.emailAddress ?? ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ── Mobile Floating Hamburger Button ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 w-10 h-10 bg-white border border-[var(--border)] rounded-lg flex items-center justify-center shadow-sm hover:shadow-md hover:bg-neutral-50 active:scale-95 transition-all text-black"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* ── Desktop Fixed Sidebar ── */}
      <aside
        className="hidden md:flex fixed inset-y-0 left-0 flex-col border-r border-[var(--border)] bg-white z-30 transition-[width] duration-300 ease-in-out"
        style={{ width: "var(--sidebar-width)" }}
      >
        <SidebarContent isMobile={false} />
      </aside>

      {/* ── Mobile Collapsible Overlay Drawer ── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            />
            {/* Slide-out Sidebar */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="md:hidden fixed inset-y-0 left-0 w-[280px] flex flex-col border-r border-[var(--border)] bg-white z-50 shadow-2xl"
            >
              <SidebarContent isMobile={true} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
