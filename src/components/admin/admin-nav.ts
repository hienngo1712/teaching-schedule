import { ChartColumn, History, Inbox, LayoutDashboard, MessageSquare, MessagesSquare, Tags, Users, type LucideIcon } from "lucide-react"
import type vi from "@/language/vi.json"

export type AdminNavItem = { href: string; labelKey: keyof typeof vi; shortKey: keyof typeof vi; icon: LucideIcon }

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/overview", labelKey: "admin_overview", shortKey: "admin_tab_overview", icon: LayoutDashboard },
  { href: "/admin/orders", labelKey: "admin_pending_orders", shortKey: "admin_tab_orders", icon: Inbox },
  { href: "/admin/chat", labelKey: "admin_chat", shortKey: "admin_tab_chat", icon: MessagesSquare },
  { href: "/admin/accounts", labelKey: "admin_accounts_plans", shortKey: "admin_tab_accounts", icon: Users },
  { href: "/admin/history", labelKey: "admin_order_history", shortKey: "admin_tab_history", icon: History },
  { href: "/admin/prices", labelKey: "admin_prices", shortKey: "admin_tab_prices", icon: Tags },
  { href: "/admin/revenue", labelKey: "admin_revenue", shortKey: "admin_tab_revenue", icon: ChartColumn },
  { href: "/admin/feedback", labelKey: "admin_feedback", shortKey: "admin_tab_feedback", icon: MessageSquare },
]
