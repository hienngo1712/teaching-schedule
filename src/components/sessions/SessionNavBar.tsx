"use client"

import { useEffect, useMemo, useRef, type TouchEvent } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SessionListDTO } from "@/lib/types/models"
import { useTranslation } from "@/components/providers/LanguageProvider"

// Sắp theo ngày rồi giờ bắt đầu rồi id để danh sách ca đi đúng thứ tự thời gian.
export function sortSessions(list: SessionListDTO[]): SessionListDTO[] {
  return [...list].sort((a, b) => {
    const da = a.sessionDate instanceof Date ? a.sessionDate.toISOString() : String(a.sessionDate)
    const db = b.sessionDate instanceof Date ? b.sessionDate.toISOString() : String(b.sessionDate)
    return da.localeCompare(db) || a.startTime.localeCompare(b.startTime) || a.id - b.id
  })
}

const TYPING = "input, textarea, select, [role=combobox], [role=listbox], [role=menu], [role=menuitem], [contenteditable=true]"

type Props = {
  siblings: SessionListDTO[]
  current: SessionListDTO
  onNavigate: (s: SessionListDTO) => void
  blocked?: boolean
}

// Thanh điều hướng ← → xem ca trước/sau trong tháng, kèm phím mũi tên và vuốt cảm ứng.
export function SessionNavBar({ siblings, current, onNavigate, blocked = false }: Props) {
  const { t } = useTranslation()
  const sorted = useMemo(() => sortSessions(siblings), [siblings])
  const currentIndex = sorted.findIndex((s) => s.id === current.id)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const canPrev = currentIndex > 0
  const canNext = currentIndex >= 0 && currentIndex < sorted.length - 1

  // Phím mũi tên đổi ca, trừ khi đang gõ (ghi chú điểm danh) hoặc có hộp con mở.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Menu Radix xử lý ↑↓ bằng preventDefault nhưng không chặn nổi bọt; Alt+← là Quay lại của trình duyệt.
      if (blocked || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest?.(TYPING)) return

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        if (canNext) {
          e.preventDefault()
          onNavigate(sorted[currentIndex + 1])
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        if (canPrev) {
          e.preventDefault()
          onNavigate(sorted[currentIndex - 1])
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [blocked, canNext, canPrev, currentIndex, onNavigate, sorted])

  const handleTouchStart = (e: TouchEvent) => {
    if (blocked || e.touches.length !== 1) return
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (blocked || !touchStartRef.current || e.changedTouches.length !== 1) return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    touchStartRef.current = null

    // Ngang nhiều hơn dọc và khoảng cách ≥ 60px
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && canNext) {
        onNavigate(sorted[currentIndex + 1])
      } else if (dx > 0 && canPrev) {
        onNavigate(sorted[currentIndex - 1])
      }
    }
  }

  const positionText = t("session_position")
    .replace("{i}", String(currentIndex >= 0 ? currentIndex + 1 : 1))
    .replace("{n}", String(sorted.length))

  return (
    <div
      className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-1.5"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-tour="session-nav"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("prev_session")}
        disabled={!canPrev || blocked}
        onClick={() => canPrev && !blocked && onNavigate(sorted[currentIndex - 1])}
        className="size-11 md:size-9"
      >
        <ChevronLeft className="size-5" />
      </Button>

      {currentIndex >= 0 ? (
        <span className="text-xs font-semibold text-slate-600 select-none">
          {positionText}
        </span>
      ) : (
        <span aria-hidden />
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("next_session")}
        disabled={!canNext || blocked}
        onClick={() => canNext && !blocked && onNavigate(sorted[currentIndex + 1])}
        className="size-11 md:size-9"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  )
}
