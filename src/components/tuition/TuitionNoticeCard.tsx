"use client"

import { forwardRef, useEffect, useState } from "react"
import { toDataURL } from "qrcode"
import type { TuitionNoticeDTO } from "@/lib/types/models"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { formatVnDate } from "@/lib/payment-notes"
import { noticeFeePerSession, noticePaymentState } from "@/lib/tuition-notice"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = { notice: TuitionNoticeDTO; onReady?: () => void; onError?: (e: unknown) => void }

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// Thuần hiển thị, G render lại ở trang phụ huynh. Chỉ block/grid, không rounded-full/inline-flex/shadow:
// html2canvas vẽ sai các thứ đó (xem useExport.ts).
export const TuitionNoticeCard = forwardRef<HTMLDivElement, Props>(function TuitionNoticeCard(
  { notice, onReady, onError },
  ref
) {
  const { t } = useTranslation()
  const state = noticePaymentState(notice)
  const payload = state === "qr" && notice.qr ? notice.qr.payload : null
  const [qrSrc, setQrSrc] = useState<string | null>(null)

  useEffect(() => {
    // Không có QR thì sẵn sàng ngay; có QR thì chờ <img> tải xong (onLoad).
    if (!payload) {
      onReady?.()
      return
    }
    let cancelled = false
    toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 240 })
      .then((url) => {
        if (!cancelled) setQrSrc(url)
      })
      .catch((e) => {
        console.error("Không tạo được mã QR:", e)
        if (!cancelled) onError?.(e)
      })
    return () => {
      cancelled = true
    }
  }, [payload, onReady, onError])

  const fee = noticeFeePerSession(notice.presentDates)
  const dates = notice.presentDates
    .map((d) => (fee === null ? `${ddmm(d.date)} (${formatCurrency(d.fee)})` : ddmm(d.date)))
    .join(", ")

  const row = (label: string, value: string, className?: string) => (
    <div className={cn("grid grid-cols-[1fr_auto] gap-3", className)}>
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )

  return (
    <div
      ref={ref}
      data-testid="notice-card"
      style={{ width: 360 }}
      className="space-y-4 border border-slate-200 bg-white p-5 text-sm text-slate-900"
    >
      <h2 className="text-center text-base font-bold">
        {t("tuition_notice_title")} {notice.month}/{notice.year}
      </h2>

      <div className="space-y-1">
        <p>
          <span className="text-slate-500">{t("student")}: </span>
          <span className="font-semibold">{notice.fullName}</span>
        </p>
        <p>
          <span className="text-slate-500">{t("grade")}: </span>
          {notice.grade}
        </p>
      </div>

      <div className="space-y-1">
        {row(t("notice_present_sessions"), String(notice.presentSessions))}
        {fee !== null && row(t("notice_fee_per_session"), formatCurrency(fee))}
        {dates && (
          <p>
            <span className="text-slate-500">{t("notice_dates")}: </span>
            {dates}
          </p>
        )}
      </div>

      <div className="space-y-1 border-t border-slate-200 pt-3">
        {row(t("notice_month_fee"), formatCurrency(notice.currentMonthFee))}
        {notice.previousBalance > 0 && row(t("notice_prev_debt"), formatCurrency(notice.previousBalance))}
        {notice.previousBalance < 0 && row(t("notice_prev_credit"), formatCurrency(notice.previousBalance))}
        {row(t("total_amount_due"), formatCurrency(notice.totalAmountDue), "font-semibold")}
        {row(t("paid_total"), formatCurrency(notice.paidAmount))}
        {notice.payments.map((p) => (
          <p key={p.id} className="pl-3 text-xs text-slate-500">
            {formatDate(p.paidAt)} · {t(p.method === "cash" ? "method_cash" : "method_transfer")} ·{" "}
            {formatCurrency(p.amount)}
          </p>
        ))}
        {row(
          t("notice_remaining"),
          formatCurrency(notice.remaining),
          "border-t border-slate-200 pt-2 text-lg font-bold"
        )}
      </div>

      {state === "qr" && notice.qr && (
        <div className="space-y-1 border-t border-slate-200 pt-3 text-center">
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL; html2canvas cần <img> thường
            <img
              src={qrSrc}
              alt="VietQR"
              width={200}
              height={200}
              className="mx-auto block"
              onLoad={onReady}
            />
          ) : (
            <div className="mx-auto bg-slate-100" style={{ width: 200, height: 200 }} />
          )}
          <p className="pt-2 font-semibold">{notice.qr.bankShortName}</p>
          <p>
            {t("account_number")}: {notice.qr.accountNumber}
          </p>
          <p>
            {t("account_name")}: {notice.qr.accountName}
          </p>
          <p>
            {t("payment_amount")}: {formatCurrency(notice.qr.amount)}
          </p>
          <p>
            {t("notice_transfer_content")}: {notice.qr.content}
          </p>
        </div>
      )}

      {state === "settled" && (
        <p className="border-t border-slate-200 pt-3 text-center font-semibold">{t("notice_settled")}</p>
      )}

      {state === "paid" && (
        <div className="border-t border-slate-200 pt-3 text-center">
          <p className="font-semibold">{t("notice_paid_in_full")}</p>
          {notice.overpaid > 0 && (
            <p className="text-slate-600">
              {t("notice_overpaid").replace("{amount}", formatCurrency(notice.overpaid))}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
        <p>
          {t("notice_teacher")}: {notice.teacherName}
        </p>
        <p>
          {t("notice_issued")}: {formatVnDate(new Date())}
        </p>
      </div>
    </div>
  )
})
