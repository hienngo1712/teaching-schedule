"use client"

import { FEATURE_PLAN, type Feature } from "@/lib/plans"
import { openUpgrade } from "@/components/plan/upgrade-store"
import { usePlan } from "./usePlan"

export function useFeatureGate(feature: Feature) {
  const { ready, has } = usePlan()
  const allowed = has(feature)
  // Chỉ khóa khi đã biết gói; query dùng `enabled: allowed` để lúc chưa tải gói cũng không gọi (tránh FORBIDDEN).
  const locked = ready && !allowed
  const requiredPlan = FEATURE_PLAN[feature]
  const open = () => openUpgrade({ plan: requiredPlan })
  return {
    locked,
    allowed,
    requiredPlan,
    openUpgrade: open,
    guard:
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) =>
        locked ? open() : fn(...args),
  }
}
