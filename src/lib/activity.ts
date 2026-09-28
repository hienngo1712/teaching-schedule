// Thuần: ngày VN cho dữ liệu hoạt động (spec K nhóm B).
import { vnDateParts } from "@/lib/utils"

// ≤ 1 lần ghi/giờ/người nhưng Active 24h vẫn chính xác tới 1 giờ (spec K B2).
export const ACTIVITY_TOUCH_MS = 60 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, "0")

export function vnDayKey(d: Date): string {
  const { year, month, day } = vnDateParts(d)
  return `${year}-${pad(month)}-${pad(day)}`
}

// Prisma ghi cột @db.Date theo phần ngày UTC: nửa đêm UTC giữ đúng ngày VN.
export function vnDayDate(d: Date): Date {
  const { year, month, day } = vnDateParts(d)
  return new Date(Date.UTC(year, month - 1, day))
}

export function shouldTouch(lastActiveAt: Date | null, now: Date): boolean {
  if (!lastActiveAt) return true
  if (now.getTime() - lastActiveAt.getTime() >= ACTIVITY_TOUCH_MS) return true
  return vnDayKey(lastActiveAt) !== vnDayKey(now)
}
