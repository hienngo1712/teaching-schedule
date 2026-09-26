"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Copy } from "lucide-react"
import { toDataURL } from "qrcode"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { isPeriod, planLabel } from "@/lib/plans"
import { formatCurrency } from "@/lib/utils"

type Order = NonNullable<RouterOutputs["plan"]["me"]["pendingOrder"]>

export function PendingOrderCard({ order, paymentReady }: { order: Order; paymentReady: boolean }) {
  const { t } = useTranslation()
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  const payload = order.qr?.payload ?? null

  useEffect(() => {
    if (!payload) return
    let cancelled = false
    toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 240 })
      .then((url) => {
        if (!cancelled) setQrSrc(url)
      })
      .catch((e) => console.error("Không tạo được mã QR:", e))
    return () => {
      cancelled = true
    }
  }, [payload])

  const cancel = trpc.plan.cancelOrder.useMutation({
    onSuccess: () => toast.success(t("plan_order_cancelled")),
    onError: (e) => toast.error(e.message),
  })

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t("plan_copied"))
    } catch {
      // Trình duyệt chặn clipboard: chữ vẫn hiện trên thẻ để tự chọn.
    }
  }

  const periodText = !isPeriod(order.period)
    ? ""
    : order.period === "2year"
      ? t("plan_period_2year")
      : t(order.period)
  const rows = order.qr
    ? [
        { label: t("bank"), value: order.qr.bankShortName, copyValue: order.qr.bankShortName },
        { label: t("account_number"), value: order.qr.accountNumber, copyValue: order.qr.accountNumber },
        { label: t("account_name"), value: order.qr.accountName, copyValue: order.qr.accountName },
        { label: t("payment_amount"), value: formatCurrency(order.amount), copyValue: String(order.amount) },
        { label: t("notice_transfer_content"), value: order.transferContent, copyValue: order.transferContent },
      ]
    : []

  return (
    <section data-testid="pending-order" className="space-y-3 rounded-xl border border-amber-200 bg-white p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          {planLabel(order.plan)} · {periodText}
          {order.bonusMonths > 0 && ` · ${t("plan_bonus_months").replace("{n}", String(order.bonusMonths))}`}
        </h2>
        <span className="rounded-full bg-amber-50 px-2 text-xs font-medium leading-5 text-amber-800">{t("plan_pending")}</span>
      </div>

      {order.qr && paymentReady ? (
        <>
          {qrSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL sinh tại chỗ, không qua next/image
            <img src={qrSrc} alt="VietQR" className="mx-auto size-60" />
          )}
          <dl className="divide-y divide-slate-100 text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-2 py-1.5">
                <dt className="w-28 shrink-0 text-slate-500">{r.label}</dt>
                <dd className="min-w-0 flex-1 break-all font-medium text-foreground">{r.value}</dd>
                <Button type="button" variant="ghost" size="icon" aria-label={`${t("copy_link")} ${r.label}`} className="size-11 shrink-0 md:size-9" onClick={() => copy(r.copyValue)}>
                  <Copy className="size-4" />
                </Button>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="text-sm text-slate-500">{t("plan_payment_not_ready")}</p>
      )}

      <p className="text-xs text-slate-500">{t("plan_pending_hint")}</p>
      <Button type="button" variant="outline" className="h-11 md:h-10" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: order.id })}>
        {t("plan_cancel_order")}
      </Button>
    </section>
  )
}
