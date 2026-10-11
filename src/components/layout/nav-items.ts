import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Crown,
  LayoutDashboard,
  MapPin,
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
  // Chỉ hiện khi GV có nơi tính tiền theo học sinh (spec AL §4.4).
  requires?: "perStudent"
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/calendar", labelKey: "calendar", icon: CalendarDays },
  { href: "/students", labelKey: "students", icon: Users },
  { href: "/tuition", labelKey: "tuition", icon: Wallet, requires: "perStudent" },
  { href: "/reports", labelKey: "reports", icon: BarChart3, feature: "monthlyReport", requires: "perStudent" },
]

// Ẩn Học phí/Báo cáo khi chắc chắn không có nơi theo học sinh; chưa tải xong thì giữ như cũ.
export function filterByPlaces<T extends NavItem>(items: T[], summary: { hasPerStudent: boolean } | undefined): T[] {
  if (!summary || summary.hasPerStudent) return items
  return items.filter((i) => i.requires !== "perStudent")
}

export function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}

export const MANAGE_ITEMS: NavItem[] = [
  { href: "/subjects", labelKey: "subject", icon: BookOpen },
  { href: "/places", labelKey: "places", icon: MapPin },
  { href: "/settings", labelKey: "settings", icon: Settings },
  { href: "/plan", labelKey: "my_plan", icon: Crown },
  { href: "/trash", labelKey: "trash", icon: Trash2 },
  { href: "/guide", labelKey: "guide_nav", icon: CircleHelp, external: true },
]

// Tab "Thêm" trên mobile gom các màn không có tab riêng.
export const MORE_ITEMS: (NavItem & { descKey: keyof typeof vi })[] = [
  { href: "/reports", labelKey: "reports", icon: BarChart3, descKey: "more_reports_desc", feature: "monthlyReport", requires: "perStudent" },
  { href: "/subjects", labelKey: "subject", icon: BookOpen, descKey: "more_subjects_desc" },
  { href: "/places", labelKey: "places", icon: MapPin, descKey: "more_places_desc" },
  { href: "/settings", labelKey: "settings", icon: Settings, descKey: "more_settings_desc" },
  { href: "/plan", labelKey: "my_plan", icon: Crown, descKey: "more_plan_desc" },
  { href: "/trash", labelKey: "trash", icon: Trash2, descKey: "more_trash_desc" },
  { href: "/guide", labelKey: "guide_nav", icon: CircleHelp, descKey: "more_guide_desc", external: true },
]

export function isMoreActive(pathname: string) {
  return MORE_ITEMS.some((i) => isNavActive(pathname, i.href))
}
