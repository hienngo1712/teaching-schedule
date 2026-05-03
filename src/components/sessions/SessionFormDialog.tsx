"use client"

import { useEffect } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import {
  sessionCreateSchema,
  type SessionCreateInput,
} from "@/lib/schemas/session"
import { trpc } from "@/lib/trpc"
import type { SessionDTO } from "@/server/services/session.service"
import { StudentPicker } from "./StudentPicker"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: string // "YYYY-MM-DD"
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
  const isEdit = !!editingSession
  const utils = trpc.useUtils()

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

  // Set default subject if any is marked as default
  useEffect(() => {
    if (!isEdit && subjects.length > 0 && !form.getValues("subjectId")) {
      const defaultSubject = subjects.find((s) => s.isDefault) || subjects[0]
      form.setValue("subjectId", defaultSubject.id)
    }
  }, [subjects, isEdit, form])

  // Reset form when editingSession or initialDate changes
  useEffect(() => {
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
    } else if (initialDate) {
      form.setValue("sessionDate", initialDate)
    }
  }, [editingSession, initialDate, form])

  const createMutation = trpc.session.create.useMutation({
    onSuccess: () => {
      toast.success("Tạo ca dạy thành công")
      utils.session.getMonth.invalidate()
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error(err.message)
      } else {
        toast.error("Đã có lỗi xảy ra khi tạo ca dạy")
      }
    },
  })

  const updateMutation = trpc.session.update.useMutation({
    onSuccess: () => {
      toast.success("Cập nhật ca dạy thành công")
      utils.session.getMonth.invalidate()
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error(err.message)
      } else {
        toast.error("Đã có lỗi xảy ra khi cập nhật ca dạy")
      }
    },
  })

  function onSubmit(values: SessionCreateInput) {
    if (isEdit) {
      updateMutation.mutate({
        id: editingSession.id,
        data: values,
      })
    } else {
      createMutation.mutate(values)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Sửa ca dạy" : "Tạo ca dạy mới"}
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
                    <FormLabel>Ngày dạy</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              dayjs(field.value).format("DD/MM/YYYY")
                            ) : (
                              <span>Chọn ngày</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={new Date(field.value)}
                          onSelect={(date) =>
                            field.onChange(dayjs(date).format("YYYY-MM-DD"))
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
                    <FormLabel>Môn học</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn môn" />
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
                    <FormLabel>Bắt đầu</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
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
                    <FormLabel>Kết thúc</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
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
                  <FormLabel>Tiêu đề (không bắt buộc)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ví dụ: Nhóm nâng cao, Lớp 7A..." {...field} />
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
                  <FormLabel>Học sinh</FormLabel>
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
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Nội dung bài học, dặn dò..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Cập nhật" : "Tạo ca dạy"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
