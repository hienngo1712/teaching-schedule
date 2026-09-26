import {
  BarChart3,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  Settings,
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

export type NavItem = (typeof NAV_ITEMS)[number]

export const MANAGE_ITEMS: NavItem[] = [
  { href: "/subjects", labelKey: "subject", icon: BookOpen },
  { href: "/settings", labelKey: "settings", icon: Settings },
]

// Tab "Thêm" trên mobile gom các màn không có tab riêng.
export const MORE_ITEMS: (NavItem & { descKey: keyof typeof vi })[] = [
  { href: "/reports", labelKey: "reports", icon: BarChart3, descKey: "more_reports_desc" },
  { href: "/subjects", labelKey: "subject", icon: BookOpen, descKey: "more_subjects_desc" },
  { href: "/settings", labelKey: "settings", icon: Settings, descKey: "more_settings_desc" },
]

export function isMoreActive(pathname: string) {
  return MORE_ITEMS.some((i) => isNavActive(pathname, i.href))
}
