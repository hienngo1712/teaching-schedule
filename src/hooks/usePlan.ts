"use client"

import { trpc } from "@/lib/trpc"
import { hasFeature, type Feature, type PlanFields } from "@/lib/plans"

// poll chỉ bật ở trang Gói: sidebar/banner cũng dùng hook này, bật mọi nơi thì mọi trang hỏi server 5s/lần.
export function usePlan({ poll = false }: { poll?: boolean } = {}) {
  // Đơn payOS đang chờ: hỏi lại mỗi 5s để thẻ đổi "Đã kích hoạt" khi webhook bật gói; hết đơn chờ thì tự dừng.
  const me = trpc.plan.me.useQuery(undefined, {
    refetchInterval: (q) => (poll && q.state.data?.pendingOrder?.method === "payos" ? 5000 : false),
  }).data
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
