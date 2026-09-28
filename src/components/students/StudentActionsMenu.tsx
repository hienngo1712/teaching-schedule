"use client"

import type { ReactNode } from "react"
import { CalendarDays, Link2, MoreHorizontal, Pencil, Trash2, UserCheck, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  isActive: boolean
  parentLinkLocked: boolean
  parentLinkBadge?: ReactNode
  onViewSchedule: () => void
  onParentLink: () => void
  onEdit: () => void
  onMarkDropped: () => void
  onMarkBack: () => void
  onDelete: () => void
}

// Mục có dòng mô tả để giáo viên phân biệt Đã nghỉ và Xóa (spec R1).
function TwoLine({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span>{title}</span>
      <span className="text-xs font-normal text-slate-500">{hint}</span>
    </span>
  )
}

export function StudentActionsMenu(p: Props) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={t("actions")}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem className="min-h-11 md:min-h-9" onSelect={p.onViewSchedule}>
          <CalendarDays className="mr-2 size-4" />
          {t("view_schedule")}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 md:min-h-9" onSelect={p.onParentLink}>
          <Link2 className="mr-2 size-4" />
          {t("parent_link")}
          {p.parentLinkBadge}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 md:min-h-9" onSelect={p.onEdit}>
          <Pencil className="mr-2 size-4" />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {p.isActive ? (
          <DropdownMenuItem className="min-h-11 items-start" onSelect={p.onMarkDropped}>
            <UserX className="mr-2 mt-0.5 size-4 shrink-0" />
            <TwoLine title={t("deactivate")} hint={t("mark_dropped_hint")} />
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="min-h-11 items-start" onSelect={p.onMarkBack}>
            <UserCheck className="mr-2 mt-0.5 size-4 shrink-0" />
            <TwoLine title={t("mark_back")} hint={t("mark_back_hint")} />
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="min-h-11 items-start text-red-600 focus:text-red-700" onSelect={p.onDelete}>
          <Trash2 className="mr-2 mt-0.5 size-4 shrink-0" />
          <TwoLine title={t("delete_student_menu")} hint={t("delete_student_hint")} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
