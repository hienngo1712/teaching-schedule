"use client"

import { AppHeader } from "@/components/layout/AppHeader"
import { AdminSidebar } from "./AdminSidebar"
import { AdminTabBar } from "./AdminTabBar"

// Không có PlanBanner/UpgradeDialog/RenewOffer: admin không có gói, không gọi plan.me (spec J mục 2).
export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-page">
      <div className="hidden h-full bg-white md:flex">
        <AdminSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader variant="admin" />
        {/* Mobile chừa chỗ tab bar (56px) + safe-area */}
        <main className="relative flex-1 overflow-y-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-10">
          {children}
        </main>
      </div>

      <AdminTabBar />
    </div>
  )
}
