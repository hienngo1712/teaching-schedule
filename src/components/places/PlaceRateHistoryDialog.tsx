"use client"

import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { formatCurrency } from "@/lib/utils"

// Lịch sử đơn giá của 1 nơi (spec AM §4.2): mức mới nhất trước.
export function PlaceRateHistoryDialog({ place, onClose }: { place: { id: number; name: string }; onClose: () => void }) {
  const { t } = useTranslation()
  const query = trpc.placeRate.history.useQuery({ placeId: place.id })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("place_rate_history")}</DialogTitle>
          <p className="text-sm text-slate-500">{place.name}</p>
        </DialogHeader>
        {query.isPending ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-slate-400" />
          </div>
        ) : !query.data || query.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{t("place_rate_history_empty")}</p>
        ) : (
          <ul className="divide-y" data-testid="place-rate-history">
            {query.data.map((r) => (
              <li key={r.fromKey} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-slate-600">
                  {r.fromYear === null
                    ? t("place_rate_history_all")
                    : t("place_rate_history_from").replace("{m}", String(r.fromMonth)).replace("{y}", String(r.fromYear))}
                </span>
                <span className="font-medium tabular-nums text-slate-900">
                  {r.amount > 0
                    ? t(r.unit === "hour" ? "income_rate_hour" : "income_rate_session").replace("{amount}", formatCurrency(r.amount))
                    : t("place_rate_history_empty")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
