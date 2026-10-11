"use client"

import { forwardRef, useEffect, useState, type ReactNode } from "react"
import { toDataURL } from "qrcode"
import type { PlaceNoticeCardData } from "@/server/services/place-notice.service"
import { cn, formatCurrency } from "@/lib/utils"
import { formatVnDate } from "@/lib/payment-notes"
import { formatHours } from "@/lib/timesheet-export"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  notice: PlaceNoticeCardData
  variant?: "default" | "wide"
  // Phiếu chưa có QR vì GV chưa nhập ngân hàng: hộp của GV truyền link tới Cài đặt; trang người trả để trống.
  noBankAction?: ReactNode
  onReady?: () => void
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// Phiếu báo theo nơi dạy (spec AN §1, mẫu 12), dựng như TuitionNoticeCard. Chỉ block/grid để html2canvas vẽ đúng.
export const PlaceNoticeCard = forwardRef<HTMLDivElement, Props>(function PlaceNoticeCard(
  { notice, variant = "default", noBankAction, onReady },
  ref
) {
  const { t } = useTranslation()
  const isWide = variant === "wide"
  const payload = notice.qr?.payload ?? null
  const [qrSrc, setQrSrc] = useState<string | null>(null)
  // QR lỗi (tạo hoặc hiển thị): phiếu vẫn xong, ô QR ghi lỗi — nút lưu ảnh không treo (FIX AN F2).
  const [qrFailed, setQrFailed] = useState(false)

  useEffect(() => {
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
        if (!cancelled) setQrFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [payload, onReady])

  useEffect(() => {
    if (qrFailed) onReady?.()
  }, [qrFailed, onReady])

  const rateLabel = t(notice.rate.unit === "hour" ? "income_rate_hour" : "income_rate_session").replace(
    "{amount}",
    formatCurrency(notice.rate.amount)
  )
  const dates = notice.doneDates.map((d) => (d.isMakeup ? `${ddmm(d.date)} ${t("place_notice_makeup_mark")}` : ddmm(d.date))).join(", ")
  const row = (label: string, value: string, className?: string) => (
    <div className={cn("grid grid-cols-[1fr_auto] gap-3", className)}>
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
  const qrSize = isWide ? 160 : 200

  return (
    <div
      ref={ref}
      data-testid="place-notice-card"
      // Rộng tối đa 360px nhưng co theo khung (375/360px còn 343/328px): không tràn mép, không cuộn ngang (FIX AN Task 2).
      className={cn("w-full space-y-4 border border-slate-200 bg-white p-5 text-sm text-slate-900", !isWide && "mx-auto max-w-[360px]")}
    >
      <h2 className="text-center text-base font-bold">
        {t("place_notice_title")} {notice.month}/{notice.year}
      </h2>

      <div className="space-y-1">
        <p>
          <span className="text-slate-500">{t("place_notice_to")}: </span>
          <span className="font-semibold">{notice.placeName}</span>
        </p>
        <p>
          <span className="text-slate-500">{t("notice_teacher")}: </span>
          {notice.teacherName}
        </p>
        {notice.subjects.length > 0 && (
          <p>
            <span className="text-slate-500">{t("place_notice_subjects")}: </span>
            {notice.subjects.join(", ")}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <p>
          <span className="text-slate-500">{t("place_notice_dates")}: </span>
          {dates}
        </p>
        {notice.cancelledDates.length > 0 && (
          <p className="text-slate-500">
            {t("place_notice_excluded")}: {notice.cancelledDates.map((d) => `${ddmm(d)} ${t("place_notice_cancelled_mark")}`).join(", ")}
          </p>
        )}
      </div>

      <div className="space-y-1 border-t border-slate-200 pt-3">
        {row(t("place_notice_sessions"), String(notice.doneCount))}
        {row(t("place_notice_hours"), formatHours(notice.doneHours))}
        {row(t("place_notice_rate"), rateLabel)}
        {row(t("place_notice_amount"), formatCurrency(notice.expected), "font-semibold")}
        {row(t("place_notice_received"), formatCurrency(notice.received))}
        {row(t("place_notice_remaining"), formatCurrency(notice.remaining), "border-t border-slate-200 pt-2 text-lg font-bold")}
      </div>

      {notice.remaining === 0 ? (
        <p className="border-t border-slate-200 pt-3 text-center font-semibold">{t("place_notice_paid")}</p>
      ) : notice.qr && notice.bank ? (
        <div
          data-testid="place-notice-qr"
          className={cn("border-t border-slate-200 pt-3", isWide ? "grid grid-cols-[160px_1fr] items-center gap-4 text-left" : "space-y-1 text-center")}
        >
          {qrSrc && !qrFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL; html2canvas cần <img> thường
            <img
              src={qrSrc}
              alt={notice.qr.provider === "payos" ? "payOS" : "VietQR"}
              width={qrSize}
              height={qrSize}
              className={cn("block", !isWide && "mx-auto")}
              onLoad={onReady}
              onError={() => setQrFailed(true)}
            />
          ) : (
            <div
              className={cn("flex items-center justify-center bg-slate-100 p-3 text-xs text-slate-500", !isWide && "mx-auto")}
              style={{ width: qrSize, height: qrSize }}
            >
              {qrFailed && t("place_notice_qr_failed")}
            </div>
          )}
          <div className={cn("space-y-1", !isWide && "pt-2")}>
            <p className="font-semibold">{notice.bank.bankShortName}</p>
            <p>
              {t("account_number")}: {notice.bank.accountNumber}
            </p>
            <p>
              {t("account_name")}: {notice.bank.accountName}
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
        <div className="space-y-2 border-t border-slate-200 pt-3 text-center text-slate-600">
          <p>{t("place_notice_no_bank")}</p>
          {noBankAction}
        </div>
      )}

      <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
        <p>
          {t("notice_issued")}: {formatVnDate(new Date())}
        </p>
      </div>
    </div>
  )
})
