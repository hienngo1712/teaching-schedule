"use client"

import { ChevronDown, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { LockBadge } from "@/components/plan/LockBadge"
import type { PaidPlan } from "@/lib/plans"

type Props = { onAdd: () => void; onImport: () => void; addLockPlan: PaidPlan | null }

export function AddStudentSplitButton({ onAdd, onImport, addLockPlan }: Props) {
  const { t } = useTranslation()
  const importGate = useFeatureGate("studentImport")

  return (
    <div className="flex">
      <Button onClick={onAdd} className="h-11 rounded-r-none md:h-10" data-tour="student-add">
        <UserPlus className="mr-2 size-4" />
        {t("add_student")}
        {addLockPlan && <LockBadge plan={addLockPlan} className="ml-1.5" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("more_options")}
            data-testid="add-student-more"
            className="h-11 w-11 rounded-l-none border-l border-primary-foreground/30 px-0 md:h-10 md:w-9"
            data-tour="student-add-more"
          >
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Chưa biết gói: khóa tạm, không mở dialog nhập cũng không popup nâng cấp nhầm (luật cũ của nút Nhập Excel). */}
          <DropdownMenuItem
            className="min-h-11 md:min-h-0"
            disabled={!importGate.allowed && !importGate.locked}
            onSelect={() => (importGate.allowed ? onImport() : importGate.openUpgrade())}
            data-tour="student-import-item"
          >
            {t("import_excel")}
            {importGate.locked && <LockBadge plan={importGate.requiredPlan} className="ml-auto pl-2" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
