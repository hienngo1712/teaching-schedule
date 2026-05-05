"use client"

import type { z } from "zod"
import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
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

type StudentRecord = {
  id: number
  fullName: string
  grade: number
  parentPhone: string | null
  parentName: string | null
  notes: string | null
  isActive: boolean
  tuitionFee: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  student?: StudentRecord
}

export function StudentFormDialog({ open, onOpenChange, mode, student }: Props) {
  const utils = trpc.useUtils()

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

  // Reset form khi dialog mở (cho cả create + edit)
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
      // Invalidate toàn bộ query liên quan đến student.list
      utils.student.list.invalidate()
      utils.report.invalidate()
      toast.success("Đã thêm học sinh")
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const updateMut = trpc.student.update.useMutation({
    onSuccess: () => {
      utils.student.list.invalidate()
      utils.report.invalidate()
      toast.success("Đã cập nhật học sinh")
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
            {mode === "create" ? "Thêm học sinh" : "Sửa học sinh"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="fullName">
              Họ và tên <span className="text-red-500">*</span>
            </Label>
            <Input id="fullName" placeholder="Nhập họ tên" {...form.register("fullName")} />
            {form.formState.errors.fullName && (
              <p className="text-xs text-red-600">
                {form.formState.errors.fullName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="grade">
              Lớp <span className="text-red-500">*</span>
            </Label>
            <Select
              value={String(form.watch("grade"))}
              onValueChange={(v) => form.setValue("grade", Number(v))}
            >
              <SelectTrigger id="grade">
                <SelectValue placeholder="Chọn lớp" />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    Lớp {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tuitionFee">
              Học phí / Buổi (VNĐ) <span className="text-red-500">*</span>
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
            <Label htmlFor="isActive">Trạng thái</Label>
            <Select
              value={form.watch("isActive") ? "true" : "false"}
              onValueChange={(v) => form.setValue("isActive", v === "true")}
            >
              <SelectTrigger id="isActive">
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Đang học</SelectItem>
                <SelectItem value="false">Đã nghỉ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentPhone">SĐT phụ huynh</Label>
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
            <Label htmlFor="parentName">Tên phụ huynh</Label>
            <Input id="parentName" placeholder="Nhập họ tên" {...form.register("parentName")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú</Label>
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Đang lưu..."
                : mode === "create"
                  ? "Thêm"
                  : "Cập nhật"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
