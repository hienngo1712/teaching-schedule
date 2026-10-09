import type vi from "@/language/vi.json"
import { isPeriod } from "@/lib/plans"
import { formatVnDate } from "@/lib/payment-notes"
import { formatTime } from "@/lib/utils"

export const SOURCE_KEY = { trial: "plan_source_trial", paid: "plan_source_paid", free: "plan_source_free" } as const

// Đơn admin đặt tay (setPlan) không có kỳ: period = null.
export function periodKey(p: string | null): keyof typeof vi {
  if (!isPeriod(p)) return "plan_order_by_admin"
  return p === "2year" ? "plan_period_2year" : p
}

export function dateOrDash(d: string | Date | null): string {
  return d ? formatVnDate(new Date(d)) : "-"
}

// Giờ VN (UTC+7) cho lịch sử cấu hình: server chạy UTC, formatTime đọc giờ UTC nên cộng 7 giờ trước.
export function dateTimeVn(d: string): string {
  const date = new Date(d)
  return `${formatVnDate(date)} ${formatTime(new Date(date.getTime() + 7 * 60 * 60 * 1000))}`
}

// "dd/mm HH:mm" giờ VN cho dòng "Cập nhật lúc".
export function shortDateTimeVn(d: string): string {
  const date = new Date(d)
  return `${formatVnDate(date).slice(0, 5)} ${formatTime(new Date(date.getTime() + 7 * 60 * 60 * 1000))}`
}

// "HH:mm dd/mm" giờ VN cho câu "Đã chuyển ... lúc ..." của đơn payOS cần xử lý.
export function timeDayVn(d: string): string {
  const date = new Date(d)
  return `${formatTime(new Date(date.getTime() + 7 * 60 * 60 * 1000))} ${formatVnDate(date).slice(0, 5)}`
}

export function fillMonth(template: string, { year, month }: { year: number; month: number }): string {
  return template.replace("{m}", String(month)).replace("{y}", String(year))
}

