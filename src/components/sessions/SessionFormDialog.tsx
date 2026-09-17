"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, Loader2 } from "lucide-react"
import dayjs from "dayjs"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TimeInput } from "@/components/ui/time-input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  sessionCreateSchema,
  type SessionCreateInput,
} from "@/lib/schemas/session"
import { trpc } from "@/lib/trpc"
import type { SessionDTO } from "@/lib/types/models"
import { StudentPicker } from "./StudentPicker"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: string
  editingSession?: SessionDTO
  onSuccess?: () => void
}

export function SessionFormDialog({
  open,
  onOpenChange,
  initialDate,
  editingSession,
  onSuccess,
}: Props) {
  const { t } = useTranslation()
  const isEdit = !!editingSession
  const [isUpdateFuture, setIsUpdateFuture] = useState(false)

  const { data: subjects = [] } = trpc.subject.list.useQuery({ isActive: true })

  const form = useForm<SessionCreateInput>({
    resolver: zodResolver(sessionCreateSchema),
    defaultValues: {
      sessionDate: initialDate || dayjs().format("YYYY-MM-DD"),
      startTime: "08:00",
      endTime: "09:30",
      subjectId: undefined,
      title: "",
      notes: "",
      studentIds: [],
    },
  })

  // Reset mỗi lần mở dialog, kể cả khi tạo ca mới (tránh giữ dữ liệu ca vừa sửa).
  // Không phụ thuộc `subjects` — môn về muộn sẽ reset đè lên thứ user vừa nhập.
  useEffect(() => {
    if (!open) return

    if (editingSession) {
      form.reset({
        sessionDate: dayjs(editingSession.sessionDate).format("YYYY-MM-DD"),
        startTime: editingSession.startTime,
        endTime: editingSession.endTime,
        subjectId: editingSession.subjectId,
        title: editingSession.title || "",
        notes: editingSession.notes || "",
        studentIds: editingSession.students.map((s) => s.studentId),
      })
    } else {
      form.reset({
        sessionDate: initialDate || dayjs().format("YYYY-MM-DD"),
        startTime: "08:00",
        endTime: "09:30",
        subjectId: undefined,
        title: "",
        notes: "",
        studentIds: [],
      })
    }
    setIsUpdateFuture(false)
  }, [open, editingSession, initialDate, form])

  // Điền môn mặc định cho ca mới, chạy sau effect reset ở trên.
  useEffect(() => {
    if (!open || isEdit || subjects.length === 0) return
    if (form.getValues("subjectId")) return
    const defaultSubject = subjects.find((s) => s.isDefault) || subjects[0]
    form.setValue("subjectId", defaultSubject.id)
  }, [open, subjects, isEdit, form])

  const createMutation = trpc.session.create.useMutation({
    onSuccess: () => {
      toast.success(t("session_created_success"))
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error(err.message)
      } else {
        toast.error(t("session_create_error"))
      }
    },
  })

  const updateMutation = trpc.session.update.useMutation({
    onSuccess: () => {
      toast.success(t("session_updated_success"))
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error(err.message)
      } else {
        toast.error(t("session_update_error"))
      }
    },
  })

  const updateFutureMutation = trpc.session.updateFuture.useMutation({
    onSuccess: (res) => {
      toast.success(t("session_update_future_success").replace("{count}", String(res.updated)))
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error(err.message)
      } else {
        toast.error(err.message || t("session_series_update_error"))
      }
    },
  })

  function onSubmit(values: SessionCreateInput) {
    if (isEdit) {
      if (isUpdateFuture) {
        updateFutureMutation.mutate({
          id: editingSession!.id,
          data: values,
        })
      } else {
        updateMutation.mutate({
          id: editingSession!.id,
          data: values,
        })
      }
    } else {
      createMutation.mutate(values)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending || updateFutureMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full max-w-none sm:h-auto sm:max-w-[500px] sm:max-h-[90vh] overflow-y-auto sm:rounded-lg top-0 left-0 translate-x-0 translate-y-0 sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("edit_session") : t("create_session")}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sessionDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("session_date")}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            // updateFuture không nhận sessionDate → khóa ô ngày.
                            disabled={isUpdateFuture}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              dayjs(field.value).format("DD/MM/YYYY")
                            ) : (
                              <span>{t("pick_date")}</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) =>
                            field.onChange(date ? dayjs(date).format("YYYY-MM-DD") : "")
                          }
                          disabled={(date) => date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subjectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("subject")}</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("select_subject")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            <div className="flex items-center gap-2">
                              <div
                                className="size-2 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("start_time")}</FormLabel>
                    <FormControl>
                      <TimeInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("end_time")}</FormLabel>
                    <FormControl>
                      <TimeInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("title_optional")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("title")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="studentIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("student")}</FormLabel>
                  <FormControl>
                    <StudentPicker
                      value={field.value || []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("session_notes")}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEdit && (
              <div className="pt-2 border-t space-y-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="update-future"
                    checked={isUpdateFuture}
                    onCheckedChange={(val) => {
                      const checked = !!val
                      setIsUpdateFuture(checked)
                      // Trả lại ngày gốc nếu user đã lỡ đổi trước khi tick.
                      if (checked && editingSession) {
                        form.setValue(
                          "sessionDate",
                          dayjs(editingSession.sessionDate).format("YYYY-MM-DD")
                        )
                      }
                    }}
                  />
                  <Label htmlFor="update-future" className="text-sm font-medium cursor-pointer">
                    {t("apply_to_recurring")}
                  </Label>
                </div>
                {isUpdateFuture && (
                  <p className="text-xs text-slate-500 pl-6">
                    {t("apply_to_recurring_date_locked")}
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? t("update") : t("create_session")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
