"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { SUBJECT_COLORS, pickNextColor } from "@/lib/subject-colors"
import { cn, vnDateParts } from "@/lib/utils"
import { PLACE_KINDS, defaultBilling, type PlaceKind } from "@/lib/schemas/place"
import type { PlaceBilling } from "@/lib/billing"
import { useTranslation } from "@/components/providers/LanguageProvider"
import type vi from "@/language/vi.json"

type Place = RouterOutputs["place"]["list"][number]

type Props = {
  place?: Place
  usedColors: string[]
  onClose: () => void
  onSaved?: (id: number) => void
}

const BILLINGS: PlaceBilling[] = ["per_student", "per_session"]
const RATE_UNITS = ["session", "hour"] as const
type RateUnit = (typeof RATE_UNITS)[number]

// 13 tháng: tháng hiện tại và 12 tháng trước (spec AM §4.2), dạng "YYYY-MM".
function rateMonths(year: number, month: number): string[] {
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  })
}

// Như SubjectFormDialog (mẫu AJ 07a): chỉ mount khi mở nên state khởi tạo thẳng từ props.
export function PlaceFormDialog({ place, usedColors, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const [name, setName] = useState(place?.name ?? "")
  const [kind, setKind] = useState<PlaceKind>(place?.kind ?? "home")
  const [billing, setBilling] = useState<PlaceBilling>(place?.billing ?? "per_student")
  const [color, setColor] = useState(place?.color ?? pickNextColor(usedColors))
  const [error, setError] = useState<string | null>(null)
  const { year, month } = vnDateParts()
  const currentMonth = `${year}-${String(month).padStart(2, "0")}`
  const [rateUnit, setRateUnit] = useState<RateUnit>(place?.rate?.unit ?? "session")
  const [rateAmount, setRateAmount] = useState<number | undefined>(place?.rate?.amount)
  const [rateFrom, setRateFrom] = useState(currentMonth)
  const rateMut = trpc.placeRate.set.useMutation({
    onSuccess: () => {
      utils.place.invalidate()
      utils.income.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  // Đơn giá chỉ cho nơi theo ca/giờ; gửi khi số tiền/đơn vị/tháng áp dụng đổi so với hiện tại.
  const amount = rateAmount ?? 0
  const rateChanged =
    billing === "per_session" &&
    (amount !== (place?.rate?.amount ?? 0) ||
      (amount > 0 && rateUnit !== place?.rate?.unit) ||
      (amount > 0 && !!place?.hasSessions && rateFrom !== currentMonth))

  const handlers = {
    onSuccess: (saved: { id: number } | undefined) => {
      toast.success(t("place_saved"))
      utils.place.invalidate()
      if (saved && rateChanged) {
        const [fromYear, fromMonth] = rateFrom.split("-").map(Number)
        rateMut.mutate({ placeId: saved.id, unit: rateUnit, amount, fromYear, fromMonth })
      }
      if (saved) onSaved?.(saved.id)
      onClose()
    },
    onError: (e: { message: string }) => setError(t(e.message as keyof typeof vi)),
  }
  const createMut = trpc.place.create.useMutation(handlers)
  const updateMut = trpc.place.update.useMutation(handlers)
  const isPending = createMut.isPending || updateMut.isPending
  const trimmed = name.trim()
  const billingChanged = !!place && place.hasData && billing !== place.billing

  const save = () => {
    setError(null)
    // Chỉ gửi billing khi thật sự đổi: tránh ghi lịch sử cách tính khi chỉ sửa tên/màu.
    if (place) updateMut.mutate({ id: place.id, name: trimmed, kind, color, ...(billing !== place.billing && { billing }) })
    else createMut.mutate({ name: trimmed, kind, color, billing })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{place ? t("edit_place") : t("add_place")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="place-name">{t("place_name")}</Label>
            <Input
              id="place-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              className="h-11 md:h-10"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("place_kind")}</p>
            <div role="radiogroup" aria-label={t("place_kind")} className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              {PLACE_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => {
                    setKind(k)
                    // Đổi loại thì gợi ý cách tính theo loại; vẫn chọn lại được bên dưới.
                    setBilling(defaultBilling(k))
                  }}
                  className={cn(
                    "min-h-11 rounded-md px-1 text-xs font-bold md:min-h-9",
                    kind === k ? "bg-white text-primary shadow-sm" : "text-slate-500"
                  )}
                >
                  {t(`place_kind_${k}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("place_billing")}</p>
            <div role="radiogroup" aria-label={t("place_billing")} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BILLINGS.map((b) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={billing === b}
                  onClick={() => setBilling(b)}
                  className={cn(
                    "flex min-h-11 items-center justify-center rounded-md border px-2 text-sm font-medium",
                    billing === b ? "border-primary bg-primary/5 text-primary" : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  {t(`place_billing_${b}`)}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              {t(billing === "per_student" ? "place_per_student_hint" : "place_per_session_hint")}
            </p>
            {billingChanged && (
              <p data-testid="place-billing-from" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t("place_billing_from_month").replace("{m}", String(month)).replace("{y}", String(year))}
              </p>
            )}
          </div>

          {billing === "per_session" && (
            <div className="space-y-2" data-testid="place-rate">
              <p className="text-sm font-medium">{t("place_rate")}</p>
              <div role="radiogroup" aria-label={t("place_rate")} className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                {RATE_UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={rateUnit === u}
                    onClick={() => setRateUnit(u)}
                    className={cn("min-h-11 rounded-md text-xs font-bold md:min-h-9", rateUnit === u ? "bg-white text-primary shadow-sm" : "text-slate-500")}
                  >
                    {t(u === "session" ? "place_rate_session" : "place_rate_hour")}
                  </button>
                ))}
              </div>
              <Label htmlFor="place-rate-amount" className="sr-only">
                {t(rateUnit === "session" ? "place_rate_amount_session" : "place_rate_amount_hour")}
              </Label>
              <CurrencyInput
                id="place-rate-amount"
                inputMode="numeric"
                value={rateAmount}
                onChange={setRateAmount}
                placeholder={t(rateUnit === "session" ? "place_rate_amount_session" : "place_rate_amount_hour")}
                className="h-11 md:h-10"
              />
              <p className="text-xs text-slate-500">{t("place_rate_hint")}</p>
              {place?.hasSessions && (
                <div className="space-y-1">
                  <Label htmlFor="place-rate-from" className="text-xs font-medium text-slate-600">
                    {t("place_rate_from")}
                  </Label>
                  <select
                    id="place-rate-from"
                    value={rateFrom}
                    onChange={(e) => setRateFrom(e.target.value)}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm md:h-10"
                  >
                    {rateMonths(year, month).map((m) => (
                      <option key={m} value={m}>
                        {`${t("month_abbr")}${Number(m.slice(5))}/${m.slice(0, 4)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("place_color")}</p>
            <div className="grid grid-cols-5 gap-3">
              {SUBJECT_COLORS.map((c) => {
                const selected = color.toUpperCase() === c
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={selected}
                    onClick={() => setColor(c)}
                    className={cn("flex size-11 items-center justify-center rounded-full", selected && "ring-2 ring-slate-900 ring-offset-2")}
                    style={{ backgroundColor: c }}
                  >
                    {selected && <Check className="size-5 text-white" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 md:h-10">
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={!trimmed || isPending} className="h-11 md:h-10">
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
