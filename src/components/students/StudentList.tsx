"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CalendarDays, MoreHorizontal, Pencil, Phone, Trash2, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { GRADES } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { useFilters } from "@/hooks/useFilters"
import { useDebounce } from "@/hooks/useDebounce"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { UpgradeAllClassesButton } from "./UpgradeAllClassesButton"
import { ImportStudentsButton } from "./ImportStudentsDialog"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { PageHeader } from "@/components/common/PageHeader"
import { FilterBar } from "@/components/common/FilterBar"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"

type StudentRow = RouterOutputs["student"]["list"]["items"][number]

const ALL_GRADES_VALUE = "all"

export function StudentList() {
  const router = useRouter()
  const { t } = useTranslation()
  const { selectedGrade, searchStudentName, setGrade, setSearch } = useFilters()

  const [localSearch, setLocalSearch] = useState(searchStudentName)
  const debouncedSearch = useDebounce(localSearch, 400)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active")

  useEffect(() => {
    setSearch(debouncedSearch)
    setCurrentPage(1) // Reset to page 1 when search changes
  }, [debouncedSearch, setSearch])

  useEffect(() => {
    setLocalSearch(searchStudentName)
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

  const deleteMut = trpc.student.delete.useMutation({
    onSuccess: () => {
      toast.success(t("delete_success"))
      setDeleteTarget(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const students = listQuery.data?.items ?? []
  const totalItems = listQuery.data?.totalCount ?? 0
  const totalPages = listQuery.data?.totalPages ?? 0

  const levelBadge = (s: StudentRow) =>
    s.level === "tieu_hoc" ? (
      <Badge variant="outline" className="whitespace-nowrap border-blue-200 bg-blue-50 text-blue-700">
        {t("primary_school")}
      </Badge>
    ) : (
      <Badge variant="outline" className="whitespace-nowrap border-emerald-200 bg-emerald-50 text-emerald-700">
        {t("secondary_school")}
      </Badge>
    )

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

  const actionsMenu = (s: StudentRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={t("actions")}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => router.push(`/calendar?studentId=${s.id}`)}>
          <CalendarDays className="mr-2 size-4" />
          {t("view_schedule")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setFormState({ open: true, mode: "edit", student: s })}>
          <Pencil className="mr-2 size-4" />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => setDeleteTarget(s)}>
          <Trash2 className="mr-2 size-4" />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const offset = (currentPage - 1) * pageSize
  const columns: Column<StudentRow>[] = [
    { header: t("stt"), cell: (_, i) => offset + i + 1, className: "w-12 text-center" },
    { header: t("full_name"), cell: (s) => <span className="font-medium">{s.fullName}</span> },
    { header: t("grade"), cell: (s) => s.grade, className: "w-16" },
    { header: t("level"), cell: levelBadge, className: "w-32" },
    { header: t("tuition_fee"), cell: (s) => formatCurrency(s.tuitionFee), className: "w-32 text-right font-medium text-slate-700" },
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
        actions={
          <>
            <UpgradeAllClassesButton />
            <ImportStudentsButton />
            <Button onClick={() => setFormState({ open: true, mode: "create" })} className="h-11 md:h-10">
              <UserPlus className="mr-2 size-4" />
              {t("add_student")}
            </Button>
          </>
        }
      />

      <FilterBar
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
          <div className="rounded-lg border border-slate-200 bg-white p-4">
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
                {formatCurrency(s.tuitionFee)}
                <span className="font-normal text-slate-500">{t("per_session")}</span>
              </span>
              {s.parentPhone && (
                <a href={`tel:${s.parentPhone}`} className="inline-flex min-h-11 items-center gap-1.5 text-indigo-700">
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_student")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("student")}{" "}
              <span className="font-medium text-slate-900">
                {deleteTarget?.fullName}
              </span>{" "}
              {t("delete_student_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              onClick={() =>
                deleteTarget && deleteMut.mutate({ id: deleteTarget.id })
              }
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMut.isPending ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
