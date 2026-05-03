"use client"

import { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { trpc } from "@/lib/trpc"
import { ATTENDANCE_LABEL, ATTENDANCE_STATUS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { AttendanceStatus } from "@/lib/schemas/attendance"

type Props = {
  sessionId: number
}

type AttendanceState = {
  studentId: number
  attendance: AttendanceStatus
  note: string
}

export function AttendancePanel({ sessionId }: Props) {
  const utils = trpc.useUtils()
  
  const { data: attendanceData, isLoading } = trpc.attendance.get.useQuery({
    sessionId,
  })

  const [attendances, setAttendances] = useState<Record<number, AttendanceState>>({})

  // Initialize state when data is loaded
  useEffect(() => {
    if (attendanceData) {
      const initialState: Record<number, AttendanceState> = {}
      attendanceData.forEach((item) => {
        initialState[item.studentId] = {
          studentId: item.studentId,
          attendance: item.attendance as AttendanceStatus,
          note: item.note || "",
        }
      })
      setAttendances(initialState)
    }
  }, [attendanceData])

  const updateMutation = trpc.attendance.update.useMutation({
    onSuccess: () => {
      toast.success("Đã lưu điểm danh")
      utils.attendance.get.invalidate({ sessionId })
    },
    onError: () => {
      toast.error("Đã có lỗi xảy ra khi lưu điểm danh")
    },
  })

  const handleUpdateStatus = (studentId: number, status: AttendanceStatus) => {
    setAttendances((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], attendance: status },
    }))
  }

  const handleUpdateNote = (studentId: number, note: string) => {
    setAttendances((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], note },
    }))
  }

  const handleMarkAllPresent = () => {
    const newState = { ...attendances }
    Object.keys(newState).forEach((key) => {
      newState[Number(key)].attendance = "present"
    })
    setAttendances(newState)
  }

  const handleSave = () => {
    const payload = Object.values(attendances).map((a) => ({
      studentId: a.studentId,
      attendance: a.attendance,
      note: a.note.trim() === "" ? undefined : a.note,
    }))
    updateMutation.mutate({ sessionId, attendances: payload })
  }

  if (isLoading) {
    return <div className="text-center py-4 text-slate-500">Đang tải danh sách học sinh...</div>
  }

  if (!attendanceData || attendanceData.length === 0) {
    return <div className="text-center py-4 text-slate-500">Chưa có học sinh nào trong ca học này.</div>
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-md divide-y">
        {attendanceData.map((student) => {
          const state = attendances[student.studentId]
          if (!state) return null

          return (
            <div
              key={student.studentId}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white hover:bg-slate-50"
            >
              <div className="flex-1 flex items-center justify-between sm:justify-start gap-4">
                <div>
                  <div className="font-medium text-sm text-slate-900">
                    {student.fullName}
                  </div>
                  <div className="text-xs text-slate-500">
                    Lớp {student.grade}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select
                  value={state.attendance}
                  onValueChange={(val) =>
                    handleUpdateStatus(student.studentId, val as AttendanceStatus)
                  }
                >
                  <SelectTrigger
                    className={cn(
                      "w-[140px] h-8 text-xs font-medium",
                      state.attendance === "present" && "bg-green-50 text-green-700 border-green-200",
                      state.attendance === "absent" && "bg-red-50 text-red-700 border-red-200",
                      state.attendance === "late" && "bg-amber-50 text-amber-700 border-amber-200",
                      state.attendance === "pending" && "bg-slate-50 text-slate-600 border-slate-200"
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ATTENDANCE_STATUS).map(([, value]) => (
                      <SelectItem key={value} value={value}>
                        {ATTENDANCE_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Ghi chú..."
                  value={state.note}
                  onChange={(e) =>
                    handleUpdateNote(student.studentId, e.target.value)
                  }
                  className="flex-1 sm:w-[150px] h-8 text-xs"
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllPresent}
          className="text-xs text-slate-600"
        >
          <Check className="mr-1 size-3" />
          Tất cả có mặt
        </Button>
        
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Lưu điểm danh
        </Button>
      </div>
    </div>
  )
}
