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

  const removeStudentMutation = trpc.session.removeStudent.useMutation({
    onSuccess: () => {
      toast.success(t("remove_student_success"))
      setStudentToRemove(null)
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
      <div className="overflow-hidden rounded-md border bg-white">
        {/* Một markup cho cả 2 cỡ: mobile 2 dòng (tên + nút | học phí, ghi chú, xóa), desktop 1 hàng như bảng cũ */}
        <div className="hidden grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_auto_auto] gap-x-3 border-b bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 md:grid">
          <span>{t("student")}</span>
          <span>{t("tuition_col")}</span>
          <span>{t("notes")}</span>
          <span>{t("attendance_col")}</span>
          <span className="w-8"><span className="sr-only">{t("remove_from_session")}</span></span>
        </div>

        <div className="divide-y">
          {attendanceData.map((student) => {
            const state = attendances[student.studentId]
            if (!state) return null

            return (
              <div
                key={student.studentId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_auto_auto] md:py-2"
              >
                <div className="order-1 min-w-0">
                  <div className="truncate font-medium text-slate-900">{student.fullName}</div>
                  <div className="text-xs text-slate-500">{t("grade")} {student.grade}</div>
                </div>

                <div className="order-2 flex gap-2 md:order-4 md:gap-1.5">
                  <button
                    type="button"
                    aria-pressed={state.attendance === "present"}
                    aria-label={ATTENDANCE_LABEL.present}
                    title={ATTENDANCE_LABEL.present}
                    onClick={() => handleToggleStatus(student.studentId, "present")}
                    className={cn(
                      "inline-flex size-11 items-center justify-center rounded-md border transition-colors md:size-8",
                      state.attendance === "present"
                        ? "border-green-500 bg-green-50 text-green-600"
                        : "border-slate-200 text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Check className="size-5 md:size-4" strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    aria-pressed={state.attendance === "absent"}
                    aria-label={ATTENDANCE_LABEL.absent}
                    title={ATTENDANCE_LABEL.absent}
                    onClick={() => handleToggleStatus(student.studentId, "absent")}
                    className={cn(
                      "inline-flex size-11 items-center justify-center rounded-md border transition-colors md:size-8",
                      state.attendance === "absent"
                        ? "border-red-500 bg-red-50 text-red-600"
                        : "border-slate-200 text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <X className="size-5 md:size-4" strokeWidth={3} />
                  </button>
                </div>

                {/* md:contents: ở desktop 3 phần tử con thành ô grid riêng, sắp lại bằng order */}
                <div className="order-3 col-span-2 flex items-center gap-2 md:contents">
                  <CurrencyInput
                    value={state.fee}
                    onChange={(val) => handleUpdateFee(student.studentId, val || 0)}
                    className="h-10 w-28 shrink-0 text-sm md:order-2 md:h-8 md:w-full md:text-xs"
                  />
                  <Input
                    placeholder={t("note")}
                    value={state.note}
                    onChange={(e) => handleUpdateNote(student.studentId, e.target.value)}
                    className="h-10 min-w-0 flex-1 text-sm md:order-3 md:h-8 md:text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0 text-slate-400 hover:text-red-600 md:order-5 md:size-8"
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
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Dính đáy vùng cuộn của dialog; -mx-6/px-6 khớp padding p-6 của DialogContent */}
      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-2 border-t bg-white px-6 py-3">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleMarkAllPresent} className="h-11 text-xs text-slate-600 md:h-9">
            <Check className="mr-1 size-3" />
            {t("mark_all_present")}
          </Button>
          <Button variant="outline" onClick={handleMarkAllAbsent} className="h-11 text-xs text-slate-600 md:h-9">
            <X className="mr-1 size-3" />
            {t("mark_all_absent")}
          </Button>
        </div>

        <Button onClick={handleSave} disabled={updateMutation.isPending} className="h-11 w-full sm:w-auto md:h-9">
          {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
