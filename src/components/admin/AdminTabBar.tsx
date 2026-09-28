"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { trpc } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { isNavActive } from "@/components/layout/nav-items"
import { ADMIN_NAV_ITEMS } from "./admin-nav"

// Chép kiểu tab của BottomTabBar thay vì trích chung, để không đụng tab bar giáo viên.
function tabClass(active: boolean) {
  return cn(
    "relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px]",
    active ? "font-semibold text-primary" : "font-medium text-muted-foreground"
  )
}

function ActiveBar() {
  return <span aria-hidden className="absolute left-1/2 top-0 h-[3px] w-5 -translate-x-1/2 rounded-full bg-primary" />
}

export function AdminTabBar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  const pendingData = trpc.admin.pendingCount.useQuery().data
  const pendingCount = pendingData?.count ?? 0
  const newAccounts = pendingData?.newAccounts ?? 0
  return (
    <nav
      aria-label={t("main_navigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isNavActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                {active && <ActiveBar />}
                {item.href === "/admin/orders" && newAccounts > 0 && (
                  <span data-testid="admin-tab-new-dot" className="absolute left-[calc(50%-14px)] top-2 size-2 rounded-full bg-teal-500">
                    <span className="sr-only">{t("admin_new_accounts_count_label").replace("{n}", String(newAccounts))}</span>
                  </span>
                )}
                <span className="relative">
                  <Icon className="size-5" />
                  {item.href === "/admin/orders" && pendingCount > 0 && (
                    <span
                      data-testid="admin-tab-pending-count"
                      className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-amber-100 px-1 text-center text-[10px] font-semibold leading-4 text-amber-800"
                    >
                      {pendingCount}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-1">{t(item.shortKey)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
