import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Crown,
  LayoutDashboard,
  Settings,
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import type vi from "@/language/vi.json"
import type { Feature } from "@/lib/plans"

export type NavItem = {
  href: string
  labelKey: keyof typeof vi
  icon: LucideIcon
  feature?: Feature
  external?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/calendar", labelKey: "calendar", icon: CalendarDays },
  { href: "/students", labelKey: "students", icon: Users },
  { href: "/tuition", labelKey: "tuition", icon: Wallet },
  { href: "/reports", labelKey: "reports", icon: BarChart3, feature: "monthlyReport" },
]

export function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}

export const MANAGE_ITEMS: NavItem[] = [
  { href: "/subjects", labelKey: "subject", icon: BookOpen },
  { href: "/settings", labelKey: "settings", icon: Settings },
  { href: "/plan", labelKey: "my_plan", icon: Crown },
  { href: "/trash", labelKey: "trash", icon: Trash2 },
  { href: "/guide", labelKey: "guide_nav", icon: CircleHelp, external: true },
]

// Tab "Thêm" trên mobile gom các màn không có tab riêng.
export const MORE_ITEMS: (NavItem & { descKey: keyof typeof vi })[] = [
  { href: "/reports", labelKey: "reports", icon: BarChart3, descKey: "more_reports_desc", feature: "monthlyReport" },
  { href: "/subjects", labelKey: "subject", icon: BookOpen, descKey: "more_subjects_desc" },
  { href: "/settings", labelKey: "settings", icon: Settings, descKey: "more_settings_desc" },
  { href: "/plan", labelKey: "my_plan", icon: Crown, descKey: "more_plan_desc" },
  { href: "/trash", labelKey: "trash", icon: Trash2, descKey: "more_trash_desc" },
  { href: "/guide", labelKey: "guide_nav", icon: CircleHelp, descKey: "more_guide_desc", external: true },
]

export function isMoreActive(pathname: string) {
  return MORE_ITEMS.some((i) => isNavActive(pathname, i.href))
}
