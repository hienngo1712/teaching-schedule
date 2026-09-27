import type vi from "@/language/vi.json"
import { isPeriod } from "@/lib/plans"
import { formatVnDate } from "@/lib/payment-notes"

export const SOURCE_KEY = { trial: "plan_source_trial", paid: "plan_source_paid", free: "plan_source_free" } as const

// Đơn admin đặt tay (setPlan) không có kỳ: period = null.
export function periodKey(p: string | null): keyof typeof vi {
  if (!isPeriod(p)) return "plan_order_by_admin"
  return p === "2year" ? "plan_period_2year" : p
}

export function dateOrDash(d: string | null): string {
  return d ? formatVnDate(new Date(d)) : "-"
}
