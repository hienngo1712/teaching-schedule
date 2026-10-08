"use client"

import { useState } from "react"
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
import { CircleHelp, DatabaseBackup, KeyRound, LogOut, Languages, MessageSquare, ShieldCheck } from "lucide-react"
import { ChangePasswordDialog } from "./ChangePasswordDialog"
import { BackupConfirmDialog } from "./BackupConfirmDialog"
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useBackupDownload } from "@/hooks/useBackupDownload"
import { RenewOffer } from "@/components/plan/RenewOffer"
import { WhatsNew } from "@/components/whats-new/WhatsNew"
import { CurrentPlanBadge } from "@/components/plan/CurrentPlanBadge"
import { ADMIN_HOME } from "@/lib/admin"

function getInitials(name?: string | null) {
  if (!name) return "GV"
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase() || "GV"
}

export function AppHeader({ variant = "teacher" }: { variant?: "teacher" | "admin" }) {
  const admin = variant === "admin"
  const { data: session } = useSession()
  const { t, language, setLanguage } = useTranslation()
  const backup = useBackupDownload()
  const [confirmBackup, setConfirmBackup] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const fullName = session?.user?.fullName ?? session?.user?.username ?? t("teacher_fallback")

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b bg-white px-4 md:h-16 md:px-8">
      {/* min-w-0: nút 44px bên phải to hơn, tên dài phải cắt chứ không đẩy tràn ngang. */}
      <span className="min-w-0 truncate text-sm text-muted-foreground">
        {t("hello")},{" "}
        <span className="font-medium text-foreground">{fullName}</span>
      </span>

      <div className="flex shrink-0 items-center gap-2">
        {/* Admin không dùng gói: không gọi plan.me, không nhắc gia hạn. */}
        {!admin && <RenewOffer />}
        {!admin && <WhatsNew />}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="size-11 text-slate-600 md:size-10">
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
              className="relative flex size-11 items-center justify-center rounded-full bg-[#EEF0F4] text-[13px] font-semibold text-[#374151] hover:bg-[#E5E7EB] md:size-10"
              aria-label={t("account_menu")}
            >
              {getInitials(fullName)}
              {/* Mobile không có sidebar/logo → nhãn gói đè góc avatar; desktop đã có ở sidebar. */}
              {!admin && <CurrentPlanBadge className="pointer-events-none absolute -right-1.5 -top-1.5 md:hidden" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {admin ? (
              <>
                <DropdownMenuItem asChild>
                  <Link href={ADMIN_HOME}>
                    <ShieldCheck className="size-4 mr-2" />
                    {t("admin_page")}
                  </Link>
                </DropdownMenuItem>
                {/* Admin không có sidebar giáo viên: đây là lối duy nhất vào Hướng dẫn. */}
                <DropdownMenuItem asChild>
                  <a href="/guide" target="_blank" rel="noopener noreferrer">
                    <CircleHelp className="size-4 mr-2" />
                    {t("guide_nav")}
                    <span className="sr-only"> {t("opens_new_tab")}</span>
                  </a>
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onSelect={() => setConfirmBackup(true)} disabled={backup.isDownloading}>
                  <DatabaseBackup className="size-4 mr-2" />
                  {t("backup_data")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}>
                  <MessageSquare className="size-4 mr-2" />
                  {t("feedback_menu")}
                </DropdownMenuItem>
              </>
            )}
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

        <BackupConfirmDialog
          open={confirmBackup}
          onOpenChange={setConfirmBackup}
          onConfirm={() => {
            setConfirmBackup(false)
            backup.download()
          }}
        />

        {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
      </div>
    </header>
  )
}
