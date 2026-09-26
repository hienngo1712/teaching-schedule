"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { MORE_ITEMS } from "./nav-items"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MoreSheet({ open, onOpenChange }: Props) {
  const { t } = useTranslation()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Sheet phủ cả tab bar (D8); không có mô tả nên tắt aria-describedby để Radix không cảnh báo. */}
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        className="rounded-t-[20px] px-4 pt-2.5 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetTitle className="sr-only">{t("more")}</SheetTitle>
        <div aria-hidden className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#D5D8DE]" />
        <ul className="flex flex-col gap-1">
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="flex min-h-14 items-center gap-3.5 rounded-xl px-3 hover:bg-accent"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-medium text-foreground">{t(item.labelKey)}</span>
                    <span className="text-xs text-muted-foreground">{t(item.descKey)}</span>
                  </span>
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
