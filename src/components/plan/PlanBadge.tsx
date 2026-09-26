import { PLAN_LABEL, type PaidPlan } from "@/lib/plans"
import { cn } from "@/lib/utils"

export function PlanBadge({ plan, className }: { plan: PaidPlan; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-primary bg-white px-1.5 text-[10px] font-semibold leading-4 text-primary",
        className
      )}
    >
      {PLAN_LABEL[plan]}
    </span>
  )
}
