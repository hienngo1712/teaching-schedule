import { Prisma, type PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { randomInt } from "node:crypto"
import {
  FEATURE_PLAN,
  PLAN_LABEL,
  PLAN_PRICES,
  computeBonusMonths,
  effectivePlan,
  formatValidUntil,
  hasFeature,
  isPlan,
  minPlanForStudents,
  orderBlockedUntil,
  studentLimit,
  type CreditOrder,
  type EffectivePlan,
  type Feature,
  type PaidPlan,
  type PlanFields,
} from "@/lib/plans"
import { buildVietQrPayload } from "@/lib/vietqr"
import { findBank } from "@/lib/vn-banks"
import type { CreateOrderInput } from "@/lib/schemas/plan"

export type Db = PrismaClient | Prisma.TransactionClient

export const PLAN_SELECT = { plan: true, planExpiresAt: true, trialEndsAt: true } satisfies Prisma.UserSelect

// errorFormatter đọc lớp này để trả data.planRequired cho client (spec I D15).
export class PlanRequiredError extends Error {
  readonly plan: PaidPlan
  constructor(plan: PaidPlan) {
    super(`Cần gói ${PLAN_LABEL[plan]}`)
    this.name = "PlanRequiredError"
    this.plan = plan
  }
}

export function planRequiredError(plan: PaidPlan, message: string): TRPCError {
  return new TRPCError({ code: "FORBIDDEN", message, cause: new PlanRequiredError(plan) })
}

// Đọc DB mỗi lần (không lấy từ JWT) để đổi gói có hiệu lực ngay.
export async function getUserPlan(db: Db, userId: number): Promise<EffectivePlan & { fields: PlanFields }> {
  const fields = await db.user.findUniqueOrThrow({ where: { id: userId }, select: PLAN_SELECT })
  return { ...effectivePlan(fields, new Date()), fields }
}

export async function assertFeature(db: Db, userId: number, feature: Feature): Promise<void> {
  const { plan } = await getUserPlan(db, userId)
  if (hasFeature(plan, feature)) return
  const need = FEATURE_PLAN[feature]
  throw planRequiredError(need, `Tính năng này cần gói ${PLAN_LABEL[need]}`)
}

// D8: chỉ chặn thêm HS đang học mới / bật lại HS nghỉ; không tự tắt HS nào khi hạ gói.
// Đếm không khóa dòng: 2 request đồng thời có thể vượt 1 HS (chấp nhận, spec mục 6.3).
export async function assertCanActivateStudents(db: Db, userId: number, n: number): Promise<void> {
  const { plan } = await getUserPlan(db, userId)
  const limit = studentLimit(plan)
  if (limit === null) return
  const count = await db.student.count({ where: { userId, isActive: true } })
  if (count + n <= limit) return
  throw planRequiredError(
    minPlanForStudents(count + n),
    `Gói ${PLAN_LABEL[plan]} tối đa ${limit} học sinh đang học (hiện có ${count})`
  )
}

// D13: bỏ 0/O/1/I/L để gõ tay không nhầm.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

export function generateOrderCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("")
}

export function isAdminUsername(username?: string | null): boolean {
  if (!username) return false
  return (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(username)
}

// D12: TK nhận tiền của chủ app nằm ở env, không lưu DB. BIN lạ coi như chưa cài.
export function getPlanBankAccount() {
  const bank = findBank(process.env.PLAN_BANK_BIN?.trim() ?? "")
  const accountNumber = process.env.PLAN_BANK_ACCOUNT_NUMBER?.trim()
  const accountName = process.env.PLAN_BANK_ACCOUNT_NAME?.trim()
  if (!bank || !accountNumber || !accountName) return null
  return { bin: bank.bin, bankShortName: bank.shortName, accountNumber, accountName }
}

// "Đơn Plus đang hiệu lực" cho quy đổi D7: đơn Plus đã duyệt mới nhất.
export async function findLastPlusOrder(db: Db, userId: number): Promise<CreditOrder | null> {
  return db.planOrder.findFirst({
    where: { userId, plan: "plus", status: "approved" },
    orderBy: [{ decidedAt: "desc" }, { id: "desc" }],
    select: { amount: true, period: true, bonusMonths: true },
  })
}

const ORDER_SELECT = {
  id: true,
  plan: true,
  period: true,
  amount: true,
  code: true,
  status: true,
  source: true,
  bonusMonths: true,
  creditDays: true,
  grantedUntil: true,
  createdAt: true,
} satisfies Prisma.PlanOrderSelect

export async function getMyPlan(db: PrismaClient, userId: number, username: string) {
  const now = new Date()
  const [fields, activeStudents, orders, pending, lastPlus] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: PLAN_SELECT }),
    db.student.count({ where: { userId, isActive: true } }),
    db.planOrder.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10, select: ORDER_SELECT }),
    db.planOrder.findFirst({ where: { userId, status: "pending" }, orderBy: { id: "desc" }, select: ORDER_SELECT }),
    findLastPlusOrder(db, userId),
  ])
  const eff = effectivePlan(fields, now)
  const bank = getPlanBankAccount()
  const content = pending?.code ? `SM ${pending.code}` : null

  return {
    plan: eff.plan,
    source: eff.source,
    expiresAt: eff.expiresAt,
    paidPlan: isPlan(fields.plan) ? fields.plan : "standard",
    planExpiresAt: fields.planExpiresAt,
    trialEndsAt: fields.trialEndsAt,
    activeStudents,
    studentLimit: studentLimit(eff.plan),
    plusCreditOrder: fields.plan === "plus" ? lastPlus : null,
    pendingOrder:
      pending && pending.code && content
        ? {
            id: pending.id,
            code: pending.code,
            plan: pending.plan,
            period: pending.period,
            amount: pending.amount,
            bonusMonths: pending.bonusMonths,
            createdAt: pending.createdAt,
            transferContent: content,
            qr: bank
              ? {
                  payload: buildVietQrPayload({ bin: bank.bin, accountNumber: bank.accountNumber, amount: pending.amount, content }),
                  bankShortName: bank.bankShortName,
                  accountNumber: bank.accountNumber,
                  accountName: bank.accountName,
                }
              : null,
          }
        : null,
    orders,
    paymentReady: bank !== null,
    isAdmin: isAdminUsername(username),
  }
}

export async function createOrder(
  db: PrismaClient,
  userId: number,
  input: CreateOrderInput
): Promise<{ id: number; code: string; bonusMonths: number }> {
  if (!getPlanBankAccount()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Chưa mở thanh toán" })
  const now = new Date()
  const fields = await db.user.findUniqueOrThrow({ where: { id: userId }, select: PLAN_SELECT })
  const blocked = orderBlockedUntil(fields, input.plan, now)
  if (blocked) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Gói Pro còn hạn tới ${formatValidUntil(blocked)}, chưa đặt được gói Plus` })
  }
  const amount = PLAN_PRICES[input.plan][input.period]
  // Spec 6.6: ưu đãi chốt lúc tạo đơn, admin duyệt muộn vẫn giữ.
  const bonusMonths = computeBonusMonths(fields, input.plan, input.period, now)
  // Mã trùng unique gần như không thể nên chỉ thử lại 1 lần (như generateParentLink).
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        // Khóa theo userId: 2 request cùng lúc không thì cùng thấy "chưa có đơn chờ" rồi ra 2 đơn pending.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(userId)})`
        // D14: tối đa 1 đơn chờ, đơn mới thay đơn cũ.
        await tx.planOrder.updateMany({ where: { userId, status: "pending" }, data: { status: "cancelled" } })
        const code = generateOrderCode()
        const order = await tx.planOrder.create({
          data: { userId, plan: input.plan, period: input.period, amount, bonusMonths, code, status: "pending" },
          select: { id: true },
        })
        return { id: order.id, code, bonusMonths }
      })
    } catch (e) {
      const isDuplicate = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
      if (!isDuplicate || attempt > 0) throw e
    }
  }
}

export async function cancelOrder(db: PrismaClient, userId: number, id: number): Promise<{ success: true }> {
  const { count } = await db.planOrder.updateMany({ where: { id, userId, status: "pending" }, data: { status: "cancelled" } })
  if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy yêu cầu đang chờ" })
  return { success: true }
}
