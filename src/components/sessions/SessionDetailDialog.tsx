"use client"

import { useState } from "react"
import { CalendarDays, Clock, Copy, Edit2, Loader2, MoreVertical, Trash2, UserPlus } from "lucide-react"
import dayjs from "dayjs"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Calendar } from "@/components/ui/calendar"
import { trpc } from "@/lib/trpc"
import type { SessionDTO } from "@/server/services/session.service"
import { AttendancePanel } from "./AttendancePanel"
import { StudentPicker } from "./StudentPicker"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: SessionDTO
  onEdit: (session: SessionDTO) => void
}

export function SessionDetailDialog({
  open,
  onOpenChange,
  session,
  onEdit,
}: Props) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false)
  const [isAddStudentsOpen, setIsAddStudentsOpen] = useState(false)
  const [targetDate, setTargetDate] = useState<Date | undefined>(
    dayjs(session.sessionDate).add(7, "day").toDate()
  )
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([])
  const utils = trpc.useUtils()

  const deleteMutation = trpc.session.delete.useMutation({
    onSuccess: () => {
      toast.success("Đã xóa ca dạy")
      utils.session.getMonth.invalidate()
      onOpenChange(false)
    },
    onError: () => {
      toast.error("Đã có lỗi xảy ra khi xóa ca dạy")
    },
  })

  const duplicateMutation = trpc.session.duplicate.useMutation({
    onSuccess: () => {
      toast.success("Đã nhân bản ca dạy thành công")
      utils.session.getMonth.invalidate()
      setIsDuplicateDialogOpen(false)
    },
    onError: (err) => {
      toast.error(err.message || "Đã có lỗi xảy ra khi nhân bản")
    },
  })

  const addStudentsMutation = trpc.session.addStudents.useMutation({
    onSuccess: () => {
      toast.success("Đã cập nhật danh sách học sinh")
      utils.session.getMonth.invalidate()
      utils.attendance.get.invalidate({ sessionId: session.id })
      setIsAddStudentsOpen(false)
    },
    onError: (err) => {
      toast.error(err.message || "Đã có lỗi xảy ra")
    },
  })

  const handleDelete = () => {
    deleteMutation.mutate({ id: session.id })
  }

  const handleDuplicate = () => {
    if (!targetDate) return
    duplicateMutation.mutate({
      id: session.id,
      targetDate: dayjs(targetDate).format("YYYY-MM-DD"),
    })
  }

  const handleOpenAddStudents = () => {
    setSelectedStudentIds(session.students.map((s) => s.studentId))
    setIsAddStudentsOpen(true)
  }

  const handleSaveStudents = () => {
    addStudentsMutation.mutate({
      sessionId: session.id,
      studentIds: selectedStudentIds,
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full h-full max-w-none sm:h-auto sm:max-w-[600px] sm:max-h-[90vh] overflow-y-auto sm:rounded-lg top-0 left-0 translate-x-0 translate-y-0 sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]">
          <DialogHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <DialogTitle className="text-xl flex items-center gap-2">
                <div
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: session.subject.color }}
                />
                <span className="truncate">
                  {session.title || session.subject.name}
                </span>
              </DialogTitle>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <CalendarDays className="size-4" />
                  {dayjs(session.sessionDate).format("DD/MM/YYYY")}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="size-4" />
                  {session.startTime} – {session.endTime} ({session.durationMins}p)
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menu hành động">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(session)}>
                  <Edit2 className="mr-2 size-4" />
                  Sửa ca dạy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenAddStudents}>
                  <UserPlus className="mr-2 size-4" />
                  Thêm học sinh
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsDuplicateDialogOpen(true)}>
                  <Copy className="mr-2 size-4" />
                  Nhân bản ca dạy
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Xóa ca dạy
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DialogHeader>

          {session.notes && (
            <div className="bg-slate-50 p-3 rounded-md text-sm text-slate-600 whitespace-pre-wrap">
              <span className="font-semibold block mb-1">Ghi chú:</span>
              {session.notes}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Điểm danh học sinh</h3>
              <Badge variant="outline">{session.studentCount} học sinh</Badge>
            </div>
            
            <AttendancePanel sessionId={session.id} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddStudentsOpen} onOpenChange={setIsAddStudentsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Quản lý học sinh trong ca</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <StudentPicker
              value={selectedStudentIds}
              onChange={setSelectedStudentIds}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAddStudentsOpen(false)}
              disabled={addStudentsMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              onClick={handleSaveStudents}
              disabled={addStudentsMutation.isPending}
            >
              {addStudentsMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nhân bản ca dạy</DialogTitle>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center">
            <p className="text-sm text-slate-500 mb-4 text-center">
              Chọn ngày để nhân bản ca dạy này. Giờ dạy và danh sách học sinh sẽ được giữ nguyên.
            </p>
            <Calendar
              mode="single"
              selected={targetDate}
              onSelect={setTargetDate}
              className="rounded-md border shadow"
              initialFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsDuplicateDialogOpen(false)}
              disabled={duplicateMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              onClick={handleDuplicate}
              disabled={duplicateMutation.isPending || !targetDate}
            >
              {duplicateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Nhân bản
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Ca dạy này và toàn bộ dữ liệu điểm danh liên quan sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Xóa ca dạy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
