"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Ellipsis } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { NAV_ITEMS, isMoreActive, isNavActive } from "./nav-items"
import { MoreSheet } from "./MoreSheet"

const TAB_ITEMS = NAV_ITEMS.slice(0, 4)

function tabClass(active: boolean) {
  return cn(
    "relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px]",
    active ? "font-semibold text-primary" : "font-medium text-muted-foreground"
  )
}

function ActiveBar() {
  return <span aria-hidden className="absolute left-1/2 top-0 h-[3px] w-5 -translate-x-1/2 rounded-full bg-primary" />
}

export function BottomTabBar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  // Gắn trạng thái mở với pathname: đổi route (kể cả nút Back) là sheet tự đóng.
  const [openAt, setOpenAt] = useState<string | null>(null)
  const moreActive = isMoreActive(pathname)

  return (
    <nav
      aria-label={t("main_navigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isNavActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                {active && <ActiveBar />}
                <Icon className="size-5" />
                <span className="max-w-full truncate px-1">
                  {t(item.href === "/calendar" ? "calendar_short" : item.labelKey)}
                </span>
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-current={moreActive ? "page" : undefined}
            onClick={() => setOpenAt(pathname)}
            className={tabClass(moreActive)}
          >
            {moreActive && <ActiveBar />}
            <Ellipsis className="size-5" />
            <span className="max-w-full truncate px-1">{t("more")}</span>
          </button>
        </li>
      </ul>
      <MoreSheet open={openAt === pathname} onOpenChange={(open) => setOpenAt(open ? pathname : null)} />
    </nav>
  )
}
