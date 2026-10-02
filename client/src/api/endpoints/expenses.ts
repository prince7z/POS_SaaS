import { apiBlob, apiRequest } from '../client'

export const EXPENSE_CATEGORIES = [
  'RENT',
  'SALARY',
  'ELECTRICITY',
  'MARKETING',
  'MAINTENANCE',
  'TRANSPORT',
  'PACKAGING',
  'OFFICE_SUPPLIES',
  'OTHER',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type ExpenseSortBy = 'expenseDate' | 'amount' | 'createdAt'

export interface Expense {
  id: string
  expenseDate: string
  category: ExpenseCategory
  otherCategoryName: string | null
  description: string
  amount: number
  notes: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string } | null
}

export interface ExpenseFilters {
  page?: number
  limit?: number
  search?: string
  category?: ExpenseCategory
  from?: string
  to?: string
  sortBy?: ExpenseSortBy
  sortOrder?: 'asc' | 'desc'
}

export interface ExpenseSummary {
  totalExpenses: number
  expenseCount: number
  averageExpense: number
  largestExpense: number
}

export interface ExpenseAnalytics {
  trend: Array<{ period: string; amount: number }>
  categoryBreakdown: Array<{ category: string; amount: number; percentage: number }>
  largestExpenses: Array<{ expenseDate: string; category: string; description: string; amount: number }>
  trendByCategory: Array<{ period: string; category: string; amount: number }>
  filters: { from: string; to: string }
}

export interface ExpenseInput {
  expenseDate: string
  category: ExpenseCategory
  otherCategoryName?: string | null
  description: string
  amount: number
  notes?: string | null
}

function query(filters: object) {
  const params = new URLSearchParams()
  Object.entries(filters as Record<string, string | number | undefined>).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.toString() ? `?${params.toString()}` : ''
}

export function getExpenses(filters: ExpenseFilters) {
  return apiRequest<{
    items: Expense[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>(`/expenses${query({ ...filters, page: filters.page ?? 1, limit: filters.limit ?? 20 })}`)
}

export function getExpense(id: string) {
  return apiRequest<Expense>(`/expenses/${id}`)
}

export function createExpense(input: ExpenseInput) {
  return apiRequest<Expense>('/expenses', { method: 'POST', body: JSON.stringify(input) })
}

export function updateExpense(id: string, input: Partial<ExpenseInput>) {
  return apiRequest<Expense>(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteExpense(id: string) {
  return apiRequest<void>(`/expenses/${id}`, { method: 'DELETE' })
}

export function getExpenseSummary(filters: Pick<ExpenseFilters, 'from' | 'to' | 'category'>) {
  return apiRequest<ExpenseSummary>(`/expenses/summary${query(filters)}`)
}

export function getExpenseAnalytics(filters: Pick<ExpenseFilters, 'from' | 'to' | 'category'>) {
  return apiRequest<ExpenseAnalytics>(`/expenses/analytics${query(filters)}`)
}

export function exportExpenses(filters: ExpenseFilters) {
  return apiBlob(`/expenses/export${query(filters)}`)
}
