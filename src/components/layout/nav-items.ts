import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CircleHelp,
  ClipboardList,
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
  // Chỉ hiện khi GV có nơi tính tiền theo học sinh (spec AL §4.4) / theo ca/giờ (spec AM §4.1).
  requires?: "perStudent" | "perSession"
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/calendar", labelKey: "calendar", icon: CalendarDays },
  { href: "/students", labelKey: "students", icon: Users },
  { href: "/tuition", labelKey: "tuition", icon: Wallet, requires: "perStudent" },
  { href: "/timesheet", labelKey: "timesheet", icon: ClipboardList, requires: "perSession" },
  { href: "/reports", labelKey: "reports", icon: BarChart3, feature: "monthlyReport", requires: "perStudent" },
]

type PlaceFlags = { hasPerStudent: boolean; hasPerSession: boolean }

// Ẩn Học phí/Báo cáo khi chắc chắn không có nơi theo học sinh (chưa tải xong thì giữ như cũ);
// Bảng công chỉ hiện khi chắc chắn có nơi theo ca/giờ (đa số GV không có, tránh nháy).
export function filterByPlaces<T extends NavItem>(items: T[], summary: PlaceFlags | undefined): T[] {
  return items.filter((i) => {
    if (i.requires === "perStudent") return !summary || summary.hasPerStudent
    if (i.requires === "perSession") return !!summary?.hasPerSession
    return true
  })
}

// Tab dưới mobile = 4 mục đầu còn hiện: chỉ dạy theo ca/giờ thì Bảng công vào chỗ của Học phí (spec AM RF 4).
export function tabItems(summary: PlaceFlags | undefined): NavItem[] {
  return filterByPlaces(NAV_ITEMS, summary).slice(0, 4)
}

// Sheet "Thêm": bỏ mục đã có tab riêng.
export function moreItems(summary: PlaceFlags | undefined) {
  const tabs = new Set(tabItems(summary).map((i) => i.href))
  return filterByPlaces(MORE_ITEMS, summary).filter((i) => !tabs.has(i.href))
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
  { href: "/timesheet", labelKey: "timesheet", icon: ClipboardList, descKey: "more_timesheet_desc", requires: "perSession" },
  { href: "/reports", labelKey: "reports", icon: BarChart3, descKey: "more_reports_desc", feature: "monthlyReport", requires: "perStudent" },
  { href: "/subjects", labelKey: "subject", icon: BookOpen, descKey: "more_subjects_desc" },
  { href: "/places", labelKey: "places", icon: MapPin, descKey: "more_places_desc" },
  { href: "/settings", labelKey: "settings", icon: Settings, descKey: "more_settings_desc" },
  { href: "/plan", labelKey: "my_plan", icon: Crown, descKey: "more_plan_desc" },
  { href: "/trash", labelKey: "trash", icon: Trash2, descKey: "more_trash_desc" },
  { href: "/guide", labelKey: "guide_nav", icon: CircleHelp, descKey: "more_guide_desc", external: true },
]

export function isMoreActive(pathname: string, summary?: PlaceFlags) {
  return (summary ? moreItems(summary) : MORE_ITEMS).some((i) => isNavActive(pathname, i.href))
}
