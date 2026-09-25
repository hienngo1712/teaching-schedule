"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ArrowUpCircle, Loader2 } from "lucide-react"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Button } from "@/components/ui/button"
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

export type UpgradeResult = RouterOutputs["student"]["upgradeAllClasses"]
export type UpgradeLog = RouterOutputs["student"]["getUpgradeLogThisYear"]

export function UpgradeAllClassesButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const logQuery = trpc.student.getUpgradeLogThisYear.useQuery()
  const alreadyDone = !!logQuery.data
  const currentYear = new Date().getFullYear()

  const mutation = trpc.student.upgradeAllClasses.useMutation({
    onSuccess: (data) => {
      toast.success(
        t("upgrade_all_success")
          .replace("{upgraded}", String(data.upgradedCount))
          .replace("{deactivated}", String(data.deactivatedCount)),
      )
      setOpen(false)
    },
    onError: (err) => {
      toast.error(err.message)
      setOpen(false)
    },
  })

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={alreadyDone || logQuery.isPending}
        title={
          alreadyDone
            ? t("upgrade_all_already_done").replace("{year}", String(currentYear))
            : undefined
        }
        aria-label={t("upgrade_all_button")}
        className="h-11 px-3 md:h-10 md:px-4"
      >
        <ArrowUpCircle className="size-4 sm:mr-2" />
        <span className="hidden sm:inline">{t("upgrade_all_button")}</span>
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("upgrade_all_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("upgrade_all_confirm_body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                mutation.mutate()
              }}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : null}
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
