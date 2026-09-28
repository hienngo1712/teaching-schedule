import type { Prisma, PrismaClient } from "@prisma/client"
import { adminUsernames } from "@/lib/admin"
import { effectivePlan, type Plan, type PlanSource } from "@/lib/plans"
import type { MarkAccountsSeenInput } from "@/lib/schemas/plan"
import type { Db } from "./plan.service"

// Tài khoản mới admin chưa xem (spec K R1): không admin, chưa xóa mềm (Q).
export function newAccountsWhere(): Prisma.UserWhereInput {
  return { adminSeenAt: null, isDeleted: false, username: { notIn: adminUsernames() } }
}

export function countNewAccounts(db: Db): Promise<number> {
  return db.user.count({ where: newAccountsWhere() })
}

export type NewAccountRow = { id: number; username: string; fullName: string | null; createdAt: Date; plan: Plan; source: PlanSource }

export async function getNewAccounts(db: Db, now = new Date()): Promise<{ items: NewAccountRow[]; total: number }> {
  const where = newAccountsWhere()
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      select: { id: true, username: true, fullName: true, createdAt: true, plan: true, planExpiresAt: true, trialEndsAt: true },
    }),
    db.user.count({ where }),
  ])
  return {
    items: rows.map(({ plan, planExpiresAt, trialEndsAt, ...u }) => {
      const eff = effectivePlan({ plan, planExpiresAt, trialEndsAt }, now)
      return { ...u, plan: eff.plan, source: eff.source }
    }),
    total,
  }
}

// Chỉ đánh dấu dòng đang null: bấm 2 lần không đổi mốc đã xem (spec K R5).
export async function markAccountsSeen(db: PrismaClient, admin: string, input: MarkAccountsSeenInput): Promise<{ count: number }> {
  const where: Prisma.UserWhereInput = "all" in input ? newAccountsWhere() : { ...newAccountsWhere(), id: { in: input.userIds } }
  const { count } = await db.user.updateMany({ where, data: { adminSeenAt: new Date() } })
  console.info(`[admin] ${admin} đánh dấu đã xem ${count} tài khoản mới`)
  return { count }
}

// Đặt gói / dùng thử cho tài khoản là đã xem nó (spec K R4).
export async function markSeenIfNew(tx: Db, userId: number, now: Date): Promise<void> {
  await tx.user.updateMany({ where: { id: userId, adminSeenAt: null }, data: { adminSeenAt: now } })
}
