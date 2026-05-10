"use client"

import { useState } from "react"
import { AppSidebar } from "./AppSidebar"
import { AppHeader } from "./AppHeader"
import { cn } from "@/lib/utils"

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full bg-white">
        <AppSidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className={cn(
              "md:hidden fixed inset-y-0 left-0 z-50",
              "transition-transform"
            )}
          >
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader onToggleSidebar={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-24 relative">
          {children}
        </main>
      </div>
    </div>
  )
}
