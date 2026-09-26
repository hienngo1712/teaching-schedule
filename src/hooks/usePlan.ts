"use client"

import { trpc } from "@/lib/trpc"
import { hasFeature, type Feature, type PlanFields } from "@/lib/plans"

export function usePlan() {
  const me = trpc.plan.me.useQuery().data
  // tRPC không có transformer: Date về client là chuỗi ISO → đổi lại cho các hàm trong plans.ts.
  const fields: PlanFields | null = me
    ? {
        plan: me.paidPlan,
        planExpiresAt: me.planExpiresAt ? new Date(me.planExpiresAt) : null,
        trialEndsAt: me.trialEndsAt ? new Date(me.trialEndsAt) : null,
      }
    : null
  return {
    me,
    ready: me !== undefined,
    has: (feature: Feature) => me !== undefined && hasFeature(me.plan, feature),
    fields,
  }
}
