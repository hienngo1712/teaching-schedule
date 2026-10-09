"use client"

import { forwardRef, useEffect, useState } from "react"
import { toDataURL } from "qrcode"
import type { TuitionNoticeDTO } from "@/lib/types/models"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { formatVnDate } from "@/lib/payment-notes"
import { noticeFeePerSession, noticePaymentState } from "@/lib/tuition-notice"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  notice: TuitionNoticeDTO
  variant?: "default" | "wide"
  onReady?: () => void
  onError?: (e: unknown) => void
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// Thuần hiển thị, G render lại ở trang phụ huynh. Chỉ block/grid, không rounded-full/inline-flex/shadow:
// html2canvas vẽ sai các thứ đó (xem useExport.ts).
export const TuitionNoticeCard = forwardRef<HTMLDivElement, Props>(function TuitionNoticeCard(
  { notice, variant = "default", onReady, onError },
  ref
) {
  const { t } = useTranslation()
  const isWide = variant === "wide"
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

  const isMonthly = notice.billingMode === "monthly"
  const fee = isMonthly ? null : noticeFeePerSession(notice.presentDates)
  const dates = notice.presentDates
    .map((d) => (!isMonthly && fee === null ? `${ddmm(d.date)} (${formatCurrency(d.fee)})` : ddmm(d.date)))
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
      style={isWide ? undefined : { width: 360 }}
      className={cn("space-y-4 border border-slate-200 bg-white p-5 text-sm text-slate-900", isWide && "w-full")}
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
        {isMonthly ? (
          <>
            {/* Tháng không có ca thì tháng này 0 đ: ẩn dòng trọn gói cho khỏi mâu thuẫn. */}
            {notice.totalSessions > 0 && (
              <p>
                {t("monthly_fee_line")
                  .replace("{amount}", formatCurrency(notice.monthlyFee))
                  .replace("{p}", String(notice.presentSessions))
                  .replace("{n}", String(notice.totalSessions))}
              </p>
            )}
            {!isWide && dates && (
              <p>
                <span className="text-slate-500">{t("notice_dates")}: </span>
                {dates}
              </p>
            )}
          </>
        ) : (
          <>
            {row(t("notice_present_sessions"), String(notice.presentSessions))}
            {fee !== null && row(t("notice_fee_per_session"), formatCurrency(fee))}
            {!isWide && dates && (
              <p>
                <span className="text-slate-500">{t("notice_dates")}: </span>
                {dates}
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-1 border-t border-slate-200 pt-3">
        {notice.inProgress && notice.billingMode === "per_session"
          ? row(
              t("month_provisional_line")
                .replace("{m}", String(notice.month))
                .replace("{p}", String(notice.presentSessions)),
              formatCurrency(notice.currentMonthFee),
              "text-slate-400 italic"
            )
          : row(t("notice_month_fee"), formatCurrency(notice.currentMonthFee))}
        {notice.previousBalance > 0 &&
          row(
            notice.debtMonths > 1
              ? t("debt_n_months_label").replace("{n}", String(notice.debtMonths))
              : t("debt_prev_month_label").replace("{m}", String(notice.month === 1 ? 12 : notice.month - 1)),
            formatCurrency(notice.previousBalance)
          )}
        {notice.previousBalance < 0 && row(t("notice_prev_credit"), formatCurrency(notice.previousBalance))}
        {!(notice.inProgress && notice.billingMode === "per_session") &&
          row(t("total_amount_due"), formatCurrency(notice.totalAmountDue), "font-semibold")}
        {row(t("paid_total"), formatCurrency(notice.paidAmount))}
        {notice.payments.map((p) => (
          <p key={p.id} className="pl-3 text-xs text-slate-500">
            {formatDate(p.paidAt)} · {formatCurrency(p.amount)}
          </p>
        ))}
        {row(
          notice.inProgress && notice.billingMode === "per_session" ? t("due_now") : t("notice_remaining"),
          formatCurrency(notice.remaining),
          "border-t border-slate-200 pt-2 text-lg font-bold"
        )}
      </div>

      {state === "qr" && notice.qr && (
        isWide ? (
          <div data-testid="notice-qr-side" className="grid grid-cols-[160px_1fr] items-center gap-4 border-t border-slate-200 pt-3 text-left">
            {qrSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL; html2canvas cần <img> thường
              <img
                src={qrSrc}
                alt={notice.qr.provider === "payos" ? "payOS" : "VietQR"}
                width={160}
                height={160}
                className="block"
                onLoad={onReady}
              />
            ) : (
              <div className="bg-slate-100" style={{ width: 160, height: 160 }} />
            )}
            <div className="space-y-1">
              <p className="font-semibold">{notice.qr.bankShortName}</p>
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
              {notice.qr.provider === "payos" && <p className="text-xs text-emerald-700">{t("payos_scan_hint")}</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-1 border-t border-slate-200 pt-3 text-center">
            {qrSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL; html2canvas cần <img> thường
              <img
                src={qrSrc}
                alt={notice.qr.provider === "payos" ? "payOS" : "VietQR"}
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
            {notice.qr.provider === "payos" && <p className="text-xs text-emerald-700">{t("payos_scan_hint")}</p>}
          </div>
        )
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
