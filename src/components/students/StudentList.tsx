"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CalendarDays, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc"
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

type StudentRow = {
  id: number
  fullName: string
  grade: number
  level: "tieu_hoc" | "thcs"
  parentPhone: string | null
  parentName: string | null
  notes: string | null
  isActive: boolean
  tuitionFee: number
}

const ALL_GRADES_VALUE = "all"

export function StudentList() {
  const utils = trpc.useUtils()
  const router = useRouter()
  const { selectedGrade, searchStudentName, setGrade, setSearch } = useFilters()

  const [localSearch, setLocalSearch] = useState(searchStudentName)
  const debouncedSearch = useDebounce(localSearch, 400)

  useEffect(() => {
    setSearch(debouncedSearch)
  }, [debouncedSearch, setSearch])

  useEffect(() => {
    setLocalSearch(searchStudentName)
  }, [searchStudentName])

  const listQuery = trpc.student.list.useQuery({
    grade: selectedGrade ?? undefined,
    search: searchStudentName.trim() || undefined,
    isActive: undefined, // Lấy cả đang học và đã nghỉ
  })

  const [formState, setFormState] = useState<
    | { open: false }
    | { open: true; mode: "create" }
    | { open: true; mode: "edit"; student: StudentRow }
  >({ open: false })

  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null)

  const deleteMut = trpc.student.delete.useMutation({
    onSuccess: () => {
      utils.student.list.invalidate()
      toast.success("Đã xóa học sinh")
      setDeleteTarget(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const students = listQuery.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <Input
            placeholder="Tìm tên học sinh..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full sm:w-64"
        />

        <Select
          value={selectedGrade === null ? ALL_GRADES_VALUE : String(selectedGrade)}
          onValueChange={(v) =>
            setGrade(v === ALL_GRADES_VALUE ? null : Number(v))
          }
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tất cả lớp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_GRADES_VALUE}>Tất cả lớp</SelectItem>
            {GRADES.map((g) => (
              <SelectItem key={g} value={String(g)}>
                Lớp {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="sm:ml-auto">
          <Button
            onClick={() => setFormState({ open: true, mode: "create" })}
            className="w-full sm:w-auto"
          >
            <UserPlus className="size-4 mr-2" />
            Thêm học sinh
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">STT</TableHead>
                <TableHead className="min-w-[140px] max-w-[200px]">Họ và tên</TableHead>
                <TableHead className="w-16">Lớp</TableHead>
                <TableHead className="w-32">Cấp</TableHead>
                <TableHead className="w-32">Học phí/ Buổi</TableHead>
                <TableHead className="w-28">Trạng thái</TableHead>
                <TableHead className="hidden md:table-cell">SĐT PH</TableHead>
                <TableHead className="hidden lg:table-cell">Tên PH</TableHead>
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
                    Chưa có học sinh nào.
                    {selectedGrade === null && searchStudentName === "" && (
                      <>
                        {" "}
                        Nhấn{" "}
                        <span className="font-medium">+ Thêm học sinh</span> để
                        bắt đầu.
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                students.map((s, idx) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-center">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{s.fullName}</TableCell>
                    <TableCell>{s.grade}</TableCell>
                    <TableCell>
                      {s.level === "tieu_hoc" ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Tiểu học
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          Trung học cơ sở
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-slate-700 font-medium">
                      {formatCurrency(s.tuitionFee)}
                    </TableCell>
                    <TableCell>
                      {s.isActive ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                          Đang học
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-50 text-red-600 hover:bg-red-50 border-red-100">
                          Đã nghỉ
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
                            Xem lịch
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
                            Sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-700"
                            onSelect={() => setDeleteTarget(s)}
                          >
                            <Trash2 className="size-4 mr-2" />
                            Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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
            <AlertDialogTitle>Xóa học sinh?</AlertDialogTitle>
            <AlertDialogDescription>
              Học sinh{" "}
              <span className="font-medium text-slate-900">
                {deleteTarget?.fullName}
              </span>{" "}
              sẽ bị ẩn khỏi danh sách. Dữ liệu lịch sử vẫn được giữ lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              onClick={() =>
                deleteTarget && deleteMut.mutate({ id: deleteTarget.id })
              }
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMut.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
