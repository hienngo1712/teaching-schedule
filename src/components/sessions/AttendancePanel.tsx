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
  fee: number
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
          fee: item.fee ?? 0,
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

  const handleUpdateFee = (studentId: number, fee: number) => {
    setAttendances((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], fee },
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
      fee: a.fee,
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
      <div className="border rounded-md divide-y overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-3 py-2 font-medium">Học sinh</th>
              <th className="px-3 py-2 font-medium w-[160px]">Điểm danh</th>
              <th className="px-3 py-2 font-medium w-[120px]">Học phí</th>
              <th className="px-3 py-2 font-medium">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {attendanceData.map((student) => {
              const state = attendances[student.studentId]
              if (!state) return null

              return (
                <tr key={student.studentId} className="bg-white hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{student.fullName}</div>
                    <div className="text-xs text-slate-500">Lớp {student.grade}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={state.attendance}
                      onValueChange={(val) =>
                        handleUpdateStatus(student.studentId, val as AttendanceStatus)
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          "w-full h-8 text-xs font-medium",
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
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      value={state.fee}
                      onChange={(e) => handleUpdateFee(student.studentId, Number(e.target.value) || 0)}
                      className="w-full h-8 text-xs"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      placeholder="Ghi chú..."
                      value={state.note}
                      onChange={(e) => handleUpdateNote(student.studentId, e.target.value)}
                      className="w-full h-8 text-xs"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
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
