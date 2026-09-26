"use client"

import type { ReactNode, Key } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type Column<T> = {
  header: ReactNode
  cell: (item: T, index: number) => ReactNode
  className?: string
}

type Props<T> = {
  items: T[]
  getKey: (item: T) => Key
  columns: Column<T>[]
  renderCard: (item: T, index: number) => ReactNode
  onRowClick?: (item: T) => void
  isLoading: boolean
  isError: boolean
  onRetry?: () => void
  emptyText: ReactNode
  errorText: string
  retryText: string
}

export function ResponsiveList<T>({
  items,
  getKey,
  columns,
  renderCard,
  onRowClick,
  isLoading,
  isError,
  onRetry,
  emptyText,
  errorText,
  retryText,
}: Props<T>) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} data-testid="list-skeleton" className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-dashed bg-white py-12 text-center">
        <p className="text-sm text-slate-600">{errorText}</p>
        {onRetry && (
          <Button variant="outline" className="mt-3 h-11 md:h-10" onClick={onRetry}>
            {retryText}
          </Button>
        )}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-white py-12 text-center text-sm text-slate-500">
        {emptyText}
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c, i) => (
                <TableHead key={i} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow
                key={getKey(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((c, i) => (
                  <TableCell key={i} className={c.className}>
                    {c.cell(item, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {items.map((item, index) => (
          <div key={getKey(item)} data-testid="list-card">
            {renderCard(item, index)}
          </div>
        ))}
      </div>
    </>
  )
}
