import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import type vi from "@/language/vi.json"

export const NAV_ITEMS: { href: string; labelKey: keyof typeof vi; icon: LucideIcon }[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/calendar", labelKey: "calendar", icon: CalendarDays },
  { href: "/students", labelKey: "students", icon: Users },
  { href: "/tuition", labelKey: "tuition", icon: Wallet },
  { href: "/reports", labelKey: "reports", icon: BarChart3 },
]

export function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}
