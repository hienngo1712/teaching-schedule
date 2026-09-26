import type vi from "@/language/vi.json"
import { STUDENT_LIMITS, type Plan } from "@/lib/plans"

type T = (key: keyof typeof vi) => string

// Chữ popup khi đủ giới hạn HS đang học (spec 8.4). Pro không có giới hạn nên không gọi tới.
export function studentLimitMessage(t: T, plan: Plan, limit: number): string {
  return plan === "standard"
    ? t("plan_limit_std").replace("{limit}", String(limit)).replace("{plusLimit}", String(STUDENT_LIMITS.plus))
    : t("plan_limit_plus").replace("{limit}", String(limit))
}
