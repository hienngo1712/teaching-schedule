"use client"

import { cn } from "@/lib/utils"

export type BarSegment = { key: string; value: number; className: string }
export type ChartBar = { key: string; label: string; ariaLabel: string; segments: BarSegment[]; faded?: boolean }
export type ChartLegend = { key: string; label: string; className: string }

type Props = {
  bars: ChartBar[]
  layout: "stacked" | "grouped"
  legend: ChartLegend[]
  formatMax: (n: number) => string
  emptyText: string
  testId: string
}

// Vẽ bằng div theo % chiều cao, không thêm thư viện biểu đồ (spec K C9). stacked: segments xếp trên → dưới.
export function BarChart({ bars, layout, legend, formatMax, emptyText, testId }: Props) {
  const heights = bars.map((b) =>
    layout === "stacked" ? b.segments.reduce((s, x) => s + x.value, 0) : Math.max(0, ...b.segments.map((x) => x.value))
  )
  const max = Math.max(0, ...heights)
  if (max === 0) {
    return (
      <p data-testid={testId} className="text-sm text-slate-500">
        {emptyText}
      </p>
    )
  }
  const minWidth = bars.length * (layout === "grouped" ? 28 : 24)

  return (
    <div data-testid={testId} className="space-y-3">
      <p className="text-xs text-slate-500">{formatMax(max)}</p>
      <div className="overflow-x-auto">
        <div className="flex h-48 items-end gap-1 border-b border-slate-200" style={{ minWidth }}>
          {bars.map((b) => (
            <div
              key={b.key}
              data-testid="chart-bar"
              data-key={b.key}
              data-faded={b.faded ? "true" : undefined}
              role="img"
              aria-label={b.ariaLabel}
              title={b.ariaLabel}
              className={cn(
                "flex h-full min-w-[20px] flex-1",
                layout === "stacked" ? "flex-col justify-end" : "items-end justify-center gap-0.5",
                b.faded && "opacity-50"
              )}
            >
              {b.segments
                .filter((s) => s.value > 0)
                .map((s) => (
                  <div
                    key={s.key}
                    data-seg={s.key}
                    className={cn(s.className, layout === "grouped" && "w-1/2 max-w-3 rounded-t-sm")}
                    style={{ height: `${(s.value / max) * 100}%` }}
                  />
                ))}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1" style={{ minWidth }}>
          {bars.map((b) => (
            <span key={b.key} className="min-w-[20px] flex-1 text-center text-[10px] text-slate-500">
              {b.label}
            </span>
          ))}
        </div>
      </div>
      <ul className="flex flex-wrap gap-4 text-xs text-slate-600">
        {legend.map((l) => (
          <li key={l.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-3 rounded-sm", l.className)} />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
