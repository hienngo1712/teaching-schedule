"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { FEATURE_PLAN } from "@/lib/plans"
import { usePlan } from "@/hooks/usePlan"
import { LockBadge } from "@/components/plan/LockBadge"
import { openUpgrade } from "@/components/plan/upgrade-store"
import { MORE_ITEMS } from "./nav-items"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Nút mở sheet; bọc bằng SheetTrigger để có aria-expanded và focus quay về khi đóng.
  children: ReactNode
}

export function MoreSheet({ open, onOpenChange, children }: Props) {
  const { t } = useTranslation()
  const { ready, has } = usePlan()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      {/* Sheet phủ cả tab bar (D8); không có mô tả nên tắt aria-describedby để Radix không cảnh báo. */}
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        hideClose
        className="rounded-t-[20px] px-4 pt-2.5 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetTitle className="sr-only">{t("more")}</SheetTitle>
        <div aria-hidden className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#D5D8DE]" />
        <ul className="flex flex-col gap-1">
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon
            const plan = item.feature ? FEATURE_PLAN[item.feature] : null
            const content = (
              <>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-medium text-foreground">{t(item.labelKey)}</span>
                  <span className="text-xs text-muted-foreground">{t(item.descKey)}</span>
                </span>
              </>
            )
            // P12: mục thiếu gói vẫn hiện, bấm mở popup nâng cấp thay vì điều hướng.
            if (plan && item.feature && ready && !has(item.feature)) {
              return (
                <li key={item.href}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false)
                      openUpgrade({ plan })
                    }}
                    className="flex min-h-14 w-full items-center gap-3.5 rounded-xl px-3 text-left hover:bg-accent"
                  >
                    {content}
                    <LockBadge plan={plan} />
                  </button>
                </li>
              )
            }
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="flex min-h-14 items-center gap-3.5 rounded-xl px-3 hover:bg-accent"
                >
                  {content}
                  <ChevronRight className="size-5 shrink-0 text-[#9CA3AF]" />
                </Link>
              </li>
            )
          })}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
