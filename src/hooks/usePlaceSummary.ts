"use client"

import { trpc } from "@/lib/trpc"

// Nơi dạy của GV + tóm tắt theo tháng hiện tại (spec AL §4.4), dùng chung để hiện/ẩn ô Nơi học/Nơi dạy, Học phí.
export function usePlaceSummary() {
  const summary = trpc.place.summary.useQuery(undefined, { staleTime: 60_000 })
  const list = trpc.place.list.useQuery(undefined, { staleTime: 60_000 })
  const places = list.data ?? []
  return {
    places,
    summary: summary.data,
    // Chỉ hiện ô chọn nơi khi có ≥ 2 nơi; TK 1 nơi giữ giao diện như cũ.
    multi: places.length >= 2,
    ready: summary.isSuccess && list.isSuccess,
    placeById: (id: number | null | undefined) => places.find((p) => p.id === id),
  }
}
