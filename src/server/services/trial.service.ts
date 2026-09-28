import type { PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { DEFAULT_TRIAL_DAYS, trialDaysOf, trialEndFor } from "@/lib/plans"
import { isAdminUsername } from "@/lib/admin"
import type { SetUserTrialInput, UpdateTrialDaysInput } from "@/lib/schemas/plan"
import type { Db } from "./plan.service"
import { SETTINGS_LOCK_CLASS } from "./plan-price.service"
import { markSeenIfNew } from "./new-accounts.service"

const TRIAL_LOCK_KEY = 1
const CHANGE_SELECT = { id: true, days: true, previousDays: true, changedBy: true, createdAt: true } as const

export async function getDefaultTrialDays(db: Db): Promise<number> {
  const row = await db.trialDayChange.findFirst({
    where: { userId: null },
    // như latestMonthPrice (spec P L3).
    orderBy: { id: "desc" },
    select: { days: true },
  })
  if (row) return row.days
  // Thiếu seed thì vẫn cho đăng ký với số ngày cũ thay vì lỗi 500 (spec L mục 15 T1).
  console.warn(`[trial] thiếu số ngày dùng thử mặc định, dùng ${DEFAULT_TRIAL_DAYS}`)
  return DEFAULT_TRIAL_DAYS
}

export async function getTrialHistory(db: Db) {
  return db.trialDayChange.findMany({
    where: { userId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: CHANGE_SELECT,
  })
}

// Chỉ áp cho tài khoản đăng ký sau khi lưu; người đang dùng thử giữ trialEndsAt cũ (spec L mục 15 T2).
export async function updateDefaultTrialDays(db: PrismaClient, admin: string, input: UpdateTrialDaysInput): Promise<{ days: number }> {
  const previous = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETTINGS_LOCK_CLASS}::int, ${TRIAL_LOCK_KEY}::int)`
    const current = await getDefaultTrialDays(tx)
    if (current !== input.expected) {
      throw new TRPCError({ code: "CONFLICT", message: "Số ngày dùng thử vừa được đổi ở nơi khác, tải lại để xem" })
    }
    if (input.days === current) throw new TRPCError({ code: "BAD_REQUEST", message: "Số ngày dùng thử chưa thay đổi" })
    await tx.trialDayChange.create({ data: { userId: null, days: input.days, previousDays: current, changedBy: admin } })
    return current
  })
  console.info(`[admin] ${admin} đổi số ngày dùng thử mặc định ${previous}→${input.days}`)
  return { days: input.days }
}

// Tính từ ngày tạo tài khoản; không đụng plan/planExpiresAt, effectivePlan tự lấy gói có hiệu lực (spec L mục 15 T3).
export async function setUserTrialDays(db: PrismaClient, admin: string, input: SetUserTrialInput): Promise<{ trialEndsAt: Date | null }> {
  const trialEndsAt = await db.$transaction(async (tx) => {
    // Cùng khóa theo user với tạo/duyệt đơn: 2 lần đặt cùng lúc không ghi previousDays sai (spec P L2).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(input.userId)})`
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { username: true, createdAt: true, trialEndsAt: true, isDeleted: true },
    })
    if (!user || user.isDeleted) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" })
    if (isAdminUsername(user.username)) throw new TRPCError({ code: "FORBIDDEN", message: "Tài khoản admin không dùng gói" })
    const next = trialEndFor(user.createdAt, input.days)
    await tx.user.update({ where: { id: input.userId }, data: { trialEndsAt: next } })
    await markSeenIfNew(tx, input.userId, new Date())
    await tx.trialDayChange.create({
      data: { userId: input.userId, days: input.days, previousDays: trialDaysOf(user.createdAt, user.trialEndsAt), changedBy: admin },
    })
    return next
  })
  console.info(`[admin] ${admin} đặt ${input.days} ngày dùng thử cho user ${input.userId}`)
  return { trialEndsAt }
}

export async function getUserTrialChanges(db: Db, userId: number) {
  return db.trialDayChange.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5,
    select: CHANGE_SELECT,
  })
}
