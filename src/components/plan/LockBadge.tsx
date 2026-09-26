import { Lock } from "lucide-react"
import type { PaidPlan } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { PlanBadge } from "./PlanBadge"

export function LockBadge({ plan, className }: { plan: PaidPlan; className?: string }) {
  return (
    <span data-testid="lock-badge" className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      <Lock aria-hidden className="size-3.5 text-muted-foreground" />
      <PlanBadge plan={plan} />
    </span>
  )
}
