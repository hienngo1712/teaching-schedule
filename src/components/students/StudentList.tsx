"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Phone } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { DeleteStudentDialog } from "./DeleteStudentDialog"
import { StudentActionsMenu } from "./StudentActionsMenu"
import { GRADES } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import type { SchoolLevel } from "@/lib/types/models"
import { useFilters } from "@/hooks/useFilters"
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { StudentFormDialog } from "./StudentFormDialog"
import { ParentLinkDialog } from "./ParentLinkDialog"
import { UpgradeAllClassesButton } from "./UpgradeAllClassesButton"
import { ImportStudentsDialog } from "./ImportStudentsDialog"
import { AddStudentSplitButton } from "./AddStudentSplitButton"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { PageHeader } from "@/components/common/PageHeader"
import { FilterBar } from "@/components/common/FilterBar"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { usePlan } from "@/hooks/usePlan"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { LockBadge } from "@/components/plan/LockBadge"
import { openUpgrade } from "@/components/plan/upgrade-store"
import { studentLimitMessage } from "@/components/plan/limit-message"
import { PLAN_LABEL, minPlanForStudents } from "@/lib/plans"

type StudentRow = RouterOutputs["student"]["list"]["items"][number]

const ALL_GRADES_VALUE = "all"
// Record theo SchoolLevel: thêm cấp mới mà quên nhãn thì TypeScript báo lỗi (nhánh else cũ gắn nhầm THCS cho lớp 10–12).
const LEVEL_BADGE: Record<SchoolLevel, { className: string; labelKey: "primary_school" | "secondary_school" | "high_school" }> = {
  tieu_hoc: { className: "border-blue-200 bg-blue-50 text-blue-700", labelKey: "primary_school" },
  thcs: { className: "border-emerald-200 bg-emerald-50 text-emerald-700", labelKey: "secondary_school" },
  thpt: { className: "border-amber-200 bg-amber-50 text-amber-800", labelKey: "high_school" },
}

export function StudentList() {
  const router = useRouter()
  const { t } = useTranslation()
  const { selectedGrade, searchStudentName, setGrade, setSearch } = useFilters()
  const { me } = usePlan()
  const linkGate = useFeatureGate("parentLink")
  const limit = me?.studentLimit ?? null
  const atLimit = !!me && limit !== null && me.activeStudents >= limit
  const openLimit = () => {
    if (!me || limit === null) return
    openUpgrade({ plan: minPlanForStudents(me.activeStudents + 1), message: studentLimitMessage(t, me.plan, limit) })
  }


  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active")

  const [localSearch, setLocalSearch] = useDebouncedSearch(searchStudentName, setSearch)

  useEffect(() => {
    setCurrentPage(1) // Reset to page 1 when search changes
  }, [searchStudentName])

  useEffect(() => {
    setCurrentPage(1) // Reset to page 1 when grade changes
  }, [selectedGrade])

  useEffect(() => {
    setCurrentPage(1) // Reset to page 1 when status filter changes
  }, [statusFilter])

  const statusQuery =
    statusFilter === "all"
      ? { includeInactive: true as const }
      : { isActive: statusFilter === "active" }

  const listQuery = trpc.student.list.useQuery({
    grade: selectedGrade ?? undefined,
    search: searchStudentName.trim() || undefined,
    ...statusQuery,
    page: currentPage,
    limit: pageSize,
  })

  const [formState, setFormState] = useState<
    | { open: false }
    | { open: true; mode: "create" }
    | { open: true; mode: "edit"; student: StudentRow }
  >({ open: false })

  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<StudentRow | null>(null)
  const [parentLinkTarget, setParentLinkTarget] = useState<StudentRow | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const utils = trpc.useUtils()
  const deactivateMut = trpc.student.deactivate.useMutation({
    onSuccess: () => {
      toast.success(t("deactivate_success"))
      setDeactivateTarget(null)
      utils.student.list.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const students = listQuery.data?.items ?? []
  const totalItems = listQuery.data?.totalCount ?? 0
  const totalPages = listQuery.data?.totalPages ?? 0

  const levelBadge = (s: StudentRow) => {
    const { className, labelKey } = LEVEL_BADGE[s.level]
    return (
      <Badge variant="outline" className={`whitespace-nowrap ${className}`}>
        {t(labelKey)}
      </Badge>
    )
  }

  const statusBadge = (s: StudentRow) =>
    s.isActive ? (
      <Badge className="whitespace-nowrap border-green-200 bg-green-100 text-green-700 hover:bg-green-100">
        {t("studying")}
      </Badge>
    ) : (
      <Badge variant="secondary" className="whitespace-nowrap border-red-100 bg-red-50 text-red-600 hover:bg-red-50">
        {t("dropped")}
      </Badge>
    )

  const markBackMut = trpc.student.update.useMutation({
    onSuccess: () => {
      toast.success(t("mark_back_success"))
      utils.student.list.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const actionsMenu = (s: StudentRow) => (
    <StudentActionsMenu
      isActive={s.isActive}
      parentLinkLocked={linkGate.locked}
      parentLinkBadge={linkGate.locked ? <LockBadge plan={linkGate.requiredPlan} className="ml-auto pl-2" /> : undefined}
      onViewSchedule={() => router.push(`/calendar?studentId=${s.id}`)}
      onParentLink={() => (linkGate.locked && !s.parentLinkToken ? linkGate.openUpgrade() : setParentLinkTarget(s))}
      onEdit={() => setFormState({ open: true, mode: "edit", student: s })}
      onMarkDropped={() => setDeactivateTarget(s)}
      onMarkBack={() => markBackMut.mutate({ id: s.id, data: { isActive: true } })}
      onDelete={() => setDeleteTarget(s)}
    />
  )

  const offset = (currentPage - 1) * pageSize
  const columns: Column<StudentRow>[] = [
    { header: t("stt"), cell: (_, i) => offset + i + 1, className: "w-12 text-center" },
    { header: t("full_name"), cell: (s) => <span className="font-medium">{s.fullName}</span> },
    { header: t("grade"), cell: (s) => s.grade, className: "w-16" },
    { header: t("level"), cell: levelBadge, className: "w-32" },
    {
      header: t("tuition_fee"),
      cell: (s) => (
        <span>
          {formatCurrency(s.billingMode === "monthly" ? s.monthlyFee : s.tuitionFee)}
          <span className="ml-1 text-xs font-normal text-slate-500">
            {s.billingMode === "monthly" ? t("per_month") : t("per_session")}
          </span>
        </span>
      ),
      className: "w-36 text-right font-medium text-slate-700",
    },
    { header: t("status"), cell: statusBadge, className: "w-28" },
    { header: t("parent_phone"), cell: (s) => s.parentPhone || "-", className: "text-slate-600" },
    { header: t("parent_name"), cell: (s) => s.parentName || "-", className: "hidden lg:table-cell text-slate-600" },
    { header: <span className="sr-only">{t("actions")}</span>, cell: actionsMenu, className: "w-12" },
  ]

  const activeFilterCount = (selectedGrade !== null ? 1 : 0) + (statusFilter !== "active" ? 1 : 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("students")}
      />

      {atLimit && me && limit !== null && (
        <div
          data-testid="plan-limit-strip"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >
          <p className="min-w-0 flex-1">
            {t("plan_over_limit")
              .replace("{count}", String(me.activeStudents))
              .replace("{limit}", String(limit))
              .replace("{plan}", PLAN_LABEL[me.plan])}
          </p>
          <Link href="/plan" className="inline-flex min-h-11 items-center font-medium underline">
            {t("plan_view_plans")}
          </Link>
        </div>
      )}

      <FilterBar
        actions={
          <>
            <UpgradeAllClassesButton />
            <AddStudentSplitButton
              onAdd={() => (atLimit ? openLimit() : setFormState({ open: true, mode: "create" }))}
              onImport={() => setImportOpen(true)}
              addLockPlan={atLimit && me ? minPlanForStudents(me.activeStudents + 1) : null}
            />
          </>
        }
        search={{ value: localSearch, onChange: setLocalSearch, placeholder: t("search_student") }}
        activeCount={activeFilterCount}
        filters={
          <>
            <Select
              value={selectedGrade === null ? ALL_GRADES_VALUE : String(selectedGrade)}
              onValueChange={(v) => setGrade(v === ALL_GRADES_VALUE ? null : Number(v))}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("all_grades")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GRADES_VALUE}>{t("all_grades")}</SelectItem>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    {t("grade")} {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "active" | "inactive" | "all")}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("studying")}</SelectItem>
                <SelectItem value="inactive">{t("dropped")}</SelectItem>
                <SelectItem value="all">{t("all_status")}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <ResponsiveList
        items={students}
        getKey={(s) => s.id}
        columns={columns}
        isLoading={listQuery.isPending}
        isError={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        emptyText={
          <>
            {t("no_students_message")}
            {selectedGrade === null && searchStudentName === "" && <> {t("click_add_student_hint")}</>}
          </>
        }
        renderCard={(s) => (
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{s.fullName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
                  <span>{t("grade")} {s.grade}</span>
                  {levelBadge(s)}
                  {!s.isActive && statusBadge(s)}
                </div>
              </div>
              {actionsMenu(s)}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-slate-900">
                {formatCurrency(s.billingMode === "monthly" ? s.monthlyFee : s.tuitionFee)}
                <span className="font-normal text-slate-500">
                  {s.billingMode === "monthly" ? t("per_month") : t("per_session")}
                </span>
              </span>
              {s.parentPhone && (
                <a href={`tel:${s.parentPhone}`} className="inline-flex min-h-11 items-center gap-1.5 text-primary">
                  <Phone className="size-4" />
                  {s.parentPhone}
                </a>
              )}
            </div>
          </div>
        )}
      />

      <DataTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        totalItems={totalItems}
      />

      <StudentFormDialog
        open={formState.open}
        onOpenChange={(open) =>
          setFormState(open ? formState : { open: false })
        }
        mode={formState.open ? formState.mode : "create"}
        student={
          formState.open && formState.mode === "edit"
            ? formState.student
            : undefined
        }
      />

      {parentLinkTarget && (
        <ParentLinkDialog
          key={parentLinkTarget.id}
          student={parentLinkTarget}
          onOpenChange={(open) => !open && setParentLinkTarget(null)}
          canGenerate={linkGate.allowed}
        />
      )}

      {deleteTarget && (
        <DeleteStudentDialog
          student={deleteTarget}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null)
              utils.student.list.invalidate()
            }
          }}
        />
      )}

      <AlertDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deactivate_student")}</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-slate-900">{deactivateTarget?.fullName}</strong>{" "}
              {t("deactivate_student_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateMut.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivateMut.isPending}
              onClick={() =>
                deactivateTarget && deactivateMut.mutate({ id: deactivateTarget.id })
              }
            >
              {deactivateMut.isPending ? t("processing") : t("deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {importOpen && <ImportStudentsDialog onClose={() => setImportOpen(false)} />}
    </div>
  )
}
