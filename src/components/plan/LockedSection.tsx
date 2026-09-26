"use client"

import type { ReactNode } from "react"
import { Lock } from "lucide-react"
import type { PaidPlan } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { PlanBadge } from "./PlanBadge"
import { openUpgrade } from "./upgrade-store"

// Khung mờ giữ bố cục như gói Pro (P12). `inert`: control thật bên trong không bấm/tab được; children không được tự gọi query bị khóa.
export function LockedSection({
  plan,
  label,
  children,
  className,
  testId = "locked-section",
}: {
  plan: PaidPlan
  label: string
  children: ReactNode
  className?: string
  testId?: string
}) {
  return (
    <div data-testid={testId} className={cn("relative overflow-hidden rounded-xl", className)}>
      <div aria-hidden inert className="pointer-events-none select-none opacity-40 blur-[2px]">
        {children}
      </div>
      <button
        type="button"
        onClick={() => openUpgrade({ plan })}
        className="absolute inset-0 flex min-h-11 items-center justify-center gap-2 bg-white/40 px-4 text-sm font-medium text-slate-700"
      >
        <Lock aria-hidden className="size-4" />
        <span>{label}</span>
        <PlanBadge plan={plan} />
      </button>
    </div>
  )
}
