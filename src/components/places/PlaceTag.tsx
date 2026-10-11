"use client"

import { usePlaceSummary } from "@/hooks/usePlaceSummary"
import { cn } from "@/lib/utils"

// Chấm màu + tên nơi dạy (spec AL §4.3); chỉ hiện khi GV có ≥ 2 nơi để TK 1 nơi thấy y như cũ.
export function PlaceTag({ placeId, className }: { placeId: number | null | undefined; className?: string }) {
  const { multi, placeById } = usePlaceSummary()
  const place = multi ? placeById(placeId) : undefined
  if (!place) return null
  return (
    <span data-testid="place-tag" className={cn("flex min-w-0 items-center gap-1", className)}>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: place.color }} />
      <span className="truncate">{place.name}</span>
    </span>
  )
}
