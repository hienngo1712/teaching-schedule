"use client"

import { useState } from "react"
import { CalendarClock, CalendarDays, Clock, Copy, Edit2, Loader2, MoreVertical, RotateCcw, Trash2, UserPlus } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { TimeInput } from "@/components/ui/time-input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { trpc } from "@/lib/trpc"
import type { SessionListDTO, SessionDTO } from "@/lib/types/models"
import { AttendancePanel } from "./AttendancePanel"
import { StudentPicker } from "./StudentPicker"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: SessionListDTO
  onEdit: (session: SessionDTO) => void
}

export function SessionDetailDialog({
  open,
  onOpenChange,
  session: basicSession,
  onEdit,
}: Props) {
  const { t } = useTranslation()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false)
  const [isAddStudentsOpen, setIsAddStudentsOpen] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurEndDate, setRecurEndDate] = useState<string>(
    dayjs(basicSession.sessionDate).add(2, "month").format("YYYY-MM-DD")
  )
  const [targetDate, setTargetDate] = useState<Date | undefined>(
    dayjs(basicSession.sessionDate).add(7, "day").toDate()
  )
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([])
  const [isDeleteFuture, setIsDeleteFuture] = useState(false)
  const [isMakeupOpen, setIsMakeupOpen] = useState(false)
  const [makeupDate, setMakeupDate] = useState<Date | undefined>(
    dayjs(basicSession.sessionDate).add(2, "day").toDate()
  )
  const [makeupStart, setMakeupStart] = useState(basicSession.startTime)
  const [makeupEnd, setMakeupEnd] = useState(basicSession.endTime)
  const [makeupReason, setMakeupReason] = useState("")
  const [isRestoreOpen, setIsRestoreOpen] = useState(false)

  // Fetch full details (Lazy load)
  const { data: session, isLoading } = trpc.session.getDetail.useQuery(
    { id: basicSession.id },
    { enabled: open }
  )

  const deleteMutation = trpc.session.delete.useMutation({
    onSuccess: () => {
      toast.success(t("delete_session_success"))
      onOpenChange(false)
    },
    onError: () => {
      toast.error(t("delete_session_error"))
    },
  })

  const deleteFutureMutation = trpc.session.deleteFuture.useMutation({
    onSuccess: (res) => {
      toast.success(t("delete_recurring_success").replace("{count}", String(res.deleted)))
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err.message || t("delete_series_error"))
    },
  })

  const duplicateMutation = trpc.session.duplicate.useMutation({
    onSuccess: () => {
      toast.success(t("duplicate_success"))
      setIsDuplicateDialogOpen(false)
    },
    onError: (err) => {
      toast.error(err.message || t("duplicate_error"))
    },
  })

  const addStudentsMutation = trpc.session.addStudents.useMutation({
    onSuccess: () => {
      toast.success(t("update_students_success"))
      setIsAddStudentsOpen(false)
    },
    onError: (err) => {
      toast.error(err.message || t("generic_error"))
    },
  })

  const makeupMutation = trpc.session.createMakeup.useMutation({
    onSuccess: () => {
      toast.success(t("makeup_success"))
      setIsMakeupOpen(false)
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err.message || t("makeup_error"))
    },
  })

  const restoreMutation = trpc.session.restore.useMutation({
    onSuccess: () => {
      toast.success(t("restore_success"))
      setIsRestoreOpen(false)
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err.message || t("restore_error"))
    },
  })

  const addRecurringMutation = trpc.session.addRecurringStudents.useMutation({
    onSuccess: (res) => {
      toast.success(t("add_recurring_students_success").replace("{count}", String(res.updatedSessions)))
      setIsAddStudentsOpen(false)
    },
    onError: (err) => {
      toast.error(err.message || t("generic_error"))
    },
  })

  const handleDelete = () => {
    if (isDeleteFuture) {
      deleteFutureMutation.mutate({ id: basicSession.id })
    } else {
      deleteMutation.mutate({ id: basicSession.id })
    }
  }

  const handleDuplicate = () => {
    if (!targetDate) return
    duplicateMutation.mutate({
      id: basicSession.id,
      targetDate: dayjs(targetDate).format("YYYY-MM-DD"),
    })
  }

  const handleCreateMakeup = () => {
    if (!makeupDate) return
    makeupMutation.mutate({
      id: basicSession.id,
      sessionDate: dayjs(makeupDate).format("YYYY-MM-DD"),
      startTime: makeupStart,
      endTime: makeupEnd,
      cancelReason: makeupReason || undefined,
    })
  }

  const handleOpenAddStudents = () => {
    if (!session) return
    setSelectedStudentIds(session.students.map((s) => s.studentId))
    setIsRecurring(false)
    setIsAddStudentsOpen(true)
  }

  const handleSaveStudents = () => {
    if (isRecurring) {
      if (selectedStudentIds.length === 0) {
        toast.error(t("select_at_least_one_student"))
        return
      }

      const vnDayIndex = (dayjs(basicSession.sessionDate).day() + 6) % 7
      addRecurringMutation.mutate({
        studentIds: selectedStudentIds,
        startTime: basicSession.startTime,
        endTime: basicSession.endTime,
        startDate: dayjs(basicSession.sessionDate).format("YYYY-MM-DD"),
        endDate: recurEndDate,
        weekdays: [vnDayIndex],
      })
    } else {
      addStudentsMutation.mutate({
        sessionId: basicSession.id,
        studentIds: selectedStudentIds,
      })
    }
  }

  const isSaving = addStudentsMutation.isPending || addRecurringMutation.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full h-full max-w-none content-start sm:h-auto sm:max-w-[600px] sm:max-h-[90vh] overflow-y-auto sm:rounded-lg top-0 left-0 translate-x-0 translate-y-0 sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]">
          {isLoading || !session ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="size-8 animate-spin text-indigo-500" />
              <p className="text-sm text-slate-500 font-medium">{t("loading_details")}</p>
            </div>
          ) : (
            <>
              <DialogHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pr-8">
                <div className="min-w-0 space-y-1">
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
                    <Button variant="ghost" size="icon" aria-label={t("actions")}>
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit({ ...session, sessionDate: new Date(session.sessionDate) })}>
                      <Edit2 className="mr-2 size-4" />
                      {t("edit_session")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenAddStudents}>
                      <UserPlus className="mr-2 size-4" />
                      {t("add_student")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsDuplicateDialogOpen(true)}>
                      <Copy className="mr-2 size-4" />
                      {t("duplicate_session")}
                    </DropdownMenuItem>
                    {session.status !== "cancelled" && !session.makeupInfo && (
                      <DropdownMenuItem onClick={() => setIsMakeupOpen(true)}>
                        <CalendarClock className="mr-2 size-4" />
                        {t("create_makeup_session")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => setIsDeleteDialogOpen(true)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      {t("delete_session")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </DialogHeader>

              {session.status === "cancelled" && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between gap-2">
                  <span>
                    {t("cancelled_label")}
                    {session.makeupInfo
                      ? ` — ${t("makeup_on").replace("{date}", dayjs(session.makeupInfo.sessionDate).format("DD/MM/YYYY"))}`
                      : ""}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setIsRestoreOpen(true)}>
                    <RotateCcw className="mr-2 size-3.5" />
                    {t("restore_session")}
                  </Button>
                </div>
              )}

              {session.notes && (
                <div className="bg-slate-50 p-3 rounded-md text-sm text-slate-600 whitespace-pre-wrap">
                  <span className="font-semibold block mb-1">{t("notes")}</span>
                  {session.notes}
                </div>
              )}

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{t("attendance")}</h3>
                  <Badge variant="outline">
                    {t("students_count").replace("{count}", String(session.studentCount))}
                  </Badge>
                </div>

                <AttendancePanel
                  sessionId={session.id}
                  onSaveSuccess={() => onOpenChange(false)}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddStudentsOpen} onOpenChange={setIsAddStudentsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("manage_session_students")}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <StudentPicker
              value={selectedStudentIds}
              onChange={setSelectedStudentIds}
              knownStudents={session?.students.map((s) => ({
                studentId: s.studentId,
                fullName: s.fullName,
                grade: s.grade,
              }))}
            />

            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recur"
                  checked={isRecurring}
                  onCheckedChange={(val) => setIsRecurring(!!val)}
                />
                <Label htmlFor="recur" className="text-sm font-medium cursor-pointer">
                  {t("apply_to_recurring")}
                </Label>
              </div>

              {isRecurring && (
                <div className="pl-6 animate-in slide-in-from-top-1 duration-200">
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-slate-500">{t("until_date")}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-full h-8 text-sm justify-start font-normal",
                            !recurEndDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-3.5 w-3.5" />
                          {recurEndDate ? (
                            dayjs(recurEndDate).format("DD/MM/YYYY")
                          ) : (
                            <span>{t("pick_date")}</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={new Date(recurEndDate)}
                          onSelect={(date) =>
                            setRecurEndDate(dayjs(date).format("YYYY-MM-DD"))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t("recurring_note")
                      .replace("{start}", dayjs(basicSession.sessionDate).format("DD/MM"))
                      .replace("{end}", dayjs(recurEndDate).format("DD/MM/YYYY"))}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAddStudentsOpen(false)}
              disabled={isSaving}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSaveStudents}
              disabled={isSaving}
            >
              {isSaving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isRecurring ? t("assign_to_series") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("duplicate_session")}</DialogTitle>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center">
            <p className="text-sm text-slate-500 mb-4 text-center">
              {t("duplicate_session_desc")}
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
              {t("cancel")}
            </Button>
            <Button
              onClick={handleDuplicate}
              disabled={duplicateMutation.isPending || !targetDate}
            >
              {duplicateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("duplicate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMakeupOpen} onOpenChange={setIsMakeupOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("create_makeup_session")}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm text-slate-500">{t("create_makeup_desc")}</p>
            <Calendar mode="single" selected={makeupDate} onSelect={setMakeupDate} className="rounded-md border" />
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{t("start_time")}</Label>
                <TimeInput value={makeupStart} onValueChange={setMakeupStart} />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">{t("end_time")}</Label>
                <TimeInput value={makeupEnd} onValueChange={setMakeupEnd} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("cancel_reason")}</Label>
              <textarea
                value={makeupReason}
                onChange={(e) => setMakeupReason(e.target.value)}
                rows={2}
                className="w-full rounded-md border px-2 py-1 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsMakeupOpen(false)} disabled={makeupMutation.isPending}>
              {t("cancel")}
            </Button>
            <Button onClick={handleCreateMakeup} disabled={makeupMutation.isPending || !makeupDate}>
              {makeupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("create_makeup_session")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("restore_session")}</AlertDialogTitle>
            <AlertDialogDescription>{t("restore_confirm_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreMutation.mutate({ id: basicSession.id })}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("restore_session")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm_delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm_delete_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-center space-x-2 py-2">
            <Checkbox
              id="delete-future"
              checked={isDeleteFuture}
              onCheckedChange={(val) => setIsDeleteFuture(!!val)}
            />
            <Label htmlFor="delete-future" className="text-sm font-medium cursor-pointer">
              {t("delete_future_recurring")}
            </Label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending || deleteFutureMutation.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending || deleteFutureMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {(deleteMutation.isPending || deleteFutureMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("delete_session")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
