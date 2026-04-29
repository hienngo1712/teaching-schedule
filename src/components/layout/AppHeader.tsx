"use client"

import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { KeyRound, LogOut, Menu } from "lucide-react"
import { ChangePasswordDialog } from "./ChangePasswordDialog"

type Props = {
  onToggleSidebar?: () => void
}

function getInitials(name?: string | null) {
  if (!name) return "GV"
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase() || "GV"
}

export function AppHeader({ onToggleSidebar }: Props) {
  const { data: session } = useSession()
  const fullName = session?.user?.fullName ?? session?.user?.username ?? "Giáo viên"

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
          Xin chào,{" "}
          <span className="font-medium text-slate-900">{fullName}</span>
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="size-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold hover:bg-indigo-200"
            aria-label="Mở menu tài khoản"
          >
            {getInitials(fullName)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <ChangePasswordDialog
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <KeyRound className="size-4 mr-2" />
                Đổi mật khẩu
              </DropdownMenuItem>
            }
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => signOut({ callbackUrl: "/login" })}
            className="text-red-600 focus:text-red-700"
          >
            <LogOut className="size-4 mr-2" />
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
