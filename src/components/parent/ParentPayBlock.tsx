"use client"

import { forwardRef, useEffect, useState } from "react"
import { toDataURL } from "qrcode"
import type { TuitionNoticeDTO } from "@/lib/types/models"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import { formatVnDate } from "@/lib/payment-notes"
import { noticeFeePerSession, noticePaymentState } from "@/lib/tuition-notice"
import { debtLines } from "@/lib/debt-breakdown"
import { useTranslation } from "@/components/providers/LanguageProvider"

// Tháng đang học theo buổi: số tạm tính, "Cần đóng ngay" thay "Còn phải trả" (như TuitionNoticeCard).
export const isProvisionalNotice = (n: TuitionNoticeDTO) => n.inProgress && n.billingMode === "per_session"

function CopyRow({ label, value, copyValue }: { label: string; value: string; copyValue: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Trình duyệt chặn clipboard: người dùng tự chọn chữ để chép.
    }
  }
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 last:border-b-0 lg:py-1">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="break-all font-semibold text-slate-900">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`${t("copy_link")} ${label}`}
        className="h-11 shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-primary lg:h-8"
      >
        {copied ? t("copied_short") : t("copy_link")}
      </button>
    </div>
  )
}

// Khối Thanh toán trang phụ huynh (spec AU A1): web dính cột phải, điện thoại nằm sau nhận xét.
export const ParentPayBlock = forwardRef<HTMLElement, { notice: TuitionNoticeDTO; className?: string }>(
  function ParentPayBlock({ notice, className }, ref) {
    const { t } = useTranslation()
    const state = noticePaymentState(notice)
    const payload = state === "qr" && notice.qr ? notice.qr.payload : null
    const [qrSrc, setQrSrc] = useState<string | null>(null)

    useEffect(() => {
      if (!payload) return
      let cancelled = false
      toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 240 })
        .then((url) => !cancelled && setQrSrc(url))
        .catch((e) => console.error("Không tạo được mã QR:", e))
      return () => {
        cancelled = true
      }
    }, [payload])

    const provisional = isProvisionalNotice(notice)
    const fee = notice.billingMode === "per_session" ? noticeFeePerSession(notice.presentDates) : null
    const pill =
      state === "paid"
        ? { text: t("fully_paid"), cls: "bg-emerald-50 text-emerald-700" }
        : state === "settled"
          ? { text: t("notice_settled"), cls: "bg-emerald-50 text-emerald-700" }
          : { text: notice.paidAmount > 0 ? t("partial_paid") : t("unpaid"), cls: "bg-amber-50 text-amber-700" }

    const row = (label: string, value: string, cls?: string, key?: string) => (
      <div key={key} className={cn("flex justify-between gap-3 py-0.5", cls)}>
        <span className="text-slate-500">{label}</span>
        <span className="whitespace-nowrap text-right tabular-nums">{value}</span>
      </div>
    )

    return (
      <aside ref={ref} data-testid="parent-pay" className={cn("rounded-xl border border-slate-200 bg-white p-4 lg:p-5", className)}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">{t("parent_pay_title").replace("{m}", String(notice.month))}</h2>
          <span className={cn("shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold", pill.cls)}>{pill.text}</span>
        </div>

        <p className="mt-2 text-sm text-slate-500 lg:mt-1">{provisional ? t("due_now") : t("notice_remaining")}</p>
        <p data-testid="parent-pay-remaining" className="text-3xl font-bold tracking-tight text-slate-900 lg:text-[28px]">
          {formatCurrency(notice.remaining)}
        </p>

        <div className="mt-3 space-y-0.5 border-t border-dashed border-slate-200 pt-2 text-sm lg:mt-2">
          {provisional
            ? row(
                t("month_provisional_line").replace("{m}", String(notice.month)).replace("{p}", String(notice.presentSessions)),
                formatCurrency(notice.currentMonthFee),
                "italic text-slate-400"
              )
            : row(
                fee !== null ? `${t("notice_month_fee")} (${notice.presentSessions} × ${formatCurrency(fee)})` : t("notice_month_fee"),
                formatCurrency(notice.currentMonthFee)
              )}
          {debtLines(t, notice).map((l) =>
            row(l.label, formatCurrency(l.amount), l.kind === "month" ? "pl-3 text-xs" : "font-medium text-debt", l.label)
          )}
          {notice.previousBalance < 0 && row(t("notice_prev_credit"), formatCurrency(notice.previousBalance))}
          {row(t("paid_total"), formatCurrency(notice.paidAmount))}
          {notice.payments.map((p) => (
            <p key={p.id} className="pl-3 text-xs text-slate-500">
              {formatDate(p.paidAt)} · {formatCurrency(p.amount)}
            </p>
          ))}
        </div>

        {state === "qr" && notice.qr && (
          <div className="mt-3 lg:mt-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center lg:p-2">
              {qrSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL
                <img
                  src={qrSrc}
                  alt={notice.qr.provider === "payos" ? "payOS" : "VietQR"}
                  className="mx-auto block size-48 rounded-md bg-white lg:size-36"
                />
              ) : (
                <div className="mx-auto size-48 rounded-md bg-slate-100 lg:size-36" />
              )}
              <p className="mt-2 text-xs text-slate-500 lg:mt-1">
                {notice.qr.provider === "payos" ? t("payos_scan_hint") : t("parent_qr_hint")}
              </p>
            </div>
            {/* payOS: trang thanh toán của payOS (spec AH §5). */}
            {notice.qr.checkoutUrl && (
              <a
                href={notice.qr.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white"
              >
                {t("payos_open_checkout")}
              </a>
            )}
            <div className="mt-2 text-sm">
              <div className="border-b border-slate-100 py-2 lg:py-1">
                <p className="text-xs text-slate-500">{t("parent_bank_owner")}</p>
                <p className="font-semibold text-slate-900">{`${notice.qr.bankShortName} · ${notice.qr.accountName}`}</p>
              </div>
              <CopyRow label={t("account_number")} value={notice.qr.accountNumber} copyValue={notice.qr.accountNumber} />
              <CopyRow label={t("payment_amount")} value={formatCurrency(notice.qr.amount)} copyValue={String(notice.qr.amount)} />
              <CopyRow label={t("notice_transfer_content")} value={notice.qr.content} copyValue={notice.qr.content} />
            </div>
          </div>
        )}

        {state === "paid" && (
          <div className="mt-3 border-t border-slate-200 pt-3 text-center text-sm">
            <p className="font-semibold">{t("notice_paid_in_full")}</p>
            {notice.overpaid > 0 && (
              <p className="text-slate-600">{t("notice_overpaid").replace("{amount}", formatCurrency(notice.overpaid))}</p>
            )}
          </div>
        )}

        <div className="mt-3 flex justify-between gap-2 text-xs text-slate-400 lg:mt-2">
          <span>{`${t("notice_teacher")}: ${notice.teacherName}`}</span>
          <span>{`${t("notice_issued")}: ${formatVnDate(new Date())}`}</span>
        </div>
      </aside>
    )
  }
)
