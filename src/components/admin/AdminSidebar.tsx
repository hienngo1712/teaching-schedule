"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import { trpc } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { isNavActive } from "@/components/layout/nav-items"
import { ADMIN_NAV_ITEMS } from "./admin-nav"
import { CHAT_POLL_MS } from "@/lib/chat"

export function AdminSidebar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  // Query nhẹ dùng chung với tab bar (spec P J5).
  const pendingData = trpc.admin.pendingCount.useQuery().data
  const pendingCount = pendingData?.count ?? 0
  const newAccounts = pendingData?.newAccounts ?? 0
  const chatUnread = trpc.admin.chatUnread.useQuery(undefined, { refetchInterval: CHAT_POLL_MS.adminUnread }).data?.conversations ?? 0

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col gap-7 border-r bg-white px-3.5 py-5">
      <div className="flex items-center gap-2.5 px-1">
        <span className="flex size-8 items-center justify-center rounded-[9px] bg-primary">
          <GraduationCap className="size-[18px] text-white" />
        </span>
        <span className="text-base font-semibold text-foreground">{t("calendar")}</span>
        <span className="rounded-full border border-slate-300 bg-slate-50 px-1.5 text-[10px] font-semibold leading-4 text-slate-600">
          {t("admin_badge")}
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isNavActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                active
                  ? "bg-primary/[0.08] font-semibold text-primary"
                  : "font-medium text-[#4B5563] hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{t(item.labelKey)}</span>
              {item.href === "/admin/orders" && pendingCount > 0 && (
                <span
                  data-testid="admin-pending-count"
                  className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold leading-5 text-amber-800"
                >
                  {pendingCount}
                </span>
              )}
              {item.href === "/admin/orders" && newAccounts > 0 && (
                <span
                  data-testid="admin-new-accounts-count"
                  aria-label={t("admin_new_accounts_count_label").replace("{n}", String(newAccounts))}
                  className="ml-1 rounded-full border border-primary px-1.5 text-xs font-semibold text-primary"
                >
                  {newAccounts}
                </span>
              )}
              {item.href === "/admin/chat" && chatUnread > 0 && (
                <span
                  data-testid="admin-chat-unread"
                  aria-label={t("admin_chat_unread_label").replace("{n}", String(chatUnread))}
                  className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold leading-5 text-amber-800"
                >
                  {chatUnread}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto px-1 font-mono text-[11px] leading-tight text-muted-foreground">
        <div>
          v{process.env.NEXT_PUBLIC_APP_VERSION} · {process.env.NEXT_PUBLIC_BUILD_SHA}
        </div>
        <div>{process.env.NEXT_PUBLIC_BUILD_TIME}</div>
      </div>
    </aside>
  )
}
