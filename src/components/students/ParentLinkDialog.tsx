"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Copy, Link2Off, RefreshCw, Share2 } from "lucide-react"
import { trpc } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

type Props = {
  student: { id: number; fullName: string; parentLinkToken: string | null }
  onOpenChange: (open: boolean) => void
}

export function ParentLinkDialog({ student, onOpenChange }: Props) {
  const { t } = useTranslation()
  // Prop `student` là bản chụp lúc mở menu, không tự đổi sau mutation → giữ token cục bộ.
  const [token, setToken] = useState(student.parentLinkToken)
  const [confirm, setConfirm] = useState<"regenerate" | "disable" | null>(null)

  const generate = trpc.student.generateParentLink.useMutation({
    onSuccess: (res) => {
      setToken(res.token)
      setConfirm(null)
      toast.success(t("link_created"))
    },
    onError: (e) => toast.error(e.message),
  })
  const disable = trpc.student.disableParentLink.useMutation({
    onSuccess: () => {
      setToken(null)
      setConfirm(null)
      toast.success(t("link_disabled"))
    },
    onError: (e) => toast.error(e.message),
  })
  const busy = generate.isPending || disable.isPending

  const url = token ? `${window.location.origin}/p/${token}` : ""
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function"

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t("link_copied"))
    } catch {
      // Trình duyệt chặn clipboard: báo lỗi, người dùng tự bấm vào ô để chọn và sao chép.
      toast.error(t("link_copy_failed"))
    }
  }

  const share = async () => {
    try {
      await navigator.share({
        title: t("parent_page_title"),
        text: `${t("parent_share_text")} ${student.fullName}`,
        url,
      })
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message)
    }
  }

  const btn = "h-11 md:h-10"

  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`${t("parent_link")} · ${student.fullName}`}</DialogTitle>
            <DialogDescription>{t("parent_link_desc")}</DialogDescription>
          </DialogHeader>

          {token ? (
            <div className="space-y-3">
              <Input
                readOnly
                value={url}
                aria-label={t("parent_link")}
                data-testid="parent-link-url"
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
              />
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button className={btn} onClick={copy}>
                  <Copy className="mr-2 size-4" />
                  {t("copy_link")}
                </Button>
                {canShare && (
                  <Button variant="outline" className={btn} onClick={share}>
                    <Share2 className="mr-2 size-4" />
                    {t("share")}
                  </Button>
                )}
                <Button variant="outline" className={btn} disabled={busy} onClick={() => setConfirm("regenerate")}>
                  <RefreshCw className="mr-2 size-4" />
                  {t("regenerate_link")}
                </Button>
                <Button
                  variant="outline"
                  className={`${btn} text-red-600 hover:text-red-700`}
                  disabled={busy}
                  onClick={() => setConfirm("disable")}
                >
                  <Link2Off className="mr-2 size-4" />
                  {t("disable_link")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className={`${btn} w-full sm:w-auto`}
              disabled={busy}
              onClick={() => generate.mutate({ id: student.id })}
            >
              {t("create_link")}
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "disable" ? t("disable_link") : t("regenerate_link")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "disable" ? t("disable_link_confirm") : t("regenerate_link_confirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className={confirm === "disable" ? "bg-red-600 hover:bg-red-700" : undefined}
              onClick={(e) => {
                // Giữ AlertDialog mở tới khi mutation xong (onSuccess tự đóng).
                e.preventDefault()
                if (confirm === "disable") disable.mutate({ id: student.id })
                else generate.mutate({ id: student.id })
              }}
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
