import type { Prisma, PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import {
  FEATURE_PLAN,
  PLAN_LABEL,
  effectivePlan,
  hasFeature,
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
