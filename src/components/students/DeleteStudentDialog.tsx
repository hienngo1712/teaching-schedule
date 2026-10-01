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
import { formatCurrency } from "@/lib/utils"

type Props = {
  student: { id: number; fullName: string; isActive: boolean }
  onOpenChange: (open: boolean) => void
}

// Server là nguồn sự thật của quy tắc xoá (spec R2); dialog chỉ hiện kết quả.
export function DeleteStudentDialog({ student, onOpenChange }: Props) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const check = trpc.student.deleteCheck.useQuery({ id: student.id }, { staleTime: 0 })
  const close = () => onOpenChange(false)
  const del = trpc.student.delete.useMutation({
    onSuccess: () => {
      toast.success(t("delete_success"))
      utils.student.list.invalidate()
      utils.trash.counts.invalidate()
      close()
    },
    onError: (e) => toast.error(e.message),
  })

  const result = check.data
  const blocked = result && !result.allowed
  const message = check.isError
    ? t("load_error")
    : !result
      ? null
      : result.allowed
        ? null
        : result.reason === "debt"
          ? t("delete_blocked_debt").replace("{name}", student.fullName).replace("{amount}", formatCurrency(result.debt))
          : t("delete_blocked_active").replace("{name}", student.fullName)

  return (
    <AlertDialog open onOpenChange={(o) => !del.isPending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("delete_student")}</AlertDialogTitle>
          <AlertDialogDescription>
            {message ?? (
              <>
                <strong className="text-slate-900">{student.fullName}</strong> {t("delete_student_desc")}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          {check.isError ? (
            <Button type="button" variant="outline" className="h-11 md:h-10" onClick={() => check.refetch()}>
              {t("retry")}
            </Button>
          ) : null}
          <AlertDialogCancel className="h-11 md:h-10" disabled={del.isPending}>
            {blocked || check.isError ? t("close") : t("cancel")}
          </AlertDialogCancel>
          {!blocked && !check.isError && (
            <Button
              type="button"
              className="h-11 bg-red-600 hover:bg-red-700 md:h-10"
              disabled={check.isPending || del.isPending}
              onClick={() => del.mutate({ id: student.id })}
            >
              {check.isPending ? t("checking") : del.isPending ? t("deleting") : t("delete")}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
