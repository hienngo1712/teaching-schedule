"use client"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
import { formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

// Toast + Hoàn tác đặt ở callback cấp useMutation: vẫn chạy khi sheet/dòng đã đóng (bài học U3).
export function useRecordPayment() {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const mut = trpc.payment.record.useMutation({
    onSuccess: (res, vars) => {
      void utils.tuition.invalidate()
      void utils.payment.invalidate()
      const months = res.allocations.map((a) => `T${a.month}`).join(", ")
      toast(t("payment_recorded").replace("{amount}", formatCurrency(vars.amount)).replace("{months}", months), {
        action: {
          label: t("undo"),
          onClick: () => {
            void utils.client.payment.deleteBatch
              .mutate({ batchId: res.batchId })
              .then(() => Promise.all([utils.tuition.invalidate(), utils.payment.invalidate()]))
              .catch((e: Error) => toast.error(e.message))
          },
        },
      })
    },
    onError: (e) => toast.error(e.message),
  })
  type Row = { studentId: number; year: number; month: number }
  const pay = (row: Row, amount: number, paidAt?: string) =>
    mut.mutate({ studentId: row.studentId, year: row.year, month: row.month, amount, ...(paidAt && { paidAt }) })
  return { pay, payFull: (row: Row, amount: number) => pay(row, amount), isPending: mut.isPending }
}
