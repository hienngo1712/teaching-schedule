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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { DAY_NAMES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import {
  sessionBulkCreateSchema,
  type SessionBulkCreateInput,
} from "@/lib/schemas/session"
import { trpc } from "@/lib/trpc"
import { StudentPicker } from "./StudentPicker"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function BulkCreateDialog({ open, onOpenChange, onSuccess }: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<"create" | "assign">("create")
  const [conflicts, setConflicts] = useState<{ date: string; conflict: string }[]>([])
  const [pendingValues, setPendingValues] = useState<SessionBulkCreateInput | null>(null)
  const { data: subjects = [] } = trpc.subject.list.useQuery({ isActive: true })

  const form = useForm<SessionBulkCreateInput>({
    resolver: zodResolver(sessionBulkCreateSchema),
    defaultValues: {
      startDate: dayjs().format("YYYY-MM-DD"),
      endDate: dayjs().add(1, "month").format("YYYY-MM-DD"),
      weekdays: [],
      startTime: "19:00",
      endTime: "21:00",
      subjectId: undefined,
      title: "",
      notes: "",
      studentIds: [],
    },
  })

  useEffect(() => {
    if (subjects.length > 0 && !form.getValues("subjectId")) {
      const defaultSubject = subjects.find((s) => s.isDefault) || subjects[0]
      form.setValue("subjectId", defaultSubject.id)
    }
  }, [subjects, form])

  const bulkCreateMutation = trpc.session.bulkCreate.useMutation({
    onSuccess: (res) => {
      toast.success(t("bulk_create_success").replace("{count}", String(res.created)))
      if (res.skipped > 0) {
        toast.info(t("bulk_skip_info").replace("{count}", String(res.skipped)))
      }
      onOpenChange(false)
      onSuccess?.()
      form.reset()
      setConflicts([])
      setPendingValues(null)
    },
    onError: (err) => {
      toast.error(err.message || t("bulk_create_error"))
    },
  })

  const checkConflictsMutation = trpc.session.checkBulkConflicts.useMutation({
    onSuccess: (res, variables) => {
      if (res.length > 0) {
        setConflicts(res)
        setPendingValues(variables)
      } else {
        bulkCreateMutation.mutate(variables)
      }
    },
    onError: (err) => {
      toast.error(err.message || t("check_conflicts_error"))
    },
  })

  const assignMutation = trpc.session.addRecurringStudents.useMutation({
    onSuccess: (res) => {
      toast.success(t("add_recurring_students_success").replace("{count}", String(res.updatedSessions)))
      onOpenChange(false)
      onSuccess?.()
      form.reset()
    },
    onError: (err) => {
      toast.error(err.message || t("assign_students_error"))
    },
  })

  function onSubmit(values: SessionBulkCreateInput) {
    if (mode === "create") {
      checkConflictsMutation.mutate(values)
    } else {
      if (!values.studentIds || values.studentIds.length === 0) {
        toast.error(t("select_at_least_one_student"))
        return
      }
      assignMutation.mutate({
        ...values,
        studentIds: values.studentIds,
      })
    }
  }

  const isLoading = bulkCreateMutation.isPending || assignMutation.isPending || checkConflictsMutation.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full h-full max-w-none sm:h-auto sm:max-w-[600px] sm:max-h-[90vh] overflow-y-auto sm:rounded-lg top-0 left-0 translate-x-0 translate-y-0 sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]">
          <DialogHeader>
            <DialogTitle>{t("periodic_schedule")}</DialogTitle>
          </DialogHeader>

          <div className="flex bg-slate-100 p-1 rounded-md mb-2">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-sm transition-all",
                mode === "create" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t("create_session")}
            </button>
            <button
              type="button"
              onClick={() => setMode("assign")}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-sm transition-all",
                mode === "assign" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t("assign_to_existing")}
            </button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("start_date")}</FormLabel>
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
                                <span>{t("pick_date")}</span>
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
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("end_date")}</FormLabel>
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
                                <span>{t("pick_date")}</span>
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
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="weekdays"
                render={() => (
                  <FormItem>
                    <FormLabel>{t("repeat_on_weekdays")}</FormLabel>
                    <div className="flex flex-wrap gap-4 pt-2">
                      {DAY_NAMES.map((name, index) => (
                        <FormField
                          key={name}
                          control={form.control}
                          name="weekdays"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={name}
                                className="flex flex-row items-start space-x-2 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(index)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, index])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== index
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {name}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              {mode === "create" && (
                <>
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

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("title_optional")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("bulk_title")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={form.control}
                name="studentIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {mode === "create" ? t("students_for_all_sessions") : t("students_to_assign")}
                    </FormLabel>
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

              <DialogFooter className="pt-4">
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
                  {mode === "create" ? t("create_bulk") : t("assign_students")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={conflicts.length > 0}
        onOpenChange={(open) => !open && setConflicts([])}
      >
        <AlertDialogContent className="max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">{t("conflict_detected")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("conflict_detected_desc")}
              <div className="mt-2 max-h-[200px] overflow-y-auto rounded-md border bg-slate-50 p-2 text-xs">
                {conflicts.map((c, i) => (
                  <div key={i} className="py-1 border-b last:border-0">
                    <span className="font-semibold">{c.date}:</span> {c.conflict}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {t("conflict_continue_desc")}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConflicts([])
              setPendingValues(null)
            }}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingValues) {
                  bulkCreateMutation.mutate(pendingValues)
                }
              }}
            >
              {t("continue_create")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
