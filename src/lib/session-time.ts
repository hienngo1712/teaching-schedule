import { vnDateParts } from "@/lib/utils"

const VN_OFFSET_MS = 7 * 60 * 60 * 1000

// Ngày VN hôm nay ở cùng dạng sessionDate (@db.Date lưu nửa đêm UTC).
export function vnToday(now: Date = new Date()): Date {
  const { year, month, day } = vnDateParts(now)
  return new Date(Date.UTC(year, month - 1, day))
}

// endTime lưu giờ tường VN trong thành phần UTC → so với giờ tường VN của now, không phải now UTC (lệch 7h).
export function hasSessionEnded(session: { sessionDate: Date; endTime: Date }, now: Date = new Date()): boolean {
  const d = session.sessionDate
  const t = session.endTime
  const endWallMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds())
  return endWallMs <= now.getTime() + VN_OFFSET_MS
}
