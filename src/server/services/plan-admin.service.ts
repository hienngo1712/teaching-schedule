import type { Prisma, PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { isAdminUsername } from "@/lib/admin"
import { cancelPayosLinkSafe } from "@/server/payos"
import {
  ORDER_TTL_DAYS,
  addDays,
  computeNewExpiry,
  computeUpgradeCredit,
  effectivePlan,
  expiryFromLastDay,
  isPaidPlan,
  isPeriod,
  orderBlockedUntil,
  orderExpiresAt,
} from "@/lib/plans"
import type { SetPlanInput } from "@/lib/schemas/plan"
import { PLAN_SELECT, expireStaleOrders, findLastPlusOrder, type Db } from "./plan.service"
import { countNewAccounts, markSeenIfNew } from "./new-accounts.service"

// Hạn mới khi duyệt = mốc D6 + (kỳ + tháng tặng đã chốt) + ngày quy đổi D7 (tính theo lúc duyệt).
// null = không duyệt được (D7: user đang có Pro trả phí mà đơn là Plus).
export async function computeApproval(
  db: Db,
  order: { userId: number; plan: string; period: string | null; bonusMonths: number; amount: number },
  now: Date
): Promise<{ grantedUntil: Date; creditDays: number } | null> {
  if (!isPaidPlan(order.plan) || !isPeriod(order.period)) return null
  const user = await db.user.findUniqueOrThrow({ where: { id: order.userId }, select: PLAN_SELECT })
  if (orderBlockedUntil(user, order.plan, now)) return null
  // Mẫu số là tiền đơn Pro đang duyệt, không đọc bảng giá hiện hành (spec L Q10, L4).
  const creditDays =
    order.plan === "pro"
      ? computeUpgradeCredit(user, await findLastPlusOrder(db, order.userId), order.period, order.amount, now).creditDays
      : 0
  const grantedUntil = addDays(computeNewExpiry(user, order.plan, order.period, now, order.bonusMonths), creditDays)
  return { grantedUntil, creditDays }
}

// Đơn có tiền payOS mà chưa bật gói, admin chưa xử lý → nhảy lên đầu trang đơn chờ (spec AG §6).
export function isAttention(o: { status: string; paidAmount: number | null; paidReviewedAt: Date | null }): boolean {
  return o.paidAmount !== null && o.status !== "approved" && o.paidReviewedAt === null
}

// Lõi chung duyệt tay + webhook. "pending": đơn chờ còn hạn. "paid": đơn đã nhận tiền payOS, kể cả hết hạn/huỷ/từ chối.
// Caller giữ khoá advisory theo userId. null = không chốt được, chưa ghi gì.
export async function activateOrderInTx(
  tx: Prisma.TransactionClient,
  id: number,
  decidedBy: string,
  now: Date,
  mode: "pending" | "paid"
): Promise<{ grantedUntil: Date; creditDays: number; userId: number } | null> {
  const order = await tx.planOrder.findUnique({
    where: { id },
    select: { userId: true, plan: true, period: true, bonusMonths: true, amount: true, status: true, createdAt: true, paidAmount: true },
  })
  if (!order) return null
  const ok =
    mode === "pending"
      ? order.status === "pending" && order.createdAt > addDays(now, -ORDER_TTL_DAYS)
      : order.paidAmount !== null && order.status !== "approved"
  if (!ok) return null
  const approval = await computeApproval(tx, order, now)
  if (!approval) return null
  const claimed = await tx.planOrder.updateMany({
    where: { id, status: order.status },
    data: { status: "approved", decidedBy, decidedAt: now, grantedUntil: approval.grantedUntil, creditDays: approval.creditDays },
  })
  if (claimed.count === 0) return null
  await tx.user.update({ where: { id: order.userId }, data: { plan: order.plan, planExpiresAt: approval.grantedUntil } })
  return { ...approval, userId: order.userId }
}

export async function getAdminOverview(db: PrismaClient) {
  const now = new Date()
  await expireStaleOrders(db, now)
  const [users, counts, pending, attention] = await Promise.all([
    db.user.findMany({
      where: { isDeleted: false },
      orderBy: { id: "asc" },
      select: { id: true, username: true, fullName: true, createdAt: true, lastLoginAt: true, ...PLAN_SELECT },
    }),
    db.student.groupBy({ by: ["userId"], where: { isActive: true }, _count: { _all: true } }),
    db.planOrder.findMany({
      where: { status: "pending", user: { isDeleted: false } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        code: true,
        plan: true,
        period: true,
        amount: true,
        bonusMonths: true,
        createdAt: true,
        userId: true,
        method: true,
        user: { select: { username: true, fullName: true } },
      },
    }),
    db.planOrder.findMany({
      where: { paidAmount: { not: null }, status: { not: "approved" }, paidReviewedAt: null, user: { isDeleted: false } },
      orderBy: [{ paidAt: "desc" }, { id: "desc" }],
      select: { id: true, code: true, plan: true, period: true, amount: true, bonusMonths: true, createdAt: true, userId: true, status: true, method: true, paidAmount: true, paidAt: true, user: { select: { username: true, fullName: true } } },
    }),
  ])
  const activeBy = new Map(counts.map((c) => [c.userId, c._count._all]))
  const attentionIds = new Set(attention.map((o) => o.id))
  return {
    users: users.map((u) => {
      const eff = effectivePlan(u, now)
      return {
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        activeStudents: activeBy.get(u.id) ?? 0,
        plan: eff.plan,
        source: eff.source,
        expiresAt: eff.expiresAt,
        trialEndsAt: u.trialEndsAt,
        // Admin không dùng gói nên UI ẩn nút đặt dùng thử (spec L mục 15).
        isAdmin: isAdminUsername(u.username),
      }
    }),
    pendingOrders: await Promise.all(
      pending
        .filter((o) => !attentionIds.has(o.id))
        .map(async ({ user, ...o }) => ({
          ...o,
          expiresAt: orderExpiresAt(o.createdAt),
          username: user.username,
          fullName: user.fullName,
          preview: await computeApproval(db, o, now),
        }))
    ),
    attentionOrders: await Promise.all(
      attention.map(async ({ user, ...o }) => ({
        ...o,
        expiresAt: orderExpiresAt(o.createdAt),
        username: user.username,
        fullName: user.fullName,
        preview: await computeApproval(db, o, now),
      }))
    ),
  }
}

export async function approveOrder(db: PrismaClient, admin: string, id: number): Promise<{ grantedUntil: Date; creditDays: number }> {
  const now = new Date()
  const result = await db.$transaction(async (tx) => {
    // Khóa user trước khi chốt đơn (cùng thứ tự với createOrder, tránh deadlock): 2 đơn duyệt cùng lúc không ghi đè hạn nhau.
    const owner = await tx.planOrder.findUnique({ where: { id }, select: { userId: true } })
    if (owner) await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(owner.userId)})`
    const alive = owner && (await tx.user.findUnique({ where: { id: owner.userId }, select: { isDeleted: true } }))
    if (!alive || alive.isDeleted) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" })
    const cur = await tx.planOrder.findUniqueOrThrow({ where: { id }, select: { status: true, paidAmount: true, paidReviewedAt: true } })
    // Đơn có tiền payOS chưa xử lý: admin được duyệt cả khi đã hết hạn/huỷ/từ chối.
    const mode = isAttention(cur) ? "paid" : "pending"
    const done = await activateOrderInTx(tx, id, admin, now, mode)
    if (done) return done
    if (cur.status === "pending") {
      const fresh = await tx.planOrder.findUniqueOrThrow({ where: { id }, select: { createdAt: true } })
      if (fresh.createdAt <= addDays(now, -ORDER_TTL_DAYS)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Đơn đã quá 7 ngày chưa xác nhận nên đã hết hạn. Nếu khách đã chuyển khoản, hãy dùng Đặt gói" })
      }
      throw new TRPCError({ code: "BAD_REQUEST", message: "Tài khoản đang có gói Pro còn hạn, không duyệt được đơn Plus" })
    }
    if (mode === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Tài khoản đang có gói Pro còn hạn, không duyệt được đơn Plus" })
    throw new TRPCError({ code: "CONFLICT", message: "Đơn không còn ở trạng thái chờ" })
  })
  console.info(`[admin] ${admin} duyệt đơn ${id} (user ${result.userId}) tới ${result.grantedUntil.toISOString()}`)
  return { grantedUntil: result.grantedUntil, creditDays: result.creditDays }
}

// Nhẹ hơn overview (không tải user, không tính computeApproval): sidebar + tab bar gọi ở mọi trang admin (spec P J5).
export async function getPendingCount(db: PrismaClient): Promise<{ count: number; newAccounts: number }> {
  await expireStaleOrders(db, new Date())
  const [pending, attention, newAccounts] = await Promise.all([
    db.planOrder.count({ where: { status: "pending", paidAmount: null, user: { isDeleted: false } } }),
    db.planOrder.count({ where: { paidAmount: { not: null }, status: { not: "approved" }, paidReviewedAt: null, user: { isDeleted: false } } }),
    countNewAccounts(db),
  ])
  return { count: pending + attention, newAccounts }
}

export async function rejectOrder(db: PrismaClient, admin: string, id: number, note?: string): Promise<{ success: true }> {
  const now = new Date()
  const cur = await db.planOrder.findUnique({ where: { id }, select: { status: true, paidAmount: true, paidReviewedAt: true, payosLinkId: true } })
  const paid = cur !== null && isAttention(cur)
  const { count } = await db.planOrder.updateMany({
    where: paid ? { id, status: cur.status } : { id, status: "pending" },
    data: {
      status: "rejected",
      note: note || (paid ? "Đã nhận tiền qua payOS, chủ app tự hoàn" : null),
      decidedBy: admin,
      decidedAt: now,
      ...(paid ? { paidReviewedAt: now } : {}),
    },
  })
  if (count === 0) throw new TRPCError({ code: "CONFLICT", message: "Đơn không còn ở trạng thái chờ" })
  console.info(`[admin] ${admin} từ chối đơn ${id}`)
  // Huỷ cả khi đơn đã có tiền: đơn thiếu tiền mà link còn mở thì khách vẫn trả tiếp được.
  if (cur?.payosLinkId) await cancelPayosLinkSafe(cur.payosLinkId)
  return { success: true }
}

// Đặt thẳng gói (tặng, bù ngày, sửa sai). Không đụng trialEndsAt: đặt thấp hơn khi trial còn hạn vẫn hiện Pro tới hết trial.
export async function adminSetPlan(db: PrismaClient, admin: string, input: SetPlanInput): Promise<{ success: true }> {
  const planExpiresAt = input.plan === "standard" || !input.lastDay ? null : expiryFromLastDay(input.lastDay)
  await db.$transaction(async (tx) => {
    const exists = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, isDeleted: true } })
    if (!exists || exists.isDeleted) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản" })
    await tx.user.update({ where: { id: input.userId }, data: { plan: input.plan, planExpiresAt } })
    await markSeenIfNew(tx, input.userId, new Date())
    await tx.planOrder.create({
      data: {
        userId: input.userId,
        plan: input.plan,
        amount: 0,
        status: "approved",
        source: "admin",
        grantedUntil: planExpiresAt,
        note: input.note,
        decidedBy: admin,
        decidedAt: new Date(),
      },
    })
  })
  console.info(`[admin] ${admin} đặt gói ${input.plan} cho user ${input.userId}`)
  return { success: true }
}

// Lịch sử để đối soát chuyển khoản sai nội dung (spec I-11). Vài chục tài khoản nên 100 đơn gần nhất là đủ, chưa phân trang.
export async function getOrderHistory(db: PrismaClient) {
  await expireStaleOrders(db, new Date())
  const rows = await db.planOrder.findMany({
    where: { status: { not: "pending" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      code: true,
      plan: true,
      period: true,
      amount: true,
      bonusMonths: true,
      creditDays: true,
      status: true,
      source: true,
      method: true,
      paidAmount: true,
      paidAt: true,
      grantedUntil: true,
      note: true,
      decidedBy: true,
      decidedAt: true,
      createdAt: true,
      user: { select: { username: true, fullName: true } },
    },
  })
  return rows.map(({ user, ...o }) => ({ ...o, username: user.username, fullName: user.fullName }))
}
