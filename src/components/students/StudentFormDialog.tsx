"use client"

import type { z } from "zod"
import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { studentCreateSchema, type StudentCreateInput } from "@/lib/schemas/student"
import { GRADES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useTranslation } from "@/components/providers/LanguageProvider"

type StudentRecord = RouterOutputs["student"]["list"]["items"][number]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  student?: StudentRecord
}

export function StudentFormDialog({ open, onOpenChange, mode, student }: Props) {
  const { t } = useTranslation()

  const form = useForm<z.input<typeof studentCreateSchema>>({
    resolver: zodResolver(studentCreateSchema),
    defaultValues: {
      fullName: "",
      grade: 1,
      parentPhone: undefined,
      parentName: undefined,
      notes: undefined,
      isActive: true,
      tuitionFee: undefined,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        fullName: student?.fullName ?? "",
        grade: student?.grade ?? 1,
        parentPhone: student?.parentPhone ?? undefined,
        parentName: student?.parentName ?? undefined,
        notes: student?.notes ?? undefined,
        isActive: student?.isActive ?? true,
        tuitionFee: student?.tuitionFee ?? undefined,
      })
    }
  }, [open, student, form])

  const createMut = trpc.student.create.useMutation({
    onSuccess: () => {
      toast.success(t("student_added_success"))
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const updateMut = trpc.student.update.useMutation({
    onSuccess: () => {
      toast.success(t("student_updated_success"))
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const isPending = createMut.isPending || updateMut.isPending

  function onSubmit(values: z.input<typeof studentCreateSchema>) {
    const data = values as StudentCreateInput;
    if (mode === "create") {
      createMut.mutate(data)
    } else if (student) {
      updateMut.mutate({ id: student.id, data })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full max-w-none sm:h-auto sm:max-w-md sm:max-h-[90vh] overflow-y-auto sm:rounded-lg top-0 left-0 translate-x-0 translate-y-0 sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("add_student") : t("edit_student")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="fullName">
              {t("full_name")} <span className="text-red-500">*</span>
            </Label>
            <Input id="fullName" placeholder={t("enter_full_name")} {...form.register("fullName")} />
            {form.formState.errors.fullName && (
              <p className="text-xs text-red-600">
                {form.formState.errors.fullName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="grade">
              {t("grade")} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={String(form.watch("grade"))}
              onValueChange={(v) => form.setValue("grade", Number(v))}
            >
              <SelectTrigger id="grade">
                <SelectValue placeholder={t("select_grade")} />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    {t("grade")} {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tuitionFee">
              {t("tuition_fee_per_session")}
            </Label>
            <Controller
              control={form.control}
              name="tuitionFee"
              render={({ field }) => (
                <CurrencyInput
                  id="tuitionFee"
                  placeholder="0"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {form.formState.errors.tuitionFee && (
              <p className="text-xs text-red-600">
                {form.formState.errors.tuitionFee.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="isActive">{t("status")}</Label>
            <Select
              value={form.watch("isActive") ? "true" : "false"}
              onValueChange={(v) => form.setValue("isActive", v === "true")}
            >
              <SelectTrigger id="isActive">
                <SelectValue placeholder={t("select_status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t("studying")}</SelectItem>
                <SelectItem value="false">{t("dropped")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentPhone">{t("parent_phone")}</Label>
            <Input
              id="parentPhone"
              placeholder="0901234567"
              {...form.register("parentPhone")}
            />
            {form.formState.errors.parentPhone && (
              <p className="text-xs text-red-600">
                {form.formState.errors.parentPhone.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentName">{t("parent_name")}</Label>
            <Input id="parentName" placeholder={t("enter_full_name")} {...form.register("parentName")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t("saving")
                : mode === "create"
                  ? t("add")
                  : t("update")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
