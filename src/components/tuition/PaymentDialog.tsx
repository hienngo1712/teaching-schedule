"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { CurrencyInput } from "@/components/ui/currency-input"
import { updatePaymentSchema, type UpdatePaymentInput } from "@/lib/schemas/tuition"
import { formatCurrency } from "@/lib/utils"

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: {
    studentId: number
    fullName: string
    year: number
    month: number
    totalExpected: number
    paidAmount: number
    isFullPaid: boolean
    notes: string | null
  } | null
  onSuccess: () => void
}

export function PaymentDialog({ open, onOpenChange, data, onSuccess }: PaymentDialogProps) {
  const utils = trpc.useUtils()
  const mutation = trpc.tuition.updatePayment.useMutation({
    onSuccess: () => {
      toast.success("Cập nhật học phí thành công")
      onSuccess()
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const form = useForm<UpdatePaymentInput>({
    resolver: zodResolver(updatePaymentSchema),
    defaultValues: {
      studentId: 0,
      year: 0,
      month: 0,
      paidAmount: 0,
      isFullPaid: false,
      notes: "",
    },
  })

  useEffect(() => {
    if (data && open) {
      form.reset({
        studentId: data.studentId,
        year: data.year,
        month: data.month,
        paidAmount: data.paidAmount,
        isFullPaid: data.isFullPaid,
        notes: data.notes || "",
      })
    }
  }, [data, open, form])

  function onSubmit(values: UpdatePaymentInput) {
    mutation.mutate(values)
  }

  function quickPayFull() {
    if (!data) return
    form.setValue("paidAmount", data.totalExpected)
    form.setValue("isFullPaid", true)
  }

  if (!data) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ghi nhận đóng học phí</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <div className="flex justify-between items-center mb-4 p-3 bg-slate-50 rounded-md border border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-500">Học sinh</p>
              <p className="font-semibold text-slate-900">{data.fullName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-500">Tháng {data.month}/{data.year}</p>
              <p className="font-semibold text-indigo-600">{formatCurrency(data.totalExpected)}</p>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="paidAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Số tiền đã đóng</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={(v) => field.onChange(v)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isFullPaid"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Đánh dấu đã đóng đủ
                      </FormLabel>
                    </div>
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
                        placeholder="VD: Đóng tiền mặt, chuyển khoản..." 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:gap-0">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={quickPayFull}
                  className="mr-auto"
                >
                  Đóng đủ nhanh
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Đang lưu..." : "Lưu thông tin"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
