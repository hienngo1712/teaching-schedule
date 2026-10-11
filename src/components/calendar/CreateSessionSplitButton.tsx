"use client"

import { CalendarPlus, ChevronDown, Plus, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { LockBadge } from "@/components/plan/LockBadge"

type Props = { onCreate: () => void; onBulkCreate: () => void; onCopyMonth: () => void }

// Như AddStudentSplitButton: nút chính Tạo ca dạy, ▾ gồm Lịch lặp + Chép lịch tháng.
export function CreateSessionSplitButton({ onCreate, onBulkCreate, onCopyMonth }: Props) {
  const { t } = useTranslation()
  const copyGate = useFeatureGate("copyMonth")

  return (
    <div className="flex">
      <Button onClick={onCreate} className="h-11 rounded-r-none md:h-10" data-tour="session-add">
        <Plus className="mr-2 size-4" />
        {t("create_session")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("more_options")}
            data-testid="create-session-more"
            className="h-11 w-11 rounded-l-none border-l border-primary-foreground/30 px-0 md:h-10 md:w-9"
          >
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-11 gap-2 md:min-h-9" onSelect={onBulkCreate}>
            <Repeat className="size-4" />
            {t("bulk_schedule")}
          </DropdownMenuItem>
          {/* Khóa chứ không ẩn (spec I): Standard chọn mở UpgradeDialog thay vì dialog chép. */}
          <DropdownMenuItem
            className="min-h-11 gap-2 md:min-h-9"
            data-testid="copy-month-button"
            onSelect={copyGate.guard(onCopyMonth)}
          >
            <CalendarPlus className="size-4" />
            {t("copy_month")}
            {copyGate.locked && <LockBadge plan={copyGate.requiredPlan} className="ml-auto pl-2" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
