import type { Prisma, PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import {
  FEATURE_PLAN,
  PLAN_LABEL,
  effectivePlan,
  hasFeature,
  minPlanForStudents,
  studentLimit,
  type EffectivePlan,
  type Feature,
  type PaidPlan,
  type PlanFields,
} from "@/lib/plans"

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
