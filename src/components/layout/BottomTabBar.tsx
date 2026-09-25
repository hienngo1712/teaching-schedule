"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { NAV_ITEMS, isNavActive } from "./nav-items"

export function BottomTabBar() {
  const pathname = usePathname()
  const { t } = useTranslation()

  return (
    <nav
      aria-label={t("main_navigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isNavActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-indigo-700" : "text-slate-500"
                )}
              >
                <Icon className="size-5" />
                <span className="max-w-full truncate px-1">{t(item.labelKey)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
