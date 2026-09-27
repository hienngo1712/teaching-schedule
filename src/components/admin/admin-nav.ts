import { History, Inbox, Tags, Users, type LucideIcon } from "lucide-react"
import type vi from "@/language/vi.json"

export type AdminNavItem = { href: string; labelKey: keyof typeof vi; shortKey: keyof typeof vi; icon: LucideIcon }

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/orders", labelKey: "admin_pending_orders", shortKey: "admin_tab_orders", icon: Inbox },
  { href: "/admin/accounts", labelKey: "admin_accounts_plans", shortKey: "admin_tab_accounts", icon: Users },
  { href: "/admin/history", labelKey: "admin_order_history", shortKey: "admin_tab_history", icon: History },
  { href: "/admin/prices", labelKey: "admin_prices", shortKey: "admin_tab_prices", icon: Tags },
]
