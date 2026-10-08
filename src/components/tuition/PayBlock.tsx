"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc"
import { formatCurrency } from "@/lib/utils"
import { allocatePayment, keyToYearMonth } from "@/lib/payment-allocation"
import { vnTodayIso } from "@/lib/payment-summary"
import { useRecordPayment } from "@/hooks/useRecordPayment"
import { useTranslation } from "@/components/providers/LanguageProvider"

export function PayBlock({
  studentId,
  year,
  month,
  due,
}: {
  studentId: number
  year: number
  month: number
  due: number
}) {
  const { t } = useTranslation()
  const { pay, payFull, isPending } = useRecordPayment()
  const [partial, setPartial] = useState(false)
  const [amount, setAmount] = useState(0)
  const [dateOpen, setDateOpen] = useState(false)
  const [paidAt, setPaidAt] = useState(vnTodayIso())

  const ledgers = trpc.tuition.ledgers.useQuery(
    { studentId, year, month },
    { enabled: partial }
  )
  const preview =
    partial && amount > 0 && ledgers.data
      ? allocatePayment(ledgers.data, amount)
      : []

  const previewText = preview
    .map((p) => `T${keyToYearMonth(p.key).month}: ${formatCurrency(p.amount)}`)
    .join(", ")

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div className="text-sm font-semibold text-slate-900">{t("collect_payment")}</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {due > 0 && (
          <Button
            size="sm"
            className="h-11 sm:h-9"
            disabled={isPending}
            onClick={() => payFull({ studentId, year, month }, due)}
          >
            {t("pay_full").replace("{amount}", formatCurrency(due))}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-11 sm:h-9"
          onClick={() => {
            setPartial(!partial)
            if (partial) {
              setAmount(0)
              setDateOpen(false)
            }
          }}
          data-tour="tuition-pay-partial"
        >
          {t("pay_partial")}
        </Button>
      </div>

      {partial && (
        <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
          <div className="space-y-1.5">
            <label htmlFor="pay-amount" className="text-xs font-medium text-slate-700">
              {t("pay_amount_label")}
            </label>
            <CurrencyInput
              id="pay-amount"
              value={amount}
              onChange={(v) => setAmount(v ?? 0)}
              placeholder="0"
            />
          </div>

          {preview.length > 0 && (
            <div className="text-xs text-slate-600">
              {t("pay_preview").replace("{parts}", previewText)}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {!dateOpen ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-slate-500 hover:bg-transparent hover:underline"
                onClick={() => setDateOpen(true)}
              >
                {t("paid_at_today_change").replace("{d}", paidAt)}
              </Button>
            ) : (
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="h-8 w-auto text-xs"
              />
            )}

            <Button
              size="sm"
              className="h-11 sm:h-9"
              disabled={amount <= 0 || isPending}
              onClick={() => {
                pay({ studentId, year, month }, amount, paidAt)
                setPartial(false)
                setAmount(0)
                setDateOpen(false)
              }}
            >
              {t("record_payment_submit")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
