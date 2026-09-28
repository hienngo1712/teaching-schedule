"use client"

import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { formatCurrency, vnDateParts } from "@/lib/utils"

type Props = {
  student: { id: number; fullName: string; isActive: boolean }
  onOpenChange: (open: boolean) => void
}

export function DeleteStudentDialog({ student, onOpenChange }: Props) {
  const { t } = useTranslation()
  const { year, month } = vnDateParts()
  // Đường chỉ đọc, cùng hàm tính với màn Học phí/Tổng quan: nợ = nợ lũy kế tới tháng này (spec Q 5b).
  const status = trpc.tuition.getMonthlyStatusReadOnly.useQuery({
    studentId: student.id,
    year,
    month,
    status: "all",
    page: 1,
    limit: 1,
  })
  const row = status.data?.items[0]
  const debt = row && !row.isFullPaid ? Math.max(0, row.totalAmountDue - row.paidAmount) : 0
  const close = () => onOpenChange(false)
  const del = trpc.student.delete.useMutation({
    onSuccess: () => {
      toast.success(t("delete_success"))
      close()
    },
    onError: (e) => toast.error(e.message),
  })
  const deactivate = trpc.student.deactivate.useMutation({
    onSuccess: () => {
      toast.success(t("deactivate_success"))
      close()
    },
    onError: (e) => toast.error(e.message),
  })
  const busy = del.isPending || deactivate.isPending
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("delete_student")}</AlertDialogTitle>
          <AlertDialogDescription>
            {debt > 0 ? (
              t("delete_student_debt_desc")
                .replace("{name}", student.fullName)
                .replace("{amount}", formatCurrency(debt))
            ) : (
              <>
                <strong className="text-slate-900">{student.fullName}</strong>{" "}
                {t("delete_student_desc")}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-11 md:h-10" disabled={busy}>
            {t("cancel")}
          </AlertDialogCancel>
          {debt > 0 && student.isActive && (
            <Button
              type="button"
              variant="outline"
              className="h-11 md:h-10"
              disabled={busy}
              onClick={() => deactivate.mutate({ id: student.id })}
            >
              {t("deactivate_instead")}
            </Button>
          )}
          <Button
            type="button"
            className="h-11 bg-red-600 hover:bg-red-700 md:h-10"
            disabled={busy || status.isPending}
            onClick={() => del.mutate({ id: student.id })}
          >
            {status.isPending ? t("checking") : del.isPending ? t("deleting") : t("delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
