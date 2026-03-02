// ─── Enums ─────────────────────────────────────────────────────────────────────
export type AccountType = "CURRENT" | "SAVINGS";
export type TransactionType = "INCOME" | "EXPENSE";
export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED";
export type RecurringInterval = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type UserRole = "USER" | "ADMIN";

// ─── User ──────────────────────────────────────────────────────────────────────
export interface UserResponse {
  id: string;
  clerkUserId: string;
  email: string;
  name: string;
  imageUrl: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

// ─── Account ───────────────────────────────────────────────────────────────────
export interface AccountResponse {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountRequest {
  name: string;
  type: AccountType;
  balance: number;
  isDefault?: boolean;
}

export interface UpdateAccountRequest {
  name?: string;
  type?: AccountType;
  balance?: number;
  isDefault?: boolean;
}

// ─── Transaction ───────────────────────────────────────────────────────────────
export interface TransactionResponse {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  category: string;
  receiptUrl: string | null;
  isRecurring: boolean;
  recurringInterval: RecurringInterval | null;
  status: TransactionStatus;
  accountId: string;
  accountName: string;
  createdAt: string;
}

export interface CreateTransactionRequest {
  type: TransactionType;
  amount: number;
  description?: string;
  date: string;
  category: string;
  accountId: string;
  receiptUrl?: string;
  isRecurring?: boolean;
  recurringInterval?: RecurringInterval;
}

export interface UpdateTransactionRequest {
  type?: TransactionType;
  amount?: number;
  description?: string;
  date?: string;
  category?: string;
  accountId?: string;
  receiptUrl?: string;
  isRecurring?: boolean;
  recurringInterval?: RecurringInterval;
}

// ─── Budget ────────────────────────────────────────────────────────────────────
export interface BudgetResponse {
  id: string;
  amount: number;
  lastAlertSent: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Analytics ─────────────────────────────────────────────────────────────────
export interface AnalyticsResponse {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  categoryBreakdown: Record<string, number>;
  monthlyTrends: Record<string, number>;
  topSpendingCategories: Array<Record<string, unknown>>;
  averageMonthlyExpense: number;
  transactionCount: number;
  savingsRate: number;
  periodStart: string;
  periodEnd: string;
}

// ─── AI Insights ───────────────────────────────────────────────────────────────
export interface SpendingInsightResponse {
  summary: string;
  recommendations: string[];
  patterns: string[];
  topCategories: string[];
  anomalies: string[];
}

// ─── Receipt ───────────────────────────────────────────────────────────────────
export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}
export interface ReceiptScanResponse {
  merchantName: string;
  amount: number;
  transactionDate: string;
  category: string;
  description: string;
  receiptUrl: string;
  confidence: number;
  paymentMethod: string;
  taxAmount: string;
  items: ReceiptItem[];
}

// ─── Pagination ────────────────────────────────────────────────────────────────
export interface Page<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

// ─── Error ─────────────────────────────────────────────────────────────────────
export interface ApiError {
  status: number;
  message: string;
}
