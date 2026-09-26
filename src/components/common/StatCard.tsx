import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Props = {
  label: string
  value?: string | number
  hint?: ReactNode
  icon?: ReactNode
  loading?: boolean
  valueClassName?: string
}

export function StatCard({ label, value, hint, icon, loading, valueClassName }: Props) {
  return (
    <Card data-testid="stat-card" className="bg-white">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {icon}
        </div>
        {loading || value === undefined ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          // nowrap: số tiền 9 chữ số không được gãy "100.000.000 / đ" ở thẻ 2 cột 390px
          <p
            data-testid="stat-value"
            className={cn("mt-1 whitespace-nowrap text-lg font-semibold tracking-tight text-foreground xl:text-2xl", valueClassName)}
          >
            {value}
          </p>
        )}
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}
