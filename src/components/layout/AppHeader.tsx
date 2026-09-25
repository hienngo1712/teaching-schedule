"use client"

import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BookOpen, KeyRound, LogOut, Languages, Settings } from "lucide-react"
import { ChangePasswordDialog } from "./ChangePasswordDialog"
import { useTranslation } from "@/components/providers/LanguageProvider"

function getInitials(name?: string | null) {
  if (!name) return "GV"
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase() || "GV"
}

export function AppHeader() {
  const { data: session } = useSession()
  const { t, language, setLanguage } = useTranslation()
  const fullName = session?.user?.fullName ?? session?.user?.username ?? t("teacher_fallback")

  return (
    <header className="h-14 border-b border-slate-200 bg-white px-4 flex items-center justify-between">
      <span className="truncate text-sm text-slate-600">
        {t("hello")},{" "}
        <span className="font-medium text-slate-900">{fullName}</span>
      </span>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-600">
              <Languages className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={() => setLanguage("vi")}
              className={language === "vi" ? "bg-slate-100 font-medium" : ""}
            >
              {t("vietnamese")}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setLanguage("en")}
              className={language === "en" ? "bg-slate-100 font-medium" : ""}
            >
              {t("english")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="size-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold hover:bg-indigo-200"
              aria-label={t("account_menu")}
            >
              {getInitials(fullName)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/subjects">
                <BookOpen className="size-4 mr-2" />
                {t("subject")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="size-4 mr-2" />
                {t("settings")}
              </Link>
            </DropdownMenuItem>
            <ChangePasswordDialog
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <KeyRound className="size-4 mr-2" />
                  {t("change_password")}
                </DropdownMenuItem>
              }
            />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => signOut({ callbackUrl: "/login" })}
              className="text-red-600 focus:text-red-700"
            >
              <LogOut className="size-4 mr-2" />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
