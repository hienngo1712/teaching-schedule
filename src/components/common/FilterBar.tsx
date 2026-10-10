"use client"

import { useState, type ReactNode } from "react"
import { MoreHorizontal, Search, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useMediaQuery } from "@/hooks/useMediaQuery"

export type FilterChip = { key: string; label: string; onRemove: () => void }
export type MoreAction = {
  key: string
  label: string
  icon?: ReactNode
  onSelect: () => void
  locked?: ReactNode
  disabled?: boolean
}

type Props = {
  search?: { value: string; onChange: (value: string) => void; placeholder: string }
  primaryFilter?: ReactNode
  filters?: ReactNode
  activeChips?: FilterChip[]
  onClearAll?: () => void
  period?: ReactNode
  actions?: ReactNode
  moreActions?: MoreAction[]
  activeCount?: number
}

export function FilterBar(props: Props) {
  const { primaryFilter, activeChips, onClearAll, period, moreActions } = props
  // Chỗ chưa chuyển (không truyền prop AK nào) giữ nguyên bố cục cũ.
  const compact = primaryFilter !== undefined || activeChips !== undefined || onClearAll !== undefined
    || period !== undefined || moreActions !== undefined
  return compact ? <CompactFilterBar {...props} /> : <LegacyFilterBar {...props} />
}

function SearchBox({ search, className }: { search: NonNullable<Props["search"]>; className: string }) {
  return (
    <div className={className}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={search.value}
        onChange={(e) => search.onChange(e.target.value)}
        placeholder={search.placeholder}
        className="h-11 bg-white pl-9 md:h-10"
      />
    </div>
  )
}

function LegacyFilterBar({ search, filters, activeCount = 0, actions }: Props) {
  const { t } = useTranslation()

  return (
    // 1 khung như thanh Lịch dạy: ô tìm co lại để lọc + nút hành động vừa 1 hàng trên desktop (mobile nút xuống hàng riêng).
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 md:p-4">
      {search && <SearchBox search={search} className="relative flex-1 md:min-w-44 md:max-w-72" />}

      {filters && (
        <>
          <div className="hidden shrink-0 items-center gap-2 md:flex">{filters}</div>

          {/* SheetContent chỉ mount khi mở nên `filters` không bị render 2 lần cùng lúc */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-11 md:hidden">
                <SlidersHorizontal className="mr-2 size-4" />
                {t("filter")}
                {activeCount > 0 && ` (${activeCount})`}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-lg">
              <SheetHeader>
                <SheetTitle>{t("filter")}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-3 [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:w-full">
                {filters}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
      {actions && (
        <div className="flex w-full flex-wrap items-center justify-end gap-2 md:ml-auto md:w-auto md:shrink-0 md:flex-nowrap">{actions}</div>
      )}
    </div>
  )
}

function CompactFilterBar({
  search, primaryFilter, filters, activeChips, onClearAll, period, actions, moreActions, activeCount = 0,
}: Props) {
  const { t } = useTranslation()
  // Chỉ mount popover HOẶC sheet theo khổ màn → `filters` không bao giờ render 2 lần.
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const [sheetOpen, setSheetOpen] = useState(false)
  const n = activeChips ? activeChips.length : activeCount
  const clearAll = n > 0 && onClearAll && (
    <Button variant="ghost" className="h-11 px-3 text-primary md:h-9" onClick={onClearAll}>
      {t("filter_clear_all")}
    </Button>
  )

  const trigger = (
    <Button
      variant="outline"
      className={n > 0 ? "h-11 shrink-0 border-primary bg-primary/5 text-primary md:h-10" : "h-11 shrink-0 md:h-10"}
    >
      <SlidersHorizontal className="mr-2 size-4" />
      {t("filter")}
      {n > 0 && ` (${n})`}
    </Button>
  )

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 md:p-4">
      {search && <SearchBox search={search} className="relative min-w-0 flex-1 md:max-w-72" />}
      {/* Điện thoại: hàng 1 = tìm + Bộ lọc, hàng 2 = ô ngoài (co giãn) + kỳ/⋯. Laptop: đúng thứ tự DOM. */}
      {primaryFilter && <div className="order-1 min-w-0 flex-1 md:order-none md:flex-none">{primaryFilter}</div>}

      {filters && (isDesktop ? (
        <Popover>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <div className="flex flex-col gap-3 [&_button[role=combobox]]:w-full">{filters}</div>
            {clearAll && <div className="mt-3 flex justify-end border-t pt-2">{clearAll}</div>}
          </PopoverContent>
        </Popover>
      ) : (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-lg">
            <SheetHeader>
              <SheetTitle>{t("filter")}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-3 [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:w-full">
              {filters}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              {clearAll}
              <Button className="h-11" onClick={() => setSheetOpen(false)}>{t("filter_done")}</Button>
            </div>
          </SheetContent>
        </Sheet>
      ))}

      {(period || actions || (moreActions && moreActions.length > 0)) && (
        <div className="order-2 flex min-w-0 items-center gap-2 md:order-none md:ml-auto">
          {period}
          {actions}
          {moreActions && moreActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-11 shrink-0 md:size-10" aria-label={t("more_actions")}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {moreActions.map((a) => (
                  <DropdownMenuItem key={a.key} className="min-h-11 md:min-h-9" disabled={a.disabled} onSelect={a.onSelect}>
                    {a.icon}
                    {a.label}
                    {a.locked}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {activeChips && activeChips.length > 0 && (
        <div className="order-3 flex w-full flex-wrap items-center gap-2 border-t border-slate-100 pt-2 md:order-none">
          {activeChips.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-label={`${t("filter_remove")} ${c.label}`}
              onClick={c.onRemove}
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-slate-100 pl-3 pr-2 text-xs font-medium text-slate-700 hover:bg-slate-200 md:min-h-8"
            >
              {c.label}
              <X className="size-3" aria-hidden />
            </button>
          ))}
          {onClearAll && (
            <Button variant="ghost" className="h-11 px-2 text-xs text-primary md:h-8" onClick={onClearAll}>
              {t("filter_clear_all")}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
