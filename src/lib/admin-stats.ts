// Thuần: số liệu màn Tổng quan admin (spec K nhóm A, T). users truyền vào đã loại admin.
import { vnDayKey } from "@/lib/activity"
import { isPaidPlan } from "@/lib/plans"

export const EXPIRING_DAYS = 30
// "Còn hoạt động" cho thẻ Standard sau dùng thử: khớp phiên ghi nhớ 30 ngày (spec K A7).
export const STILL_ACTIVE_DAYS = 30
export const TREND_RANGES = [7, 14, 30] as const
export type TrendRange = (typeof TREND_RANGES)[number]

export type StatUser = { isActive: boolean; plan: string; planExpiresAt: Date | null; trialEndsAt: Date | null; lastActiveAt: Date | null }
export type AccountCards = {
  totalAccounts: number
  activeAccounts: number
  active24h: number
  paying: { plus: number; pro: number }
  trial: number
  expiringSoon: { paid: number; trial: number }
  standardAfterTrial: number
}
export type DayCount = { day: string; count: number }
export type TrendDay = { day: string; newAccounts: number; returning: number; isToday: boolean }
export type AccountTrend = {
  days: TrendDay[]
  totals: { newAccounts: number; avgPerDay: number; returning: number; busiestDay: DayCount | null }
  trackingSince: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

export function computeAccountCards(users: StatUser[], now: Date): AccountCards {
  const c: AccountCards = {
    totalAccounts: users.length,
    activeAccounts: 0,
    active24h: 0,
    paying: { plus: 0, pro: 0 },
    trial: 0,
    expiringSoon: { paid: 0, trial: 0 },
    standardAfterTrial: 0,
  }
  const t = now.getTime()
  const soon = t + EXPIRING_DAYS * DAY_MS
  for (const u of users) {
    // Tài khoản khóa không dùng được app: không tính vào các thẻ gói và hoạt động (spec K A3, U U26).
    if (!u.isActive) continue
    if (u.lastActiveAt && u.lastActiveAt.getTime() >= t - DAY_MS) c.active24h++
    c.activeAccounts++
    const plan = u.plan
    if (isPaidPlan(plan) && u.planExpiresAt && u.planExpiresAt.getTime() > t) {
      c.paying[plan]++
      if (u.planExpiresAt.getTime() <= soon) c.expiringSoon.paid++
      continue
    }
    if (u.trialEndsAt && u.trialEndsAt.getTime() > t) {
      c.trial++
      if (u.trialEndsAt.getTime() <= soon) c.expiringSoon.trial++
      continue
    }
    if (u.trialEndsAt && u.lastActiveAt && u.lastActiveAt.getTime() >= t - STILL_ACTIVE_DAYS * DAY_MS) c.standardAfterTrial++
  }
  return c
}

export function lastNDays(now: Date, n: number): string[] {
  const [y, m, d] = vnDayKey(now).split("-").map(Number)
  const base = Date.UTC(y, m - 1, d)
  return Array.from({ length: n }, (_, i) => new Date(base - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10))
}

export function buildAccountTrend(days: string[], newRows: DayCount[], returningRows: DayCount[], trackingSince: string | null): AccountTrend {
  const fresh = new Map(newRows.map((r) => [r.day, r.count]))
  const back = new Map(returningRows.map((r) => [r.day, r.count]))
  const out = days.map((day, i) => ({ day, newAccounts: fresh.get(day) ?? 0, returning: back.get(day) ?? 0, isToday: i === days.length - 1 }))
  let busiestDay: DayCount | null = null
  // Duyệt cũ → mới với >=: hòa thì lấy ngày gần hơn (spec K T4).
  for (const d of out) if (d.newAccounts > 0 && (!busiestDay || d.newAccounts >= busiestDay.count)) busiestDay = { day: d.day, count: d.newAccounts }
  const newAccounts = out.reduce((s, d) => s + d.newAccounts, 0)
  return {
    days: out,
    totals: {
      newAccounts,
      avgPerDay: days.length ? Math.round((newAccounts / days.length) * 10) / 10 : 0,
      returning: out.reduce((s, d) => s + d.returning, 0),
      busiestDay,
    },
    trackingSince,
  }
}
