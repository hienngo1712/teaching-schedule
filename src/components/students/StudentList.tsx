"use client"

import { useState } from "react"
import { toast } from "sonner"
import { MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react"
import { trpc } from "@/lib/trpc"
import { GRADES } from "@/lib/constants"
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
}

const ALL_GRADES_VALUE = "all"

export function StudentList() {
  const utils = trpc.useUtils()

  const [grade, setGrade] = useState<number | null>(null)
  const [search, setSearch] = useState("")

  const listQuery = trpc.student.list.useQuery({
    grade: grade ?? undefined,
    search: search.trim() || undefined,
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
        <Select
          value={grade === null ? ALL_GRADES_VALUE : String(grade)}
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

        <Input
          placeholder="Tìm tên học sinh..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />

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

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">STT</TableHead>
              <TableHead>Họ và tên</TableHead>
              <TableHead className="w-16">Lớp</TableHead>
              <TableHead className="w-24">Cấp</TableHead>
              <TableHead className="hidden md:table-cell">SĐT PH</TableHead>
              <TableHead className="hidden lg:table-cell">Tên PH</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : students.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-slate-500 py-12"
                >
                  Chưa có học sinh nào.
                  {grade === null && search === "" && (
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
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium">{s.fullName}</TableCell>
                  <TableCell>{s.grade}</TableCell>
                  <TableCell>
                    {s.level === "tieu_hoc" ? (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                        Tiểu học
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        THCS
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
