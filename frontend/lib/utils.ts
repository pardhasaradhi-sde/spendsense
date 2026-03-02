import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
}

export function formatDateTime(dateString: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export function toBackendDate(date: Date): string {
  return date.toISOString().slice(0, 19);
}

export const CATEGORIES = [
  "Food & Dining",
  "Transport",
  "Shopping",
  "Housing",
  "Utilities",
  "Healthcare",
  "Entertainment",
  "Education",
  "Travel",
  "Groceries",
  "Salary",
  "Freelance",
  "Investment",
  "Other",
];
