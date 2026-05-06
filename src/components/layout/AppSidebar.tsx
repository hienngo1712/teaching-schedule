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

const ICONS = {
  LayoutDashboard,
  CalendarDays,
  Users,
  BarChart3,
  Wallet,
} as const

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tổng quan", icon: "LayoutDashboard" as const },
  { href: "/calendar", label: "Lịch dạy", icon: "CalendarDays" as const },
  { href: "/students", label: "Học sinh", icon: "Users" as const },
  { href: "/reports/tuition", label: "Học phí", icon: "Wallet" as const },
  { href: "/reports", label: "Báo cáo", icon: "BarChart3" as const },
]

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <aside className="h-full w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="h-14 px-4 flex items-center gap-2 border-b border-slate-200">
        <GraduationCap className="size-6 text-indigo-600" />
        <span className="font-semibold text-slate-900">Lịch dạy</span>
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
    </aside>
  )
}
