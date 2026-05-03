"use client"

import { useState } from "react"
import { CalendarDays, Clock, Edit2, MoreVertical, Trash2 } from "lucide-react"
import dayjs from "dayjs"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
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
import { trpc } from "@/lib/trpc"
import type { SessionDTO } from "@/server/services/session.service"
import { AttendancePanel } from "./AttendancePanel"

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

  const handleDelete = () => {
    deleteMutation.mutate({ id: session.id })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
                <Button variant="ghost" size="icon">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(session)}>
                  <Edit2 className="mr-2 size-4" />
                  Sửa ca dạy
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
