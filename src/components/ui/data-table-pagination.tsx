"use client"

import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "@/components/providers/LanguageProvider"

interface DataTablePaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  totalItems: number
  className?: string
}

export function DataTablePagination({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalItems,
  className,
}: DataTablePaginationProps) {
  const { t } = useTranslation()
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 md:left-60 z-30 flex items-center justify-between px-4 md:px-6 py-1.5 md:py-2 bg-white/95 backdrop-blur-sm border-t border-slate-200 gap-4 md:gap-12",
      className
    )}>
      <div className="text-xs md:text-sm text-slate-500 font-medium truncate">
        {totalItems > 0 ? (
          <>
            <span className="hidden sm:inline">{t("showing_prefix")} </span>
            <span className="text-slate-900 font-bold">{startItem}-{endItem}</span>
            <span className="hidden sm:inline"> {t("showing_of")}</span>
            <span className="sm:hidden">/</span>
            <span className="text-slate-900 font-bold"> {totalItems}</span>
            <span className="hidden sm:inline"> {t("records_suffix")}</span>
          </>
        ) : (
          t("no_records")
        )}
      </div>

      <div className="flex items-center gap-4 md:gap-8">
        <div className="hidden sm:flex items-center space-x-2">
          <p className="text-sm font-medium text-slate-600">{t("rows_per_page")}</p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              onPageSizeChange(Number(value))
            }}
          >
            <SelectTrigger className="h-8 w-[70px] bg-slate-50 border-slate-200">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top" className="bg-white border-slate-200">
              {[5, 10, 20, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2">
            <div className="flex items-center justify-center text-xs md:text-sm font-medium text-slate-600 min-w-[60px] md:min-w-[100px]">
                {t("page")} {currentPage}<span className="hidden md:inline"> / {totalPages || 1}</span>
            </div>
            <div className="flex items-center space-x-1">
            <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex border-slate-200"
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1 || totalPages === 0}
            >
                <span className="sr-only">{t("first_page")}</span>
                <ChevronsLeft className="h-4 w-4 text-slate-600" />
            </Button>
            <Button
                variant="outline"
                className="h-8 w-8 p-0 border-slate-200"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1 || totalPages === 0}
            >
                <span className="sr-only">{t("prev_page")}</span>
                <ChevronLeft className="h-4 w-4 text-slate-600" />
            </Button>
            <Button
                variant="outline"
                className="h-8 w-8 p-0 border-slate-200"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
            >
                <span className="sr-only">{t("next_page")}</span>
                <ChevronRight className="h-4 w-4 text-slate-600" />
            </Button>
            <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex border-slate-200"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
            >
                <span className="sr-only">{t("last_page")}</span>
                <ChevronsRight className="h-4 w-4 text-slate-600" />
            </Button>
            </div>
        </div>
      </div>
    </div>
  )
}
