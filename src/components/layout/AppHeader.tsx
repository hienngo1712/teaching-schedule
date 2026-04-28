"use client"

import { Button } from "@/components/ui/button"
import { LogOut, Menu } from "lucide-react"

type Props = {
  onToggleSidebar?: () => void
  fullName?: string
}

function getInitials(name?: string) {
  if (!name) return "GV"
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase() || "GV"
}

export function AppHeader({ onToggleSidebar, fullName = "Giáo viên" }: Props) {
  return (
    <header className="h-14 border-b border-slate-200 bg-white px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onToggleSidebar}
          aria-label="Mở menu"
        >
          <Menu className="size-5" />
        </Button>
        <span className="text-sm text-slate-600 hidden sm:inline">
          Xin chào, <span className="font-medium text-slate-900">{fullName}</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
          {getInitials(fullName)}
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </Button>
      </div>
    </header>
  )
}
