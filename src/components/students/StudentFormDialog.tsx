"use client"

import type { z } from "zod"
import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { studentCreateSchema, studentFormSchema, type StudentCreateInput } from "@/lib/schemas/student"
import { CONSENT_ACCEPTED, isConsentError } from "@/lib/consent"
import { ConsentCheckbox } from "@/components/common/ConsentCheckbox"
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
import { usePlan } from "@/hooks/usePlan"
import { openUpgrade } from "@/components/plan/upgrade-store"
import { studentLimitMessage } from "@/components/plan/limit-message"
import { minPlanForStudents, planRequiredOf } from "@/lib/plans"
import { handleRadioGroupKeyDown } from "@/lib/radio-group-keys"
import { cn, vnDateParts } from "@/lib/utils"

type StudentRecord = RouterOutputs["student"]["list"]["items"][number]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  student?: StudentRecord
}

export function StudentFormDialog({ open, onOpenChange, mode, student }: Props) {
  const { t } = useTranslation()
  const { me } = usePlan()
  const [consent, setConsent] = useState(false)

  const form = useForm<z.input<typeof studentCreateSchema>>({
    resolver: zodResolver(studentFormSchema),
    shouldUnregister: false,
    defaultValues: {
      fullName: "",
      grade: 1,
      parentPhone: undefined,
      parentName: undefined,
      notes: undefined,
      isActive: true,
      tuitionFee: undefined,
      billingMode: "per_session",
      monthlyFee: undefined,
    },
  })

  useEffect(() => {
    if (open) {
      setConsent(false)
      form.reset({
        fullName: student?.fullName ?? "",
        grade: student?.grade ?? 1,
        parentPhone: student?.parentPhone ?? undefined,
        parentName: student?.parentName ?? undefined,
        notes: student?.notes ?? undefined,
        isActive: student?.isActive ?? true,
        tuitionFee: student?.tuitionFee ?? undefined,
        billingMode: student?.billingMode ?? "per_session",
        monthlyFee: student?.monthlyFee ?? undefined,
      })
    }
  }, [open, student, form])

  const createMut = trpc.student.create.useMutation({
    onSuccess: () => {
      toast.success(t("student_added_success"))
      onOpenChange(false)
    },
    // Lỗi thiếu gói đã mở popup ở TRPCProvider, không toast thêm.
    onError: (e) => {
      if (isConsentError(e)) toast.error(t("consent_required"))
      else if (!planRequiredOf(e)) toast.error(e.message)
    },
  })

  const updateMut = trpc.student.update.useMutation({
    onSuccess: () => {
      toast.success(t("student_updated_success"))
      onOpenChange(false)
    },
    // Lỗi thiếu gói đã mở popup ở TRPCProvider, không toast thêm.
    onError: (e) => {
      if (isConsentError(e)) toast.error(t("consent_required"))
      else if (!planRequiredOf(e)) toast.error(e.message)
    },
  })

  const isPending = createMut.isPending || updateMut.isPending

  const curBillingMode = form.watch("billingMode")
  const curMonthlyFee = form.watch("monthlyFee")
  const { month: curMonth, year: curYear } = vnDateParts()
  const isBillingModeChanged =
    mode === "edit" &&
    Boolean(student?.isActive) &&
    Boolean(student?.billingMode) &&
    (curBillingMode !== student?.billingMode ||
      (curBillingMode === "monthly" && (curMonthlyFee ?? 0) !== (student?.monthlyFee ?? 0)))

  function onSubmit(values: z.input<typeof studentCreateSchema>) {
    if (!consent) return
    const data = values as StudentCreateInput;
    // Bật HS thành đang học khi đã đủ giới hạn: mở popup nâng cấp thay vì gửi rồi nhận lỗi.
    const activating = data.isActive && (mode === "create" || student?.isActive === false)
    if (activating && me && me.studentLimit !== null && me.activeStudents >= me.studentLimit) {
      openUpgrade({ plan: minPlanForStudents(me.activeStudents + 1), message: studentLimitMessage(t, me.plan, me.studentLimit) })
      return
    }
    if (mode === "create") {
      createMut.mutate({ ...data, consent: CONSENT_ACCEPTED })
    } else if (student) {
      updateMut.mutate({ id: student.id, data, consent: CONSENT_ACCEPTED })
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
          <div data-tour="student-form-name" className="space-y-3">
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
          </div>

          <div data-tour="student-form-billing" className="space-y-3">
          <div className="space-y-2">
            <Label>{t("billing_mode_label")}</Label>
            <div
              role="radiogroup"
              aria-label={t("billing_mode_label")}
              onKeyDown={handleRadioGroupKeyDown}
              className="grid grid-cols-2 gap-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={curBillingMode === "per_session"}
                tabIndex={curBillingMode === "per_session" ? 0 : -1}
                onClick={() => form.setValue("billingMode", "per_session")}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-md border text-sm font-medium transition-colors",
                  curBillingMode === "per_session"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                {t("billing_per_session")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={curBillingMode === "monthly"}
                tabIndex={curBillingMode === "monthly" ? 0 : -1}
                onClick={() => form.setValue("billingMode", "monthly")}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-md border text-sm font-medium transition-colors",
                  curBillingMode === "monthly"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                {t("billing_monthly")}
              </button>
            </div>
            {isBillingModeChanged && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                {t("billing_change_note")
                  .replace("{m}", String(curMonth))
                  .replace("{y}", String(curYear))}
              </p>
            )}
          </div>

          {curBillingMode === "monthly" ? (
            <div className="space-y-2">
              <Label htmlFor="monthlyFee">
                {t("fee_per_month_label")}
              </Label>
              <Controller
                control={form.control}
                name="monthlyFee"
                render={({ field }) => (
                  <CurrencyInput
                    id="monthlyFee"
                    placeholder="0"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {form.formState.errors.monthlyFee && (
                <p className="text-xs text-red-600">
                  {form.formState.errors.monthlyFee.message}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="tuitionFee">
                {t("fee_per_session_label")}
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

          <div className="space-y-2" data-tour="student-form-parent">
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

          <div data-tour="student-form-submit" className="space-y-3">
          <ConsentCheckbox
            id="student-consent"
            label={t("consent_student")}
            checked={consent}
            onCheckedChange={setConsent}
            disabled={isPending}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !consent}>
              {isPending
                ? t("saving")
                : mode === "create"
                  ? t("add")
                  : t("update")}
            </Button>
          </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
