"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  BarChart3,
  Wallet,
  GraduationCap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

const ICONS = {
  LayoutDashboard,
  CalendarDays,
  Users,
  BarChart3,
  Wallet,
} as const

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { t } = useTranslation()

  const NAV_ITEMS = [
    { href: "/dashboard", label: t("dashboard"), icon: "LayoutDashboard" as const },
    { href: "/calendar", label: t("calendar"), icon: "CalendarDays" as const },
    { href: "/students", label: t("students"), icon: "Users" as const },
    { href: "/tuition", label: t("tuition"), icon: "Wallet" as const },
    { href: "/reports", label: t("reports"), icon: "BarChart3" as const },
  ]

  return (
    <aside className="h-full w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="h-14 px-4 flex items-center gap-2 border-b border-slate-200">
        <GraduationCap className="size-6 text-indigo-600" />
        <span className="font-semibold text-slate-900">{t("calendar")}</span>
      </div>
      <nav className="p-2 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon]
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-slate-200 px-4 py-3 text-[11px] leading-tight text-slate-400">
        <div>
          v{process.env.NEXT_PUBLIC_APP_VERSION} · {process.env.NEXT_PUBLIC_BUILD_SHA}
        </div>
        <div>{process.env.NEXT_PUBLIC_BUILD_TIME}</div>
      </div>
    </aside>
  )
}
