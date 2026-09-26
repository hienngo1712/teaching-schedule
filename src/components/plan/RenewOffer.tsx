"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePlan } from "@/hooks/usePlan"
import { PLAN_LABEL, formatValidUntil, renewOffer } from "@/lib/plans"
import { formatVnDate } from "@/lib/payment-notes"
import { vnDateParts } from "@/lib/utils"

const SHOWN_KEY = "renew-offer-shown"

function vnToday(): string {
  const { year, month, day } = vnDateParts()
  return `${year}-${month}-${day}`
}

// Spec 8.6: gói trả phí còn 1–60 ngày, không có đơn chờ. Nút header hiện suốt thời gian đó.
export function RenewOffer() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const { me, fields } = usePlan()
  const [open, setOpen] = useState(false)
  const offer = me && fields ? renewOffer(fields, new Date(), me.pendingOrder !== null) : null
  const hasOffer = offer !== null

  useEffect(() => {
    // Tự mở mỗi ngày VN 1 lần; không tự mở khi đang ở trang gia hạn.
    if (!hasOffer || pathname.startsWith("/plan")) return
    const today = vnToday()
    let shown: string | null = null
    try {
      shown = localStorage.getItem(SHOWN_KEY)
    } catch {
      // Storage bị chặn: coi như chưa hiện hôm nay.
    }
    if (shown === today) return
    try {
      localStorage.setItem(SHOWN_KEY, today)
    } catch {
      // Không lưu được thì lần tải sau hiện lại, chấp nhận.
    }
    setOpen(true)
  }, [hasOffer, pathname])

  if (!offer) return null
  const name = PLAN_LABEL[offer.plan]
  const later =
    offer.dropsAfter && offer.after
      ? t("renew_offer_drops")
          .replace("{date}", formatVnDate(offer.dropsAfter).slice(0, 5))
          .replace("{two}", String(offer.after.twoYear))
          .replace("{one}", String(offer.after.year))
      : t("renew_offer_last")

  return (
    <>
      <Button type="button" aria-label={t("plan_renew")} className="h-11 gap-1.5 px-3 md:h-10" onClick={() => setOpen(true)}>
        <RefreshCw aria-hidden className="size-4" />
        <span className="hidden sm:inline">{t("plan_renew")}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="renew-offer" className="max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("renew_offer_title")}</DialogTitle>
            <DialogDescription>
              {t("renew_offer_days_left")
                .replace("{plan}", name)
                .replace("{n}", String(offer.daysLeft))
                .replace("{date}", formatValidUntil(offer.expiresAt))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-primary">
              {t("renew_offer_current").replace("{two}", String(offer.twoYear)).replace("{one}", String(offer.year))}
            </p>
            <p className="text-slate-600">{later}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="h-11 md:h-10" onClick={() => setOpen(false)}>
              {t("plan_later")}
            </Button>
            <Button asChild className="h-11 md:h-10">
              <Link href="/plan" onClick={() => setOpen(false)}>
                {t("renew_offer_now")}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
