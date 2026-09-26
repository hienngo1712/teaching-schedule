"use client"

import { AppSidebar } from "./AppSidebar"
import { AppHeader } from "./AppHeader"
import { BottomTabBar } from "./BottomTabBar"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // 100dvh: thanh địa chỉ iOS Safari co giãn không làm nhảy layout như h-screen
    <div className="flex h-[100dvh] overflow-hidden bg-page">
      <div className="hidden h-full bg-white md:flex">
        <AppSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader />
        {/* Mobile chừa chỗ cho tab bar (56px) + thanh phân trang (~44px) + safe-area */}
        <main className="relative flex-1 overflow-y-auto p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] md:p-6 md:pb-24">
          {children}
        </main>
      </div>

      <BottomTabBar />
    </div>
  )
}
