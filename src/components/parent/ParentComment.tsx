"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { cn } from "@/lib/utils"

// Nhận xét tháng (spec AU A2): điện thoại thu gọn ~7 dòng + "Đọc tiếp"; web hiện đủ (khối thanh toán đã dính bên phải).
export function ParentComment({ text, month, teacherName }: { text: string; month: number; teacherName: string }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflow, setOverflow] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || expanded) return
    const check = () => setOverflow(el.scrollHeight > el.clientHeight + 1)
    check()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, expanded])

  return (
    <section data-testid="parent-comment" className="rounded-xl border border-slate-200 bg-white p-4 lg:col-start-1">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary">
          {teacherName.trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">{t("parent_comment_title").replace("{m}", String(month))}</h2>
          <p className="truncate text-sm text-slate-500">{teacherName}</p>
        </div>
      </div>
      {/* Text thường (React tự escape), giữ xuống dòng. 7 dòng × 1.7 = 11.9em. */}
      <p
        ref={ref}
        className={cn(
          "whitespace-pre-wrap break-words text-[15px] leading-[1.7] text-slate-800",
          !expanded && "max-h-[11.9em] overflow-hidden lg:max-h-none"
        )}
      >
        {text}
      </p>
      {!expanded && overflow && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 min-h-11 font-semibold text-primary lg:hidden"
        >
          {t("parent_read_more")}
        </button>
      )}
    </section>
  )
}
