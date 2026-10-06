"use client"

import { useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Loader2, Star } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

const MAX = 1000
const STARS = [1, 2, 3, 4, 5]

export function FeedbackDialog({ onClose, prompted = false }: { onClose: (sent: boolean) => void; prompted?: boolean }) {
  const { t } = useTranslation()
  const page = usePathname() ?? "/"
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState("")
  const starRefs = useRef<(HTMLButtonElement | null)[]>([])
  const submit = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      toast.success(t("feedback_thanks"))
      onClose(true)
    },
    onError: (e) => toast.error(e.data?.code === "TOO_MANY_REQUESTS" ? t("feedback_limit") : e.message),
  })

  const pick = (n: number) => {
    setRating(n)
    starRefs.current[n - 1]?.focus()
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") pick(Math.min(5, Math.max(1, rating + 1)))
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") pick(Math.max(1, rating - 1))
    else return
    e.preventDefault()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("feedback_title")}</DialogTitle>
          {prompted ? (
            <DialogDescription>{t("feedback_prompt_subtitle")}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{t("feedback_title")}</DialogDescription>
          )}
        </DialogHeader>
        <div role="radiogroup" aria-label={t("feedback_rating_label")} onKeyDown={onKeyDown} className="flex justify-center gap-1">
          {STARS.map((n) => (
            <button
              key={n}
              ref={(el) => {
                starRefs.current[n - 1] = el
              }}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={t("feedback_star").replace("{n}", String(n))}
              tabIndex={rating === n || (rating === 0 && n === 1) ? 0 : -1}
              onClick={() => setRating(n)}
              className="flex size-11 items-center justify-center rounded-md hover:bg-slate-100"
            >
              <Star className={cn("size-7", n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300")} aria-hidden />
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor="feedback-message">{t("feedback_message_label")}</Label>
          <Textarea
            id="feedback-message"
            value={message}
            maxLength={MAX}
            rows={4}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-right text-xs text-slate-500">
            {message.length}/{MAX}
          </p>
        </div>
        <DialogFooter className="gap-2">
          {prompted && (
            <Button variant="outline" onClick={() => onClose(false)} className="h-11 md:h-10">
              {t("feedback_later")}
            </Button>
          )}
          <Button
            onClick={() => submit.mutate({ rating, message, page })}
            disabled={rating === 0 || submit.isPending}
            className="h-11 md:h-10"
          >
            {submit.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("feedback_send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
