"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
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
import { ATTENDANCE_LABEL } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { setAllAttendance } from "@/lib/attendance-state"
import type { AttendanceStatus } from "@/lib/schemas/attendance"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  sessionId: number
  onSaveSuccess?: () => void
}

type AttendanceState = {
  studentId: number
  attendance: AttendanceStatus
  note: string
  fee: number
}

export function AttendancePanel({ sessionId, onSaveSuccess }: Props) {
  const { t } = useTranslation()

  const { data: attendanceData, isLoading } = trpc.attendance.get.useQuery({
    sessionId,
  })

  const [attendances, setAttendances] = useState<Record<number, AttendanceState>>({})
  const [studentToRemove, setStudentToRemove] = useState<{
    studentId: number
    fullName: string
  } | null>(null)

  const utils = trpc.useUtils()

  const removeStudentMutation = trpc.session.removeStudent.useMutation({
    onSuccess: () => {
      toast.success(t("remove_student_success"))
      setStudentToRemove(null)
      // Refetch danh sách điểm danh để HS vừa gỡ biến mất ngay (tránh stale).
      utils.attendance.get.invalidate({ sessionId })
      onSaveSuccess?.()
    },
    onError: (err) => {
      toast.error(err.message || t("remove_student_error"))
      setStudentToRemove(null)
    },
  })

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
      toast.success(t("save_attendance_success"))
      onSaveSuccess?.()
    },
    onError: () => {
      toast.error(t("save_attendance_error"))
    },
  })

  // Bấm lại đúng trạng thái đang chọn -> trả về "chưa điểm danh" (để undo khi bấm nhầm).
  const handleToggleStatus = (studentId: number, status: AttendanceStatus) => {
    setAttendances((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        attendance: prev[studentId].attendance === status ? "pending" : status,
      },
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
    setAttendances((prev) => setAllAttendance(prev, "present"))
  }

  const handleMarkAllAbsent = () => {
    setAttendances((prev) => setAllAttendance(prev, "absent"))
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
    return <div className="text-center py-4 text-slate-500">{t("loading_students")}</div>
  }

  if (!attendanceData || attendanceData.length === 0) {
    return <div className="text-center py-4 text-slate-500">{t("no_students_in_session")}</div>
  }

  return (
    <>
    <div className="space-y-4">
      <div className="border rounded-md overflow-hidden flex flex-col bg-white">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs border-b">
              <tr>
                <th className="px-3 py-2 font-medium">{t("student")}</th>
                <th className="px-3 py-2 font-medium w-[120px]">{t("tuition_col")}</th>
                <th className="px-3 py-2 font-medium">{t("notes")}</th>
                <th className="px-3 py-2 font-medium w-[86px]">{t("attendance_col")}</th>
                <th className="px-3 py-2 font-medium w-[40px]"><span className="sr-only">{t("remove_from_session")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {attendanceData.map((student) => {
                const state = attendances[student.studentId]
                if (!state) return null

                return (
                  <tr key={student.studentId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{student.fullName}</div>
                      <div className="text-xs text-slate-500">{t("grade")} {student.grade}</div>
                    </td>
                    <td className="px-3 py-2">
                      <CurrencyInput
                        value={state.fee}
                        onChange={(val) => handleUpdateFee(student.studentId, val || 0)}
                        className="w-full h-8 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        placeholder={t("note")}
                        value={state.note}
                        onChange={(e) => handleUpdateNote(student.studentId, e.target.value)}
                        className="w-full h-8 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          aria-pressed={state.attendance === "present"}
                          aria-label={ATTENDANCE_LABEL.present}
                          title={ATTENDANCE_LABEL.present}
                          onClick={() => handleToggleStatus(student.studentId, "present")}
                          className={cn(
                            "inline-flex size-8 items-center justify-center rounded-md border transition-colors",
                            state.attendance === "present"
                              ? "bg-green-50 border-green-500 text-green-600"
                              : "border-slate-200 text-slate-400 hover:text-slate-600"
                          )}
                        >
                          <Check className="size-4" strokeWidth={3} />
                        </button>
                        <button
                          type="button"
                          aria-pressed={state.attendance === "absent"}
                          aria-label={ATTENDANCE_LABEL.absent}
                          title={ATTENDANCE_LABEL.absent}
                          onClick={() => handleToggleStatus(student.studentId, "absent")}
                          className={cn(
                            "inline-flex size-8 items-center justify-center rounded-md border transition-colors",
                            state.attendance === "absent"
                              ? "bg-red-50 border-red-500 text-red-600"
                              : "border-slate-200 text-slate-400 hover:text-slate-600"
                          )}
                        >
                          <X className="size-4" strokeWidth={3} />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-slate-400 hover:text-red-600"
                        aria-label={t("remove_from_session")}
                        title={t("remove_from_session")}
                        onClick={() =>
                          setStudentToRemove({
                            studentId: student.studentId,
                            fullName: student.fullName,
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllPresent}
            className="text-xs text-slate-600"
          >
            <Check className="mr-1 size-3" />
            {t("mark_all_present")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAbsent}
            className="text-xs text-slate-600"
          >
            <X className="mr-1 size-3" />
            {t("mark_all_absent")}
          </Button>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {t("save_attendance")}
        </Button>
      </div>
    </div>

    <AlertDialog
      open={studentToRemove !== null}
      onOpenChange={(open) => {
        if (!open) setStudentToRemove(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirm_delete")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("confirm_remove_student").replace("{name}", studentToRemove?.fullName ?? "")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removeStudentMutation.isPending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (studentToRemove) {
                removeStudentMutation.mutate({
                  sessionId,
                  studentId: studentToRemove.studentId,
                })
              }
            }}
            disabled={removeStudentMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {removeStudentMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("remove_from_session")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
