"use client"

import type { ReactNode } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  search?: { value: string; onChange: (value: string) => void; placeholder: string }
  filters?: ReactNode
  activeCount?: number
}

export function FilterBar({ search, filters, activeCount = 0 }: Props) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      {search && (
        <div className="relative flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            className="h-11 bg-white pl-9 md:h-10"
          />
        </div>
      )}

      {filters && (
        <>
          <div className="hidden items-center gap-2 md:flex">{filters}</div>

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
    </div>
  )
}
