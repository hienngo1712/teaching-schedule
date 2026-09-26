"use client"

import { CalendarIcon, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCalendar } from "@/hooks/useCalendar"
import { useFilters } from "@/hooks/useFilters"
import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

export function ReportPeriodPicker() {
  const { t } = useTranslation()
  const { year, month } = useCalendar()
  const {
    toYear,
    toMonth,
    filterType,
    setRange
  } = useFilters()

  const label = useMemo(() => {
    if (filterType === 'month') return `${t("month")} ${month}/${year}`
    if (filterType === 'year') return `${t("year")} ${year}`
    if (filterType === 'range') {
        const start = `${t("from_month")} ${month}/${year}`
        const end = `${t("to_month")} ${toMonth || month}/${toYear || year}`
        return `${start} - ${end}`
    }
    return t("select_report_period")
  }, [filterType, year, month, toYear, toMonth, t])

  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
  const YEARS = Array.from({ length: 7 }, (_, i) => 2024 + i)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between min-w-[200px] h-10 px-4 bg-white border-slate-200 hover:bg-slate-50">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-primary" />
            <span className="font-semibold text-slate-700">{label}</span>
          </div>
          <ChevronDown className="size-4 text-slate-400 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-4 bg-white shadow-xl border-slate-200" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("report_type")}</label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                    onClick={() => setRange({ type: 'month' })}
                    className={cn(
                        "text-xs py-1.5 rounded-md transition-all font-bold",
                        filterType === 'month' ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                    )}
                >{t("month")}</button>
                <button
                    onClick={() => setRange({ type: 'year' })}
                    className={cn(
                        "text-xs py-1.5 rounded-md transition-all font-bold",
                        filterType === 'year' ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                    )}
                >{t("year")}</button>
                <button
                    onClick={() => setRange({ type: 'range' })}
                    className={cn(
                        "text-xs py-1.5 rounded-md transition-all font-bold",
                        filterType === 'range' ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"
                    )}
                >{t("range")}</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {filterType === 'range' ? t("from_month") : t("month")}
                </label>
                <Select
                    disabled={filterType === 'year'}
                    value={month.toString()}
                    onValueChange={(v) => setRange({ month: parseInt(v) })}
                >
                    <SelectTrigger className="h-9 border-slate-200">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                        {MONTHS.map(m => (
                            <SelectItem key={m} value={m.toString()}>{t("month")} {m}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("year")}</label>
                <Select
                    value={year.toString()}
                    onValueChange={(v) => setRange({ year: parseInt(v) })}
                >
                    <SelectTrigger className="h-9 border-slate-200">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                        {YEARS.map(y => (
                            <SelectItem key={y} value={y.toString()}>{t("year")} {y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </div>
          </div>

          {filterType === 'range' && (
             <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("to_month")}</label>
                    <Select
                        value={(toMonth || month).toString()}
                        onValueChange={(v) => setRange({ toMonth: parseInt(v) })}
                    >
                        <SelectTrigger className="h-9 border-slate-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200">
                            {MONTHS.map(m => (
                                <SelectItem key={m} value={m.toString()}>{t("month")} {m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("year")}</label>
                    <Select
                        value={(toYear || year).toString()}
                        onValueChange={(v) => setRange({ toYear: parseInt(v) })}
                    >
                        <SelectTrigger className="h-9 border-slate-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200">
                            {YEARS.map(y => (
                                <SelectItem key={y} value={y.toString()}>{t("year")} {y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
             </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
