"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CalendarDays, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { GRADES } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { useFilters } from "@/hooks/useFilters"
import { useDebounce } from "@/hooks/useDebounce"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { useTranslation } from "@/components/providers/LanguageProvider"

type StudentRow = RouterOutputs["student"]["list"]["items"][number]

const ALL_GRADES_VALUE = "all"

export function StudentList() {
  const router = useRouter()
  const { t } = useTranslation()
  const { selectedGrade, searchStudentName, setGrade, setSearch } = useFilters()

  const [localSearch, setLocalSearch] = useState(searchStudentName)
  const debouncedSearch = useDebounce(localSearch, 400)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <Select
          value={selectedGrade === null ? ALL_GRADES_VALUE : String(selectedGrade)}
          onValueChange={(v) =>
            setGrade(v === ALL_GRADES_VALUE ? null : Number(v))
          }
        >
          <SelectTrigger className="w-full sm:w-40">
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

        <Input
          placeholder={t("search_student")}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="w-full sm:w-64"
        />

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as "active" | "inactive" | "all")}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t("studying")}</SelectItem>
            <SelectItem value="inactive">{t("dropped")}</SelectItem>
            <SelectItem value="all">{t("all_status")}</SelectItem>
          </SelectContent>
        </Select>

        <div className="sm:ml-auto flex flex-col sm:flex-row gap-2">
          <UpgradeAllClassesButton />
          <Button
            onClick={() => setFormState({ open: true, mode: "create" })}
            className="w-full sm:w-auto"
          >
            <UserPlus className="size-4 mr-2" />
            {t("add_student")}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">{t("stt")}</TableHead>
                <TableHead className="min-w-[140px] max-w-[200px]">{t("full_name")}</TableHead>
                <TableHead className="w-16">{t("grade")}</TableHead>
                <TableHead className="w-32">{t("level")}</TableHead>
                <TableHead className="w-32 text-right">{t("tuition_fee")}</TableHead>
                <TableHead className="w-28">{t("status")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("parent_phone")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("parent_name")}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-sm text-slate-500 py-12"
                  >
                    {t("no_students_message")}
                    {selectedGrade === null && searchStudentName === "" && (
                      <>
                        {" "}
                        {t("click_add_student_hint")}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                students.map((s, idx) => {
                  const actualIndex = (currentPage - 1) * pageSize + idx + 1
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-center">{actualIndex}</TableCell>
                      <TableCell className="font-medium">{s.fullName}</TableCell>
                    <TableCell>{s.grade}</TableCell>
                    <TableCell>
                      {s.level === "tieu_hoc" ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {t("primary_school")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          {t("secondary_school")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-slate-700 font-medium">
                      {formatCurrency(s.tuitionFee)}
                    </TableCell>
                    <TableCell>
                      {s.isActive ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                          {t("studying")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-50 text-red-600 hover:bg-red-50 border-red-100">
                          {t("dropped")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-slate-600">
                      {s.parentPhone || "-"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-slate-600">
                      {s.parentName || "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => router.push(`/calendar?studentId=${s.id}`)}
                          >
                            <CalendarDays className="size-4 mr-2" />
                            {t("view_schedule")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              setFormState({
                                open: true,
                                mode: "edit",
                                student: s,
                              })
                            }
                          >
                            <Pencil className="size-4 mr-2" />
                            {t("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-700"
                            onSelect={() => setDeleteTarget(s)}
                          >
                            <Trash2 className="size-4 mr-2" />
                            {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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
